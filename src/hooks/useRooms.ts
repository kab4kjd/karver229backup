import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import type { RoomTimeSlot } from "@/lib/roomTimePricing";

export type { RoomTimeSlot };

export interface Room {
  id: string;
  name: string;
  price: number;
  groupId?: string;
  sort_order?: number;
  block_minutes?: number;
  timeSlots?: RoomTimeSlot[];
  useTimeSlots?: boolean;
  min_print_minutes?: number;
}

export interface StoredRoomConfig {
  timeSlots: RoomTimeSlot[];
  useTimeSlots: boolean;
  min_print_minutes?: number;
}

const ROOM_SLOTS_STORAGE_KEY = "karaoke_room_time_slots_data";
export const DEFAULT_MIN_PRINT_MINUTES_KEY = "karaoke_default_min_print_minutes";

export const getDefaultMinPrintMinutes = (): number => {
  try {
    const raw = localStorage.getItem(DEFAULT_MIN_PRINT_MINUTES_KEY);
    if (raw !== null && raw !== "") {
      const val = Number(raw);
      return Number.isNaN(val) ? 15 : Math.max(0, val);
    }
  } catch {}
  return 15;
};

export const setDefaultMinPrintMinutes = (minutes: number) => {
  try {
    const safeVal = Math.max(0, Math.round(Number(minutes) || 0));
    localStorage.setItem(DEFAULT_MIN_PRINT_MINUTES_KEY, safeVal.toString());
    window.dispatchEvent(new Event("min_print_minutes_changed"));
  } catch (e) {
    console.error("Failed to save default min print minutes", e);
  }
};

export const getStoredRoomSlotsMap = (): Record<string, StoredRoomConfig> => {
  try {
    const raw = localStorage.getItem(ROOM_SLOTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveStoredRoomSlots = (
  roomIdOrName: string,
  timeSlots: RoomTimeSlot[],
  useTimeSlots: boolean,
  min_print_minutes?: number
) => {
  try {
    const current = getStoredRoomSlotsMap();
    current[roomIdOrName] = {
      timeSlots,
      useTimeSlots,
      min_print_minutes: min_print_minutes !== undefined ? min_print_minutes : current[roomIdOrName]?.min_print_minutes,
    };
    localStorage.setItem(ROOM_SLOTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Failed to save room time slots locally", e);
  }
};

const fetchRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const slotsMap = getStoredRoomSlotsMap();

  return (data || []).map((r) => {
    const localConfig = slotsMap[r.id] || slotsMap[r.name];
    return {
      id: r.id,
      name: r.name,
      price: r.price,
      groupId: r.group_id ?? undefined,
      sort_order: r.sort_order,
      block_minutes: r.block_minutes,
      timeSlots: localConfig?.timeSlots || [],
      useTimeSlots: localConfig ? localConfig.useTimeSlots : false,
      min_print_minutes: localConfig?.min_print_minutes,
    };
  });
};

export const useRooms = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRooms,
    staleTime: 5 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const [defaultMinPrintMinutes, setInternalDefaultMinPrintMinutes] = useState<number>(getDefaultMinPrintMinutes);

  useEffect(() => {
    const handleStorage = () => {
      setInternalDefaultMinPrintMinutes(getDefaultMinPrintMinutes());
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("min_print_minutes_changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("min_print_minutes_changed", handleStorage);
    };
  }, []);

  const updateDefaultMinPrintMinutes = (minutes: number) => {
    const safeVal = Math.max(0, Math.round(Number(minutes) || 0));
    setDefaultMinPrintMinutes(safeVal);
    setInternalDefaultMinPrintMinutes(safeVal);
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  const getEffectiveMinPrintMinutes = (room?: Room | null): number => {
    if (room && room.min_print_minutes !== undefined && !Number.isNaN(Number(room.min_print_minutes))) {
      return Math.max(0, Number(room.min_print_minutes));
    }
    return defaultMinPrintMinutes;
  };

  const addMutation = useMutation({
    mutationFn: async ({
      name,
      price,
      block_minutes,
      timeSlots,
      useTimeSlots,
      min_print_minutes,
    }: {
      name: string;
      price: number;
      block_minutes?: number;
      timeSlots?: RoomTimeSlot[];
      useTimeSlots?: boolean;
      min_print_minutes?: number;
    }) => {
      const maxOrder = rooms.length > 0 ? Math.max(...rooms.map((r) => r.sort_order ?? 0)) + 1 : 0;
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name, price, sort_order: maxOrder, block_minutes: block_minutes ?? 5 })
        .select()
        .single();
      if (error) throw error;

      if (data) {
        saveStoredRoomSlots(data.id, timeSlots || [], !!useTimeSlots, min_print_minutes);
        saveStoredRoomSlots(data.name, timeSlots || [], !!useTimeSlots, min_print_minutes);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      price,
      groupId,
      block_minutes,
      timeSlots,
      useTimeSlots,
      min_print_minutes,
    }: {
      id: string;
      name: string;
      price: number;
      groupId?: string;
      block_minutes?: number;
      timeSlots?: RoomTimeSlot[];
      useTimeSlots?: boolean;
      min_print_minutes?: number;
    }) => {
      const { error } = await supabase
        .from("rooms")
        .update({ name, price, group_id: groupId ?? null, block_minutes: block_minutes ?? 5 })
        .eq("id", id);
      if (error) throw error;

      saveStoredRoomSlots(id, timeSlots || [], !!useTimeSlots, min_print_minutes);
      saveStoredRoomSlots(name, timeSlots || [], !!useTimeSlots, min_print_minutes);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
      try {
        const slotsMap = getStoredRoomSlotsMap();
        delete slotsMap[id];
        localStorage.setItem(ROOM_SLOTS_STORAGE_KEY, JSON.stringify(slotsMap));
      } catch {}
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedRooms: Room[]) => {
      const updates = reorderedRooms.map((room, index) =>
        supabase.from("rooms").update({ sort_order: index }).eq("id", room.id)
      );
      await Promise.all(updates);
    },
    onMutate: async (reorderedRooms: Room[]) => {
      await queryClient.cancelQueries({ queryKey: ["rooms"] });
      queryClient.setQueryData(["rooms"], reorderedRooms);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const addRoom = (
    name: string,
    price: number,
    block_minutes?: number,
    timeSlots?: RoomTimeSlot[],
    useTimeSlots?: boolean,
    min_print_minutes?: number
  ) => addMutation.mutate({ name, price, block_minutes, timeSlots, useTimeSlots, min_print_minutes });

  const updateRoom = (
    id: string,
    name: string,
    price: number,
    groupId?: string,
    block_minutes?: number,
    timeSlots?: RoomTimeSlot[],
    useTimeSlots?: boolean,
    min_print_minutes?: number
  ) => updateMutation.mutate({ id, name, price, groupId, block_minutes, timeSlots, useTimeSlots, min_print_minutes });

  const deleteRoom = (id: string) => deleteMutation.mutate(id);
  const reorderRooms = (reorderedRooms: Room[]) => reorderMutation.mutate(reorderedRooms);
  const getRoomByName = (name: string): Room | undefined => rooms.find((room) => room.name === name);

  return {
    rooms,
    isLoading,
    addRoom,
    updateRoom,
    deleteRoom,
    reorderRooms,
    getRoomByName,
    defaultMinPrintMinutes,
    updateDefaultMinPrintMinutes,
    getEffectiveMinPrintMinutes,
  };
};
