import { useState, useMemo, lazy, Suspense } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, Zap, FileSpreadsheet, FileText } from "lucide-react";
import { Check, X, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseProductGroups } from "@/hooks/useExpenseProductGroups";
import { Invoice } from "@/pages/Index";
import { Loader2 } from "lucide-react";
import QuickAddExpensesDialog from "./QuickAddExpensesDialog";

const ExpensesProfitCharts = lazy(() => import("./ExpensesProfitCharts"));


type Period = "day" | "month" | "custom";

interface ExpensesTabProps {
  invoices: Invoice[];
}



const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "đ";
const todayStr = () => format(new Date(), "yyyy-MM-dd");

const ExpensesTab = ({ invoices }: ExpensesTabProps) => {
  const {
    expenses,
    addExpense, updateExpense, deleteExpense, deleteExpensesBulk,
  } = useExpenses();
  const {
    groups: menuCategories,
    items: menuItems,
    addGroup: addMenuCategory,
    renameGroup: renameMenuCategory,
    deleteGroup: deleteMenuCategory,
    addItem: addMenuItem,
    renameItem: renameMenuItem,
    deleteItem: deleteMenuItem,
  } = useExpenseProductGroups();

  // Form state
  const [productCategory, setProductCategory] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [newMenuCategoryName, setNewMenuCategoryName] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [newItemNameByGroup, setNewItemNameByGroup] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // List filter by product group
  const [listGroupFilter, setListGroupFilter] = useState<string>("__all__");

  // Chart filter
  const [period, setPeriod] = useState<Period>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  // Drill-down: group selected for product chart
  const [drillGroup, setDrillGroup] = useState<string>("");

  const DEFAULT_EXPENSE_CATEGORY = "Chung";

  const resetForm = () => {
    setProductCategory("");
    setProductName("");
    setExpenseDate(new Date());
    setAmount("");
    setNote("");
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    const payload = {
      category_name: DEFAULT_EXPENSE_CATEGORY,
      expense_date: format(expenseDate, "yyyy-MM-dd"),
      amount: amt,
      note,
      product_category: productCategory || null,
      product_name: productName || null,
    };
    if (editingId) {
      await updateExpense.mutateAsync({ id: editingId, ...payload });
    } else {
      await addExpense.mutateAsync(payload);
    }
    resetForm();
  };

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setProductCategory(e.product_category || "");
    setProductName(e.product_name || "");
    setExpenseDate(new Date(e.expense_date));
    setAmount(String(e.amount));
    setNote(e.note || "");
  };

  // Items filtered by selected product category
  const productItemsInCategory = useMemo(() => {
    if (!productCategory) return [];
    const cat = menuCategories.find(c => c.name === productCategory);
    if (!cat) return [];
    return menuItems.filter(i => i.group_id === cat.id);
  }, [productCategory, menuCategories, menuItems]);

  // Date range based on period
  const dateRange = useMemo(() => {
    let start: Date, end: Date;
    if (period === "day") {
      start = new Date(selectedDate); start.setHours(0,0,0,0);
      end = new Date(selectedDate); end.setHours(23,59,59,999);
    } else if (period === "month") {
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(customStart); start.setHours(0,0,0,0);
      end = new Date(customEnd); end.setHours(23,59,59,999);
    }
    return { start, end };
  }, [period, selectedDate, customStart, customEnd]);

  // Filter expenses in period
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.expense_date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Additional filter for the expense LIST view by product group (does not affect charts)
  const listExpenses = useMemo(() => {
    if (listGroupFilter === "__all__") return filteredExpenses;
    if (listGroupFilter === "__none__") return filteredExpenses.filter(e => !e.product_category);
    return filteredExpenses.filter(e => e.product_category === listGroupFilter);
  }, [filteredExpenses, listGroupFilter]);


  // Filter invoices in period
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.checkInRaw ? new Date(inv.checkInRaw) : (() => {
        const dateStr = inv.date.split(",")[0];
        const [day, month, year] = dateStr.split("/").map(Number);
        return new Date(year, month - 1, day);
      })();
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [invoices, dateRange]);

  // Revenue by category (from invoices' items)
  const revenueByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const cat = item.category || "Khác";
        map.set(cat, (map.get(cat) || 0) + item.price * item.quantity);
      });
    });
    return map;
  }, [filteredInvoices]);

  // Expenses by product group (replaces expense-category breakdown)
  const expenseByGroup = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const key = e.product_category || "Khác";
      map.set(key, (map.get(key) || 0) + e.amount);
    });
    return map;
  }, [filteredExpenses]);

  // Combined chart data: revenue, expense, profit per product group
  const profitByCategory = useMemo(() => {
    const cats = new Set<string>([...revenueByCategory.keys(), ...expenseByGroup.keys()]);
    return Array.from(cats).map(cat => {
      const revenue = revenueByCategory.get(cat) || 0;
      const expense = expenseByGroup.get(cat) || 0;
      return {
        category: cat,
        revenue,
        expense,
        profit: revenue - expense,
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [revenueByCategory, expenseByGroup]);

  // Profit detail per product (item) within each category
  const profitByProduct = useMemo(() => {
    type Row = { category: string; product: string; revenue: number; expense: number; quantity: number };
    const map = new Map<string, Row>();
    const keyOf = (cat: string, name: string) => `${cat}||${name}`;

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const cat = item.category || "Khác";
        const k = keyOf(cat, item.name);
        const row = map.get(k) || { category: cat, product: item.name, revenue: 0, expense: 0, quantity: 0 };
        row.revenue += item.price * item.quantity;
        row.quantity += item.quantity;
        map.set(k, row);
      });
    });

    filteredExpenses.forEach(e => {
      if (!e.product_category || !e.product_name) return;
      const k = keyOf(e.product_category, e.product_name);
      const row = map.get(k) || { category: e.product_category, product: e.product_name, revenue: 0, expense: 0, quantity: 0 };
      row.expense += e.amount;
      map.set(k, row);
    });

    return Array.from(map.values())
      .map(r => ({ ...r, profit: r.revenue - r.expense }))
      .sort((a, b) => a.category.localeCompare(b.category) || b.profit - a.profit);
  }, [filteredInvoices, filteredExpenses]);


  const totals = useMemo(() => {
    const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalRevenue = Array.from(revenueByCategory.values()).reduce((s, v) => s + v, 0);
    return {
      totalExpense,
      totalRevenue,
      profit: totalRevenue - totalExpense,
    };
  }, [filteredExpenses, revenueByCategory]);

  // Available groups (with any revenue or expense) for drill-down selector
  const availableGroups = useMemo(
    () => profitByCategory.map(r => r.category),
    [profitByCategory]
  );

  // Auto-pick first group when selection invalid
  const effectiveDrillGroup = useMemo(() => {
    if (drillGroup && availableGroups.includes(drillGroup)) return drillGroup;
    return availableGroups[0] || "";
  }, [drillGroup, availableGroups]);

  // Products inside the drill-down group
  const drillProductData = useMemo(
    () => profitByProduct.filter(r => r.category === effectiveDrillGroup),
    [profitByProduct, effectiveDrillGroup]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredExpenses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
  };
  const handleBulkDelete = async () => {
    await deleteExpensesBulk.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };
  const handleDeleteAll = async () => {
    await deleteExpensesBulk.mutateAsync(filteredExpenses.map(e => e.id));
    setSelectedIds(new Set());
  };

  const periodLabel = useMemo(() => {
    if (period === "day") return format(selectedDate, "dd-MM-yyyy");
    if (period === "month") return format(selectedDate, "MM-yyyy");
    return `${format(customStart, "dd-MM-yyyy")}_${format(customEnd, "dd-MM-yyyy")}`;
  }, [period, selectedDate, customStart, customEnd]);

  const exportProfitByProductXLSX = async () => {
    const XLSX = await import("@datalens-tech/xlsx");
    const rows = profitByProduct.map(r => ({
      "Nhóm": r.category,
      "Sản phẩm": r.product,
      "SL bán": r.quantity,
      "Doanh thu": r.revenue,
      "Chi phí": r.expense,
      "Lợi nhuận": r.profit,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loi nhuan SP");
    XLSX.writeFile(wb, `loi-nhuan-san-pham-${periodLabel}.xlsx`);
  };

  const exportProfitByProductPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = profitByProduct.map(r => `
      <tr>
        <td>${r.category}</td>
        <td>${r.product}</td>
        <td style="text-align:right">${r.quantity || "-"}</td>
        <td style="text-align:right">${formatPrice(r.revenue)}</td>
        <td style="text-align:right">${formatPrice(r.expense)}</td>
        <td style="text-align:right; color:${r.profit >= 0 ? "#16a34a" : "#dc2626"}"><b>${formatPrice(r.profit)}</b></td>
      </tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Loi nhuan SP - ${periodLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:16px;color:#111}h1{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px}th{background:#f3f4f6;text-align:left}</style></head>
      <body>
        <h1>Chi tiết lợi nhuận theo sản phẩm trong nhóm</h1>
        <p style="font-size:12px;color:#555;margin:0 0 12px">Kỳ: ${periodLabel}</p>
        <table>
          <thead><tr><th>Nhóm</th><th>Sản phẩm</th><th style="text-align:right">SL bán</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Chi phí</th><th style="text-align:right">Lợi nhuận</th></tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="6" style="text-align:center">Không có dữ liệu</td></tr>`}</tbody>
        </table>
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <>
      <QuickAddExpensesDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} />
    <div className="space-y-6">


      {/* Add expense form */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">{editingId ? "Sửa chi phí" : "Thêm chi phí"}</h3>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={() => setShowQuickAdd(true)}>
              <Zap className="h-4 w-4 mr-2" />Thêm nhanh chi phí
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
              <Settings className="h-4 w-4 mr-2" />Quản lý nhóm sản phẩm
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <div>
            <Label>Nhóm sản phẩm (tùy chọn)</Label>
            <Select value={productCategory || "__none__"} onValueChange={(v) => { setProductCategory(v === "__none__" ? "" : v); setProductName(""); }}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="— Không gắn —" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="__none__">— Không gắn —</SelectItem>
                {menuCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sản phẩm trong nhóm (tùy chọn)</Label>
            <Select
              value={productName || "__none__"}
              onValueChange={(v) => setProductName(v === "__none__" ? "" : v)}
              disabled={!productCategory}
            >
              <SelectTrigger className="mt-2"><SelectValue placeholder={productCategory ? "— Tất cả —" : "Chọn nhóm trước"} /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="__none__">— Tất cả —</SelectItem>
                {productItemsInCategory.map(it => (
                  <SelectItem key={it.id} value={it.name}>{it.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Ngày chi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-2", !expenseDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expenseDate ? format(expenseDate, "dd/MM/yyyy", { locale: vi }) : "Chọn ngày"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={expenseDate} onSelect={(d) => d && setExpenseDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Giá trị (VNĐ)</Label>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Ghi chú</Label>
            <Input
              placeholder="Ghi chú (tùy chọn)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleSubmit} disabled={!amount}>
            {editingId ? <><Pencil className="h-4 w-4 mr-2" />Cập nhật</> : <><Plus className="h-4 w-4 mr-2" />Thêm chi phí</>}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>Hủy</Button>
          )}
        </div>
      </Card>

      {/* Product group manager dialog */}
      <Dialog open={showCategoryManager} onOpenChange={(o) => { setShowCategoryManager(o); if (!o) { setEditingCatId(null); setEditingCatName(""); setNewMenuCategoryName(""); setExpandedGroupId(null); setEditingItemId(null); setEditingItemName(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quản lý nhóm sản phẩm (dùng cho Chi phí)</DialogTitle>
            <p className="text-xs text-muted-foreground">Danh sách riêng cho Chi phí. Thay đổi tại đây KHÔNG ảnh hưởng đến Loại món ăn.</p>
          </DialogHeader>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {menuCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có nhóm sản phẩm</p>
            ) : menuCategories.map(cat => {
              const itemsInGroup = menuItems.filter(i => i.group_id === cat.id);
              const isExpanded = expandedGroupId === cat.id;
              return (
                <div key={cat.id} className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-muted">
                    {editingCatId === cat.id ? (
                      <>
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { renameMenuCategory.mutate({ id: cat.id, name: editingCatName }); setEditingCatId(null); }
                            if (e.key === "Escape") setEditingCatId(null);
                          }}
                          autoFocus className="h-8"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { renameMenuCategory.mutate({ id: cat.id, name: editingCatName }); setEditingCatId(null); }}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingCatId(null)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <button className="flex-1 text-left font-medium flex items-center gap-2" onClick={() => setExpandedGroupId(isExpanded ? null : cat.id)}>
                          <span className="text-xs text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
                          {cat.name}
                          <span className="text-xs text-muted-foreground">({itemsInGroup.length})</span>
                        </button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa nhóm "{cat.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Tất cả sản phẩm trong nhóm này cũng sẽ bị xóa. Không ảnh hưởng đến Loại món ăn.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMenuCategory.mutate(cat.id)}>Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="p-2 space-y-1">
                      {itemsInGroup.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-1">Chưa có sản phẩm trong nhóm</p>
                      ) : itemsInGroup.map(it => (
                        <div key={it.id} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/40">
                          {editingItemId === it.id ? (
                            <>
                              <Input
                                value={editingItemName}
                                onChange={(e) => setEditingItemName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { renameMenuItem.mutate({ id: it.id, name: editingItemName }); setEditingItemId(null); }
                                  if (e.key === "Escape") setEditingItemId(null);
                                }}
                                autoFocus className="h-7"
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { renameMenuItem.mutate({ id: it.id, name: editingItemName }); setEditingItemId(null); }}>
                                <Check className="h-3.5 w-3.5 text-success" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingItemId(null)}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm">{it.name}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingItemId(it.id); setEditingItemName(it.name); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMenuItem.mutate(it.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-1 pt-1">
                        <Input
                          placeholder="Tên sản phẩm mới"
                          value={newItemNameByGroup[cat.id] || ""}
                          onChange={(e) => setNewItemNameByGroup(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            const v = (newItemNameByGroup[cat.id] || "").trim();
                            if (e.key === "Enter" && v) {
                              addMenuItem.mutate({ group_id: cat.id, name: v });
                              setNewItemNameByGroup(prev => ({ ...prev, [cat.id]: "" }));
                            }
                          }}
                          className="h-7"
                        />
                        <Button size="sm" className="h-7" onClick={() => {
                          const v = (newItemNameByGroup[cat.id] || "").trim();
                          if (!v) return;
                          addMenuItem.mutate({ group_id: cat.id, name: v });
                          setNewItemNameByGroup(prev => ({ ...prev, [cat.id]: "" }));
                        }}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Tên nhóm sản phẩm mới"
              value={newMenuCategoryName}
              onChange={(e) => setNewMenuCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newMenuCategoryName.trim()) {
                  addMenuCategory.mutate(newMenuCategoryName.trim());
                  setNewMenuCategoryName("");
                }
              }}
            />
            <Button onClick={() => {
              if (!newMenuCategoryName.trim()) return;
              addMenuCategory.mutate(newMenuCategoryName.trim());
              setNewMenuCategoryName("");
            }}><Plus className="h-4 w-4 mr-1" />Thêm nhóm</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryManager(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Period filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Kỳ báo cáo</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-40 mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Theo ngày</SelectItem>
                <SelectItem value="month">Theo tháng</SelectItem>
                <SelectItem value="custom">Tùy chọn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period !== "custom" && (
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Doanh thu</p>
              <p className="text-2xl font-bold text-success">{formatPrice(totals.totalRevenue)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-success" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Chi phí</p>
              <p className="text-2xl font-bold text-destructive">{formatPrice(totals.totalExpense)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-destructive" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Lợi nhuận</p>
              <p className={cn("text-2xl font-bold", totals.profit >= 0 ? "text-success" : "text-destructive")}>
                {formatPrice(totals.profit)}
              </p>
            </div>
            <Wallet className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Suspense fallback={<Card className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
        <ExpensesProfitCharts
          profitByCategory={profitByCategory}
          availableGroups={availableGroups}
          effectiveDrillGroup={effectiveDrillGroup}
          onSelectDrillGroup={setDrillGroup}
          drillProductData={drillProductData}
        />
      </Suspense>

      {/* Profit table */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Chi tiết lợi nhuận theo nhóm</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhóm</TableHead>
              <TableHead className="text-right">Doanh thu</TableHead>
              <TableHead className="text-right">Chi phí</TableHead>
              <TableHead className="text-right">Lợi nhuận</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profitByCategory.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
            ) : profitByCategory.map(row => (
              <TableRow key={row.category}>
                <TableCell className="font-medium">{row.category}</TableCell>
                <TableCell className="text-right">{formatPrice(row.revenue)}</TableCell>
                <TableCell className="text-right">{formatPrice(row.expense)}</TableCell>
                <TableCell className={cn("text-right font-semibold", row.profit >= 0 ? "text-success" : "text-destructive")}>
                  {formatPrice(row.profit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Profit by product within group */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="text-lg font-semibold">Chi tiết lợi nhuận theo sản phẩm trong nhóm</h3>
            <p className="text-xs text-muted-foreground">Doanh thu tính theo sản phẩm trong hoá đơn. Chi phí tính theo các khoản chi đã gắn nhóm + sản phẩm tương ứng.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={exportProfitByProductXLSX} disabled={profitByProduct.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />XLSX
            </Button>
            <Button size="sm" variant="outline" onClick={exportProfitByProductPDF} disabled={profitByProduct.length === 0}>
              <FileText className="h-4 w-4 mr-2" />PDF
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhóm</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">SL bán</TableHead>
              <TableHead className="text-right">Doanh thu</TableHead>
              <TableHead className="text-right">Chi phí</TableHead>
              <TableHead className="text-right">Lợi nhuận</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profitByProduct.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Không có dữ liệu</TableCell></TableRow>
            ) : profitByProduct.map(row => (
              <TableRow key={`${row.category}||${row.product}`}>
                <TableCell className="text-muted-foreground">{row.category}</TableCell>
                <TableCell className="font-medium">{row.product}</TableCell>
                <TableCell className="text-right">{row.quantity || "-"}</TableCell>
                <TableCell className="text-right">{formatPrice(row.revenue)}</TableCell>
                <TableCell className="text-right">{formatPrice(row.expense)}</TableCell>
                <TableCell className={cn("text-right font-semibold", row.profit >= 0 ? "text-success" : "text-destructive")}>
                  {formatPrice(row.profit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Expense list */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">Danh sách chi phí trong kỳ ({listExpenses.length})</h3>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Nhóm:</Label>
              <Select value={listGroupFilter} onValueChange={setListGroupFilter}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  <SelectItem value="__none__">(Không nhóm)</SelectItem>
                  {menuCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />Xóa đã chọn ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa {selectedIds.size} chi phí đã chọn?</AlertDialogTitle>
                    <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete}>Xóa</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {filteredExpenses.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />Xóa tất cả
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa tất cả {filteredExpenses.length} chi phí trong kỳ?</AlertDialogTitle>
                    <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll}>Xóa tất cả</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={listExpenses.length > 0 && listExpenses.every(e => selectedIds.has(e.id))}
                  onCheckedChange={(v) => {
                    if (v) setSelectedIds(prev => new Set([...prev, ...listExpenses.map(e => e.id)]));
                    else setSelectedIds(prev => { const n = new Set(prev); listExpenses.forEach(e => n.delete(e.id)); return n; });
                  }}
                />
              </TableHead>
              <TableHead>Ngày</TableHead>
              
              <TableHead>Sản phẩm</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listExpenses.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có chi phí trong kỳ này</TableCell></TableRow>
            ) : listExpenses.map(exp => (
              <TableRow key={exp.id} data-state={selectedIds.has(exp.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox checked={selectedIds.has(exp.id)} onCheckedChange={() => toggleSelect(exp.id)} />
                </TableCell>
                <TableCell>{format(new Date(exp.expense_date), "dd/MM/yyyy")}</TableCell>
                
                <TableCell className="text-muted-foreground">
                  {exp.product_category || exp.product_name ? (
                    <span>
                      {exp.product_name || "(Cả nhóm)"}
                      {exp.product_category && <span className="text-xs"> · {exp.product_category}</span>}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">{exp.note || "-"}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{formatPrice(exp.amount)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(exp)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa chi phí?</AlertDialogTitle>
                        <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteExpense.mutate(exp.id)}>Xóa</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
    </>
  );

};

export default ExpensesTab;