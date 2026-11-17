import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Download,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  Package,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface InventoryAnalyticsDialogProps {
  items: { id: string; name: string; price: number; category_id: string; shorthand?: string | null }[];
  categories: { id: string; name: string; unit_multiplier?: number }[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface CheckWithRecords {
  id: string;
  check_date: string;
  start_date: string;
  end_date: string;
  created_at: string;
  check_mode?: string;
  records: {
    id: string;
    item_id: string;
    item_name: string;
    opening_stock: number;
    imported: number;
    sold: number;
    theoretical_stock: number;
    actual_stock: number;
    difference: number;
    note: string | null;
  }[];
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

const formatCheckPeriod = (startDate?: string, endDate?: string, checkDate?: string) => {
  const start = startDate || checkDate;
  const end = endDate || checkDate;
  if (!start && !end) return "";
  if (!start) return formatDateDisplay(end!);
  if (!end || start === end) return formatDateDisplay(start);
  return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
};

export const InventoryAnalyticsDialog: React.FC<InventoryAnalyticsDialogProps> = ({
  items,
  categories,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : internalOpen;
  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChangeProp?.(next);
    },
    [isControlled, onOpenChangeProp]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [checkSessions, setCheckSessions] = useState<CheckWithRecords[]>([]);
  const [timePreset, setTimePreset] = useState<"7days" | "30days" | "thisMonth" | "all" | "custom">("30days");
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [diffFilter, setDiffFilter] = useState<"all" | "loss_only" | "surplus_only" | "mismatch_only">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "top_loss" | "trend" | "records">("overview");

  // Create lookup maps for performance
  const itemMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; price: number; category_id: string }>();
    items.forEach((item) => {
      map.set(item.id, item);
      map.set(item.name.toLowerCase().trim(), item);
    });
    return map;
  }, [items]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Load inventory checks and records
  const loadAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch checks
      let query = supabase
        .from("inventory_checks")
        .select("*")
        .order("created_at", { ascending: false });

      if (timePreset !== "all") {
        if (startDate) {
          query = query.gte("check_date", startDate);
        }
        if (endDate) {
          query = query.lte("check_date", endDate);
        }
      }

      const { data: checks, error: checksError } = await query;
      if (checksError) throw checksError;

      if (!checks || checks.length === 0) {
        setCheckSessions([]);
        setIsLoading(false);
        return;
      }

      const checkIds = checks.map((c) => c.id);

      // 2. Fetch records for all these checks
      const { data: records, error: recordsError } = await supabase
        .from("inventory_check_records")
        .select("*")
        .in("check_id", checkIds);

      if (recordsError) throw recordsError;

      // Group records by check_id
      const recordsByCheck = new Map<string, any[]>();
      records?.forEach((rec) => {
        if (!recordsByCheck.has(rec.check_id)) {
          recordsByCheck.set(rec.check_id, []);
        }
        recordsByCheck.get(rec.check_id)!.push(rec);
      });

      const fullSessions: CheckWithRecords[] = checks.map((chk) => ({
        ...chk,
        records: recordsByCheck.get(chk.id) || [],
      }));

      setCheckSessions(fullSessions);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu báo cáo kiểm kho:", err);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu báo cáo kiểm kho",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [timePreset, startDate, endDate]);

  useEffect(() => {
    if (isOpen) {
      loadAnalyticsData();
    }
  }, [isOpen, loadAnalyticsData]);

  const handleTimePresetChange = (preset: "7days" | "30days" | "thisMonth" | "all" | "custom") => {
    setTimePreset(preset);
    const now = new Date();
    const endStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
    setEndDate(endStr);

    if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`);
    } else if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`);
    } else if (preset === "thisMonth") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(`${startOfMonth.getFullYear()}-${(startOfMonth.getMonth() + 1).toString().padStart(2, "0")}-01`);
    }
  };

  // Process and flatten records based on active filters
  const processedRecords = useMemo(() => {
    const list: Array<{
      checkId: string;
      checkDate: string;
      periodDisplay: string;
      checkCreatedAt: string;
      recordId: string;
      itemId: string;
      itemName: string;
      categoryName: string;
      unitPrice: number;
      openingStock: number;
      imported: number;
      sold: number;
      theoreticalStock: number;
      actualStock: number;
      difference: number;
      lossQuantity: number;
      surplusQuantity: number;
      lossValue: number;
      surplusValue: number;
      netValue: number;
      note: string;
    }> = [];

    checkSessions.forEach((session) => {
      session.records.forEach((rec) => {
        // Resolve item details
        const matchedItem = itemMap.get(rec.item_id) || itemMap.get(rec.item_name.toLowerCase().trim());
        const categoryId = matchedItem?.category_id || "";
        const categoryName = categoryMap.get(categoryId) || "Khác";
        const unitPrice = matchedItem?.price || 0;

        // Filters:
        // Category filter
        if (selectedCategory !== "all" && categoryId !== selectedCategory) {
          return;
        }

        // Difference filter
        if (diffFilter === "loss_only" && rec.difference >= 0) return;
        if (diffFilter === "surplus_only" && rec.difference <= 0) return;
        if (diffFilter === "mismatch_only" && rec.difference === 0) return;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = rec.item_name.toLowerCase().includes(q);
          const matchCat = categoryName.toLowerCase().includes(q);
          if (!matchName && !matchCat) return;
        }

        const diff = rec.difference;
        const lossQty = diff < 0 ? Math.abs(diff) : 0;
        const surplusQty = diff > 0 ? diff : 0;
        const lossVal = lossQty * unitPrice;
        const surplusVal = surplusQty * unitPrice;
        const netVal = surplusVal - lossVal;
        const periodDisplay = formatCheckPeriod(session.start_date, session.end_date, session.check_date);

        list.push({
          checkId: session.id,
          checkDate: session.check_date || session.start_date,
          periodDisplay,
          checkCreatedAt: session.created_at,
          recordId: rec.id,
          itemId: rec.item_id,
          itemName: rec.item_name,
          categoryName,
          unitPrice,
          openingStock: rec.opening_stock,
          imported: rec.imported,
          sold: rec.sold,
          theoreticalStock: rec.theoretical_stock,
          actualStock: rec.actual_stock,
          difference: diff,
          lossQuantity: lossQty,
          surplusQuantity: surplusQty,
          lossValue: lossVal,
          surplusValue: surplusVal,
          netValue: netVal,
          note: rec.note || "",
        });
      });
    });

    return list;
  }, [checkSessions, selectedCategory, diffFilter, searchQuery, itemMap, categoryMap]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let totalChecks = checkSessions.length;
    let totalLossQty = 0;
    let totalLossVal = 0;
    let totalSurplusQty = 0;
    let totalSurplusVal = 0;
    let totalMismatchCount = 0;

    processedRecords.forEach((r) => {
      totalLossQty += r.lossQuantity;
      totalLossVal += r.lossValue;
      totalSurplusQty += r.surplusQuantity;
      totalSurplusVal += r.surplusValue;
      if (r.difference !== 0) totalMismatchCount++;
    });

    const netValue = totalSurplusVal - totalLossVal;

    return {
      totalChecks,
      totalLossQty,
      totalLossVal,
      totalSurplusQty,
      totalSurplusVal,
      totalMismatchCount,
      netValue,
    };
  }, [checkSessions, processedRecords]);

  // Top Loss Items aggregation
  const topLossItems = useMemo(() => {
    const agg = new Map<string, {
      itemName: string;
      categoryName: string;
      unitPrice: number;
      totalLossQty: number;
      totalLossVal: number;
      lossTimes: number;
      totalChecksInvolved: number;
    }>();

    processedRecords.forEach((r) => {
      if (!agg.has(r.itemName)) {
        agg.set(r.itemName, {
          itemName: r.itemName,
          categoryName: r.categoryName,
          unitPrice: r.unitPrice,
          totalLossQty: 0,
          totalLossVal: 0,
          lossTimes: 0,
          totalChecksInvolved: 0,
        });
      }
      const entry = agg.get(r.itemName)!;
      entry.totalChecksInvolved += 1;
      if (r.difference < 0) {
        entry.totalLossQty += r.lossQuantity;
        entry.totalLossVal += r.lossValue;
        entry.lossTimes += 1;
      }
    });

    return Array.from(agg.values())
      .filter((item) => item.totalLossQty > 0)
      .sort((a, b) => b.totalLossVal - a.totalLossVal);
  }, [processedRecords]);

  // Trend data by check date
  const trendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; displayDate: string; lossQty: number; surplusQty: number; lossVal: number; surplusVal: number }>();

    // Process from oldest to newest
    const sorted = [...checkSessions].sort((a, b) => new Date(a.check_date || a.created_at).getTime() - new Date(b.check_date || b.created_at).getTime());

    sorted.forEach((session) => {
      const d = session.check_date || session.start_date;
      if (!dateMap.has(d)) {
        dateMap.set(d, {
          date: d,
          displayDate: formatDateDisplay(d),
          lossQty: 0,
          surplusQty: 0,
          lossVal: 0,
          surplusVal: 0,
        });
      }
      const dayEntry = dateMap.get(d)!;

      session.records.forEach((rec) => {
        const matchedItem = itemMap.get(rec.item_id) || itemMap.get(rec.item_name.toLowerCase().trim());
        const price = matchedItem?.price || 0;

        if (rec.difference < 0) {
          const lQty = Math.abs(rec.difference);
          dayEntry.lossQty += lQty;
          dayEntry.lossVal += lQty * price;
        } else if (rec.difference > 0) {
          dayEntry.surplusQty += rec.difference;
          dayEntry.surplusVal += rec.difference * price;
        }
      });
    });

    return Array.from(dateMap.values());
  }, [checkSessions, itemMap]);

  // Export Excel function
  const handleExportExcel = async () => {
    try {
      const XLSX = await import("@datalens-tech/xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp KPI & Top món thất thoát
      const summaryRows = [
        ["BÁO CÁO THỐNG KÊ BIẾN ĐỘNG & HAO HỤT KIỂM KHO"],
        [`Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`],
        [`Khoảng thời gian: ${timePreset === "all" ? "Tất cả" : `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`}`],
        [],
        ["TỔNG QUAN CHỈ SỐ"],
        ["Tổng số đợt kiểm kho", metrics.totalChecks],
        ["Tổng số bản ghi lệch", metrics.totalMismatchCount],
        ["Tổng số lượng thiếu (lon/đơn vị)", metrics.totalLossQty],
        ["Tổng giá trị thất thoát (VNĐ)", metrics.totalLossVal],
        ["Tổng số lượng thừa (lon/đơn vị)", metrics.totalSurplusQty],
        ["Tổng giá trị dôi thừa (VNĐ)", metrics.totalSurplusVal],
        ["Giá trị chênh lệch ròng (VNĐ)", metrics.netValue],
        [],
        ["TOP MẶT HÀNG THẤT THOÁT CAO NHẤT"],
        ["STT", "Tên mặt hàng", "Nhóm hàng", "Đơn giá", "Tổng lượng thiếu", "Thành tiền mất mát (VNĐ)", "Số lần bị thiếu"],
      ];

      topLossItems.forEach((item, idx) => {
        summaryRows.push([
          (idx + 1).toString(),
          item.itemName,
          item.categoryName,
          item.unitPrice.toString(),
          item.totalLossQty.toString(),
          item.totalLossVal.toString(),
          item.lossTimes.toString(),
        ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "TongQuan_TopHaoHut");

      // Sheet 2: Chi tiết tất cả các bản ghi
      const detailRows = [
        ["CHI TIẾT CÁC LẦN KIỂM KHO CÓ DỮ LIỆU"],
        [
          "STT",
          "Khoảng thời gian kiểm",
          "Tên món",
          "Nhóm hàng",
          "Đơn giá (VNĐ)",
          "Tồn đầu",
          "Nhập",
          "Bán",
          "Tồn lý thuyết",
          "Tồn thực tế",
          "Chênh lệch (SL)",
          "Thành tiền chênh lệch (VNĐ)",
          "Trạng thái",
          "Ghi chú",
        ],
      ];

      processedRecords.forEach((r, idx) => {
        detailRows.push([
          (idx + 1).toString(),
          r.periodDisplay,
          r.itemName,
          r.categoryName,
          r.unitPrice.toString(),
          r.openingStock.toString(),
          r.imported.toString(),
          r.sold.toString(),
          r.theoreticalStock.toString(),
          r.actualStock.toString(),
          r.difference.toString(),
          (r.difference * r.unitPrice).toString(),
          r.difference < 0 ? "Thiếu" : r.difference > 0 ? "Thừa" : "Khớp",
          r.note || "",
        ]);
      });

      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, "ChiTietKiemKho");

      const fileName = `BaoCao_HaoHut_KiemKho_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Xuất thành công",
        description: `Đã xuất báo cáo thống kê: ${fileName}`,
      });
    } catch (err) {
      console.error("Lỗi xuất Excel báo cáo:", err);
      toast({
        title: "Lỗi",
        description: "Không thể xuất file Excel",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button variant="outline" className="border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <BarChart3 className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" />
              <span>Báo cáo</span>
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                Báo cáo Thống kê Hao hụt & Biến động Kho
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Tổng hợp từ dữ liệu lịch sử kiểm kho • Tuyệt đối an toàn, không ảnh hưởng số liệu kho gốc
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAnalyticsData}
                disabled={isLoading}
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Xuất Excel báo cáo
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-3">
            {/* Time Preset */}
            <div>
              <Label className="text-xs text-muted-foreground">Khoảng thời gian</Label>
              <Select value={timePreset} onValueChange={(val: any) => handleTimePresetChange(val)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">7 ngày qua</SelectItem>
                  <SelectItem value="30days">30 ngày qua</SelectItem>
                  <SelectItem value="thisMonth">Tháng này</SelectItem>
                  <SelectItem value="all">Toàn bộ lịch sử</SelectItem>
                  <SelectItem value="custom">Tùy chọn ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dates if selected */}
            {timePreset === "custom" ? (
              <div className="flex items-end gap-1.5">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Từ ngày</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Đến ngày</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            ) : (
              /* Category Filter */
              <div>
                <Label className="text-xs text-muted-foreground">Danh mục hàng hóa</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Tất cả nhóm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả nhóm hàng</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Difference Filter */}
            <div>
              <Label className="text-xs text-muted-foreground">Lọc chênh lệch</Label>
              <Select value={diffFilter} onValueChange={(val: any) => setDiffFilter(val)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả số liệu</SelectItem>
                  <SelectItem value="mismatch_only">Chỉ món có lệch (≠ 0)</SelectItem>
                  <SelectItem value="loss_only">Chỉ món hao hụt (thiếu)</SelectItem>
                  <SelectItem value="surplus_only">Chỉ món dôi thừa (thừa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Item */}
            <div>
              <Label className="text-xs text-muted-foreground">Tìm kiếm mặt hàng</Label>
              <div className="relative mt-1">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tên món..."
                  className="h-8 text-xs pl-8"
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-3">
          {/* Total Checks */}
          <div className="rounded-lg border bg-card p-3 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Số đợt kiểm kê</span>
              <Package className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-1 text-2xl font-bold">{metrics.totalChecks}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ghi nhận {metrics.totalMismatchCount} lượt lệch
            </p>
          </div>

          {/* Loss / Shrinkage */}
          <div className="rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 p-3 shadow-xs">
            <div className="flex items-center justify-between text-red-600 dark:text-red-400">
              <span className="text-xs font-semibold flex items-center gap-1">
                <TrendingDown className="h-4 w-4" /> Tổng thất thoát (Thiếu)
              </span>
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                -{metrics.totalLossQty}
              </Badge>
            </div>
            <div className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(metrics.totalLossVal)}
            </div>
            <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
              Thiếu tổng cộng {metrics.totalLossQty} lon/chai/đơn vị
            </p>
          </div>

          {/* Surplus */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
              <span className="text-xs font-semibold flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Tổng dôi thừa (Thừa)
              </span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                +{metrics.totalSurplusQty}
              </Badge>
            </div>
            <div className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(metrics.totalSurplusVal)}
            </div>
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
              Dôi dư tổng cộng {metrics.totalSurplusQty} lon/chai/đơn vị
            </p>
          </div>

          {/* Net Impact */}
          <div className="rounded-lg border bg-card p-3 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Chênh lệch ròng</span>
              {metrics.netValue >= 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div className={`mt-1 text-xl font-bold ${metrics.netValue < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {formatCurrency(metrics.netValue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.netValue < 0 ? "Thâm hụt ròng so với lý thuyết" : "Dương ròng so với lý thuyết"}
            </p>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 w-full mb-2">
            <TabsTrigger value="overview" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1.5" />
              Tổng quan & Đánh giá
            </TabsTrigger>
            <TabsTrigger value="top_loss" className="text-xs">
              <TrendingDown className="h-3.5 w-3.5 mr-1.5 text-red-500" />
              Top thất thoát ({topLossItems.length})
            </TabsTrigger>
            <TabsTrigger value="trend" className="text-xs">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Biểu đồ xu hướng
            </TabsTrigger>
            <TabsTrigger value="records" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Nhật ký chi tiết ({processedRecords.length})
            </TabsTrigger>
          </TabsList>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Đang tải và tổng hợp dữ liệu kiểm kho...</p>
            </div>
          ) : checkSessions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Package className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Chưa có dữ liệu kiểm kho trong khoảng thời gian này</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Hãy thực hiện "Lưu lịch sử" trong tab Kiểm kho để hệ thống phân tích.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              <TabsContent value="overview" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[360px] pr-3">
                  <div className="space-y-4">
                    {/* Top 3 biggest losses preview */}
                    <div className="border rounded-lg p-3 bg-muted/20">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2.5 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-4 w-4" />
                        Các mặt hàng cần lưu ý nhiều nhất
                      </h4>
                      {topLossItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Không có mặt hàng nào bị thất thoát trong kỳ được chọn. Rất tốt!
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {topLossItems.slice(0, 3).map((item, idx) => (
                            <div key={item.itemName} className="border border-red-200 dark:border-red-900/60 rounded-md p-2.5 bg-background">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                  #{idx + 1} {item.itemName}
                                </span>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  {item.categoryName}
                                </Badge>
                              </div>
                              <div className="mt-2 flex items-baseline justify-between text-xs">
                                <span className="text-muted-foreground">Số lượng thiếu:</span>
                                <span className="font-semibold text-red-600">-{item.totalLossQty}</span>
                              </div>
                              <div className="flex items-baseline justify-between text-xs mt-0.5">
                                <span className="text-muted-foreground">Giá trị mất:</span>
                                <span className="font-bold text-red-600">{formatCurrency(item.totalLossVal)}</span>
                              </div>
                              <div className="flex items-baseline justify-between text-[11px] text-muted-foreground mt-0.5">
                                <span>Tần suất thiếu:</span>
                                <span>{item.lossTimes} lần kiểm</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Operational advice */}
                    <div className="border rounded-lg p-3 bg-muted/10 text-xs text-muted-foreground space-y-1.5">
                      <p className="font-semibold text-foreground">💡 Lưu ý nghiệp vụ:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>
                          <strong>Chênh lệch âm (Thiếu):</strong> Có thể do phục vụ khui lon không bấm bill, thất thoát trong khâu bảo quản hoặc nhập hàng thực tế ít hơn hóa đơn nhập.
                        </li>
                        <li>
                          <strong>Chênh lệch dương (Thừa):</strong> Thường do khách để lại lon chưa uống nhưng bill đã tính, hoặc nhân viên nhập kho chưa điền vào cột "Nhập".
                        </li>
                        <li>
                          Dữ liệu trên báo cáo được tính toán trực tiếp từ các phiếu chốt kho đã lưu, đảm bảo hoàn toàn minh bạch.
                        </li>
                      </ul>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* TAB 2: TOP LOSS */}
              <TabsContent value="top_loss" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[360px]">
                  {topLossItems.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-xs">
                      Không có món nào bị hao hụt trong khoảng thời gian đã lọc.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px] text-center">Hạng</TableHead>
                          <TableHead>Tên mặt hàng</TableHead>
                          <TableHead>Nhóm</TableHead>
                          <TableHead className="text-right">Đơn giá niêm yết</TableHead>
                          <TableHead className="text-center">Số lượng thiếu</TableHead>
                          <TableHead className="text-right">Tổng tiền thất thoát</TableHead>
                          <TableHead className="text-center">Số đợt bị thiếu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topLossItems.map((item, idx) => (
                          <TableRow key={item.itemName}>
                            <TableCell className="text-center font-bold text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-semibold text-sm">
                              {item.itemName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {item.categoryName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-center font-bold text-red-600 dark:text-red-400">
                              -{item.totalLossQty}
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                              {formatCurrency(item.totalLossVal)}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {item.lossTimes} đợt
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* TAB 3: TREND CHART */}
              <TabsContent value="trend" className="flex-1 m-0 overflow-hidden">
                <div className="h-[360px] flex flex-col justify-between pt-2">
                  <div className="text-xs text-muted-foreground flex items-center justify-between px-2 mb-1">
                    <span>Biến động số lượng lon/đơn vị thừa & thiếu theo từng đợt kiểm:</span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-red-600 text-xs">
                        <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-xs"></span> Số lượng thiếu
                      </span>
                      <span className="flex items-center gap-1 text-blue-600 text-xs">
                        <span className="inline-block w-2.5 h-2.5 bg-blue-500 rounded-xs"></span> Số lượng thừa
                      </span>
                    </span>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            value,
                            name === "lossQty" ? "Số lượng thiếu" : "Số lượng thừa",
                          ]}
                          labelFormatter={(label) => `Ngày: ${label}`}
                        />
                        <Bar dataKey="lossQty" fill="#ef4444" name="lossQty" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="surplusQty" fill="#3b82f6" name="surplusQty" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: RECORDS */}
              <TabsContent value="records" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[360px]">
                  {processedRecords.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-xs">
                      Không có bản ghi nào khớp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px] whitespace-nowrap">Khoảng thời gian kiểm</TableHead>
                          <TableHead>Mặt hàng</TableHead>
                          <TableHead className="text-center w-[60px]">Tồn đầu</TableHead>
                          <TableHead className="text-center w-[60px]">Nhập</TableHead>
                          <TableHead className="text-center w-[60px]">Bán</TableHead>
                          <TableHead className="text-center w-[75px]">Lý thuyết</TableHead>
                          <TableHead className="text-center w-[75px]">Thực tế</TableHead>
                          <TableHead className="text-center w-[85px]">Chênh lệch</TableHead>
                          <TableHead className="text-right w-[110px]">Thành tiền</TableHead>
                          <TableHead>Ghi chú</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedRecords.map((r) => {
                          const isLoss = r.difference < 0;
                          const isSurplus = r.difference > 0;
                          return (
                            <TableRow key={r.recordId}>
                              <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                {r.periodDisplay}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-xs">{r.itemName}</span>
                                <span className="text-[10px] text-muted-foreground block">{r.categoryName}</span>
                              </TableCell>
                              <TableCell className="text-center text-xs">{r.openingStock}</TableCell>
                              <TableCell className="text-center text-xs text-blue-600">{r.imported}</TableCell>
                              <TableCell className="text-center text-xs text-amber-600">{r.sold}</TableCell>
                              <TableCell className="text-center text-xs">{r.theoreticalStock}</TableCell>
                              <TableCell className="text-center text-xs font-semibold">{r.actualStock}</TableCell>
                              <TableCell className="text-center font-bold text-xs">
                                {isLoss ? (
                                  <span className="text-red-600 bg-red-100 dark:bg-red-950/60 px-1.5 py-0.5 rounded-sm">
                                    {r.difference}
                                  </span>
                                ) : isSurplus ? (
                                  <span className="text-blue-600 bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-sm">
                                    +{r.difference}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className={`text-right text-xs font-semibold ${isLoss ? "text-red-600" : isSurplus ? "text-blue-600" : "text-muted-foreground"}`}>
                                {isLoss ? `-${formatCurrency(r.lossValue)}` : isSurplus ? `+${formatCurrency(r.surplusValue)}` : "0 ₫"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={r.note}>
                                {r.note || "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
