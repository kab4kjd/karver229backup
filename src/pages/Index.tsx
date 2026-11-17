import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { LogOut, Loader2, AlertTriangle } from "lucide-react";
import { useInvoices, checkDuplicateInvoice } from "@/hooks/useInvoices";
import type { DuplicateInvoiceInfo } from "@/integrations/supabase/localDatabase";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useRoomSessions } from "@/hooks/useRoomSessions";
import { useRooms } from "@/hooks/useRooms";
import { useRoomGroups } from "@/hooks/useRoomGroups";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useLayoutPreference } from "@/hooks/useLayoutPreference";
import { useThemeConfig } from "@/hooks/useThemeConfig";
import { useCardLayout } from "@/hooks/useCardLayout";
import { useIdleLock } from "@/hooks/useIdleLock";
import { useCustomers } from "@/hooks/useCustomers";
import { normalizeVi } from "@/lib/normalize";
import { calculateRoomTimeCharges, type RoomTimeCalculationResult } from "@/lib/roomTimePricing";

const InvoiceFormPanel = lazy(() => import("@/components/karaoke/InvoiceFormPanel"));
const InvoiceDisplay = lazy(() => import("@/components/karaoke/InvoiceDisplay"));
const LockScreen = lazy(() => import("@/components/karaoke/LockScreen"));
const InvoiceHistory = lazy(() => import("@/components/karaoke/InvoiceHistory"));
const ConfigurationTab = lazy(() => import("@/components/karaoke/ConfigurationTab"));
const ReportsTab = lazy(() => import("@/components/karaoke/ReportsTab"));
const InventoryCheckTab = lazy(() => import("@/components/karaoke/InventoryCheckTab"));
const ActivityLogsTab = lazy(() => import("@/components/karaoke/ActivityLogsTab").then(m => ({ default: m.ActivityLogsTab })));
const ExpensesTab = lazy(() => import("@/components/karaoke/ExpensesTab"));
const CustomersTab = lazy(() => import("@/components/karaoke/CustomersTab"));

import type { ItemCategories } from "@/components/karaoke/ConfigurationTab";

export interface InvoiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface Invoice {
  id: string;
  roomName: string;
  roomPrice: number;
  checkIn: string;
  checkOut: string;
  checkInRaw?: string;
  checkOutRaw?: string;
  duration: number;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: "percentage" | "fixed";
  tax: number;
  total: number;
  date: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, role, permissions, permissionsVerified, displayName, username, loading, signOut, isAdmin, isStaff } = useAuth();
  const [activeTab, setActiveTab] = useState("invoice");
  const [logsTabVisited, setLogsTabVisited] = useState(false);

  const canLoadInvoices =
    permissionsVerified &&
    (permissions.can_view_invoice ||
      permissions.can_view_history ||
      permissions.can_view_reports ||
      permissions.can_view_inventory ||
      permissions.can_view_expenses ||
      permissions.can_view_customers);
  const canLoadCategories =
    permissionsVerified &&
    (permissions.can_view_invoice ||
      permissions.can_view_inventory ||
      permissions.can_view_config);
  const canLoadRooms =
    permissionsVerified &&
    (permissions.can_view_invoice || permissions.can_view_config);
  const canLoadCustomers =
    permissionsVerified &&
    (permissions.can_view_invoice || permissions.can_view_customers);

  const { invoices: dbInvoices, saveInvoice, updateInvoice, payDebt } = useInvoices({ enabled: canLoadInvoices });
  const { addLog } = useActivityLogs({ enabled: logsTabVisited && permissionsVerified && permissions.can_view_logs });
  const { leftWidth, saveLeftWidth, appTitle, saveAppTitle, appSubtitle, saveAppSubtitle } = useLayoutPreference();
  const { themeConfig } = useThemeConfig();
  const { config: cardLayout, updateOrder, updateHeight } = useCardLayout();
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoicePrintedAt, setEditingInvoicePrintedAt] = useState<string | null>(null);
  const [editingOriginalData, setEditingOriginalData] = useState<Record<string, unknown> | null>(null);
  const [isReadOnlyEdit, setIsReadOnlyEdit] = useState(false);
  const editingInvoiceIdRef = useRef<string | null>(null);
  editingInvoiceIdRef.current = editingInvoiceId;
  const isApplyingRemoteSessionRef = useRef(false);
  const { categories: dbCategories, items: dbItems, isLoading: categoriesLoading } = useCategories({ enabled: canLoadCategories });
  const handleRemoteActiveRoomClosed = useCallback((closedRoomName: string) => {
    if (editingInvoiceIdRef.current) return;
    const resetDate = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    setSelectedRoom("");
    setRoomPrice(0);
    setCheckIn("");
    setCheckOut("");
    setCheckInDate(resetDate);
    setCheckOutDate(resetDate);
    setDuration(0);
    setItems([]);
    setDiscountType("percentage");
    setDiscountValue(0);
    setIsRealTime(true);
    toast({
      title: "Phòng đã được chốt / đóng",
      description: `Phòng ${closedRoomName} vừa được tài khoản khác in hóa đơn hoặc đóng phòng.`,
    });
  }, []);

  const { 
    roomSessions,
    activeRoom, 
    lastRemoteUpdateTick,
    openRoom, 
    updateRoomSession, 
    clearRoomSession, 
    closeRoom, 
    getCurrentSession,
    hasItems: roomHasItems,
    getRoomTotal,
  } = useRoomSessions({
    enabled: permissionsVerified && permissions.can_view_invoice,
    updatedBy: displayName || username || "",
    onRemoteActiveRoomClosed: handleRemoteActiveRoomClosed,
  });
  const {
    rooms,
    addRoom,
    updateRoom,
    deleteRoom,
    reorderRooms,
    getRoomByName,
    defaultMinPrintMinutes,
    updateDefaultMinPrintMinutes,
    getEffectiveMinPrintMinutes,
  } = useRooms({ enabled: canLoadRooms });
  const { roomGroups, priceListItems } = useRoomGroups({ enabled: canLoadRooms });
  
  const [selectedRoom, setSelectedRoom] = useState("");
  const [roomPrice, setRoomPrice] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [isRealTime, setIsRealTime] = useState(true);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkOutDate, setCheckOutDate] = useState(todayStr);
  const [duration, setDuration] = useState(0);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  // Convert database categories/items to ItemCategories format, applying group price overrides
  const itemCategories = useMemo<ItemCategories>(() => {
    // Find current room's group
    const currentRoom = rooms.find(r => r.name === selectedRoom);
    const groupId = currentRoom?.groupId;
    const priceMap: Record<string, number> = {};
    if (groupId) {
      priceListItems
        .filter(p => p.room_group_id === groupId)
        .forEach(p => { priceMap[p.item_id] = p.custom_price; });
    }

    const result: ItemCategories = {};
    dbCategories.forEach(cat => {
      const categoryItems = dbItems
        .filter(item => item.category_id === cat.id)
        .map(item => ({
          name: item.name,
          price: priceMap[item.id] !== undefined ? priceMap[item.id] : item.price,
          customQuantity: !!item.custom_quantity,
        }));
      if (categoryItems.length > 0) {
        result[cat.name] = categoryItems;
      }
    });
    return result;
  }, [dbCategories, dbItems, selectedRoom, rooms, priceListItems]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const visibleTabs = useMemo(() => {
    const tabs: { value: string; label: string }[] = [];
    if (permissions.can_view_invoice) tabs.push({ value: "invoice", label: "Hóa đơn" });
    if (permissions.can_view_history) tabs.push({ value: "history", label: "Lịch sử" });
    if (permissions.can_view_reports) tabs.push({ value: "reports", label: "Báo cáo" });
    if (permissions.can_view_customers) tabs.push({ value: "customers", label: "Khách hàng" });
    if (permissions.can_view_inventory) tabs.push({ value: "inventory", label: "Kiểm kho" });
    if (permissions.can_view_logs) tabs.push({ value: "logs", label: "Log" });
    if (permissions.can_view_expenses) tabs.push({ value: "expenses", label: "Chi phí" });
    if (permissions.can_view_config) tabs.push({ value: "config", label: "Cấu hình" });
    return tabs;
  }, [permissions]);

  useEffect(() => {
    if (loading || (user && !permissionsVerified)) return;
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.value === activeTab)) {
      const firstTab = visibleTabs[0].value;
      if (firstTab === "logs") setLogsTabVisited(true);
      setActiveTab(firstTab);
    }
  }, [loading, user, permissionsVerified, visibleTabs, activeTab]);

  // activeTab is now initialized above with hooks
  const handleTabChange = useCallback((tab: string) => {
    if (tab === "logs") setLogsTabVisited(true);
    setActiveTab(tab);
  }, []);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "debt">("paid");
  const [partialAmount, setPartialAmount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const { customers, addCustomer } = useCustomers({ enabled: canLoadCustomers });
  const ensureCustomer = useCallback(async (name?: string) => {
    const n = (name || "").trim();
    if (!n) return;
    const key = normalizeVi(n);
    if (customers.some((c) => normalizeVi(c.name) === key)) return;
    try {
      await addCustomer.mutateAsync({ name: n });
    } catch {
      /* bỏ qua lỗi thêm khách hàng tự động */
    }
  }, [customers, addCustomer]);
  const [showDurationWarning, setShowDurationWarning] = useState(false);
  const [duplicateWarningInvoice, setDuplicateWarningInvoice] = useState<DuplicateInvoiceInfo | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Sync current form state to room session
  const syncToRoomSession = useCallback(() => {
    if (activeRoom) {
      updateRoomSession(activeRoom, {
        checkIn,
        checkOut,
        checkInDate,
        checkOutDate,
        items,
        discountType,
        discountValue,
        taxRate,
        isRealTime,
      });
    }
  }, [activeRoom, checkIn, checkOut, checkInDate, checkOutDate, items, discountType, discountValue, taxRate, isRealTime, updateRoomSession]);

  // Sync whenever items change - but skip when applying remote updates or editing a history invoice
  useEffect(() => {
    if (isApplyingRemoteSessionRef.current) return;
    if (activeRoom && !editingInvoiceId) {
      syncToRoomSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, checkIn, checkOut, checkInDate, checkOutDate, discountType, discountValue, taxRate, isRealTime, editingInvoiceId]);

  // Load session when room is opened
  const handleOpenRoom = useCallback((roomName: string, roomPriceVal: number) => {
    // Save current room session first
    syncToRoomSession();
    
    setIsRealTime(true);
    openRoom(roomName, roomPriceVal);
    setSelectedRoom(roomName);
    setRoomPrice(roomPriceVal);
    
    // Load room session data will happen in next effect
  }, [openRoom, syncToRoomSession]);

  // Close room without printing
  const handleCloseRoom = useCallback((roomName: string) => {
    clearRoomSession(roomName);
    const resetDate = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    if (roomName === selectedRoom) {
      setSelectedRoom("");
      setRoomPrice(0);
      setCheckIn("");
      setCheckOut("");
      setCheckInDate(resetDate);
      setCheckOutDate(resetDate);
      setDuration(0);
      setItems([]);
      setDiscountType("percentage");
      setDiscountValue(0);
      setIsRealTime(true);
    }
    toast({
      title: "Đã đóng phòng",
      description: `Phòng ${roomName} đã được đóng`,
    });
  }, [clearRoomSession, selectedRoom]);

  const handleCheckOutChange = useCallback((time: string) => {
    setIsRealTime(false);
    setCheckOut(time);
  }, []);

  const handleCheckOutDateChange = useCallback((date: string) => {
    setIsRealTime(false);
    setCheckOutDate(date);
  }, []);

  // When activeRoom changes, load its session
  useEffect(() => {
    const session = getCurrentSession();
    if (session) {
      isApplyingRemoteSessionRef.current = true;
      const now = new Date();
      const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const live = session.isRealTime !== false;
      setIsRealTime(live);

      setSelectedRoom(session.roomName);
      setRoomPrice(session.roomPrice);
      setCheckIn(session.checkIn);
      setCheckOut(live ? currentTime : (session.checkOut || currentTime));
      setCheckInDate(session.checkInDate || todayStr);
      setCheckOutDate(live ? currentDate : (session.checkOutDate || currentDate));
      setItems(session.items);
      setDiscountType(session.discountType);
      setDiscountValue(session.discountValue);
      setTaxRate(session.taxRate);

      const timer = setTimeout(() => {
        isApplyingRemoteSessionRef.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom]);

  // Apply remote updates to the active room session without echoing back to Firestore
  useEffect(() => {
    if (lastRemoteUpdateTick === 0 || !activeRoom || editingInvoiceId) return;
    const session = roomSessions[activeRoom];
    if (!session) return;

    isApplyingRemoteSessionRef.current = true;
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const live = session.isRealTime !== false;

    setIsRealTime(live);
    setSelectedRoom(session.roomName);
    setRoomPrice(session.roomPrice);
    setCheckIn(session.checkIn);
    setCheckOut(live ? currentTime : (session.checkOut || currentTime));
    setCheckInDate(session.checkInDate || todayStr);
    setCheckOutDate(live ? currentDate : (session.checkOutDate || currentDate));
    setItems(session.items);
    setDiscountType(session.discountType);
    setDiscountValue(session.discountValue);
    setTaxRate(session.taxRate);

    const timer = setTimeout(() => {
      isApplyingRemoteSessionRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRemoteUpdateTick]);

  // Keep checkOut running in real-time when active room is in real-time mode
  useEffect(() => {
    if (!activeRoom || editingInvoiceId || !isRealTime) return;

    const tick = () => {
      const now = new Date();
      const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setCheckOut((prev) => (prev !== currentTime ? currentTime : prev));
      setCheckOutDate((prev) => (prev !== currentDate ? currentDate : prev));
    };

    tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [activeRoom, editingInvoiceId, isRealTime]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);


  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Find active room metadata (including time slots)
  const currentRoomData = useMemo(() => {
    if (!selectedRoom) return undefined;
    const target = selectedRoom.trim().toLowerCase();
    return rooms.find(r => r.name.trim().toLowerCase() === target || r.id === selectedRoom);
  }, [rooms, selectedRoom]);

  const currentMinPrintMinutes = useMemo(() => {
    return getEffectiveMinPrintMinutes(currentRoomData);
  }, [getEffectiveMinPrintMinutes, currentRoomData]);

  // Get block_minutes for current room (default 5-minute blocks to match room display)
  const currentRoomBlockMinutes = useMemo(() => {
    if (currentRoomData?.block_minutes && currentRoomData.block_minutes !== 60) {
      return currentRoomData.block_minutes;
    }
    const groupId = currentRoomData?.groupId;
    if (groupId) {
      const group = roomGroups.find(g => g.id === groupId);
      if (group?.block_minutes && group.block_minutes !== 60) return group.block_minutes;
    }
    return 5; // default 5-minute blocks matching room display
  }, [currentRoomData, roomGroups]);

  const [actualDuration, setActualDuration] = useState(0);

  // Time-based calculation calculation engine
  const roomTimeCalculation: RoomTimeCalculationResult = useMemo(() => {
    return calculateRoomTimeCharges({
      checkInDate,
      checkIn,
      checkOutDate,
      checkOut,
      defaultPrice: roomPrice,
      blockMinutes: currentRoomBlockMinutes,
      timeSlots: currentRoomData?.timeSlots,
      useTimeSlots: currentRoomData?.useTimeSlots ?? false,
    });
  }, [checkInDate, checkIn, checkOutDate, checkOut, roomPrice, currentRoomBlockMinutes, currentRoomData]);

  useEffect(() => {
    setDuration(roomTimeCalculation.totalDuration ?? roomTimeCalculation.totalHours ?? 0);
    setActualDuration(roomTimeCalculation.actualDuration ?? roomTimeCalculation.actualHours ?? 0);
  }, [roomTimeCalculation]);

  const roomTotal = Math.round(roomTimeCalculation.totalAmount);
  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = roomTotal + itemsTotal;
  
  let discount = 0;
  if (discountType === "percentage") {
    discount = Math.round(subtotal * discountValue / 100);
  } else {
    discount = discountValue;
  }
  
  const afterDiscount = subtotal - discount;
  const tax = Math.round(afterDiscount * taxRate / 100);
  const total = afterDiscount + tax;

  const handleSelectRoom = useCallback((roomName: string) => {
    if (roomSessions[roomName]) {
      syncToRoomSession();
      openRoom(roomName, rooms.find(r => r.name === roomName)?.price || 0);
    } else {
      setSelectedRoom(roomName);
      const room = rooms.find((r) => r.name === roomName);
      if (room) {
        setRoomPrice(room.price);
      }
    }
  }, [roomSessions, syncToRoomSession, openRoom, rooms]);

  const getDisplayRoomTotal = useCallback((roomName: string) => {
    if (roomName === selectedRoom) {
      return total;
    }
    return getRoomTotal(roomName);
  }, [selectedRoom, total, getRoomTotal]);

  const handleAddItem = (item: { name: string; price: number; category: string }) => {
    const existingItemIndex = items.findIndex(i => i.name === item.name);
    
    if (existingItemIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += 1;
      setItems(updatedItems);
    } else {
      setItems([...items, { 
        ...item, 
        id: Math.random().toString(), 
        quantity: 1 
      }]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(id);
      return;
    }
    setItems(items.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const resetForm = () => {
    const wasEditingHistory = !!editingInvoiceId;
    // Only clear active room's session when NOT editing a history invoice (i.e. it was a real print)
    if (activeRoom && !wasEditingHistory) {
      clearRoomSession(activeRoom);
    }
    const resetDate = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;

    setEditingInvoiceId(null);
    setEditingInvoicePrintedAt(null);
    setEditingOriginalData(null);
    setIsReadOnlyEdit(false);
    setIsRealTime(true);
    setPaymentStatus("paid");
    setPartialAmount(0);
    setCustomerName("");

    // If we were editing a history invoice AND there is still an active room session,
    // restore that active room's form state instead of blanking everything.
    const activeSession = wasEditingHistory && activeRoom ? getCurrentSession() : null;
    if (activeSession) {
      const now = new Date();
      const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const live = activeSession.isRealTime !== false;
      setIsRealTime(live);
      setSelectedRoom(activeSession.roomName);
      setRoomPrice(activeSession.roomPrice);
      setCheckIn(activeSession.checkIn);
      setCheckOut(live ? currentTime : (activeSession.checkOut || currentTime));
      setCheckInDate(activeSession.checkInDate || resetDate);
      setCheckOutDate(live ? currentDate : (activeSession.checkOutDate || currentDate));
      setItems(activeSession.items);
      setDiscountType(activeSession.discountType);
      setDiscountValue(activeSession.discountValue);
      setTaxRate(activeSession.taxRate);
      return;
    }

    setSelectedRoom("");
    setRoomPrice(0);
    setCheckIn("");
    setCheckOut("");
    setCheckInDate(resetDate);
    setCheckOutDate(resetDate);
    setDuration(0);
    setItems([]);
    setDiscountType("percentage");
    setDiscountValue(0);
  };

  const isPrinting = isCheckingDuplicate || saveInvoice.isPending || updateInvoice.isPending;

  const executePrint = async (skipDuplicateCheck = false) => {
    if (isPrinting) return; // Guard against double-clicks

    if (!selectedRoom || !selectedRoom.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn phòng trước khi in hóa đơn",
        variant: "destructive",
      });
      return;
    }

    if (!checkIn || !checkOut) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ giờ vào và giờ ra",
        variant: "destructive",
      });
      return;
    }

    const actualMinutes = Math.max(0, Math.round((roomTimeCalculation.actualDuration ?? actualDuration ?? 0) * 60));
    if (roomPrice > 0 && currentMinPrintMinutes > 0 && actualMinutes < currentMinPrintMinutes && !editingInvoiceId) {
      setShowDurationWarning(true);
      toast({
        title: "Cảnh báo tiền giờ",
        description: `Thời gian sử dụng phòng dưới ${currentMinPrintMinutes} phút (${actualMinutes} phút). Không thể in hóa đơn!`,
        variant: "destructive",
      });
      return;
    }

    const effectiveCheckInDate = checkInDate || todayStr;
    const effectiveCheckOutDate = checkOutDate || todayStr;

    if (!editingInvoiceId && !skipDuplicateCheck) {
      setIsCheckingDuplicate(true);
      try {
        const dup = await checkDuplicateInvoice({
          roomName: selectedRoom.trim(),
          checkInDate: effectiveCheckInDate,
          checkIn,
          checkOutDate: effectiveCheckOutDate,
          checkOut,
        });
        if (dup) {
          setDuplicateWarningInvoice(dup);
          return;
        }
      } finally {
        setIsCheckingDuplicate(false);
      }
    }

    const safeRoomPrice = Number.isNaN(Number(roomPrice)) ? 0 : Number(roomPrice);
    const safeDuration = Number.isNaN(Number(duration)) ? 0 : Number(duration);
    const safeDiscount = Number.isNaN(Number(discount)) ? 0 : Number(discount);
    const safeTaxRate = Number.isNaN(Number(taxRate)) ? 0 : Number(taxRate);
    const safeTotal = Number.isNaN(Number(total)) ? 0 : Number(total);

    try {
      if (editingInvoiceId && isReadOnlyEdit) {
        const computedPaidAmount = paymentStatus === "paid" ? safeTotal : paymentStatus === "debt" ? 0 : partialAmount;
        await payDebt.mutateAsync({ id: editingInvoiceId, paidAmount: computedPaidAmount, customerName });
        addLog("UPDATE", `Cập nhật thanh toán & in lại hóa đơn ${selectedRoom} (chỉ đọc): ${paymentStatus} - ${computedPaidAmount.toLocaleString("vi-VN")}đ`, {
          invoiceId: editingInvoiceId,
          roomName: selectedRoom,
          paymentStatus,
          paidAmount: computedPaidAmount,
        });
      } else if (editingInvoiceId) {
        const computedPaidAmount = paymentStatus === "paid" ? safeTotal : paymentStatus === "debt" ? 0 : partialAmount;
        await updateInvoice.mutateAsync({
          id: editingInvoiceId,
          roomName: selectedRoom.trim(),
          roomPrice: safeRoomPrice,
          checkInDate: effectiveCheckInDate,
          checkOutDate: effectiveCheckOutDate,
          checkIn,
          checkOut,
          duration: safeDuration,
          items,
          discountType,
          discountValue: safeDiscount,
          taxRate: safeTaxRate,
          totalAmount: safeTotal,
          paidAmount: computedPaidAmount,
          paymentStatus,
          customerName,
        });
        // Build detailed changes list
        const changes: string[] = [];
        if (editingOriginalData) {
          if (editingOriginalData.roomName !== selectedRoom) changes.push(`Phòng: ${editingOriginalData.roomName} → ${selectedRoom}`);
          if (editingOriginalData.roomPrice !== roomPrice) changes.push(`Giá phòng: ${(editingOriginalData.roomPrice as number).toLocaleString("vi-VN")}đ → ${roomPrice.toLocaleString("vi-VN")}đ`);
          if (editingOriginalData.checkIn !== checkIn) changes.push(`Giờ vào: ${editingOriginalData.checkIn} → ${checkIn}`);
          if (editingOriginalData.checkOut !== checkOut) changes.push(`Giờ ra: ${editingOriginalData.checkOut} → ${checkOut}`);
          if (editingOriginalData.discount !== discount) changes.push(`Giảm giá: ${(editingOriginalData.discount as number).toLocaleString("vi-VN")}đ → ${discount.toLocaleString("vi-VN")}đ`);
          if (editingOriginalData.total !== total) changes.push(`Tổng tiền: ${(editingOriginalData.total as number).toLocaleString("vi-VN")}đ → ${total.toLocaleString("vi-VN")}đ`);
          
          // Compare items
          const oldItems = editingOriginalData.items as Array<{name: string; price: number; quantity: number}>;
          const newItems = items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }));
          const addedItems = newItems.filter(ni => !oldItems.some(oi => oi.name === ni.name));
          const removedItems = oldItems.filter(oi => !newItems.some(ni => ni.name === oi.name));
          const changedItems = newItems.filter(ni => {
            const oi = oldItems.find(o => o.name === ni.name);
            return oi && (oi.quantity !== ni.quantity || oi.price !== ni.price);
          });
          
          if (addedItems.length > 0) changes.push(`Thêm món: ${addedItems.map(i => `${i.name} x${i.quantity}`).join(", ")}`);
          if (removedItems.length > 0) changes.push(`Xóa món: ${removedItems.map(i => i.name).join(", ")}`);
          if (changedItems.length > 0) changes.push(`Sửa món: ${changedItems.map(i => {
            const oi = oldItems.find(o => o.name === i.name)!;
            const parts: string[] = [];
            if (oi.quantity !== i.quantity) parts.push(`SL: ${oi.quantity}→${i.quantity}`);
            if (oi.price !== i.price) parts.push(`Giá: ${oi.price.toLocaleString("vi-VN")}→${i.price.toLocaleString("vi-VN")}đ`);
            return `${i.name} (${parts.join(", ")})`;
          }).join("; ")}`);
        }
        
        const desc = changes.length > 0 
          ? `Cập nhật hóa đơn ${selectedRoom}: ${changes.join(" | ")}` 
          : `Cập nhật hóa đơn ${selectedRoom} (không thay đổi)`;
        
        addLog("UPDATE", desc, {
          invoiceId: editingInvoiceId,
          roomName: selectedRoom,
          total: safeTotal,
          originalTotal: editingOriginalData?.total,
          totalReduced: editingOriginalData ? safeTotal < (editingOriginalData.total as number) : false,
          changes,
        });
      } else {
        const computedPaidAmount2 = paymentStatus === "paid" ? safeTotal : paymentStatus === "debt" ? 0 : partialAmount;
        await saveInvoice.mutateAsync({
          roomName: selectedRoom.trim(),
          roomPrice: safeRoomPrice,
          checkInDate: effectiveCheckInDate,
          checkOutDate: effectiveCheckOutDate,
          checkIn,
          checkOut,
          duration: safeDuration,
          items,
          discountType,
          discountValue: safeDiscount,
          taxRate: safeTaxRate,
          totalAmount: safeTotal,
          staffName: displayName,
          paidAmount: computedPaidAmount2,
          paymentStatus,
          customerName,
        });
      }

      await ensureCustomer(customerName);

      setTimeout(() => {
        const invoiceEl = document.getElementById('invoice-area');
        if (invoiceEl) {
          const clone = invoiceEl.cloneNode(true) as HTMLElement;
          clone.id = 'print-clone';
          // Remove print:hidden elements from clone
          clone.querySelectorAll('.print\\:hidden, [class*="print:hidden"]').forEach(el => el.remove());
          document.body.classList.add('printing');
          document.body.appendChild(clone);
          window.print();
          document.body.removeChild(clone);
          document.body.classList.remove('printing');
        }
        resetForm();
      }, 100);

      toast({
        title: "Thành công",
        description: editingInvoiceId ? "Hóa đơn đã được cập nhật và in" : "Hóa đơn đã được lưu và in",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể lưu hóa đơn",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    const actualMinutes = Math.max(0, Math.round((roomTimeCalculation.actualDuration ?? actualDuration ?? 0) * 60));
    if (roomPrice > 0 && currentMinPrintMinutes > 0 && actualMinutes < currentMinPrintMinutes && !editingInvoiceId) {
      setShowDurationWarning(true);
      toast({
        title: "Cảnh báo tiền giờ",
        description: `Thời gian sử dụng phòng dưới ${currentMinPrintMinutes} phút (${actualMinutes} phút). Không thể in hóa đơn!`,
        variant: "destructive",
      });
      return;
    }
    executePrint(false);
  };

  const handleInvoiceClick = (invoice: Invoice, rawInvoice?: any) => {
    if (!permissions.can_view_invoice) {
      toast({
        title: "Không có quyền truy cập",
        description: "Tài khoản của bạn không có quyền mở tab Hóa đơn để chỉnh sửa.",
        variant: "destructive",
      });
      return;
    }

    // Check edit time window — admin bypasses, staff limited by permissions.edit_invoice_minutes (0 = unlimited)
    let readOnly = false;
    if (rawInvoice?.created_at && !isAdmin) {
      const limitMinutes = permissions?.edit_invoice_minutes ?? 60;
      if (limitMinutes > 0) {
        const createdAt = new Date(rawInvoice.created_at);
        const diffMs = Date.now() - createdAt.getTime();
        if (diffMs > limitMinutes * 60 * 1000) {
          readOnly = true;
          toast({
            title: "Chỉ xem hóa đơn",
            description: `Đã quá ${limitMinutes} phút — bạn chỉ có thể xem, cập nhật thanh toán và in lại.`,
          });
        }
      }
    }
    setIsReadOnlyEdit(readOnly);
    setIsRealTime(false);

    setEditingInvoiceId(invoice.id);
    setEditingInvoicePrintedAt(rawInvoice?.created_at ?? null);
    setSelectedRoom(invoice.roomName);
    setRoomPrice(invoice.roomPrice);
    
    setCheckIn(invoice.checkIn);
    setCheckOut(invoice.checkOut);
    
    if (rawInvoice && rawInvoice.check_in && rawInvoice.check_out) {
      const checkInDateTime = new Date(rawInvoice.check_in);
      const checkOutDateTime = new Date(rawInvoice.check_out);
      
      const formatDate = (d: Date) => {
        if (Number.isNaN(d.getTime())) return todayStr;
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      };
      
      setCheckInDate(formatDate(checkInDateTime));
      setCheckOutDate(formatDate(checkOutDateTime));
    } else {
      setCheckInDate(todayStr);
      setCheckOutDate(todayStr);
    }
    
    setItems(invoice.items);
    setDiscountType("fixed");
    setDiscountValue(invoice.discount || 0);
    setTaxRate(rawInvoice?.tax_rate || 0);
    setActiveTab("invoice");

    // Load payment status + customer name from raw invoice
    if (rawInvoice) {
      const ps = (rawInvoice.payment_status as "paid" | "partial" | "debt") || "paid";
      setPaymentStatus(ps);
      setPartialAmount(rawInvoice.paid_amount || 0);
      setCustomerName(rawInvoice.customer_name || "");
    }

    // Store original data for diff comparison
    setEditingOriginalData({
      roomName: invoice.roomName,
      roomPrice: invoice.roomPrice,
      checkIn: invoice.checkIn,
      checkOut: invoice.checkOut,
      items: invoice.items.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
      discount: invoice.discount,
      total: invoice.total,
    });

    addLog("UPDATE", `Mở chỉnh sửa hóa đơn: ${invoice.roomName} - ${invoice.total.toLocaleString("vi-VN")}đ`, {
      invoiceId: invoice.id,
      roomName: invoice.roomName,
      total: invoice.total,
    });
    toast({
      title: "Đang chỉnh sửa hóa đơn",
      description: "Bấm in để cập nhật hóa đơn này",
    });
  };

  const handleClearHistory = () => {
    // History is now managed by database, this can be used for admin deletion if needed
    localStorage.removeItem("karaoke-invoices");
  };

  const handleReprintLog = useCallback((inv: { id: string; roomName: string; total: number }) => {
    addLog("PRINT", `In lại hóa đơn từ Lịch sử: ${inv.roomName} - ${inv.total.toLocaleString("vi-VN")}đ`, {
      invoiceId: inv.id,
      roomName: inv.roomName,
      total: inv.total,
    });
  }, [addLog]);

  if (loading || (user && !permissionsVerified)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Transform DB invoices to local Invoice format for components
  const transformedInvoices: Invoice[] = dbInvoices.map((inv: any) => ({
    id: inv.id,
    roomName: inv.room_name,
    roomPrice: inv.room_price,
    checkIn: new Date(inv.check_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    checkOut: new Date(inv.check_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    checkInRaw: inv.check_in,
    checkOutRaw: inv.check_out,
    duration: inv.duration / 60, // Convert from minutes to hours
    items: (inv.invoice_items || []).map((item: any) => ({
      id: item.id,
      name: item.item_name ?? item.name ?? "",
      price: Number(item.item_price ?? item.price ?? 0),
      quantity: Number(item.quantity ?? 0),
      category: item.category || "",
    })),
    subtotal: Math.round((inv.duration / 60) * inv.room_price) + 
      (inv.invoice_items || []).reduce((sum: number, item: any) => sum + Number(item.item_price ?? item.price ?? 0) * Number(item.quantity ?? 0), 0),
    discount: inv.discount_value || 0,
    discountType: inv.discount_type as "percentage" | "fixed" || "percentage",
    tax: Math.round((inv.total_amount - (inv.total_amount / (1 + (inv.tax_rate || 0) / 100)))),
    total: inv.total_amount,
    paymentStatus: inv.payment_status,
    paidAmount: inv.paid_amount,
    customerName: inv.customer_name,
    date: new Date(inv.created_at).toLocaleDateString("vi-VN") + ", " + 
      new Date(inv.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  }));

  const layoutMode = themeConfig.layout;

  if (layoutMode === "classic") {
    return (
      <div className="min-h-screen bg-background p-2 sm:p-4 md:p-6">
        <IdleLockGate
          enabled={permissionsVerified && !!permissions.lock_screen_enabled}
          timeoutMinutes={permissions.lock_screen_minutes || 5}
          username={username}
          displayName={displayName}
          email={user?.email || ""}
        />
        <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between py-1 sm:py-2 gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold tracking-tight text-foreground">{appTitle}</h1>
              <p className="text-xs text-muted-foreground">{appSubtitle}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">{username || displayName}</p>
                {role && (
                  <p className="text-xs text-muted-foreground">
                    {role === "admin" ? "Quản trị viên" : "Nhân viên"}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {visibleTabs.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Tài khoản của bạn chưa được cấp quyền truy cập tab nào. Vui lòng liên hệ Quản trị viên.
              </p>
            </Card>
          ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 flex justify-start text-base">
              <TabsList className="inline-flex h-auto w-auto justify-start bg-muted/50 gap-1 p-1">
                {visibleTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-base whitespace-nowrap px-3 py-2 sm:py-1.5"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {permissionsVerified && permissions.can_view_invoice && (
            <TabsContent value="invoice" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-[var(--left-w)_var(--right-w)] gap-4" style={{ '--left-w': `${leftWidth}%`, '--right-w': `${100 - leftWidth}%` } as React.CSSProperties}>
                <div className="space-y-4">
                  <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
                    <InvoiceFormPanel
                      variant="classic"
                      categoriesLoading={categoriesLoading}
                      cardOrder={cardLayout.order}
                      cardHeights={cardLayout.heights}
                      onCardOrderChange={updateOrder}
                      onCardHeightChange={updateHeight}
                      rooms={rooms}
                      selectedRoom={selectedRoom}
                      activeRoom={activeRoom}
                      onSelectRoom={handleSelectRoom}
                      onRoomPriceChange={setRoomPrice}
                      onOpenRoom={handleOpenRoom}
                      onCloseRoom={handleCloseRoom}
                      roomHasItems={roomHasItems}
                      getDisplayRoomTotal={getDisplayRoomTotal}
                      editingInvoiceId={editingInvoiceId}
                      items={items}
                      itemCategories={itemCategories}
                      onItemsChange={setItems}
                      isReadOnlyEdit={isReadOnlyEdit}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      checkInDate={checkInDate}
                      checkOutDate={checkOutDate}
                      duration={duration}
                      actualDuration={actualDuration}
                      onCheckInChange={setCheckIn}
                      onCheckOutChange={handleCheckOutChange}
                      onCheckInDateChange={setCheckInDate}
                      onCheckOutDateChange={handleCheckOutDateChange}
                      isRealTime={isRealTime}
                      onToggleRealTime={setIsRealTime}
                      discountType={discountType}
                      onDiscountTypeChange={setDiscountType}
                      discountValue={discountValue}
                      onDiscountValueChange={setDiscountValue}
                      taxRate={taxRate}
                      onTaxRateChange={setTaxRate}
                    />
                  </Suspense>
                </div>

                <div>
                  <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
                    <InvoiceDisplay
                      roomName={selectedRoom}
                      roomPrice={roomPrice}
                      minPrintMinutes={currentMinPrintMinutes}
                      duration={duration}
                      actualDuration={actualDuration}
                      roomTimeCalculation={roomTimeCalculation}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      checkInDate={checkInDate}
                      checkOutDate={checkOutDate}
                      items={items}
                      subtotal={subtotal}
                      discount={discount}
                      tax={tax}
                      taxRate={taxRate}
                      total={total}
                      staffName={displayName}
                      isEditing={!!editingInvoiceId}
                      isReadOnly={isReadOnlyEdit}
                      printedAt={editingInvoicePrintedAt ?? undefined}
                      onPrint={handlePrint}
                      isPrinting={isPrinting}
                      onCancelEdit={resetForm}
                      paymentStatus={paymentStatus}
                      paidAmount={paymentStatus === "paid" ? total : paymentStatus === "debt" ? 0 : partialAmount}
                      onPaymentStatusChange={setPaymentStatus}
                      onPartialAmountChange={setPartialAmount}
                      customerName={customerName}
                      onCustomerNameChange={setCustomerName}
                      customerSuggestions={Array.from(new Set([
                        ...customers.map((c) => c.name),
                        ...dbInvoices.map((i: any) => i.customer_name),
                      ].filter((n: any) => !!n)))}
                    />
                  </Suspense>
                </div>
              </div>
            </TabsContent>
            )}

            {permissions.can_view_customers && (
            <TabsContent value="customers" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <CustomersTab canDeleteCustomer={permissions.can_delete_customers} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_history && (
            <TabsContent value="history" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <InvoiceHistory 
                  invoices={transformedInvoices}
                  onClearHistory={handleClearHistory}
                  onLoadInvoice={handleInvoiceClick}
                  canDelete={permissions.can_delete_history}
                  canEdit={permissions.can_view_invoice}
                  rooms={rooms}
                  roomGroups={roomGroups}
                  onReprintLog={handleReprintLog}
                />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_reports && (
            <TabsContent value="reports" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ReportsTab invoices={transformedInvoices} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_inventory && (
            <TabsContent value="inventory" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <InventoryCheckTab
                  invoices={transformedInvoices}
                  items={dbItems}
                  categories={dbCategories}
                  canEditHistory={permissions.can_edit_inventory_history}
                  canDeleteHistory={permissions.can_delete_inventory_history}
                />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_logs && (
            <TabsContent value="logs" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ActivityLogsTab canDelete={permissions.can_delete_logs} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_expenses && (
            <TabsContent value="expenses" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ExpensesTab invoices={transformedInvoices} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_config && (
            <TabsContent value="config" className="mt-4">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ConfigurationTab 
                  isAdmin={isAdmin}
                  currentUserId={user?.id || ""}
                  rooms={rooms}
                  onAddRoom={addRoom}
                  onUpdateRoom={updateRoom}
                  onDeleteRoom={deleteRoom}
                  onReorderRooms={reorderRooms}
                  defaultMinPrintMinutes={defaultMinPrintMinutes}
                  onUpdateDefaultMinPrintMinutes={updateDefaultMinPrintMinutes}
                  leftWidth={leftWidth}
                  onLeftWidthChange={saveLeftWidth}
                  appTitle={appTitle}
                  onAppTitleChange={saveAppTitle}
                  appSubtitle={appSubtitle}
                  onAppSubtitleChange={saveAppSubtitle}
                  cardOrder={cardLayout.order}
                  cardHeights={cardLayout.heights}
                  onCardOrderChange={updateOrder}
                  onCardHeightChange={updateHeight}
                  subPermissions={{
                    can_config_rooms: permissions.can_config_rooms,
                    can_config_items: permissions.can_config_items,
                    can_config_pricelist: permissions.can_config_pricelist,
                    can_config_layout: permissions.can_config_layout,
                    can_config_print: permissions.can_config_print,
                  }}
                />
              </Suspense>
            </TabsContent>
            )}
          </Tabs>
          )}
        </div>

        <AlertDialog open={showDurationWarning} onOpenChange={setShowDurationWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                Không thể in hóa đơn — Tiền giờ dưới {currentMinPrintMinutes} phút
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm space-y-2 text-foreground">
                  <p>
                    Thời gian sử dụng phòng hiện tại là{" "}
                    <strong className="text-destructive font-semibold">
                      {Math.max(0, Math.round((roomTimeCalculation.actualDuration ?? actualDuration ?? 0) * 60))} phút
                    </strong>{" "}
                    (dưới mức tối thiểu {currentMinPrintMinutes} phút).
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Hệ thống không cho phép in hóa đơn khi thời gian tiền giờ chưa đủ {currentMinPrintMinutes} phút. Vui lòng kiểm tra lại giờ vào / giờ ra hoặc tiếp tục sử dụng phòng. (Bạn có thể tùy chỉnh số phút tối thiểu trong mục Cấu hình &gt; Phòng).
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowDurationWarning(false)}>
                Đã hiểu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DuplicateInvoiceAlertDialog
          duplicateInvoice={duplicateWarningInvoice}
          onCancel={() => setDuplicateWarningInvoice(null)}
          onConfirmPrint={() => {
            setDuplicateWarningInvoice(null);
            executePrint(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-hidden h-screen">
      <IdleLockGate
        enabled={permissionsVerified && !!permissions.lock_screen_enabled}
        timeoutMinutes={permissions.lock_screen_minutes || 5}
        username={username}
        displayName={displayName}
        email={user?.email || ""}
      />

      {/* Header */}
      <header className="px-6 py-3.5 border-b border-border flex justify-between items-center bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-['Syne'] text-xl font-bold tracking-tight text-primary">{appTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-semibold text-sm">{username || displayName}</div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {role === "admin" ? "Quản trị viên" : "Nhân viên"}
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={handleSignOut} title="Đăng xuất" className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div className={`flex-1 grid ${activeTab === 'invoice' && permissions.can_view_invoice ? 'grid-cols-1 lg:grid-cols-[280px_1fr_350px]' : 'grid-cols-1 lg:grid-cols-[280px_1fr]'} overflow-hidden`}>
          
          {/* Left Navigation Sidebar */}
          <aside className="bg-card border-r border-border p-4 flex flex-col gap-1.5 overflow-y-auto flex-shrink-0">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground px-3 py-2 mb-1">Menu quản lý</div>
            
            {visibleTabs.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-2">Không có tab khả dụng</p>
            ) : (
              visibleTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleTabChange(tab.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                    activeTab === tab.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))
            )}
          </aside>

          {/* Center Content Area */}
          <main className="p-6 overflow-y-auto flex flex-col gap-6 bg-background">
            {visibleTabs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Tài khoản của bạn chưa được cấp quyền truy cập tab nào. Vui lòng liên hệ Quản trị viên.
                </p>
              </Card>
            ) : (
            <>
            {permissionsVerified && permissions.can_view_invoice && (
            <TabsContent value="invoice" className="m-0 space-y-4">
              <div className="space-y-4">
                <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
                  <InvoiceFormPanel
                    variant="modern"
                    categoriesLoading={categoriesLoading}
                    cardOrder={cardLayout.order}
                    cardHeights={cardLayout.heights}
                    onCardOrderChange={updateOrder}
                    onCardHeightChange={updateHeight}
                    rooms={rooms}
                    selectedRoom={selectedRoom}
                    activeRoom={activeRoom}
                    onSelectRoom={handleSelectRoom}
                    onRoomPriceChange={setRoomPrice}
                    onOpenRoom={handleOpenRoom}
                    onCloseRoom={handleCloseRoom}
                    roomHasItems={roomHasItems}
                    getDisplayRoomTotal={getDisplayRoomTotal}
                    editingInvoiceId={editingInvoiceId}
                    items={items}
                    itemCategories={itemCategories}
                    onItemsChange={setItems}
                    isReadOnlyEdit={isReadOnlyEdit}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    duration={duration}
                    actualDuration={actualDuration}
                    onCheckInChange={setCheckIn}
                    onCheckOutChange={handleCheckOutChange}
                    onCheckInDateChange={setCheckInDate}
                    onCheckOutDateChange={handleCheckOutDateChange}
                    isRealTime={isRealTime}
                    onToggleRealTime={setIsRealTime}
                    discountType={discountType}
                    onDiscountTypeChange={setDiscountType}
                    discountValue={discountValue}
                    onDiscountValueChange={setDiscountValue}
                    taxRate={taxRate}
                    onTaxRateChange={setTaxRate}
                  />
                </Suspense>
              </div>
            </TabsContent>
            )}

            {permissions.can_view_customers && (
            <TabsContent value="customers" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <CustomersTab canDeleteCustomer={permissions.can_delete_customers} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_history && (
            <TabsContent value="history" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <InvoiceHistory 
                  invoices={transformedInvoices}
                  onClearHistory={handleClearHistory}
                  onLoadInvoice={handleInvoiceClick}
                  canDelete={permissions.can_delete_history}
                  canEdit={permissions.can_view_invoice}
                  rooms={rooms}
                  roomGroups={roomGroups}
                  onReprintLog={handleReprintLog}
                />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_reports && (
            <TabsContent value="reports" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ReportsTab invoices={transformedInvoices} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_inventory && (
            <TabsContent value="inventory" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <InventoryCheckTab
                  invoices={transformedInvoices}
                  items={dbItems}
                  categories={dbCategories}
                  canEditHistory={permissions.can_edit_inventory_history}
                  canDeleteHistory={permissions.can_delete_inventory_history}
                />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_logs && (
            <TabsContent value="logs" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ActivityLogsTab canDelete={permissions.can_delete_logs} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_expenses && (
            <TabsContent value="expenses" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ExpensesTab invoices={transformedInvoices} />
              </Suspense>
            </TabsContent>
            )}

            {permissions.can_view_config && (
            <TabsContent value="config" className="m-0">
              <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <ConfigurationTab 
                  isAdmin={isAdmin}
                  currentUserId={user?.id || ""}
                  rooms={rooms}
                  onAddRoom={addRoom}
                  onUpdateRoom={updateRoom}
                  onDeleteRoom={deleteRoom}
                  onReorderRooms={reorderRooms}
                  defaultMinPrintMinutes={defaultMinPrintMinutes}
                  onUpdateDefaultMinPrintMinutes={updateDefaultMinPrintMinutes}
                  leftWidth={leftWidth}
                  onLeftWidthChange={saveLeftWidth}
                  appTitle={appTitle}
                  onAppTitleChange={saveAppTitle}
                  appSubtitle={appSubtitle}
                  onAppSubtitleChange={saveAppSubtitle}
                  cardOrder={cardLayout.order}
                  cardHeights={cardLayout.heights}
                  onCardOrderChange={updateOrder}
                  onCardHeightChange={updateHeight}
                  subPermissions={{
                    can_config_rooms: permissions.can_config_rooms,
                    can_config_items: permissions.can_config_items,
                    can_config_pricelist: permissions.can_config_pricelist,
                    can_config_layout: permissions.can_config_layout,
                    can_config_print: permissions.can_config_print,
                  }}
                />
              </Suspense>
            </TabsContent>
            )}
            </>
            )}
          </main>

          {/* Right Bill Sidebar (Only shown when on invoice tab) */}
          {activeTab === 'invoice' && permissionsVerified && permissions.can_view_invoice && (
            <aside className="bg-card border-l border-border flex flex-col h-full overflow-y-auto">
              <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                <InvoiceDisplay
                  roomName={selectedRoom}
                  roomPrice={roomPrice}
                  minPrintMinutes={currentMinPrintMinutes}
                  duration={duration}
                  actualDuration={actualDuration}
                  roomTimeCalculation={roomTimeCalculation}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  checkInDate={checkInDate}
                  checkOutDate={checkOutDate}
                  items={items}
                  subtotal={subtotal}
                  discount={discount}
                  tax={tax}
                  taxRate={taxRate}
                  total={total}
                  staffName={displayName}
                  isEditing={!!editingInvoiceId}
                  isReadOnly={isReadOnlyEdit}
                  printedAt={editingInvoicePrintedAt ?? undefined}
                  onPrint={handlePrint}
                  isPrinting={isPrinting}
                  onCancelEdit={resetForm}
                  paymentStatus={paymentStatus}
                  paidAmount={paymentStatus === "paid" ? total : paymentStatus === "debt" ? 0 : partialAmount}
                  onPaymentStatusChange={setPaymentStatus}
                  onPartialAmountChange={setPartialAmount}
                  customerName={customerName}
                  onCustomerNameChange={setCustomerName}
                  customerSuggestions={Array.from(new Set([
                    ...customers.map((c) => c.name),
                    ...dbInvoices.map((i: any) => i.customer_name),
                  ].filter((n: any) => !!n)))}
                />
              </Suspense>
            </aside>
          )}

        </div>
      </Tabs>

      <AlertDialog open={showDurationWarning} onOpenChange={setShowDurationWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              Không thể in hóa đơn — Tiền giờ dưới {currentMinPrintMinutes} phút
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm space-y-2 text-foreground">
                <p>
                  Thời gian sử dụng phòng hiện tại là{" "}
                  <strong className="text-destructive font-semibold">
                    {Math.max(0, Math.round((roomTimeCalculation.actualDuration ?? actualDuration ?? 0) * 60))} phút
                  </strong>{" "}
                  (dưới mức tối thiểu {currentMinPrintMinutes} phút).
                </p>
                <p className="text-muted-foreground text-xs">
                  Hệ thống không cho phép in hóa đơn khi thời gian tiền giờ chưa đủ {currentMinPrintMinutes} phút. Vui lòng kiểm tra lại giờ vào / giờ ra hoặc tiếp tục sử dụng phòng. (Bạn có thể tùy chỉnh số phút tối thiểu trong mục Cấu hình &gt; Phòng).
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDurationWarning(false)}>
              Đã hiểu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateInvoiceAlertDialog
        duplicateInvoice={duplicateWarningInvoice}
        onCancel={() => setDuplicateWarningInvoice(null)}
        onConfirmPrint={() => {
          setDuplicateWarningInvoice(null);
          executePrint(true);
        }}
      />
    </div>
  );
};

interface DuplicateInvoiceAlertDialogProps {
  duplicateInvoice: DuplicateInvoiceInfo | null;
  onCancel: () => void;
  onConfirmPrint: () => void;
}
const DuplicateInvoiceAlertDialog = ({ duplicateInvoice, onCancel, onConfirmPrint }: DuplicateInvoiceAlertDialogProps) => {
  const formatHm = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const formatCreatedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <AlertDialog open={!!duplicateInvoice} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Cảnh báo hóa đơn có thể bị trùng
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm space-y-3 text-foreground">
              <p>
                Hệ thống phát hiện vừa có một hóa đơn cho cùng phòng và khung giờ vào trên máy chủ. Có thể tài khoản khác vừa in hóa đơn này.
              </p>
              {duplicateInvoice && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phòng:</span>
                    <span className="font-semibold">{duplicateInvoice.room_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giờ vào - Giờ ra:</span>
                    <span className="font-medium">
                      {formatHm(duplicateInvoice.check_in)} - {formatHm(duplicateInvoice.check_out)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền:</span>
                    <span className="font-bold text-primary">
                      {duplicateInvoice.total_amount.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Người tạo:</span>
                    <span className="font-medium">{duplicateInvoice.staff_name || "Không rõ"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Thời điểm in:</span>
                    <span className="font-medium">{formatCreatedAt(duplicateInvoice.created_at)}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Nếu hóa đơn này đã được đồng nghiệp in rồi, vui lòng chọn &quot;Hủy, không tạo trùng&quot;.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Hủy, không tạo trùng</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmPrint}>
            Vẫn lưu &amp; in hóa đơn mới
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface IdleLockGateProps {
  enabled: boolean;
  timeoutMinutes: number;
  username: string;
  displayName: string;
  email: string;
}
const IdleLockGate = ({ enabled, timeoutMinutes, username, displayName, email }: IdleLockGateProps) => {
  const { locked, unlock } = useIdleLock({ enabled, timeoutMinutes });
  if (!locked) return null;
  return (
    <Suspense fallback={null}>
      <LockScreen username={username} displayName={displayName} email={email} onUnlock={unlock} />
    </Suspense>
  );
};

export default Index;
