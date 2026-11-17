import { useState, useMemo, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Loader2, Filter, CreditCard, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, CalendarDays, Download, Eye, RefreshCw, Receipt, Printer, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { Invoice } from "@/pages/Index";
import { useInvoices, type PaymentStatus } from "@/hooks/useInvoices";
import { Badge } from "@/components/ui/badge";
import { useOperatingHours } from "@/hooks/useOperatingHours";
import { useQueryClient } from "@tanstack/react-query";
import { ensureTableHydratedFromFirestore } from "@/integrations/supabase/localDatabase";
import { toast } from "@/hooks/use-toast";
import InvoiceDisplay from "@/components/karaoke/InvoiceDisplay";
import { calculateRoomTimeCharges } from "@/lib/roomTimePricing";
import type { Room } from "@/hooks/useRooms";
import type { RoomGroup } from "@/hooks/useRoomGroups";

interface InvoiceHistoryProps {
  invoices: Invoice[];
  onClearHistory: () => void;
  onLoadInvoice: (invoice: Invoice, rawInvoice?: any) => void;
  canDelete?: boolean;
  canEdit?: boolean;
  rooms?: Room[];
  roomGroups?: RoomGroup[];
  onReprintLog?: (invoice: { id: string; roomName: string; total: number }) => void;
}

const formatLocalDateYmd = (timestamp?: string) => {
  const d = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const extractTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const durationInHours = (minutes: number) => minutes / 60;

const statusLabel: Record<string, string> = {
  paid: "Đã trả",
  partial: "Trả một phần",
  debt: "Nợ",
};

const statusColor: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  debt: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const InvoiceHistory = ({
  invoices,
  onClearHistory,
  onLoadInvoice,
  canDelete = true,
  canEdit = true,
  rooms = [],
  roomGroups = [],
  onReprintLog,
}: InvoiceHistoryProps) => {
  const queryClient = useQueryClient();
  const { invoices: dbInvoices, isLoading, deleteInvoice, deleteInvoicesBatch, payDebt } = useInvoices();
  const { startTime, endTime } = useOperatingHours();
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<{ id: string; total: number; currentPaid: number } | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteFilteredOpen, setDeleteFilteredOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const displayInvoices = useMemo(() => {
    if (dbInvoices.length > 0) {
      return dbInvoices.map(inv => {
        const hours = durationInHours(inv.duration);
        const mappedItems = ((inv as any).invoice_items || []).map((item: any) => ({
          id: item.id,
          name: item.item_name ?? item.name ?? "",
          price: Number(item.item_price ?? item.price ?? 0),
          quantity: Number(item.quantity ?? 0),
          category: item.category || "",
        }));
        const itemsTotal = mappedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
        const roomFee = Math.round(inv.room_price * hours);
        return {
          id: inv.id,
          roomName: inv.room_name,
          roomPrice: inv.room_price,
          checkIn: extractTime(inv.check_in),
          checkOut: extractTime(inv.check_out),
          duration: hours,
          items: mappedItems,
          subtotal: roomFee + itemsTotal,
          discount: Number(inv.discount_value || 0),
          discountType: inv.discount_type === "percent" ? "percentage" : (inv.discount_type as "percentage" | "fixed") || "fixed",
          tax: Math.round(inv.total_amount - (roomFee + itemsTotal)),
          total: inv.total_amount,
          paidAmount: (inv as any).paid_amount ?? inv.total_amount,
          paymentStatus: ((inv as any).payment_status || "paid") as PaymentStatus,
          date: new Date(inv.created_at).toLocaleDateString("vi-VN"),
          staffName: (inv as any).staff_name || "",
          customerName: (inv as any).customer_name || "",
          _raw: inv,
        };
      });
    }
    return invoices.map(inv => ({
      ...inv,
      staffName: "",
      customerName: (inv as any).customerName || "",
      paidAmount: (inv as any).paidAmount ?? inv.total,
      paymentStatus: ((inv as any).paymentStatus || "paid") as PaymentStatus,
      _raw: null as any,
    }));
  }, [dbInvoices, invoices]);

  const [detailInvoice, setDetailInvoice] = useState<(typeof displayInvoices)[number] | null>(null);
  const [reprintingInvoice, setReprintingInvoice] = useState<(typeof displayInvoices)[number] | null>(null);

  const reprintPayload = useMemo(() => {
    if (!reprintingInvoice) return null;
    const inv = reprintingInvoice;
    const checkInDate = formatLocalDateYmd(inv._raw?.check_in || (inv as any).checkInRaw || inv._raw?.created_at);
    const checkOutDate = formatLocalDateYmd(inv._raw?.check_out || (inv as any).checkOutRaw || inv._raw?.created_at);

    const targetName = inv.roomName.trim().toLowerCase();
    const matchedRoom = rooms.find((r) => r.name.trim().toLowerCase() === targetName);
    let blockMinutes = 5;
    if (matchedRoom?.block_minutes && matchedRoom.block_minutes !== 60) {
      blockMinutes = matchedRoom.block_minutes;
    } else if (matchedRoom?.groupId) {
      const grp = roomGroups.find((g) => g.id === matchedRoom.groupId);
      if (grp?.block_minutes && grp.block_minutes !== 60) {
        blockMinutes = grp.block_minutes;
      }
    }

    const roomTimeCalculation = calculateRoomTimeCharges({
      checkInDate,
      checkIn: inv.checkIn,
      checkOutDate,
      checkOut: inv.checkOut,
      defaultPrice: inv.roomPrice,
      blockMinutes,
      timeSlots: matchedRoom?.timeSlots,
      useTimeSlots: matchedRoom?.useTimeSlots ?? false,
    });

    const itemsTotal = inv.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const roomFee = Math.round(roomTimeCalculation.totalAmount);
    const subtotal = roomFee + itemsTotal;
    const discount = Number(inv.discount || 0);
    const taxRate = Number(inv._raw?.tax_rate || 0);
    const tax = Math.max(0, Math.round(inv.total - (subtotal - discount)));

    return {
      roomName: inv.roomName,
      roomPrice: inv.roomPrice,
      checkIn: inv.checkIn,
      checkOut: inv.checkOut,
      checkInDate,
      checkOutDate,
      duration: roomTimeCalculation.totalDuration ?? inv.duration,
      actualDuration: roomTimeCalculation.actualDuration ?? inv.duration,
      roomTimeCalculation,
      items: inv.items,
      subtotal,
      discount,
      tax,
      taxRate,
      total: inv.total,
      staffName: inv.staffName,
      printedAt: inv._raw?.created_at,
      paymentStatus: inv.paymentStatus,
      paidAmount: inv.paidAmount,
      customerName: inv.customerName,
    };
  }, [reprintingInvoice, rooms, roomGroups]);

  useEffect(() => {
    if (!reprintingInvoice || !reprintPayload) return;
    let cancelled = false;

    const runPrint = async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      const invoiceEl = document.getElementById("history-reprint-area");
      if (!invoiceEl) {
        setReprintingInvoice(null);
        return;
      }

      const imgs = Array.from(invoiceEl.querySelectorAll("img"));
      if (imgs.length > 0) {
        await Promise.race([
          Promise.all(
            imgs.map(
              (img) =>
                new Promise<void>((resolve) => {
                  if (img.complete) return resolve();
                  const done = () => resolve();
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                })
            )
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ]);
      }
      if (cancelled) return;

      const clone = invoiceEl.cloneNode(true) as HTMLElement;
      clone.id = "print-clone";
      clone.querySelectorAll('.print\\:hidden, [class*="print:hidden"]').forEach((el) => el.remove());
      document.body.classList.add("printing");
      document.body.appendChild(clone);
      try {
        window.print();
      } finally {
        if (clone.parentNode === document.body) {
          document.body.removeChild(clone);
        }
        document.body.classList.remove("printing");
      }

      onReprintLog?.({
        id: reprintingInvoice.id,
        roomName: reprintingInvoice.roomName,
        total: reprintingInvoice.total,
      });
      toast({
        title: "Đã in lại hóa đơn",
        description: `Phòng ${reprintingInvoice.roomName} — ${reprintingInvoice.total.toLocaleString("vi-VN")}đ`,
      });
      if (!cancelled) {
        setReprintingInvoice(null);
      }
    };

    runPrint();
    return () => {
      cancelled = true;
    };
  }, [reprintingInvoice, reprintPayload, onReprintLog]);

  const handleDirectReprint = useCallback((inv: (typeof displayInvoices)[number], e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReprintingInvoice(inv);
  }, []);

  // Sync open dialogs & selection when invoices change remotely (e.g. another account updates/deletes)
  useEffect(() => {
    const idSet = new Set(displayInvoices.map((i) => i.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (idSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    if (detailInvoice) {
      const updated = displayInvoices.find((i) => i.id === detailInvoice.id);
      if (!updated) {
        setDetailInvoice(null);
        toast({
          title: "Hóa đơn đã bị xóa",
          description: "Hóa đơn này vừa được tài khoản khác xóa.",
        });
      } else if (
        updated.total !== detailInvoice.total ||
        updated.paidAmount !== detailInvoice.paidAmount ||
        updated.paymentStatus !== detailInvoice.paymentStatus ||
        updated.items.length !== detailInvoice.items.length ||
        updated._raw?.updated_at !== detailInvoice._raw?.updated_at
      ) {
        setDetailInvoice(updated);
      }
    }

    if (payDialogOpen && payingInvoice) {
      const updated = displayInvoices.find((i) => i.id === payingInvoice.id);
      if (!updated) {
        setPayDialogOpen(false);
        setPayingInvoice(null);
        toast({
          title: "Hóa đơn đã bị xóa",
          description: "Hóa đơn này vừa được tài khoản khác xóa.",
        });
      }
    }
  }, [displayInvoices, detailInvoice, payDialogOpen, payingInvoice]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        ensureTableHydratedFromFirestore("invoices", true),
        ensureTableHydratedFromFirestore("invoice_items", true),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const staffNames = useMemo(() => {
    const names = new Set<string>();
    displayInvoices.forEach(inv => { if (inv.staffName) names.add(inv.staffName); });
    return Array.from(names).sort();
  }, [displayInvoices]);

  const getBusinessDateRange = useCallback((date: string, mode: string) => {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const isOvernight = endH < startH || (endH === startH && endM <= startM);

    if (mode === "custom") {
      const start = new Date(customStartDate);
      start.setHours(startH, startM, 0, 0);
      const end = new Date(customEndDate);
      if (isOvernight) end.setDate(end.getDate() + 1);
      end.setHours(endH, endM, 0, 0);
      return { start, end };
    }

    const selected = new Date(date);
    const start = new Date(selected);
    start.setHours(startH, startM, 0, 0);
    const end = new Date(selected);
    if (isOvernight) end.setDate(end.getDate() + 1);
    end.setHours(endH, endM, 0, 0);
    return { start, end };
  }, [startTime, endTime, customStartDate, customEndDate]);

  const filteredInvoices = useMemo(() => {
    let result = displayInvoices;

    // Date filter
    if (dateFilter !== "all") {
      const { start, end } = getBusinessDateRange(
        dateFilter === "today" ? new Date().toISOString().split("T")[0] :
        dateFilter === "custom" ? customStartDate : customDate,
        dateFilter === "custom" ? "custom" : "day"
      );
      result = result.filter(inv => {
        const checkInTime = inv._raw?.check_in ? new Date(inv._raw.check_in) : new Date(inv._raw?.created_at || 0);
        return checkInTime >= start && checkInTime <= end;
      });
    }

    if (staffFilter !== "all") result = result.filter(inv => inv.staffName === staffFilter);
    if (statusFilter !== "all") result = result.filter(inv => inv.paymentStatus === statusFilter);
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let va: any, vb: any;
        switch (sortKey) {
          case "roomName": va = a.roomName; vb = b.roomName; break;
          case "checkIn": va = a.checkIn; vb = b.checkIn; break;
          case "staffName": va = a.staffName; vb = b.staffName; break;
          case "date": va = a._raw?.created_at || ""; vb = b._raw?.created_at || ""; break;
          case "total": va = a.total; vb = b.total; break;
          case "paidAmount": va = a.paidAmount; vb = b.paidAmount; break;
          case "paymentStatus": va = a.paymentStatus; vb = b.paymentStatus; break;
          default: return 0;
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [displayInvoices, staffFilter, statusFilter, dateFilter, customDate, customStartDate, customEndDate, sortKey, sortDir, getBusinessDateRange]);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  }, [sortKey]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const paginatedInvoices = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safeCurrentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const handleClearAll = async () => {
    const ids = filteredInvoices.map(i => i.id);
    if (ids.length > 0) {
      await deleteInvoicesBatch.mutateAsync(ids);
    }
    setSelectedIds(new Set());
    setDeleteFilteredOpen(false);
    onClearHistory();
  };

  const handleDeleteSingle = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xóa hóa đơn này?")) return;
    await deleteInvoice.mutateAsync(invoiceId);
  };

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginatedInvoices.map(i => i.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }, [paginatedInvoices, selectedIds]);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      await deleteInvoicesBatch.mutateAsync(ids);
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const openPayDialog = (e: React.MouseEvent, inv: { id: string; total: number; paidAmount: number }) => {
    e.stopPropagation();
    setPayingInvoice({ id: inv.id, total: inv.total, currentPaid: inv.paidAmount });
    setPayAmount(inv.total); // default to full payment
    setPayDialogOpen(true);
  };

  const handlePayDebt = async () => {
    if (!payingInvoice) return;
    await payDebt.mutateAsync({ id: payingInvoice.id, paidAmount: payAmount });
    setPayDialogOpen(false);
    setPayingInvoice(null);
  };

  const exportToExcel = useCallback(async () => {
    const XLSX = await import("@datalens-tech/xlsx");
    const data = filteredInvoices.map((inv, i) => ({
      "STT": i + 1,
      "Ngày": inv.date,
      "Phòng": inv.roomName,
      "Giờ vào": inv.checkIn,
      "Giờ ra": inv.checkOut,
      "Thời gian (h)": Number((inv.duration || 0).toFixed(2)),
      "Tiền phòng": Math.round(inv.duration * inv.roomPrice),
      "Tiền SP": inv.items.reduce((s, it) => s + it.price * it.quantity, 0),
      "Tổng tiền": inv.total,
      "Đã trả": inv.paidAmount,
      "Trạng thái": statusLabel[inv.paymentStatus] || inv.paymentStatus,
      "Nhân viên": inv.staffName,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử hóa đơn");
    XLSX.writeFile(wb, `lich-su-hoa-don-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredInvoices]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Lịch Sử Hóa Đơn</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={dateFilter} onValueChange={(v) => handleFilterChange(setDateFilter, v)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Ngày" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="pick">Chọn ngày</SelectItem>
                <SelectItem value="custom">Khoảng ngày</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateFilter === "pick" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setCurrentPage(1); }}
              className="w-[150px] h-9"
            />
          )}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                className="w-[140px] h-9"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                className="w-[140px] h-9"
              />
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="paid">Đã trả</SelectItem>
                <SelectItem value="partial">Trả một phần</SelectItem>
                <SelectItem value="debt">Nợ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {staffNames.length > 0 && (
            <Select value={staffFilter} onValueChange={(v) => handleFilterChange(setStaffFilter, v)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Tất cả NV" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả NV</SelectItem>
                {staffNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
            size="sm"
            title="Tải lại hóa đơn và chi tiết món từ máy chủ"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          {filteredInvoices.length > 0 && (
            <Button variant="outline" onClick={exportToExcel} className="gap-2" size="sm">
              <Download className="h-4 w-4" />
              Xuất Excel
            </Button>
          )}
          {selectedIds.size > 0 && canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Xóa đã chọn ({selectedIds.size})
            </Button>
          )}
          {filteredInvoices.length > 0 && canDelete && selectedIds.size === 0 && (
            <Button variant="destructive" onClick={() => setDeleteFilteredOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Xóa tất cả
            </Button>
          )}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {staffFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" ? "Không có hóa đơn nào phù hợp" : "Chưa có hóa đơn nào"}
          </p>
        </Card>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canDelete && (
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={paginatedInvoices.length > 0 && paginatedInvoices.every(i => selectedIds.has(i.id))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("roomName")}>
                  <span className="inline-flex items-center gap-1">Phòng {sortKey === "roomName" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("checkIn")}>
                  <span className="inline-flex items-center gap-1">Thời gian {sortKey === "checkIn" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("staffName")}>
                  <span className="inline-flex items-center gap-1">Nhân viên {sortKey === "staffName" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort("date")}>
                  <span className="inline-flex items-center gap-1">Ngày in {sortKey === "date" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("total")}>
                  <span className="inline-flex items-center gap-1 justify-end">Tổng tiền {sortKey === "total" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("paidAmount")}>
                  <span className="inline-flex items-center gap-1 justify-end">Thanh toán {sortKey === "paidAmount" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("paymentStatus")}>
                  <span className="inline-flex items-center gap-1">Trạng thái {sortKey === "paymentStatus" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
                </TableHead>
                <TableHead className="text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className={`cursor-pointer ${selectedIds.has(invoice.id) ? "bg-muted/50" : ""}`}
                  onClick={() => onLoadInvoice(invoice, invoice._raw)}
                >
                  {canDelete && (
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-semibold whitespace-nowrap">
                    <div>{invoice.roomName}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {invoice.items.length > 0 ? `${invoice.items.length} món` : "Chỉ tiền phòng"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {invoice.checkIn} - {invoice.checkOut}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground whitespace-nowrap">
                    {invoice.staffName || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground whitespace-nowrap">
                    {invoice.date}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                    {invoice.total.toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-right font-bold whitespace-nowrap">
                    {invoice.paidAmount.toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={`text-xs ${statusColor[invoice.paymentStatus] || ""}`}>
                      {statusLabel[invoice.paymentStatus] || invoice.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailInvoice(invoice);
                        }}
                        title="Xem chi tiết các món"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        onClick={(e) => handleDirectReprint(invoice, e)}
                        disabled={!!reprintingInvoice}
                        title="In lại hóa đơn này"
                      >
                        {reprintingInvoice?.id === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </Button>
                      {invoice.paymentStatus !== "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => openPayDialog(e, invoice)}
                          title="Trả nợ"
                        >
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteSingle(e, invoice.id)}
                          title="Xóa hóa đơn này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={canDelete ? 5 : 4} className="text-right">
                  Tổng cộng ({filteredInvoices.length} hóa đơn):
                </TableCell>
                <TableCell className="text-right text-primary whitespace-nowrap">
                  {filteredInvoices.reduce((s, i) => s + i.total, 0).toLocaleString("vi-VN")}đ
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {filteredInvoices.reduce((s, i) => s + i.paidAmount, 0).toLocaleString("vi-VN")}đ
                </TableCell>
                <TableCell colSpan={2} className="text-center text-destructive whitespace-nowrap">
                  {(() => {
                    const debt = filteredInvoices.reduce((s, i) => s + (i.total - i.paidAmount), 0);
                    return debt > 0 ? `Nợ: ${debt.toLocaleString("vi-VN")}đ` : "";
                  })()}
                </TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {filteredInvoices.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Hiển thị</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>/ {filteredInvoices.length} hóa đơn</span>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">
                {safeCurrentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trả nợ hóa đơn</DialogTitle>
          </DialogHeader>
          {payingInvoice && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p>Tổng tiền: <span className="font-bold">{payingInvoice.total.toLocaleString("vi-VN")}đ</span></p>
                <p>Đã trả: <span className="font-bold">{payingInvoice.currentPaid.toLocaleString("vi-VN")}đ</span></p>
                <p>Còn nợ: <span className="font-bold text-destructive">{(payingInvoice.total - payingInvoice.currentPaid).toLocaleString("vi-VN")}đ</span></p>
              </div>
              <div>
                <label className="text-sm font-medium">Số tiền thanh toán</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  min={0}
                  max={payingInvoice.total}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPayAmount(payingInvoice.total)}
                >
                  Trả hết
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPayAmount(payingInvoice.currentPaid)}
                >
                  Giữ nguyên
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Hủy</Button>
            <Button onClick={handlePayDebt} disabled={payDebt.isPending}>
              {payDebt.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa hóa đơn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} hóa đơn đã chọn? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInvoicesBatch.isPending}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={deleteInvoicesBatch.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteInvoicesBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Xóa {selectedIds.size} hóa đơn
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteFilteredOpen} onOpenChange={setDeleteFilteredOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa tất cả hóa đơn</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc muốn xóa toàn bộ {filteredInvoices.length} hóa đơn đang hiển thị theo bộ lọc hiện tại? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInvoicesBatch.isPending}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                disabled={deleteInvoicesBatch.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteInvoicesBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Xóa {filteredInvoices.length} hóa đơn
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailInvoice} onOpenChange={(open) => !open && setDetailInvoice(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Chi tiết hóa đơn — {detailInvoice?.roomName}
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (() => {
            const roomFee = Math.round(detailInvoice.duration * detailInvoice.roomPrice);
            const itemsTotal = detailInvoice.items.reduce((s, it) => s + it.price * it.quantity, 0);
            const totalQty = detailInvoice.items.reduce((s, it) => s + it.quantity, 0);
            const durationMinutes = Math.round(detailInvoice.duration * 60);
            const remainingDebt = Math.max(0, detailInvoice.total - detailInvoice.paidAmount);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/40 p-3 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground">Thời gian: </span>
                    <span className="font-medium">{detailInvoice.checkIn} - {detailInvoice.checkOut} ({durationMinutes} phút)</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ngày in: </span>
                    <span className="font-medium">{detailInvoice.date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nhân viên: </span>
                    <span className="font-medium">{detailInvoice.staffName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Khách hàng: </span>
                    <span className="font-medium">{detailInvoice.customerName || "Khách lẻ"}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Trạng thái: </span>
                    <Badge variant="secondary" className={`text-xs ${statusColor[detailInvoice.paymentStatus] || ""}`}>
                      {statusLabel[detailInvoice.paymentStatus] || detailInvoice.paymentStatus}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Danh sách các món đã gọi ({detailInvoice.items.length} món, tổng SL: {totalQty})
                  </h4>
                  {detailInvoice.items.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
                      Không có món gọi thêm (chỉ tính tiền giờ phòng)
                    </div>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="w-10 text-center">STT</TableHead>
                            <TableHead>Tên món</TableHead>
                            <TableHead className="text-right">Đơn giá</TableHead>
                            <TableHead className="text-center">SL</TableHead>
                            <TableHead className="text-right">Thành tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailInvoice.items.map((item, idx) => (
                            <TableRow key={item.id || `${item.name}-${idx}`}>
                              <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {item.price.toLocaleString("vi-VN")}đ
                              </TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">
                                {(item.price * item.quantity).toLocaleString("vi-VN")}đ
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-sm border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tiền giờ phòng ({detailInvoice.duration.toFixed(2)}h × {detailInvoice.roomPrice.toLocaleString("vi-VN")}đ):
                    </span>
                    <span className="font-medium">{roomFee.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền món:</span>
                    <span className="font-medium">{itemsTotal.toLocaleString("vi-VN")}đ</span>
                  </div>
                  {detailInvoice.discount > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Giảm giá:</span>
                      <span>
                        -{detailInvoice.discountType === "percentage"
                          ? `${detailInvoice.discount}%`
                          : `${detailInvoice.discount.toLocaleString("vi-VN")}đ`}
                      </span>
                    </div>
                  )}
                  {detailInvoice._raw?.tax_rate > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Thuế/phí ({detailInvoice._raw.tax_rate}%):</span>
                      <span>+{Math.max(0, detailInvoice.tax).toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-primary pt-1 border-t">
                    <span>Tổng cộng:</span>
                    <span>{detailInvoice.total.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đã thanh toán:</span>
                    <span className="font-semibold">{detailInvoice.paidAmount.toLocaleString("vi-VN")}đ</span>
                  </div>
                  {remainingDebt > 0 && (
                    <div className="flex justify-between text-destructive font-semibold">
                      <span>Còn nợ:</span>
                      <span>{remainingDebt.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDetailInvoice(null)}>
              Đóng
            </Button>
            {detailInvoice && (
              <>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={!!reprintingInvoice}
                  onClick={() => handleDirectReprint(detailInvoice)}
                >
                  {reprintingInvoice?.id === detailInvoice.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  In lại
                </Button>
                {canEdit && (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      const target = detailInvoice;
                      setDetailInvoice(null);
                      onLoadInvoice(target, target._raw);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Mở sửa
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reprintPayload && (
        <div
          aria-hidden="true"
          className="fixed -left-[9999px] top-0 w-[80mm] pointer-events-none opacity-0 print:hidden"
        >
          <InvoiceDisplay
            cardId="history-reprint-area"
            roomName={reprintPayload.roomName}
            roomPrice={reprintPayload.roomPrice}
            checkIn={reprintPayload.checkIn}
            checkOut={reprintPayload.checkOut}
            checkInDate={reprintPayload.checkInDate}
            checkOutDate={reprintPayload.checkOutDate}
            duration={reprintPayload.duration}
            actualDuration={reprintPayload.actualDuration}
            roomTimeCalculation={reprintPayload.roomTimeCalculation}
            items={reprintPayload.items}
            subtotal={reprintPayload.subtotal}
            discount={reprintPayload.discount}
            tax={reprintPayload.tax}
            taxRate={reprintPayload.taxRate}
            total={reprintPayload.total}
            staffName={reprintPayload.staffName}
            printedAt={reprintPayload.printedAt}
            paymentStatus={reprintPayload.paymentStatus}
            paidAmount={reprintPayload.paidAmount}
            customerName={reprintPayload.customerName}
          />
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;
