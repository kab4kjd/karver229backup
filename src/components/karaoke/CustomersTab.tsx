import { useMemo, useState, lazy, Suspense } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarIcon, Wallet, Users, AlertTriangle, Search, FileSpreadsheet, History, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeVi } from "@/lib/normalize";
import { useInvoices } from "@/hooks/useInvoices";
import { useDebtPayments } from "@/hooks/useDebtPayments";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

const CustomersDebtCharts = lazy(() => import("./CustomersDebtCharts"));

type Period = "day" | "month" | "custom" | "all";

const formatPrice = (n: number) => (n || 0).toLocaleString("vi-VN") + "đ";

const ALL_COLUMNS: { key: string; label: string; width: number }[] = [
  { key: "stt", label: "STT", width: 6 },
  { key: "date", label: "Ngày tạo", width: 18 },
  { key: "age", label: "Tuổi nợ (ngày)", width: 12 },
  { key: "customer", label: "Khách hàng", width: 22 },
  { key: "room", label: "Phòng", width: 12 },
  { key: "total", label: "Tổng tiền", width: 14 },
  { key: "paid", label: "Đã trả", width: 14 },
  { key: "remaining", label: "Còn nợ", width: 14 },
  { key: "status", label: "Trạng thái", width: 14 },
  { key: "staff", label: "Nhân viên", width: 16 },
];

const PREF_KEY = "customers_export_columns";

interface CustomersTabProps {
  canDeleteCustomer?: boolean;
}

const CustomersTab = ({ canDeleteCustomer = true }: CustomersTabProps) => {
  const { invoices, payDebt } = useInvoices();
  const { payments: allPayments } = useDebtPayments();

  const [period, setPeriod] = useState<Period>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState<Date>(new Date(Date.now() - 30 * 86400000));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  // Per-column filters (grid filters)
  const [fCustomer, setFCustomer] = useState("");
  const [fRoom, setFRoom] = useState("");
  const [fStatus, setFStatus] = useState<"all" | "debt" | "partial">("all");
  const [fAge, setFAge] = useState<"all" | "lt15" | "15to30" | "gt30">("all");
  const [fMinRemain, setFMinRemain] = useState("");
  const [fMaxRemain, setFMaxRemain] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  const [payDialog, setPayDialog] = useState<{ id: string; total: number; paid: number; customer: string } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [customerHistoryName, setCustomerHistoryName] = useState<string | null>(null);

  const [showDetails, setShowDetails] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set(ALL_COLUMNS.map((c) => c.key));
  });

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(PREF_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const dateRange = useMemo(() => {
    if (period === "all") return null;
    let start: Date, end: Date;
    if (period === "day") {
      start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
      end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
    } else if (period === "month") {
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(customStart); start.setHours(0, 0, 0, 0);
      end = new Date(customEnd); end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [period, selectedDate, customStart, customEnd]);

  const baseDebtInvoices = useMemo(() => {
    return (invoices as any[])
      .filter((inv) => {
        const s = inv.payment_status;
        if (s !== "debt" && s !== "partial") return false;
        if (dateRange) {
          const d = new Date(inv.created_at);
          if (d < dateRange.start || d > dateRange.end) return false;
        }
        return true;
      })
      .map((inv) => {
        const remaining = Math.max(0, (inv.total_amount || 0) - (inv.paid_amount || 0));
        const ageDays = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / 86400000);
        return { ...inv, remaining, ageDays };
      });
  }, [invoices, dateRange]);

  const debtInvoices = useMemo(() => {
    const minR = Number(fMinRemain) || 0;
    const maxR = fMaxRemain ? Number(fMaxRemain) : Infinity;
    const gq = normalizeVi(globalSearch);
    const cq = normalizeVi(fCustomer);
    const rq = normalizeVi(fRoom);
    return baseDebtInvoices
      .filter((inv) => {
        if (fStatus !== "all" && inv.payment_status !== fStatus) return false;
        if (fAge !== "all") {
          const okAge = fAge === "lt15" ? inv.ageDays < 15 : fAge === "15to30" ? inv.ageDays >= 15 && inv.ageDays <= 30 : inv.ageDays > 30;
          if (!okAge) return false;
        }
        if (inv.remaining < minR || inv.remaining > maxR) return false;
        if (cq && !normalizeVi(inv.customer_name || "").includes(cq)) return false;
        if (rq && !normalizeVi(inv.room_name || "").includes(rq)) return false;
        if (gq) {
          const hay = `${normalizeVi(inv.customer_name || "")} ${normalizeVi(inv.room_name || "")}`;
          if (!hay.includes(gq)) return false;
        }
        return true;
      })
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [baseDebtInvoices, fCustomer, fRoom, fStatus, fAge, fMinRemain, fMaxRemain, globalSearch]);

  const totals = useMemo(() => {
    const totalDebt = debtInvoices.reduce((s, i) => s + i.remaining, 0);
    const totalPaid = debtInvoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    return { totalDebt, totalPaid, count: debtInvoices.length };
  }, [debtInvoices]);

  const ageBuckets = useMemo(() => {
    const b = [
      { key: "lt15", label: "< 15 ngày", count: 0, amount: 0 },
      { key: "15to30", label: "15-30 ngày", count: 0, amount: 0 },
      { key: "gt30", label: "> 30 ngày", count: 0, amount: 0 },
    ];
    debtInvoices.forEach((inv) => {
      const bucket = inv.ageDays < 15 ? 0 : inv.ageDays <= 30 ? 1 : 2;
      b[bucket].count += 1;
      b[bucket].amount += inv.remaining;
    });
    return b;
  }, [debtInvoices]);

  const openPayDialog = (inv: any) => {
    setPayDialog({ id: inv.id, total: inv.total_amount, paid: inv.paid_amount || 0, customer: inv.customer_name || "" });
    setPayAmount(String(inv.remaining || ""));
    setPayNote("");
  };

  const handleConfirmPay = async () => {
    if (!payDialog) return;
    const additional = Number(payAmount) || 0;
    if (additional <= 0) return;
    const newPaid = Math.min(payDialog.total, payDialog.paid + additional);
    await payDebt.mutateAsync({
      id: payDialog.id,
      paidAmount: newPaid,
      customerName: payDialog.customer || undefined,
      note: payNote || undefined,
      paymentDelta: newPaid - payDialog.paid,
    });
    setPayDialog(null);
  };

  const exportToExcel = async () => {
    const XLSX = await import("@datalens-tech/xlsx");
    const colDefs = ALL_COLUMNS.filter((c) => selectedColumns.has(c.key));
    const statusLabel = (s: string) => (s === "paid" ? "Đã thanh toán" : s === "debt" ? "Nợ" : s === "partial" ? "Trả một phần" : s || "");
    const getVal = (inv: any, key: string, idx: number): any => {
      switch (key) {
        case "stt": return idx + 1;
        case "date": return format(new Date(inv.created_at), "dd/MM/yyyy HH:mm");
        case "age": return inv.ageDays;
        case "customer": return inv.customer_name || "";
        case "room": return inv.room_name;
        case "total": return inv.total_amount || 0;
        case "paid": return inv.paid_amount || 0;
        case "remaining": return inv.remaining;
        case "status": return statusLabel(inv.payment_status);
        case "staff": return inv.staff_name || "";
        default: return "";
      }
    };
    const rows = debtInvoices.map((inv, i) => {
      const r: Record<string, any> = {};
      colDefs.forEach((c) => { r[c.label] = getVal(inv, c.key, i); });
      return r;
    });
    const summary: Record<string, any> = {};
    colDefs.forEach((c) => {
      summary[c.label] =
        c.key === "date" ? "TỔNG CỘNG"
        : c.key === "total" ? debtInvoices.reduce((s, i) => s + (i.total_amount || 0), 0)
        : c.key === "paid" ? totals.totalPaid
        : c.key === "remaining" ? totals.totalDebt
        : "";
    });
    rows.push(summary);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoá đơn nợ");
    ws["!cols"] = colDefs.map((c) => ({ wch: c.width }));
    XLSX.writeFile(wb, `hoa-don-no-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Kỳ báo cáo</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-40 mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="day">Theo ngày</SelectItem>
                <SelectItem value="month">Theo tháng</SelectItem>
                <SelectItem value="custom">Tùy chọn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(period === "day" || period === "month") && (
            <div>
              <Label>{period === "day" ? "Ngày" : "Tháng"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-48 justify-start text-left font-normal mt-2">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {period === "day" ? format(selectedDate, "dd/MM/yyyy") : format(selectedDate, "MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {period === "custom" && (
            <>
              <div>
                <Label>Từ ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48 justify-start text-left font-normal mt-2">
                      <CalendarIcon className="mr-2 h-4 w-4" />{format(customStart, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customStart} onSelect={(d) => d && setCustomStart(d)} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Đến ngày</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-48 justify-start text-left font-normal mt-2">
                      <CalendarIcon className="mr-2 h-4 w-4" />{format(customEnd, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customEnd} onSelect={(d) => d && setCustomEnd(d)} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-4 cursor-pointer hover:shadow-md transition"
          onClick={() => totals.count > 0 && setShowDetails(true)}
          title="Bấm để xem chi tiết & xuất Excel"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Số hoá đơn nợ (bấm xem chi tiết)</p>
              <p className="text-2xl font-bold text-primary">{totals.count}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng còn nợ</p>
              <p className="text-2xl font-bold text-destructive">{formatPrice(totals.totalDebt)}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Đã trả một phần</p>
              <p className="text-2xl font-bold text-success">{formatPrice(totals.totalPaid)}</p>
            </div>
            <Wallet className="h-8 w-8 text-success" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
        <CustomersDebtCharts ageBuckets={ageBuckets} />
      </Suspense>

      {/* Table */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold">Danh sách hoá đơn nợ ({debtInvoices.length})</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Tìm nhanh theo tên khách / phòng (không dấu OK)…"
              className="pl-8"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày</TableHead>
              <TableHead>Tuổi nợ</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead className="text-right">Đã trả</TableHead>
              <TableHead className="text-right">Còn nợ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
            {/* Filter row */}
            <TableRow className="bg-muted/40">
              <TableHead />
              <TableHead>
                <Select value={fAge} onValueChange={(v) => setFAge(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="lt15">&lt; 15</SelectItem>
                    <SelectItem value="15to30">15–30</SelectItem>
                    <SelectItem value="gt30">&gt; 30</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead>
                <Input value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} placeholder="Lọc KH…" className="h-8 text-xs" />
              </TableHead>
              <TableHead>
                <Input value={fRoom} onChange={(e) => setFRoom(e.target.value)} placeholder="Lọc phòng…" className="h-8 text-xs" />
              </TableHead>
              <TableHead />
              <TableHead />
              <TableHead>
                <div className="flex gap-1">
                  <Input value={fMinRemain} onChange={(e) => setFMinRemain(e.target.value)} placeholder="Min" className="h-8 text-xs w-20" type="number" />
                  <Input value={fMaxRemain} onChange={(e) => setFMaxRemain(e.target.value)} placeholder="Max" className="h-8 text-xs w-20" type="number" />
                </div>
              </TableHead>
              <TableHead>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="debt">Nợ</SelectItem>
                    <SelectItem value="partial">Trả một phần</SelectItem>
                  </SelectContent>
                </Select>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFCustomer(""); setFRoom(""); setFStatus("all"); setFAge("all");
                    setFMinRemain(""); setFMaxRemain(""); setGlobalSearch("");
                  }}
                >
                  Xoá lọc
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debtInvoices.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Không có hoá đơn nợ</TableCell></TableRow>
            ) : debtInvoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{format(new Date(inv.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                    inv.ageDays < 15 ? "bg-blue-100 text-blue-800" :
                    inv.ageDays <= 30 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800")}>
                    {inv.ageDays} ngày
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {inv.customer_name ? (
                    <button
                      className="underline underline-offset-2 hover:text-primary"
                      onClick={() => setCustomerHistoryName(inv.customer_name)}
                      title="Xem toàn bộ lịch sử nợ & trả của khách"
                    >
                      {inv.customer_name}
                    </button>
                  ) : <span className="text-muted-foreground italic">chưa có</span>}
                </TableCell>
                <TableCell>{inv.room_name}</TableCell>
                <TableCell className="text-right">{formatPrice(inv.total_amount)}</TableCell>
                <TableCell className="text-right text-success">{formatPrice(inv.paid_amount || 0)}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{formatPrice(inv.remaining)}</TableCell>
                <TableCell>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                    inv.payment_status === "debt" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800")}>
                    {inv.payment_status === "debt" ? "Nợ" : "Trả một phần"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setHistoryInvoiceId(inv.id)}>Lịch sử</Button>
                  <Button size="sm" onClick={() => openPayDialog(inv)}>Cập nhật trả</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Customer management CRUD */}
      <CustomerListSection
        allInvoices={invoices as any[]}
        onOpenHistory={(name) => setCustomerHistoryName(name)}
        canDeleteCustomer={canDeleteCustomer}
      />



      {/* Details + Excel export dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chi tiết hoá đơn nợ ({debtInvoices.length})</DialogTitle>
          </DialogHeader>
          <div className="border rounded p-3 bg-muted/30">
            <div className="text-sm font-medium mb-2">Chọn cột xuất Excel:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedColumns.has(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div className="overflow-auto flex-1 mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>STT</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Khách</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Đã trả</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtInvoices.map((inv, i) => (
                  <TableRow key={inv.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{format(new Date(inv.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{inv.customer_name || "-"}</TableCell>
                    <TableCell>{inv.room_name}</TableCell>
                    <TableCell className="text-right">{formatPrice(inv.total_amount)}</TableCell>
                    <TableCell className="text-right text-success">{formatPrice(inv.paid_amount || 0)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatPrice(inv.remaining)}</TableCell>
                    <TableCell>{inv.payment_status === "debt" ? "Nợ" : "Trả một phần"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={exportToExcel} className="gap-2" disabled={selectedColumns.size === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel ({selectedColumns.size} cột)
            </Button>
            <Button variant="secondary" onClick={() => setShowDetails(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật thanh toán</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Tổng: <b>{formatPrice(payDialog.total)}</b> · Đã trả: <b>{formatPrice(payDialog.paid)}</b> · Còn nợ: <b className="text-destructive">{formatPrice(payDialog.total - payDialog.paid)}</b>
              </div>
              <div>
                <Label>Tên khách hàng</Label>
                <Input value={payDialog.customer} onChange={(e) => setPayDialog({ ...payDialog, customer: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label>Số tiền trả thêm</Label>
                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>Ghi chú (tuỳ chọn)</Label>
                <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} className="mt-2" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Huỷ</Button>
            <Button onClick={handleConfirmPay} disabled={!Number(payAmount) || payDebt.isPending}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-invoice history */}
      <PaymentHistoryDialog invoiceId={historyInvoiceId} onClose={() => setHistoryInvoiceId(null)} />

      {/* Customer-wide history */}
      <CustomerHistoryDialog
        customerName={customerHistoryName}
        allInvoices={invoices as any[]}
        allPayments={allPayments}
        onClose={() => setCustomerHistoryName(null)}
      />
    </div>
  );
};

const PaymentHistoryDialog = ({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) => {
  const { payments, isLoading } = useDebtPayments(invoiceId || undefined);
  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lịch sử thanh toán</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Đang tải…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chưa có lần trả nợ nào</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày trả</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{format(new Date(p.paid_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell className="text-right font-medium text-success">{formatPrice(Number(p.amount))}</TableCell>
                  <TableCell className="text-muted-foreground">{p.note || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CustomerHistoryDialog = ({
  customerName, allInvoices, allPayments, onClose,
}: {
  customerName: string | null;
  allInvoices: any[];
  allPayments: any[];
  onClose: () => void;
}) => {
  const data = useMemo(() => {
    if (!customerName) return { invoices: [] as any[], payments: [] as any[], totalOwed: 0, totalPaid: 0, totalRemain: 0 };
    const target = normalizeVi(customerName);
    const invs = allInvoices.filter(
      (i) => normalizeVi(i.customer_name || "") === target && (i.payment_status === "debt" || i.payment_status === "partial" || (i.paid_amount || 0) > 0 && i.payment_status === "paid"),
    );
    const invIds = new Set(invs.map((i) => i.id));
    const pays = allPayments.filter((p) => invIds.has(p.invoice_id));
    const totalOwed = invs.reduce((s, i) => s + (i.total_amount || 0), 0);
    const totalPaid = invs.reduce((s, i) => s + (i.paid_amount || 0), 0);
    return { invoices: invs, payments: pays, totalOwed, totalPaid, totalRemain: Math.max(0, totalOwed - totalPaid) };
  }, [customerName, allInvoices, allPayments]);

  return (
    <Dialog open={!!customerName} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Lịch sử khách hàng: {customerName}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3"><div className="text-xs text-muted-foreground">Số hoá đơn nợ</div><div className="text-lg font-bold">{data.invoices.length}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Đã trả</div><div className="text-lg font-bold text-success">{formatPrice(data.totalPaid)}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">Còn nợ</div><div className="text-lg font-bold text-destructive">{formatPrice(data.totalRemain)}</div></Card>
        </div>
        <div className="overflow-auto flex-1 space-y-4 mt-2">
          <div>
            <div className="font-semibold mb-2">Hoá đơn</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Đã trả</TableHead>
                  <TableHead className="text-right">Còn nợ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => {
                  const remain = Math.max(0, (inv.total_amount || 0) - (inv.paid_amount || 0));
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>{format(new Date(inv.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{inv.room_name}</TableCell>
                      <TableCell className="text-right">{formatPrice(inv.total_amount)}</TableCell>
                      <TableCell className="text-right text-success">{formatPrice(inv.paid_amount || 0)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatPrice(remain)}</TableCell>
                      <TableCell>{inv.payment_status === "paid" ? "Đã thanh toán" : inv.payment_status === "debt" ? "Nợ" : "Trả một phần"}</TableCell>
                    </TableRow>
                  );
                })}
                {data.invoices.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="font-semibold mb-2">Các lần trả nợ</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày trả</TableHead>
                  <TableHead>Hoá đơn (phòng)</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => {
                  const inv = data.invoices.find((i) => i.id === p.invoice_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.paid_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{inv?.room_name || "-"}</TableCell>
                      <TableCell className="text-right font-medium text-success">{formatPrice(Number(p.amount))}</TableCell>
                      <TableCell className="text-muted-foreground">{p.note || "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {data.payments.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có lần trả nợ</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CustomerListSection = ({
  allInvoices,
  onOpenHistory,
  canDeleteCustomer = true,
}: {
  allInvoices: any[];
  onOpenHistory: (name: string) => void;
  canDeleteCustomer?: boolean;
}) => {
  const { customers, isLoading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", phone: "", address: "", note: "" });
    setCreating(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || "", address: c.address || "", note: c.note || "" });
    setCreating(true);
  };
  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await updateCustomer.mutateAsync({ id: editing.id, ...form });
    } else {
      await addCustomer.mutateAsync(form);
    }
    setCreating(false);
    setEditing(null);
  };

  // Tổng hợp toàn thời gian từ các hóa đơn nợ / trả một phần theo tên khách hàng
  const debtByCustomerMap = useMemo(() => {
    const map = new Map<string, { debtCount: number; paidTotal: number; remainTotal: number }>();
    for (const inv of allInvoices) {
      if (inv.payment_status !== "debt" && inv.payment_status !== "partial") continue;
      const key = normalizeVi(inv.customer_name || "").trim();
      if (!key) continue;
      const paid = Number(inv.paid_amount || 0);
      const remain = Math.max(0, Number(inv.total_amount || 0) - paid);
      const prev = map.get(key) || { debtCount: 0, paidTotal: 0, remainTotal: 0 };
      prev.debtCount += 1;
      prev.paidTotal += paid;
      prev.remainTotal += remain;
      map.set(key, prev);
    }
    return map;
  }, [allInvoices]);

  const filtered = useMemo(() => {
    const q = normalizeVi(search);
    const list = !q
      ? customers
      : customers.filter((c) =>
          normalizeVi(c.name).includes(q) ||
          normalizeVi(c.phone || "").includes(q) ||
          normalizeVi(c.address || "").includes(q),
        );
    return list.map((c) => {
      const stats = debtByCustomerMap.get(normalizeVi(c.name).trim()) || {
        debtCount: 0,
        paidTotal: 0,
        remainTotal: 0,
      };
      return { ...c, ...stats };
    });
  }, [customers, search, debtByCustomerMap]);

  const summaryTotals = useMemo(() => {
    return filtered.reduce(
      (acc, c) => {
        acc.debtCount += c.debtCount;
        acc.paidTotal += c.paidTotal;
        acc.remainTotal += c.remainTotal;
        return acc;
      },
      { debtCount: 0, paidTotal: 0, remainTotal: 0 },
    );
  }, [filtered]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold">Danh sách khách hàng ({filtered.length})</h3>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên / SĐT…"
              className="pl-8"
            />
          </div>
          <Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Thêm</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên khách hàng</TableHead>
              <TableHead>Số điện thoại</TableHead>
              <TableHead className="text-right">Số hoá đơn nợ</TableHead>
              <TableHead className="text-right">Đã trả</TableHead>
              <TableHead className="text-right">Còn nợ</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Đang tải…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có khách hàng</TableCell></TableRow>
            ) : filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <button
                    className="underline underline-offset-2 hover:text-primary text-left"
                    onClick={() => onOpenHistory(c.name)}
                    title="Xem lịch sử nợ & trả"
                  >
                    {c.name}
                  </button>
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.phone || <span className="text-muted-foreground italic">—</span>}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {c.debtCount > 0 ? (
                    <button
                      className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                      onClick={() => onOpenHistory(c.name)}
                      title="Xem các hóa đơn nợ"
                    >
                      {c.debtCount}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className={cn("text-right whitespace-nowrap", c.paidTotal > 0 ? "text-success font-medium" : "text-muted-foreground")}>
                  {formatPrice(c.paidTotal)}
                </TableCell>
                <TableCell className={cn("text-right whitespace-nowrap", c.remainTotal > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                  {formatPrice(c.remainTotal)}
                </TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)} title="Sửa khách hàng"><Pencil className="h-3.5 w-3.5" /></Button>
                  {canDeleteCustomer && (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(c.id)} title="Xóa khách hàng"><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {filtered.length > 0 && (
            <tfoot>
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2} className="text-right">
                  Tổng cộng ({filtered.length} khách hàng):
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {summaryTotals.debtCount}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-success">
                  {formatPrice(summaryTotals.paidTotal)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap text-destructive">
                  {formatPrice(summaryTotals.remainTotal)}
                </TableCell>
                <TableCell />
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên khách hàng *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2" autoFocus />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Huỷ</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || addCustomer.isPending || updateCustomer.isPending}>
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Lịch sử hoá đơn nợ của khách vẫn được giữ nguyên.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId && canDeleteCustomer) { await deleteCustomer.mutateAsync(deleteId); setDeleteId(null); } }}>Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CustomersTab;

