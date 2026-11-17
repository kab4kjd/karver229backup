import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, TrendingUp, Package, Clock, Receipt, Save, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useOperatingHours } from "@/hooks/useOperatingHours";
import { useChartOrder } from "@/hooks/useChartOrder";
import { useThemeChartColors } from "@/hooks/useThemeConfig";
import { TimePicker24h } from "./TimePicker24h";
import { Invoice } from "@/pages/Index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ReportsChartsGrid = lazy(() => import("./ReportsChartsGrid"));

interface ReportsTabProps {
  invoices: Invoice[];
}

type ReportPeriod = "day" | "week" | "month" | "custom";

const ReportsTab = ({ invoices }: ReportsTabProps) => {
  const { startTime: savedStartTime, endTime: savedEndTime, updateOperatingHours, isSaving } = useOperatingHours();
  const { primary: themePrimary, chart2: themeChart2, chart3: themeChart3, palette: themePalette } = useThemeChartColors();
  const { chartOrder, saveOrder } = useChartOrder();
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [dayStartTime, setDayStartTime] = useState(savedStartTime);
  const [dayEndTime, setDayEndTime] = useState(savedEndTime);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [selectedProductForRooms, setSelectedProductForRooms] = useState<{
    name: string;
    quantity: number;
    revenue: number;
    usages: { roomName: string; quantity: number; date: string; timeRange: string }[];
  } | null>(null);

  const ALL_EXPORT_COLUMNS = [
    { key: "stt", label: "STT", width: 5 },
    { key: "date", label: "Ngày", width: 20 },
    { key: "room", label: "Phòng", width: 15 },
    { key: "checkIn", label: "Giờ vào", width: 10 },
    { key: "checkOut", label: "Giờ ra", width: 10 },
    { key: "duration", label: "Thời gian (h)", width: 12 },
    { key: "roomPrice", label: "Tiền phòng", width: 15 },
    { key: "itemPrice", label: "Tiền SP", width: 15 },
    { key: "discount", label: "Giảm giá", width: 12 },
    { key: "tax", label: "Thuế/Phí", width: 12 },
    { key: "total", label: "Tổng tiền", width: 15 },
    { key: "staff", label: "Nhân viên", width: 15 },
    { key: "paymentStatus", label: "Thanh toán", width: 12 },
    { key: "paidAmount", label: "Đã thu", width: 15 },
    { key: "itemDetails", label: "Chi tiết SP", width: 30 },
  ] as const;

  const DEFAULT_COLUMNS = ["stt", "date", "room", "checkIn", "checkOut", "duration", "roomPrice", "itemPrice", "discount", "tax", "total"];
  const PREF_KEY = "export_excel_columns";

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_COLUMNS)
  );

  // Load saved column config from database
  useEffect(() => {
    const loadColumnConfig = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", PREF_KEY)
        .maybeSingle();
      if (data?.preference_value && Array.isArray(data.preference_value)) {
        setSelectedColumns(new Set(data.preference_value as string[]));
      }
    };
    loadColumnConfig();
  }, []);

  const saveColumnConfig = async (cols: Set<string>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, preference_key: PREF_KEY, preference_value: Array.from(cols) as any },
        { onConflict: "user_id,preference_key" }
      );
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      saveColumnConfig(next);
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Sync from DB when loaded
  useEffect(() => {
    if (!hasLocalChanges) {
      setDayStartTime(savedStartTime);
      setDayEndTime(savedEndTime);
    }
  }, [savedStartTime, savedEndTime]);

  const getDateRange = (date: string, period: ReportPeriod) => {
    const selected = new Date(date);
    let start: Date, end: Date;

    const [startH, startM] = dayStartTime.split(":").map(Number);
    const [endH, endM] = dayEndTime.split(":").map(Number);
    const isOvernight = endH < startH || (endH === startH && endM <= startM);

    if (period === "custom") {
      start = new Date(customStartDate);
      start.setHours(startH, startM, 0, 0);
      end = new Date(customEndDate);
      if (isOvernight) {
        end.setDate(end.getDate() + 1);
      }
      end.setHours(endH, endM, 0, 0);
    } else if (period === "day") {
      start = new Date(selected);
      start.setHours(startH, startM, 0, 0);
      end = new Date(selected);
      if (isOvernight) {
        end.setDate(end.getDate() + 1);
      }
      end.setHours(endH, endM, 0, 0);
    } else if (period === "week") {
      const day = selected.getDay();
      const diff = selected.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(selected.setDate(diff));
      start.setHours(startH, startM, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (isOvernight) {
        end.setDate(end.getDate() + 1);
      }
      end.setHours(endH, endM, 0, 0);
    } else {
      start = new Date(selected.getFullYear(), selected.getMonth(), 1);
      start.setHours(startH, startM, 0, 0);
      end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
      if (isOvernight) {
        end.setDate(end.getDate() + 1);
      }
      end.setHours(endH, endM, 0, 0);
    }

    return { start, end };
  };

  const filteredInvoices = useMemo(() => {
    const { start, end } = getDateRange(selectedDate, period);
    return invoices.filter((invoice) => {
      // Use raw check-in ISO timestamp for accurate filtering
      const invoiceDate = invoice.checkInRaw
        ? new Date(invoice.checkInRaw)
        : (() => {
            const dateStr = invoice.date.split(",")[0];
            const [day, month, year] = dateStr.split("/").map(Number);
            const [hours, minutes] = invoice.checkIn.split(":").map(Number);
            return new Date(year, month - 1, day, hours || 0, minutes || 0);
          })();
      return invoiceDate >= start && invoiceDate <= end;
    });
  }, [invoices, selectedDate, period, customStartDate, customEndDate, dayStartTime, dayEndTime]);

  const sortedInvoices = useMemo(() => {
    if (!sortField) return filteredInvoices;
    return [...filteredInvoices].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "date": valA = a.date; valB = b.date; break;
        case "room": valA = a.roomName; valB = b.roomName; break;
        case "checkIn": valA = a.checkIn; valB = b.checkIn; break;
        case "checkOut": valA = a.checkOut; valB = b.checkOut; break;
        case "roomPrice":
          valA = Math.round(a.duration * a.roomPrice);
          valB = Math.round(b.duration * b.roomPrice);
          break;
        case "itemPrice":
          valA = a.items.reduce((s, i) => s + i.price * i.quantity, 0);
          valB = b.items.reduce((s, i) => s + i.price * i.quantity, 0);
          break;
        case "total": valA = a.total; valB = b.total; break;
        default: return 0;
      }
      if (typeof valA === "string") {
        const cmp = valA.localeCompare(valB);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [filteredInvoices, sortField, sortDir]);

  const revenueReport = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalDiscount = filteredInvoices.reduce((sum, inv) => sum + inv.discount, 0);
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + inv.tax, 0);
    const roomRevenue = filteredInvoices.reduce((sum, inv) => sum + Math.round(inv.duration * inv.roomPrice), 0);
    const itemsRevenue = filteredInvoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((itemSum, item) => itemSum + item.price * item.quantity, 0);
    }, 0);

    return {
      totalInvoices: filteredInvoices.length,
      totalRevenue,
      totalDiscount,
      totalTax,
      roomRevenue,
      itemsRevenue,
    };
  }, [filteredInvoices]);

  // Product report grouped by category
  const productReportByCategory = useMemo(() => {
    const categoryMap = new Map<string, Map<string, { quantity: number; revenue: number; usages: { roomName: string; quantity: number; date: string; timeRange: string }[] }>>();

    filteredInvoices.forEach((invoice) => {
      const roomName = invoice.roomName || "Phòng không tên";
      const fullDate = invoice.date || "";
      const dateOnly = fullDate.includes(",") ? fullDate.split(",")[0].trim() : fullDate.trim();
      const timeRange = `${invoice.checkIn || ""} → ${invoice.checkOut || ""}`;
      invoice.items.forEach((item) => {
        const category = item.category || "Khác";
        if (!categoryMap.has(category)) {
          categoryMap.set(category, new Map());
        }
        const products = categoryMap.get(category)!;
        let existing = products.get(item.name);
        if (!existing) {
          existing = { quantity: 0, revenue: 0, usages: [] };
          products.set(item.name, existing);
        }
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;

        existing.usages.push({
          roomName,
          quantity: item.quantity,
          date: dateOnly,
          timeRange,
        });
      });
    });

    // Convert to array format with category totals
    return Array.from(categoryMap.entries())
      .map(([category, products]) => {
        const items = Array.from(products.entries())
          .map(([name, data]) => ({
            name,
            quantity: data.quantity,
            revenue: data.revenue,
            usages: data.usages
          }))
          .sort((a, b) => b.revenue - a.revenue);
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
        return { category, items, totalQuantity, totalRevenue };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredInvoices]);

  // Flat product report for charts
  const productReport = useMemo(() => {
    return productReportByCategory.flatMap(cat => cat.items);
  }, [productReportByCategory]);

  // Revenue by source (room vs items) for Pie Chart
  const revenueBySourceData = useMemo(() => {
    return [
      { name: "Tiền phòng", value: revenueReport.roomRevenue },
      { name: "Tiền sản phẩm", value: revenueReport.itemsRevenue },
    ].filter(item => item.value > 0);
  }, [revenueReport]);

  // Daily revenue for Line/Bar Chart
  const dailyRevenueData = useMemo(() => {
    const dailyMap = new Map<string, number>();
    const [startH, startM] = dayStartTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;

    filteredInvoices.forEach((invoice) => {
      const t = invoice.checkInRaw
        ? new Date(invoice.checkInRaw)
        : (() => {
            const dateStr = invoice.date.split(",")[0];
            const [day, month, year] = dateStr.split("/").map(Number);
            const [hours, minutes] = invoice.checkIn.split(":").map(Number);
            return new Date(year, month - 1, day, hours || 0, minutes || 0);
          })();
      // Allocate to operating day: if time-of-day < start time, belongs to previous calendar day
      const opDay = new Date(t);
      const tMinutes = t.getHours() * 60 + t.getMinutes();
      if (tMinutes < startMinutes) {
        opDay.setDate(opDay.getDate() - 1);
      }
      const dd = String(opDay.getDate()).padStart(2, "0");
      const mm = String(opDay.getMonth() + 1).padStart(2, "0");
      const yyyy = opDay.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;
      const existing = dailyMap.get(dateStr) || 0;
      dailyMap.set(dateStr, existing + invoice.total);
    });

    return Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => {
        const dateA = new Date(a.date.split("/").reverse().join("-"));
        const dateB = new Date(b.date.split("/").reverse().join("-"));
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredInvoices, dayStartTime]);

  // Top 10 products by quantity for Bar Chart
  const topProductsData = useMemo(() => {
    return [...productReport].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [productReport]);

  // Room usage data
  const roomUsageData = useMemo(() => {
    const roomMap = new Map<string, { count: number; revenue: number; totalHours: number }>();
    
    filteredInvoices.forEach((invoice) => {
      const existing = roomMap.get(invoice.roomName) || { count: 0, revenue: 0, totalHours: 0 };
      roomMap.set(invoice.roomName, {
        count: existing.count + 1,
        revenue: existing.revenue + invoice.total,
        totalHours: existing.totalHours + invoice.duration,
      });
    });

    return Array.from(roomMap.entries())
      .map(([room, data]) => ({ room, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredInvoices]);

  // Category revenue data for Pie Chart
  const categoryRevenueData = useMemo(() => {
    return productReportByCategory
      .map(cat => ({ name: cat.category, value: cat.totalRevenue }))
      .filter(item => item.value > 0);
  }, [productReportByCategory]);

  // Room time statistics
  const roomTimeStats = useMemo(() => {
    const totalHours = roomUsageData.reduce((sum, r) => sum + r.totalHours, 0);
    const totalSessions = roomUsageData.reduce((sum, r) => sum + r.count, 0);
    const avgHours = totalSessions > 0 ? totalHours / totalSessions : 0;
    const mostUsedRoom = roomUsageData.length > 0
      ? [...roomUsageData].sort((a, b) => b.totalHours - a.totalHours)[0]
      : null;

    return { totalHours, totalSessions, avgHours, mostUsedRoom };
  }, [roomUsageData]);

  // Room hours data for horizontal bar chart
  const roomHoursData = useMemo(() => {
    return [...roomUsageData]
      .sort((a, b) => b.totalHours - a.totalHours)
      .map(r => ({ room: r.room, hours: Math.round(r.totalHours * 100) / 100, count: r.count }));
  }, [roomUsageData]);

  const exportToCSV = () => {
    const { start, end } = getDateRange(selectedDate, period);
    const periodText = period === "day" ? "Ngày" : period === "week" ? "Tuần" : "Tháng";
    
    let csv = `BÁO CÁO DOANH THU - ${periodText.toUpperCase()}\n`;
    csv += `Từ ngày: ${start.toLocaleDateString("vi-VN")}\n`;
    csv += `Đến ngày: ${end.toLocaleDateString("vi-VN")}\n\n`;
    
    csv += `TỔNG QUAN\n`;
    csv += `Số hóa đơn,${revenueReport.totalInvoices}\n`;
    csv += `Doanh thu phòng,${revenueReport.roomRevenue}\n`;
    csv += `Doanh thu sản phẩm,${revenueReport.itemsRevenue}\n`;
    csv += `Giảm giá,${revenueReport.totalDiscount}\n`;
    csv += `Thuế/Phí,${revenueReport.totalTax}\n`;
    csv += `Tổng doanh thu,${revenueReport.totalRevenue}\n\n`;
    
    csv += `SẢN PHẨM BÁN RA\n`;
    csv += `Tên sản phẩm,Số lượng,Doanh thu\n`;
    productReport.forEach((product) => {
      csv += `${product.name},${product.quantity},${product.revenue}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bao-cao-${period}-${selectedDate}.csv`;
    link.click();
  };

  const exportInvoicesToExcel = async () => {
    const XLSX = await import("@datalens-tech/xlsx");
    const { start } = getDateRange(selectedDate, period);
    
    const colDefs = ALL_EXPORT_COLUMNS.filter(c => selectedColumns.has(c.key));

    const getRowValue = (inv: Invoice, key: string, index: number): any => {
      switch (key) {
        case "stt": return index + 1;
        case "date": return inv.date;
        case "room": return inv.roomName;
        case "checkIn": return inv.checkIn;
        case "checkOut": return inv.checkOut;
        case "duration": return Number((inv.duration || 0).toFixed(2));
        case "roomPrice": return Math.round(inv.duration * inv.roomPrice);
        case "itemPrice": return inv.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        case "discount": return inv.discount;
        case "tax": return inv.tax;
        case "total": return inv.total;
        case "staff": return (inv as any).staffName || "";
        case "paymentStatus": { const s = (inv as any).paymentStatus; return s === "paid" ? "Đã thanh toán" : s === "debt" ? "Nợ" : s === "partial" ? "Trả một phần" : s || ""; }
        case "paidAmount": return (inv as any).paidAmount ?? 0;
        case "itemDetails": return inv.items.map(i => `${i.name} x${i.quantity}`).join(", ");
        default: return "";
      }
    };

    const getSummaryValue = (key: string): any => {
      switch (key) {
        case "stt": return "";
        case "date": return "TỔNG CỘNG";
        case "roomPrice": return revenueReport.roomRevenue;
        case "itemPrice": return revenueReport.itemsRevenue;
        case "discount": return revenueReport.totalDiscount;
        case "tax": return revenueReport.totalTax;
        case "total": return revenueReport.totalRevenue;
        default: return "";
      }
    };

    const excelData = sortedInvoices.map((inv, index) => {
      const row: Record<string, any> = {};
      colDefs.forEach(col => { row[col.label] = getRowValue(inv, col.key, index); });
      return row;
    });

    const summaryRow: Record<string, any> = {};
    colDefs.forEach(col => { summaryRow[col.label] = getSummaryValue(col.key); });
    excelData.push(summaryRow);

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chi tiết hóa đơn");

    ws["!cols"] = colDefs.map(col => ({ wch: col.width }));

    const periodText = period === "day" ? "ngay" : period === "week" ? "tuan" : period === "month" ? "thang" : "tuy-chon";
    XLSX.writeFile(wb, `chi-tiet-hoa-don-${periodText}-${start.toISOString().split("T")[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const { start, end } = getDateRange(selectedDate, period);

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>Kỳ báo cáo</Label>
            <Select value={period} onValueChange={(value: ReportPeriod) => setPeriod(value)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Ngày</SelectItem>
                <SelectItem value="week">Tuần</SelectItem>
                <SelectItem value="month">Tháng</SelectItem>
                <SelectItem value="custom">Tùy chọn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {period === "custom" ? (
            <>
              <div>
                <Label>Từ ngày</Label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <Label>Đến ngày</Label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <Label>Chọn ngày</Label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <Label>Giờ bắt đầu</Label>
            <div className="mt-2">
              <TimePicker24h
                value={dayStartTime}
                onChange={(val) => { setDayStartTime(val); setHasLocalChanges(true); }}
                className="w-full h-10 px-2"
              />
            </div>
          </div>
          <div>
            <Label>Giờ kết thúc {dayEndTime < dayStartTime && <span className="text-xs text-muted-foreground">(hôm sau)</span>}</Label>
            <div className="mt-2">
              <TimePicker24h
                value={dayEndTime}
                onChange={(val) => { setDayEndTime(val); setHasLocalChanges(true); }}
                className="w-full h-10 px-2"
              />
            </div>
          </div>
          {hasLocalChanges && (
            <div className="flex items-end">
              <Button
                size="sm"
                onClick={() => {
                  updateOperatingHours({ startTime: dayStartTime, endTime: dayEndTime });
                  setHasLocalChanges(false);
                }}
                disabled={isSaving}
                className="h-10 mt-2"
              >
                <Save className="h-4 w-4 mr-1" />
                Lưu mặc định
              </Button>
            </div>
          )}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Từ ngày: {start.toLocaleDateString("vi-VN")} - Đến ngày: {end.toLocaleDateString("vi-VN")}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => revenueReport.totalInvoices > 0 && setShowInvoiceDetails(true)}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span className="text-sm">Số hóa đơn</span>
          </div>
          <p className="text-2xl font-bold mt-2 text-primary underline decoration-dotted underline-offset-4">
            {revenueReport.totalInvoices}
          </p>
          {revenueReport.totalInvoices > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Bấm để xem chi tiết</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Tổng doanh thu</span>
          </div>
          <p className="text-2xl font-bold mt-2 text-primary">
            {revenueReport.totalRevenue.toLocaleString("vi-VN")}đ
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Doanh thu phòng</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {revenueReport.roomRevenue.toLocaleString("vi-VN")}đ
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span className="text-sm">Doanh thu sản phẩm</span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {revenueReport.itemsRevenue.toLocaleString("vi-VN")}đ
          </p>
        </Card>
      </div>

      {/* Draggable Charts Grid (lazy loaded) */}
      <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
        <ReportsChartsGrid
          chartOrder={chartOrder}
          onSaveOrder={saveOrder}
          filteredInvoices={filteredInvoices}
          dayStartTime={dayStartTime}
          dayEndTime={dayEndTime}
          themePrimary={themePrimary}
          themeChart2={themeChart2}
          themeChart3={themeChart3}
          themePalette={themePalette}
          revenueReport={revenueReport}
          productReportByCategory={productReportByCategory}
          revenueBySourceData={revenueBySourceData}
          dailyRevenueData={dailyRevenueData}
          topProductsData={topProductsData}
          roomUsageData={roomUsageData}
          categoryRevenueData={categoryRevenueData}
          roomTimeStats={roomTimeStats}
          roomHoursData={roomHoursData}
          onSelectProductForRooms={setSelectedProductForRooms}
        />
      </Suspense>

      <div className="flex gap-2 print:hidden">
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Xuất CSV
        </Button>
        <Button onClick={handlePrint} variant="secondary" className="gap-2">
          <FileText className="h-4 w-4" />
          In báo cáo
        </Button>
      </div>

      {/* Invoice Details Dialog */}
      <Dialog open={showInvoiceDetails} onOpenChange={setShowInvoiceDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Chi Tiết Hóa Đơn ({filteredInvoices.length} hóa đơn)
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Từ ngày: {start.toLocaleDateString("vi-VN")} - Đến ngày: {end.toLocaleDateString("vi-VN")}</span>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowColumnConfig(!showColumnConfig)}>
              <Settings2 className="h-3.5 w-3.5" />
              Cột xuất Excel
            </Button>
          </div>
          {showColumnConfig && (
            <div className="border rounded-md p-3 mb-3 bg-muted/30">
              <div className="text-sm font-medium mb-2">Chọn cột xuất Excel:</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {ALL_EXPORT_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedColumns.has(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                    <span className="inline-flex items-center">Ngày<SortIcon field="date" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("room")}>
                    <span className="inline-flex items-center">Phòng<SortIcon field="room" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("checkIn")}>
                    <span className="inline-flex items-center">Giờ vào<SortIcon field="checkIn" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("checkOut")}>
                    <span className="inline-flex items-center">Giờ ra<SortIcon field="checkOut" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("roomPrice")}>
                    <span className="inline-flex items-center justify-end">Tiền phòng<SortIcon field="roomPrice" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("itemPrice")}>
                    <span className="inline-flex items-center justify-end">Tiền SP<SortIcon field="itemPrice" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("total")}>
                    <span className="inline-flex items-center justify-end">Tổng tiền<SortIcon field="total" /></span>
                  </TableHead>
                  <TableHead className="text-right">Thanh toán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInvoices.map((invoice, index) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell className="font-medium">{invoice.roomName}</TableCell>
                    <TableCell>{invoice.checkIn}</TableCell>
                    <TableCell>{invoice.checkOut}</TableCell>
                    <TableCell className="text-right">
                      {Math.round(invoice.duration * invoice.roomPrice).toLocaleString("vi-VN")}đ
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString("vi-VN")}đ
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {invoice.total.toLocaleString("vi-VN")}đ
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const ps = (invoice as any).paymentStatus;
                        const pa = (invoice as any).paidAmount ?? 0;
                        const paid = ps === "paid" ? invoice.total : ps === "debt" ? 0 : pa;
                        const cls = ps === "debt" ? "text-destructive" : ps === "partial" ? "text-yellow-600" : "text-green-600";
                        return <span className={`font-medium ${cls}`}>{paid.toLocaleString("vi-VN")}đ</span>;
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>TỔNG CỘNG</TableCell>
                  <TableCell className="text-right">
                    {revenueReport.roomRevenue.toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-right">
                    {revenueReport.itemsRevenue.toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-right text-primary">
                    {revenueReport.totalRevenue.toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-right">
                    {sortedInvoices.reduce((sum, inv) => {
                      const ps = (inv as any).paymentStatus;
                      const pa = (inv as any).paidAmount ?? 0;
                      return sum + (ps === "paid" ? inv.total : ps === "debt" ? 0 : pa);
                    }, 0).toLocaleString("vi-VN")}đ
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={exportInvoicesToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Xuất Excel ({selectedColumns.size} cột)
            </Button>
            <Button variant="secondary" onClick={() => setShowInvoiceDetails(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Rooms Dialog */}
      <Dialog open={!!selectedProductForRooms} onOpenChange={(open) => !open && setSelectedProductForRooms(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Chi Tiết Sử Dụng: {selectedProductForRooms?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm bg-muted p-3 rounded-lg">
              <span>Tổng số lượng: <strong className="text-primary">{selectedProductForRooms?.quantity}</strong></span>
            </div>
            <div className="max-h-[350px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phòng</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Giờ (Vào - Ra)</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProductForRooms?.usages.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{u.roomName}</TableCell>
                      <TableCell>{u.date}</TableCell>
                      <TableCell>{u.timeRange}</TableCell>
                      <TableCell className="text-right">{u.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportsTab;
