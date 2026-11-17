import { useState, useCallback, useEffect, useRef } from "react";
import type { InvoiceItem } from "@/pages/Index";
import { calculateRoomTimeCharges } from "@/lib/roomTimePricing";
import { db, auth } from "@/integrations/firebase/config";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getActiveDatabaseConfig } from "@/integrations/supabase/databaseConfig";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = (err as any)?.code || "";
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "permission-denied" ||
    msg.toLowerCase().includes("missing or insufficient permissions") ||
    msg.toLowerCase().includes("permission-denied")
  );
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY = "karaoke_room_sessions";
const ACTIVE_ROOM_KEY = "karaoke_active_room";
const COLLECTION_NAME = "room_sessions";

export interface RoomSession {
  roomName: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
  checkInDate: string;
  checkOutDate: string;
  items: InvoiceItem[];
  discountType: "percentage" | "fixed";
  discountValue: number;
  taxRate: number;
  isRealTime?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

function getRoomDocId(roomName: string): string {
  const bytes = new TextEncoder().encode(roomName.trim());
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `room_${hex}`;
}

function cleanPayload(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

const loadFromStorage = (): { sessions: Record<string, RoomSession>; activeRoom: string | null } => {
  try {
    const sessionsData = localStorage.getItem(STORAGE_KEY);
    const activeRoomData = localStorage.getItem(ACTIVE_ROOM_KEY);
    return {
      sessions: sessionsData ? JSON.parse(sessionsData) : {},
      activeRoom: activeRoomData ? JSON.parse(activeRoomData) : null,
    };
  } catch {
    return { sessions: {}, activeRoom: null };
  }
};

export interface UseRoomSessionsOptions {
  enabled?: boolean;
  updatedBy?: string;
  onRemoteActiveRoomClosed?: (roomName: string, closedBy?: string) => void;
}

export const useRoomSessions = (options?: UseRoomSessionsOptions) => {
  const enabled = options?.enabled ?? true;
  const updatedBy = options?.updatedBy || "";
  const onRemoteClosedRef = useRef(options?.onRemoteActiveRoomClosed);
  onRemoteClosedRef.current = options?.onRemoteActiveRoomClosed;

  const [roomSessions, setRoomSessions] = useState<Record<string, RoomSession>>(() => loadFromStorage().sessions);
  const [activeRoom, setActiveRoom] = useState<string | null>(() => loadFromStorage().activeRoom);
  const [lastRemoteUpdateTick, setLastRemoteUpdateTick] = useState(0);

  const activeRoomRef = useRef<string | null>(activeRoom);
  activeRoomRef.current = activeRoom;
  const roomSessionsRef = useRef<Record<string, RoomSession>>(roomSessions);
  roomSessionsRef.current = roomSessions;
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const localDeletedRoomsRef = useRef<Set<string>>(new Set());
  const clientInstanceIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roomSessions));
    } catch {
      // Ignore storage quota errors
    }
  }, [roomSessions]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(activeRoom));
    } catch {
      // Ignore storage quota errors
    }
  }, [activeRoom]);

  const persistSessionToFirestore = useCallback(async (session: RoomSession) => {
    if (!db || getActiveDatabaseConfig().mode === "cloud") return;
    if (!session?.roomName) return;
    const docId = getRoomDocId(session.roomName);
    try {
      await setDoc(
        doc(db, COLLECTION_NAME, docId),
        cleanPayload({
          ...session,
          id: docId,
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy || session.updatedBy || "",
          lastClientId: clientInstanceIdRef.current,
        }),
        { merge: true }
      );
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${docId}`);
      }
      console.warn("[RoomSession Sync Warning] Không thể đồng bộ phiên phòng lên Firestore:", err);
    }
  }, [updatedBy]);

  const deleteSessionFromFirestore = useCallback(async (roomName: string) => {
    if (!db || getActiveDatabaseConfig().mode === "cloud") return;
    if (!roomName) return;
    const docId = getRoomDocId(roomName);
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, docId));
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, `${COLLECTION_NAME}/${docId}`);
      }
      console.warn("[RoomSession Delete Warning] Không thể xóa phiên phòng trên Firestore:", err);
    }
  }, []);

  // Subscribe to Firestore room_sessions in real time across accounts/devices
  useEffect(() => {
    if (!enabled || !db || getActiveDatabaseConfig().mode === "cloud") return;

    const unsub = onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        const nextSessions: Record<string, RoomSession> = {};
        let hasExternalChange = false;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data || !data.roomName) return;
          const isFromSelf = data.lastClientId === clientInstanceIdRef.current;
          if (!isFromSelf) hasExternalChange = true;
          nextSessions[data.roomName] = {
            roomName: data.roomName,
            roomPrice: Number(data.roomPrice || 0),
            checkIn: data.checkIn || "",
            checkOut: data.checkOut || "",
            checkInDate: data.checkInDate || "",
            checkOutDate: data.checkOutDate || "",
            items: Array.isArray(data.items) ? data.items : [],
            discountType: data.discountType === "fixed" ? "fixed" : "percentage",
            discountValue: Number(data.discountValue || 0),
            taxRate: Number(data.taxRate || 0),
            isRealTime: data.isRealTime !== false,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          };
        });

        // Detect if activeRoom was closed/cleared remotely by another account
        const currentActive = activeRoomRef.current;
        const hadActiveBefore = currentActive ? !!roomSessionsRef.current[currentActive] : false;
        const stillExistsOnServer = currentActive ? !!nextSessions[currentActive] : false;

        // Also check if another room changed remotely
        if (currentActive && stillExistsOnServer && hasExternalChange) {
          setLastRemoteUpdateTick((t) => t + 1);
        }

        setRoomSessions(nextSessions);

        if (currentActive && hadActiveBefore && !stillExistsOnServer) {
          const closedLocally = localDeletedRoomsRef.current.has(currentActive);
          localDeletedRoomsRef.current.delete(currentActive);
          if (!closedLocally) {
            setActiveRoom(null);
            onRemoteClosedRef.current?.(currentActive);
          }
        }
      },
      (err) => {
        if (isPermissionDeniedError(err)) {
          handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
        }
        console.warn("[RoomSession Realtime Warning] Lỗi lắng nghe phòng đang hát:", err);
      }
    );

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === "object") {
            setRoomSessions(parsed);
            setLastRemoteUpdateTick((t) => t + 1);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
      Object.values(debounceTimersRef.current).forEach((t) => clearTimeout(t));
      debounceTimersRef.current = {};
    };
  }, [enabled]);

  const openRoom = useCallback((roomName: string, roomPrice: number) => {
    setActiveRoom(roomName);
    localDeletedRoomsRef.current.delete(roomName);

    const now = new Date();
    const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // If room doesn't have a session yet, create one with current time as check-in
    setRoomSessions(prev => {
      if (!prev[roomName]) {
        const newSession: RoomSession = {
          roomName,
          roomPrice,
          checkIn: currentTime,
          checkOut: currentTime,
          checkInDate: currentDate,
          checkOutDate: currentDate,
          items: [],
          discountType: "percentage",
          discountValue: 0,
          taxRate: 0,
          isRealTime: true,
          updatedAt: new Date().toISOString(),
          updatedBy,
        };
        persistSessionToFirestore(newSession);
        return {
          ...prev,
          [roomName]: newSession,
        };
      }
      return prev;
    });
  }, [persistSessionToFirestore, updatedBy]);

  const updateRoomSession = useCallback((roomName: string, updates: Partial<RoomSession>) => {
    setRoomSessions(prev => {
      const existing = prev[roomName];
      if (!existing) return prev;
      const merged: RoomSession = {
        ...existing,
        ...updates,
        roomName,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || existing.updatedBy,
      };

      // Skip Firestore write if nothing meaningful changed compared to existing
      const changed =
        existing.checkIn !== merged.checkIn ||
        existing.checkOut !== merged.checkOut ||
        existing.checkInDate !== merged.checkInDate ||
        existing.checkOutDate !== merged.checkOutDate ||
        existing.discountType !== merged.discountType ||
        existing.discountValue !== merged.discountValue ||
        existing.taxRate !== merged.taxRate ||
        existing.isRealTime !== merged.isRealTime ||
        JSON.stringify(existing.items) !== JSON.stringify(merged.items);

      if (changed) {
        if (debounceTimersRef.current[roomName]) {
          clearTimeout(debounceTimersRef.current[roomName]);
        }
        debounceTimersRef.current[roomName] = setTimeout(() => {
          delete debounceTimersRef.current[roomName];
          persistSessionToFirestore(merged);
        }, 350);
      }

      return {
        ...prev,
        [roomName]: merged,
      };
    });
  }, [persistSessionToFirestore, updatedBy]);

  const clearRoomSession = useCallback((roomName: string) => {
    if (debounceTimersRef.current[roomName]) {
      clearTimeout(debounceTimersRef.current[roomName]);
      delete debounceTimersRef.current[roomName];
    }
    localDeletedRoomsRef.current.add(roomName);
    setRoomSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[roomName];
      return newSessions;
    });
    if (activeRoom === roomName) {
      setActiveRoom(null);
    }
    deleteSessionFromFirestore(roomName);
  }, [activeRoom, deleteSessionFromFirestore]);

  const closeRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const getCurrentSession = useCallback(() => {
    if (!activeRoom) return null;
    return roomSessions[activeRoom] || null;
  }, [activeRoom, roomSessions]);

  const hasItems = useCallback((roomName: string) => {
    const session = roomSessions[roomName];
    return session && session.items.length > 0;
  }, [roomSessions]);

  const getRoomTotal = useCallback((roomName: string) => {
    const session = roomSessions[roomName];
    if (!session) return 0;

    let roomCharge = 0;
    if (session.checkIn && session.checkInDate) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const nowTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const isLive = session.isRealTime !== false;
      const checkOutDate = isLive ? todayStr : (session.checkOutDate || todayStr);
      const checkOut = isLive ? nowTimeStr : (session.checkOut || nowTimeStr);

      const calc = calculateRoomTimeCharges({
        checkInDate: session.checkInDate,
        checkIn: session.checkIn,
        checkOutDate,
        checkOut,
        defaultPrice: session.roomPrice,
        blockMinutes: 5,
      });
      roomCharge = Math.round(calc.totalAmount);
    }

    const itemsTotal = (session.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0);
    const subtotal = roomCharge + itemsTotal;

    // Apply discount
    let discount = 0;
    if (session.discountType === "percentage") {
      discount = Math.round(subtotal * (session.discountValue || 0) / 100);
    } else {
      discount = session.discountValue || 0;
    }

    const afterDiscount = Math.max(0, subtotal - discount);

    // Apply tax
    const tax = Math.round(afterDiscount * (session.taxRate || 0) / 100);

    return afterDiscount + tax;
  }, [roomSessions]);

  return {
    roomSessions,
    activeRoom,
    lastRemoteUpdateTick,
    openRoom,
    updateRoomSession,
    clearRoomSession,
    closeRoom,
    getCurrentSession,
    hasItems,
    getRoomTotal,
  };
};
