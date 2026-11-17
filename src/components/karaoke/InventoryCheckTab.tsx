import React, { useState, useMemo, useEffect, Fragment, useRef, useCallback, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Plus, Trash2, RefreshCw, FileText, Save, History, Eye, GripVertical, Settings2, CalendarDays, CalendarRange, Check, Loader2, Pencil, X, Minus, Search, BarChart3, Package, Activity } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOperatingHours } from "@/hooks/useOperatingHours";
import { useQueryClient } from "@tanstack/react-query";
import type { Invoice } from "@/pages/Index";
import { normalizeVi } from "@/lib/normalize";

const InventoryAnalyticsDialog = lazy(() =>
  import("./InventoryAnalyticsDialog").then((m) => ({ default: m.InventoryAnalyticsDialog }))
);

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  categoryId: string;
  openingStock: number;
  imported: number;
  exported: number;
  theoreticalStock: number;
  actualStock: number;
  difference: number;
  note: string;
}

interface InventoryCheckHistory {
  id: string;
  check_date: string;
  start_date: string;
  end_date: string;
  created_at: string;
  check_mode?: string;
}

interface InventoryCheckTabProps {
  invoices: Invoice[];
  items: { id: string; name: string; price: number; category_id: string; shorthand?: string | null }[];
  categories: { id: string; name: string; unit_multiplier?: number }[];
  canEditHistory?: boolean;
  canDeleteHistory?: boolean;
}

// Sortable row component
const SortableInventoryRow = ({
  item,
  updateItem,
  handleRemoveItem,
}: {
  item: InventoryItem;
  updateItem: (id: string, field: keyof InventoryItem, value: number | string) => void;
  handleRemoveItem: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[40px] px-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell>
        <span className="font-medium">{item.name}</span>
      </TableCell>
      <TableCell className="text-center font-medium">
        <span className="font-mono text-xs text-muted-foreground">{item.openingStock}</span>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={item.imported}
          onChange={(e) => updateItem(item.id, "imported", Number(e.target.value))}
          className="h-8 text-center font-mono"
          min={0}
        />
      </TableCell>
      <TableCell className="text-center font-medium">
        <span className="font-mono text-xs text-muted-foreground">{item.exported}</span>
      </TableCell>
      <TableCell className="text-center font-medium">
        {item.theoreticalStock.toFixed(2)}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={item.actualStock}
          onChange={(e) => updateItem(item.id, "actualStock", Number(e.target.value))}
          className="h-8 text-center"
          min={0}
        />
      </TableCell>
      <TableCell
        className={`text-center font-medium ${
          item.difference < 0
            ? "text-destructive"
            : item.difference > 0
            ? "text-green-600"
            : ""
        }`}
      >
        {item.difference.toFixed(2)}
      </TableCell>
      <TableCell>
        <Input
          value={item.note}
          onChange={(e) => updateItem(item.id, "note", e.target.value)}
          className="h-8"
          placeholder="Ghi chú..."
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleRemoveItem(item.id)}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

// Compact Table Row Component for Mobile View (Slimmed down: Omitted Theoretical Stock & Notes)
const MobileCompactRow = ({
  item,
  updateItem,
  handleRemoveItem,
}: {
  item: InventoryItem;
  updateItem: (id: string, field: keyof InventoryItem, value: number | string) => void;
  handleRemoveItem: (id: string) => void;
}) => {
  const [openingStr, setOpeningStr] = useState(String(item.openingStock ?? 0));
  const [importedStr, setImportedStr] = useState(String(item.imported ?? 0));
  const [exportedStr, setExportedStr] = useState(String(item.exported ?? 0));
  const [actualStr, setActualStr] = useState(String(item.actualStock ?? 0));

  useEffect(() => {
    setOpeningStr(String(item.openingStock ?? 0));
  }, [item.openingStock]);

  useEffect(() => {
    setImportedStr(String(item.imported ?? 0));
  }, [item.imported]);

  useEffect(() => {
    setExportedStr(String(item.exported ?? 0));
  }, [item.exported]);

  useEffect(() => {
    setActualStr(String(item.actualStock ?? 0));
  }, [item.actualStock]);

  const handleActualChange = (valStr: string) => {
    setActualStr(valStr);
    if (valStr === "") {
      updateItem(item.id, "actualStock", 0);
    } else {
      const parsed = parseFloat(valStr);
      if (!isNaN(parsed)) updateItem(item.id, "actualStock", Math.max(0, parsed));
    }
  };

  const isLoss = item.difference < 0;
  const isSurplus = item.difference > 0;

  return (
    <TableRow className="hover:bg-muted/30 transition-colors border-b border-border/40">
      {/* Item Name & Unit */}
      <TableCell className="py-2 px-1.5 align-middle">
        <div className="font-semibold text-xs text-foreground truncate max-w-[100px] xs:max-w-[130px] sm:max-w-[180px]" title={item.name}>
          {item.name}
        </div>
        {item.unit && (
          <div className="text-[10px] text-muted-foreground truncate">{item.unit}</div>
        )}
      </TableCell>

      {/* Tồn đầu - Read only */}
      <TableCell className="py-2 px-0.5 text-center align-middle font-mono text-xs font-medium text-muted-foreground">
        {item.openingStock ?? 0}
      </TableCell>

      {/* Nhập - Editable */}
      <TableCell className="py-2 px-0.5 text-center align-middle">
        <Input
          type="number"
          inputMode="decimal"
          value={importedStr}
          onChange={(e) => {
            setImportedStr(e.target.value);
            const num = parseFloat(e.target.value);
            if (!isNaN(num)) updateItem(item.id, "imported", Math.max(0, num));
          }}
          onFocus={(e) => e.target.select()}
          className="h-7 text-xs font-mono text-center p-0.5 w-[38px] xs:w-[44px] bg-background border-border/60"
        />
      </TableCell>

      {/* Xuất - Read only */}
      <TableCell className="py-2 px-0.5 text-center align-middle font-mono text-xs font-medium text-muted-foreground">
        {item.exported ?? 0}
      </TableCell>

      {/* Tồn thực tế */}
      <TableCell className="py-2 px-0.5 text-center align-middle">
        <Input
          type="number"
          inputMode="decimal"
          value={actualStr}
          onChange={(e) => handleActualChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="h-8 text-xs xs:text-sm font-bold font-mono text-center p-0.5 w-[46px] xs:w-[54px] bg-background border-primary text-primary focus:ring-1 focus:ring-primary/30"
        />
      </TableCell>

      {/* Chênh lệch */}
      <TableCell className="py-2 px-0.5 text-center align-middle font-mono font-bold text-xs">
        <span
          className={
            isLoss
              ? "text-destructive font-bold"
              : isSurplus
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-muted-foreground"
          }
        >
          {item.difference > 0 ? `+${item.difference}` : item.difference}
        </span>
      </TableCell>

      {/* Xóa */}
      <TableCell className="py-2 px-0.5 text-center align-middle">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleRemoveItem(item.id)}
          className="h-6 w-6 text-muted-foreground hover:text-destructive p-0"
          title="Xóa món"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

const InventoryCheckTab = ({
  invoices,
  items,
  categories,
  canEditHistory = true,
  canDeleteHistory = true,
}: InventoryCheckTabProps) => {
  const { startTime: opStartTime, endTime: opEndTime } = useOperatingHours();
  const [checkMode, setCheckMode] = useState<"daily" | "range">("daily");
  const [isModeExpanded, setIsModeExpanded] = useState(false);
  const [dailyDate, setDailyDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setInventoryItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        // Save new order to DB
        saveSelectedItems(newOrder.map((i) => i.id));
        return newOrder;
      });
    }
  };

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelectDialogOpen, setIsSelectDialogOpen] = useState(false);
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  const [quickInputText, setQuickInputText] = useState("");
  const [isQuickImportOpen, setIsQuickImportOpen] = useState(false);
  const [quickImportText, setQuickImportText] = useState("");
  const [categoryMultipliers, setCategoryMultipliers] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    categories.forEach((cat) => {
      initial[cat.id] = cat.unit_multiplier ?? 24;
    });
    return initial;
  });
  const [savedItemIds, setSavedItemIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const [isShorthandConfigOpen, setIsShorthandConfigOpen] = useState(false);
  const [shorthandEdits, setShorthandEdits] = useState<Record<string, string>>({});
  const [isImportShorthandConfigOpen, setIsImportShorthandConfigOpen] = useState(false);
  const [importShorthandEdits, setImportShorthandEdits] = useState<Record<string, string>>({});
  const [shorthandSaveStatus, setShorthandSaveStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const [importShorthandSaveStatus, setImportShorthandSaveStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const importDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [isAutoLoadingStock, setIsAutoLoadingStock] = useState(false);
  
  // Clean up timers on unmount
  useEffect(() => {
    const dbTimers = debounceTimers.current;
    const impTimers = importDebounceTimers.current;
    const logTimers = logDebounceTimers.current;
    return () => {
      Object.values(dbTimers).forEach(clearTimeout);
      Object.values(impTimers).forEach(clearTimeout);
      Object.values(logTimers).forEach(clearTimeout);
    };
  }, []);

  // Inventory check activity log & analytics lazy mount state
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsMounted, setAnalyticsMounted] = useState(false);
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const logDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadInventoryLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("inventory_check_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (!error && data) {
        setInventoryLogs(data);
      }
    } catch (err) {
      console.error("Lỗi tải nhật ký kiểm kho:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadInventoryLogs();
  }, [loadInventoryLogs]);

  const addInventoryLog = async (
    itemName: string,
    actionType: string,
    description: string,
    metadata?: any
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let username = "Quản trị viên";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) {
          username = profile.display_name || profile.username || user.email?.split("@")[0] || "Quản trị viên";
        }
      }

      const logId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const newLog = {
        id: logId,
        created_at: new Date().toISOString(),
        item_name: itemName,
        action_type: actionType,
        description,
        username,
        metadata: metadata || {},
      };

      await supabase.from("inventory_check_logs").insert([newLog]);
      loadInventoryLogs();
    } catch (err) {
      console.error("Lỗi lưu nhật ký kiểm kho:", err);
    }
  };

  const filteredLogs = useMemo(() => {
    return inventoryLogs.filter((log) => {
      if (logsSearchQuery.trim()) {
        const q = normalizeVi(logsSearchQuery);
        const name = normalizeVi(log.item_name || "");
        const act = normalizeVi(log.action_type || "");
        const desc = normalizeVi(log.description || "");
        const user = normalizeVi(log.username || "");
        if (!name.includes(q) && !act.includes(q) && !desc.includes(q) && !user.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [inventoryLogs, logsSearchQuery]);

  const handleExportLogsExcel = async () => {
    if (filteredLogs.length === 0) return;
    const XLSX = await import("@datalens-tech/xlsx");
    const exportData = filteredLogs.map((l) => ({
      "Thời gian": new Date(l.created_at).toLocaleString("vi-VN"),
      "Mặt hàng": l.item_name,
      "Hành động": l.action_type,
      "Nội dung": l.description,
      "Người thực hiện": l.username,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nhat_Ky_Kiem_Kho");
    XLSX.writeFile(wb, `Nhat_ky_kiem_kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Xuất nhật ký thành công", description: "Đã tải file Excel nhật ký kiểm kho" });
  };

  const handleClearLogs = async () => {
    try {
      await supabase.from("inventory_check_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setInventoryLogs([]);
      toast({ title: "Đã xóa", description: "Đã xóa toàn bộ nhật ký thao tác kiểm kho" });
    } catch (err) {
      console.error("Lỗi xóa nhật ký:", err);
    }
  };

  // Cập nhật ngày theo giờ hoạt động khi load giờ hoạt động
  useEffect(() => {
    if (opStartTime) {
      const now = new Date();
      const [startH, startM] = opStartTime.split(":").map(Number);
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = (startH || 0) * 60 + (startM || 0);
      if (currentMin < startMin) {
        now.setDate(now.getDate() - 1);
      }
      const calcDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
      setDailyDate(calcDate);
    }
  }, [opStartTime]);

  // History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<InventoryCheckHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [editingHistory, setEditingHistory] = useState<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    createdAt: string;
  } | null>(null);

  // Auto-detect mobile mode on page load
  const [isMobileMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileCategoryFilter, setMobileCategoryFilter] = useState("all");
  const [mobileStatusFilter, setMobileStatusFilter] = useState<"all" | "diff" | "matched" | "uncounted">("all");

  const diffItemsCount = useMemo(() => {
    return inventoryItems.filter((i) => i.difference !== 0).length;
  }, [inventoryItems]);

  const matchedItemsCount = useMemo(() => {
    return inventoryItems.filter((i) => i.difference === 0 && i.actualStock > 0).length;
  }, [inventoryItems]);

  const availableCategories = useMemo(() => {
    const catIds = new Set(inventoryItems.map((i) => i.categoryId));
    return categories.filter((c) => catIds.has(c.id));
  }, [inventoryItems, categories]);

  const filteredMobileItems = useMemo(() => {
    return inventoryItems.filter((item) => {
      if (mobileCategoryFilter !== "all" && item.categoryId !== mobileCategoryFilter) {
        return false;
      }
      if (mobileStatusFilter === "diff" && item.difference === 0) {
        return false;
      }
      if (mobileStatusFilter === "matched" && (item.difference !== 0 || item.actualStock === 0)) {
        return false;
      }
      if (mobileStatusFilter === "uncounted" && item.actualStock > 0) {
        return false;
      }
      if (mobileSearchQuery.trim()) {
        const q = normalizeVi(mobileSearchQuery);
        const name = normalizeVi(item.name);
        const cat = normalizeVi(categories.find((c) => c.id === item.categoryId)?.name || "");
        if (!name.includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [inventoryItems, mobileCategoryFilter, mobileStatusFilter, mobileSearchQuery, categories]);

  // Sync category multipliers when categories change
  useEffect(() => {
    const updated: Record<string, number> = {};
    categories.forEach((cat) => {
      updated[cat.id] = cat.unit_multiplier ?? 24;
    });
    setCategoryMultipliers(updated);
  }, [categories]);

  // Initialize shorthand edits from items (preserve in-progress local edits)
  useEffect(() => {
    const edits: Record<string, string> = {};
    const importEdits: Record<string, string> = {};
    items.forEach((item) => {
      if (item.shorthand) {
        edits[item.id] = item.shorthand;
      }
      if ((item as any).import_shorthand) {
        importEdits[item.id] = (item as any).import_shorthand;
      }
    });
    setShorthandEdits((prev) => ({ ...edits, ...prev }));
    setImportShorthandEdits((prev) => ({ ...importEdits, ...prev }));
  }, [items]);

  // Load saved inventory check items from database
  useEffect(() => {
    const loadSavedItems = async () => {
      const { data, error } = await supabase
        .from("inventory_check_items")
        .select("item_id");
      
      if (error) {
        console.error("Error loading saved items:", error);
        return;
      }
      
      if (data && data.length > 0) {
        const savedIds = data.map((d) => d.item_id);
        setSavedItemIds(savedIds);
        
        // Initialize inventory items from saved selection
        const newItems: InventoryItem[] = savedIds
          .map((itemId) => {
            const item = items.find((i) => i.id === itemId);
            if (!item) return null;
            
            const category = categories.find((c) => c.id === item.category_id);
            
            return {
              id: itemId,
              name: item.name,
              unit: category?.name || "",
              categoryId: item.category_id || "",
              openingStock: 0,
              imported: 0,
              exported: 0,
              theoreticalStock: 0,
              actualStock: 0,
              difference: 0,
              note: "",
            };
          })
          .filter(Boolean) as InventoryItem[];
        
        // Sort by category order
        const catOrder = categories.reduce((acc, c, i) => ({ ...acc, [c.id]: i }), {} as Record<string, number>);
        newItems.sort((a, b) => (catOrder[a.categoryId] ?? 999) - (catOrder[b.categoryId] ?? 999));
        
        setInventoryItems(newItems);
      }
    };
    
    if (items.length > 0) {
      loadSavedItems();
    }
  }, [items, categories]);

  // Fetch opening stock map from most recent daily check strictly before targetDate
  const fetchOpeningStockMap = async (
    targetDate: string
  ): Promise<{ stockMap: Record<string, number>; sourceDate: string } | null> => {
    const { data: recentChecks, error } = await supabase
      .from("inventory_checks")
      .select("id, check_date, start_date")
      .eq("check_mode", "daily")
      .lt("start_date", targetDate)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!recentChecks || recentChecks.length === 0) {
      return null;
    }

    const recentCheck = recentChecks[0];
    const { data: records, error: recError } = await supabase
      .from("inventory_check_records")
      .select("item_id, actual_stock")
      .eq("check_id", recentCheck.id);

    if (recError) {
      throw recError;
    }

    const stockMap: Record<string, number> = {};
    (records || []).forEach((r) => {
      stockMap[r.item_id] = r.actual_stock;
    });

    return {
      stockMap,
      sourceDate: recentCheck.start_date,
    };
  };

  // Sync dailyDate to startDate/endDate for daily mode
  useEffect(() => {
    if (checkMode === "daily") {
      setStartDate(dailyDate);
      setEndDate(dailyDate);
    }
  }, [checkMode, dailyDate]);


  const calculateExportedQuantity = (itemName: string) => {
    let totalExported = 0;

    const [startH, startM] = opStartTime.split(":").map(Number);
    const [endH, endM] = opEndTime.split(":").map(Number);
    const isOvernight = endH < startH || (endH === startH && endM <= startM);

    // Build start boundary
    const rangeStart = new Date(startDate);
    rangeStart.setHours(startH, startM, 0, 0);

    // Build end boundary
    const rangeEnd = new Date(endDate);
    if (isOvernight) {
      rangeEnd.setDate(rangeEnd.getDate() + 1);
    }
    rangeEnd.setHours(endH, endM, 0, 0);

    invoices.forEach((invoice) => {
      // Use raw check-in ISO timestamp for accurate filtering
      const invoiceDate = invoice.checkInRaw
        ? new Date(invoice.checkInRaw)
        : (() => {
            const dateStr = invoice.date.split(",")[0];
            const [day, month, year] = dateStr.split("/").map(Number);
            const [hours, minutes] = invoice.checkIn.split(":").map(Number);
            return new Date(year, month - 1, day, hours || 0, minutes || 0);
          })();

      if (invoiceDate >= rangeStart && invoiceDate <= rangeEnd) {
        invoice.items.forEach((item) => {
          if (item.name === itemName) {
            totalExported += item.quantity;
          }
        });
      }
    });

    return totalExported;
  };

  // Save selected items to database
  const saveSelectedItems = async (itemIds: string[]) => {
    // First delete all existing records
    await supabase.from("inventory_check_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    // Insert new records
    if (itemIds.length > 0) {
      const { error } = await supabase.from("inventory_check_items").insert(
        itemIds.map((itemId) => ({ item_id: itemId }))
      );
      
      if (error) {
        console.error("Error saving items:", error);
        toast({
          title: "Lỗi",
          description: "Không thể lưu danh sách món kiểm kho",
          variant: "destructive",
        });
      }
    }
    
    setSavedItemIds(itemIds);
  };

  // Add selected items to inventory check
  const handleAddItems = async () => {
    const newItems: InventoryItem[] = selectedItemIds
      .filter((id) => !inventoryItems.some((item) => item.id === id))
      .map((id) => {
        const item = items.find((i) => i.id === id);
        const category = categories.find((c) => c.id === item?.category_id);
        const exported = calculateExportedQuantity(item?.name || "");
        
        return {
          id,
          name: item?.name || "",
          unit: category?.name || "",
          categoryId: item?.category_id || "",
          openingStock: 0,
          imported: 0,
          exported,
          theoreticalStock: 0 - exported,
          actualStock: 0,
          difference: 0 - (0 - exported),
          note: "",
        };
      });

    // Sort combined list by category order
    const catOrder = categories.reduce((acc, c, i) => ({ ...acc, [c.id]: i }), {} as Record<string, number>);
    const updatedItems = [...inventoryItems, ...newItems].sort((a, b) => (catOrder[a.categoryId] ?? 999) - (catOrder[b.categoryId] ?? 999));
    setInventoryItems(updatedItems);
    
    // Save to database
    await saveSelectedItems(updatedItems.map((i) => i.id));
    
    setSelectedItemIds([]);
    setIsSelectDialogOpen(false);
    toast({
      title: "Đã thêm",
      description: `Đã thêm ${newItems.length} món vào kiểm kho`,
    });
  };

  // Load opening stock (from prior check) and sales data manually, preserving imported/actualStock/note
  const handleLoadSalesData = async () => {
    if (inventoryItems.length === 0 || isAutoLoadingStock) return;

    setIsAutoLoadingStock(true);
    try {
      const targetDate = checkMode === "daily" ? dailyDate : startDate;
      const openingResult = await fetchOpeningStockMap(targetDate);

      setInventoryItems((prev) =>
        prev.map((item) => {
          const openingStock = openingResult ? (openingResult.stockMap[item.id] ?? 0) : 0;
          const exported = calculateExportedQuantity(item.name);
          const theoreticalStock = openingStock + item.imported - exported;
          const difference = item.actualStock - theoreticalStock;

          return {
            ...item,
            openingStock,
            exported,
            theoreticalStock,
            difference,
          };
        })
      );

      if (openingResult) {
        toast({
          title: "Đã đổ dữ liệu",
          description: `Đã nạp tồn đầu từ ngày ${formatDateDisplay(openingResult.sourceDate)} và dữ liệu bán ra`,
        });
      } else {
        toast({
          title: "Đã đổ dữ liệu",
          description: "Đã cập nhật dữ liệu bán ra (chưa có lịch sử tồn thực tế trước đó, tồn đầu = 0)",
        });
      }
    } catch (err) {
      console.error("Error loading inventory data:", err);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu tồn đầu và bán ra",
        variant: "destructive",
      });
    } finally {
      setIsAutoLoadingStock(false);
    }
  };

  // Parse quick input string to extract actual stock
  // Format: "Ken lùn 14t10l" -> name="Ken lùn", t=thùng(24), l=lon
  const parseQuickInput = (text: string) => {
    const lines = text.trim().split("\n").filter((line) => line.trim());
    const results: { name: string; quantity: number; raw: string }[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim().toLowerCase();
      
      // Match pattern: name followed by numbers with t/l suffixes
      // e.g., "ken lùn 14t10l" or "ken 2t 19l" or "sg 4t 5l"
      const match = trimmedLine.match(/^(.+?)\s+(\d+t?\s*\d*l?|\d+l?\s*\d*t?)$/i);
      
      if (match) {
        const name = match[1].trim();
        const quantityPart = match[2].replace(/\s+/g, "");
        
        // Parse quantity: t = thùng (24 lon), l = lon
        let totalLon = 0;
        
        // Match thùng (t)
        const thungMatch = quantityPart.match(/(\d+)t/i);
        if (thungMatch) {
          totalLon += parseInt(thungMatch[1]) * 24;
        }
        
        // Match lon (l)
        const lonMatch = quantityPart.match(/(\d+)l/i);
        if (lonMatch) {
          totalLon += parseInt(lonMatch[1]);
        }
        
        // If no t or l suffix, treat as plain number
        if (!thungMatch && !lonMatch) {
          const plainNumber = parseInt(quantityPart);
          if (!isNaN(plainNumber)) {
            totalLon = plainNumber;
          }
        }
        
        results.push({ name, quantity: totalLon, raw: line });
      }
    });
    
    return results;
  };

  // Apply quick input to inventory items
  const handleApplyQuickInput = () => {
    const parsed = parseQuickInput(quickInputText);
    
    if (parsed.length === 0) {
      toast({
        title: "Không tìm thấy dữ liệu",
        description: "Vui lòng nhập đúng định dạng: Tên món + số lượng (ví dụ: Ken lùn 14t10l)",
        variant: "destructive",
      });
      return;
    }
    
    let matchedCount = 0;
    
    const updatedItems = inventoryItems.map((item) => {
      const rawShorthand = shorthandEdits[item.id] ?? items.find((i) => i.id === item.id)?.shorthand ?? "";
      const itemShorthand = rawShorthand.trim().toLowerCase();
      
      const matchedParsed = parsed.find((p) => {
        const itemNameLower = item.name.toLowerCase();
        const parsedNameLower = p.name.toLowerCase();
        
        if (itemShorthand && itemShorthand === parsedNameLower) {
          return true;
        }
        return itemNameLower.includes(parsedNameLower) || parsedNameLower.includes(itemNameLower);
      });
      
      if (matchedParsed) {
        matchedCount++;
        const actualStock = matchedParsed.quantity;
        const theoreticalStock = item.openingStock + item.imported - item.exported;
        const difference = actualStock - theoreticalStock;
        
        return {
          ...item,
          actualStock,
          difference,
        };
      }
      
      return item;
    });
    
    setInventoryItems(updatedItems);
    setQuickInputText("");
    setIsQuickInputOpen(false);
    
    addInventoryLog(
      "Hệ thống",
      "Nhập nhanh thực tế",
      `Đã cập nhật tồn thực tế cho ${matchedCount}/${parsed.length} món từ chuỗi nhập nhanh`
    );

    toast({
      title: "Đã cập nhật",
      description: `Đã đổ dữ liệu tồn thực tế cho ${matchedCount}/${parsed.length} món`,
    });
  };

  // Get multiplier for an item based on its category
  const getItemMultiplier = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item?.category_id && categoryMultipliers[item.category_id] !== undefined) {
      return categoryMultipliers[item.category_id];
    }
    return 24; // default
  };

  // Parse quick import string - uses category-based multiplier
  const parseQuickImport = (text: string) => {
    const lines = text.trim().split("\n").filter((line) => line.trim());
    const results: { name: string; quantity: number; raw: string }[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim().toLowerCase();
      
      const match = trimmedLine.match(/^(.+?)\s+([\d.]+[tl]?\s*\d*[tl]?)$/i);
      
      if (match) {
        const name = match[1].trim();
        const quantityPart = match[2].replace(/\s+/g, "");
        
        let totalLon = 0;
        const hasT = /\d+t/i.test(quantityPart);
        const hasL = /\d+l/i.test(quantityPart);
        
        if (hasT || hasL) {
          const thungMatch = quantityPart.match(/(\d+)t/i);
          if (thungMatch) totalLon += parseInt(thungMatch[1]) * 24;
          const lonMatch = quantityPart.match(/(\d+)l/i);
          if (lonMatch) totalLon += parseInt(lonMatch[1]);
        } else {
          const plainNumber = parseFloat(quantityPart);
          if (!isNaN(plainNumber)) {
            const matchedInvItem = inventoryItems.find((invItem) => {
              const rawShorthand = shorthandEdits[invItem.id] ?? items.find((i) => i.id === invItem.id)?.shorthand ?? "";
              const itemShorthand = rawShorthand.trim().toLowerCase();
              if (itemShorthand && itemShorthand === name) return true;
              return invItem.name.toLowerCase().includes(name) || name.includes(invItem.name.toLowerCase());
            });
            const multiplier = matchedInvItem ? getItemMultiplier(matchedInvItem.id) : 24;
            totalLon = plainNumber * multiplier;
          }
        }
        
        results.push({ name, quantity: totalLon, raw: line });
      }
    });
    
    return results;
  };

  // Apply quick import to inventory items (update imported column)
  const handleApplyQuickImport = () => {
    const parsed = parseQuickImport(quickImportText);
    
    if (parsed.length === 0) {
      toast({
        title: "Không tìm thấy dữ liệu",
        description: "Vui lòng nhập đúng định dạng: Tên món + số thùng (ví dụ: sg 14)",
        variant: "destructive",
      });
      return;
    }
    
    let matchedCount = 0;
    
    const updatedItems = inventoryItems.map((item) => {
      const rawImportShorthand = importShorthandEdits[item.id] ?? (items.find((i) => i.id === item.id) as any)?.import_shorthand ?? "";
      const itemImportShorthand = rawImportShorthand.trim().toLowerCase();
      
      const matchedParsed = parsed.find((p) => {
        const itemNameLower = item.name.toLowerCase();
        const parsedNameLower = p.name.toLowerCase();
        
        if (itemImportShorthand && itemImportShorthand === parsedNameLower) return true;
        return itemNameLower.includes(parsedNameLower) || parsedNameLower.includes(itemNameLower);
      });
      
      if (matchedParsed) {
        matchedCount++;
        const imported = matchedParsed.quantity;
        const theoreticalStock = item.openingStock + imported - item.exported;
        const difference = item.actualStock - theoreticalStock;
        
        return {
          ...item,
          imported,
          theoreticalStock,
          difference,
        };
      }
      
      return item;
    });
    
    setInventoryItems(updatedItems);
    setQuickImportText("");
    setIsQuickImportOpen(false);

    addInventoryLog(
      "Hệ thống",
      "Nhập nhanh nhập hàng",
      `Đã cập nhật số lượng nhập hàng cho ${matchedCount}/${parsed.length} món từ chuỗi nhập nhanh`
    );
    
    toast({
      title: "Đã cập nhật",
      description: `Đã đổ dữ liệu nhập hàng cho ${matchedCount}/${parsed.length} món`,
    });
  };

  // Single shorthand auto-save handler (debounced or on blur)
  const saveSingleShorthand = useCallback(async (itemId: string, rawVal: string) => {
    const trimmed = rawVal.trim();
    setShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "saving" }));
    try {
      const { error } = await supabase
        .from("items")
        .update({ shorthand: trimmed || null })
        .eq("id", itemId);
      if (error) throw error;

      queryClient.setQueryData<any[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => (i.id === itemId ? { ...i, shorthand: trimmed || null } : i));
      });
      queryClient.invalidateQueries({ queryKey: ["items"] });

      setShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "saved" }));
      setTimeout(() => {
        setShorthandSaveStatus((prev) => (prev[itemId] === "saved" ? { ...prev, [itemId]: "idle" } : prev));
      }, 2000);
    } catch (err) {
      console.error("Lỗi tự động lưu viết tắt:", err);
      setShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "idle" }));
    }
  }, [queryClient]);

  const handleShorthandChange = (itemId: string, value: string) => {
    setShorthandEdits((prev) => ({ ...prev, [itemId]: value }));
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }
    debounceTimers.current[itemId] = setTimeout(() => {
      saveSingleShorthand(itemId, value);
    }, 500);
  };

  const handleShorthandBlur = (itemId: string) => {
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
      delete debounceTimers.current[itemId];
    }
    const currentVal = shorthandEdits[itemId] ?? "";
    saveSingleShorthand(itemId, currentVal);
  };

  // Single import shorthand auto-save handler (debounced or on blur)
  const saveSingleImportShorthand = useCallback(async (itemId: string, rawVal: string) => {
    const trimmed = rawVal.trim();
    setImportShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "saving" }));
    try {
      const { error } = await supabase
        .from("items")
        .update({ import_shorthand: trimmed || null } as any)
        .eq("id", itemId);
      if (error) throw error;

      queryClient.setQueryData<any[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => (i.id === itemId ? { ...i, import_shorthand: trimmed || null } : i));
      });
      queryClient.invalidateQueries({ queryKey: ["items"] });

      setImportShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "saved" }));
      setTimeout(() => {
        setImportShorthandSaveStatus((prev) => (prev[itemId] === "saved" ? { ...prev, [itemId]: "idle" } : prev));
      }, 2000);
    } catch (err) {
      console.error("Lỗi tự động lưu viết tắt nhập hàng:", err);
      setImportShorthandSaveStatus((prev) => ({ ...prev, [itemId]: "idle" }));
    }
  }, [queryClient]);

  const handleImportShorthandChange = (itemId: string, value: string) => {
    setImportShorthandEdits((prev) => ({ ...prev, [itemId]: value }));
    if (importDebounceTimers.current[itemId]) {
      clearTimeout(importDebounceTimers.current[itemId]);
    }
    importDebounceTimers.current[itemId] = setTimeout(() => {
      saveSingleImportShorthand(itemId, value);
    }, 500);
  };

  const handleImportShorthandBlur = (itemId: string) => {
    if (importDebounceTimers.current[itemId]) {
      clearTimeout(importDebounceTimers.current[itemId]);
      delete importDebounceTimers.current[itemId];
    }
    const currentVal = importShorthandEdits[itemId] ?? "";
    saveSingleImportShorthand(itemId, currentVal);
  };

  // Save shorthand config
  const handleSaveShorthands = async () => {
    try {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      debounceTimers.current = {};

      const updates = Object.entries(shorthandEdits).map(([itemId, shorthand]) =>
        supabase.from("items").update({ shorthand: (shorthand || "").trim() || null }).eq("id", itemId)
      );
      await Promise.all(updates);

      queryClient.setQueryData<any[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => ({
          ...i,
          shorthand: shorthandEdits[i.id] !== undefined ? ((shorthandEdits[i.id] || "").trim() || null) : i.shorthand,
        }));
      });
      queryClient.invalidateQueries({ queryKey: ["items"] });

      toast({
        title: "Đã lưu",
        description: "Đã lưu cấu hình viết tắt",
      });
      setIsShorthandConfigOpen(false);
    } catch (error) {
      console.error("Error saving shorthands:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu cấu hình viết tắt",
        variant: "destructive",
      });
    }
  };

  // Save import shorthand config
  const handleSaveImportShorthands = async () => {
    try {
      Object.values(importDebounceTimers.current).forEach(clearTimeout);
      importDebounceTimers.current = {};

      const updates = Object.entries(importShorthandEdits).map(([itemId, shorthand]) =>
        supabase.from("items").update({ import_shorthand: (shorthand || "").trim() || null } as any).eq("id", itemId)
      );
      await Promise.all(updates);

      queryClient.setQueryData<any[]>(["items"], (old) => {
        if (!old) return old;
        return old.map((i) => ({
          ...i,
          import_shorthand: importShorthandEdits[i.id] !== undefined ? ((importShorthandEdits[i.id] || "").trim() || null) : i.import_shorthand,
        }));
      });
      queryClient.invalidateQueries({ queryKey: ["items"] });

      toast({
        title: "Đã lưu",
        description: "Đã lưu cấu hình viết tắt nhập hàng",
      });
      setIsImportShorthandConfigOpen(false);
    } catch (error) {
      console.error("Error saving import shorthands:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu cấu hình viết tắt nhập hàng",
        variant: "destructive",
      });
    }
  };

  const updateItem = (id: string, field: keyof InventoryItem, value: number | string) => {
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const oldVal = item[field];
          const numVal = Number(value);
          const updated = { ...item, [field]: value };
          
          if (field === "openingStock" || field === "imported" || field === "exported" || field === "actualStock") {
            const openingStock = field === "openingStock" ? numVal : item.openingStock;
            const imported = field === "imported" ? numVal : item.imported;
            const exported = field === "exported" ? numVal : item.exported;
            const actualStock = field === "actualStock" ? numVal : item.actualStock;
            
            updated.theoreticalStock = openingStock + imported - exported;
            updated.difference = actualStock - updated.theoreticalStock;

            if ((field === "imported" || field === "actualStock") && oldVal !== numVal && !isNaN(numVal)) {
              const fieldName = field === "imported" ? "Nhập hàng" : "Tồn thực tế";
              const timerKey = `${item.id}_${field}`;
              if (logDebounceTimers.current[timerKey]) {
                clearTimeout(logDebounceTimers.current[timerKey]);
              }
              logDebounceTimers.current[timerKey] = setTimeout(() => {
                addInventoryLog(
                  item.name,
                  `Sửa ${fieldName}`,
                  `Sửa ${fieldName}: ${oldVal} ➔ ${numVal}`,
                  { field, oldVal, newVal: numVal, itemId: id }
                );
                delete logDebounceTimers.current[timerKey];
              }, 800);
            }
          }
          
          return updated;
        }
        return item;
      })
    );
  };

  // Remove item from inventory check
  const handleRemoveItem = async (id: string) => {
    const updatedItems = inventoryItems.filter((item) => item.id !== id);
    setInventoryItems(updatedItems);
    
    // Save to database
    await saveSelectedItems(updatedItems.map((i) => i.id));
  };

  // Save inventory check to history
  // Save inventory check to history (or overwrite if in editing mode)
  const handleSaveToHistory = async () => {
    if (inventoryItems.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Vui lòng thêm món để kiểm kho trước khi lưu",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Lỗi",
          description: "Vui lòng đăng nhập để lưu kiểm kho",
          variant: "destructive",
        });
        return;
      }

      if (editingHistory) {
        if (!canEditHistory) {
          toast({
            title: "Không có quyền",
            description: "Bạn không có quyền sửa / lưu đè lịch sử kiểm kho",
            variant: "destructive",
          });
          return;
        }
        // OVERWRITE MODE: Update selected history record
        const targetCheckId = editingHistory.id;

        const { error: checkUpdateError } = await supabase
          .from("inventory_checks")
          .update({
            start_date: checkMode === "daily" ? dailyDate : startDate,
            end_date: checkMode === "daily" ? dailyDate : endDate,
            check_mode: checkMode,
          } as any)
          .eq("id", targetCheckId);

        if (checkUpdateError) {
          throw checkUpdateError;
        }

        // Delete existing check records for this check
        const { error: delRecordsError } = await supabase
          .from("inventory_check_records")
          .delete()
          .eq("check_id", targetCheckId);

        if (delRecordsError) {
          throw delRecordsError;
        }

        // Insert updated records
        const records = inventoryItems.map((item) => ({
          check_id: targetCheckId,
          item_id: item.id,
          item_name: item.name,
          opening_stock: item.openingStock,
          imported: item.imported,
          sold: item.exported,
          theoretical_stock: item.theoreticalStock,
          actual_stock: item.actualStock,
          difference: item.difference,
          note: item.note || null,
        }));

        const { error: recordsError } = await supabase
          .from("inventory_check_records")
          .insert(records);

        if (recordsError) {
          throw recordsError;
        }

        // Update local history list
        setHistoryList((prev) =>
          prev.map((h) =>
            h.id === targetCheckId
              ? {
                  ...h,
                  start_date: checkMode === "daily" ? dailyDate : startDate,
                  end_date: checkMode === "daily" ? dailyDate : endDate,
                  check_mode: checkMode,
                }
              : h
          )
        );

        toast({
          title: "Đã lưu đè",
          description: `Đã lưu đè thành công lên lịch sử kiểm kho (${editingHistory.label})`,
        });

        addInventoryLog(
          "Lịch sử kiểm kho",
          "Lưu đè lịch sử",
          `Đã lưu đè thành công lên lịch sử kiểm kho (${editingHistory.label}) với ${inventoryItems.length} món`
        );

        // Exit edit mode
        setEditingHistory(null);
      } else {
        // CREATE NEW RECORD
        const { data: checkData, error: checkError } = await supabase
          .from("inventory_checks")
          .insert({
            check_date: new Date().toISOString().split("T")[0],
            start_date: checkMode === "daily" ? dailyDate : startDate,
            end_date: checkMode === "daily" ? dailyDate : endDate,
            user_id: user.id,
            check_mode: checkMode,
          } as any)
          .select()
          .single();

        if (checkError) {
          throw checkError;
        }

        // Insert inventory check records
        const records = inventoryItems.map((item) => ({
          check_id: checkData.id,
          item_id: item.id,
          item_name: item.name,
          opening_stock: item.openingStock,
          imported: item.imported,
          sold: item.exported,
          theoretical_stock: item.theoreticalStock,
          actual_stock: item.actualStock,
          difference: item.difference,
          note: item.note || null,
        }));

        const { error: recordsError } = await supabase
          .from("inventory_check_records")
          .insert(records);

        if (recordsError) {
          throw recordsError;
        }

        addInventoryLog(
          "Lịch sử kiểm kho",
          "Lưu lịch sử mới",
          `Đã lưu lịch sử kiểm kho mới ngày ${checkMode === "daily" ? dailyDate : `${startDate} - ${endDate}`} (${inventoryItems.length} món)`
        );

        toast({
          title: "Đã lưu",
          description: "Đã lưu lịch sử kiểm kho thành công",
        });
      }
    } catch (error) {
      console.error("Error saving inventory check:", error);
      toast({
        title: "Lỗi",
        description: "Không thể lưu lịch sử kiểm kho",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Load history list
  const loadHistoryList = async () => {
    setIsLoadingHistory(true);
    
    try {
      const { data, error } = await supabase
        .from("inventory_checks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      setHistoryList(data || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải lịch sử kiểm kho",
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // View history detail
  const handleViewHistory = async (historyId: string) => {
    setViewingHistoryId(historyId);
    
    try {
      const { data, error } = await supabase
        .from("inventory_check_records")
        .select("*")
        .eq("check_id", historyId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const history = historyList.find((h) => h.id === historyId);
        if (history) {
          setStartDate(history.start_date);
          setEndDate(history.end_date);
        }

        const loadedItems: InventoryItem[] = data.map((record) => {
          const item = items.find((i) => i.id === record.item_id);
          const category = item ? categories.find((c) => c.id === item.category_id) : null;

          return {
            id: record.item_id,
            name: record.item_name,
            unit: category?.name || "",
            categoryId: item?.category_id || "",
            openingStock: record.opening_stock,
            imported: record.imported,
            exported: record.sold,
            theoreticalStock: record.theoretical_stock,
            actualStock: record.actual_stock,
            difference: record.difference,
            note: record.note || "",
          };
        });

        setInventoryItems(loadedItems);
        setIsHistoryOpen(false);
        
        toast({
          title: "Đã tải",
          description: "Đã tải lịch sử kiểm kho",
        });
      }
    } catch (error) {
      console.error("Error loading history detail:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải chi tiết kiểm kho",
        variant: "destructive",
      });
    } finally {
      setViewingHistoryId(null);
    }
  };

  // Edit history - load records and switch to edit (overwrite) mode
  const handleEditHistory = async (historyId: string) => {
    if (!canEditHistory) {
      toast({
        title: "Không có quyền",
        description: "Bạn không có quyền sửa lịch sử kiểm kho",
        variant: "destructive",
      });
      return;
    }
    setViewingHistoryId(historyId);
    
    try {
      const { data, error } = await supabase
        .from("inventory_check_records")
        .select("*")
        .eq("check_id", historyId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const history = historyList.find((h) => h.id === historyId);
        let label = "";
        if (history) {
          if (history.check_mode === "range") {
            setCheckMode("range");
            setStartDate(history.start_date);
            setEndDate(history.end_date);
          } else {
            setCheckMode("daily");
            setDailyDate(history.start_date);
            setStartDate(history.start_date);
            setEndDate(history.end_date);
          }

          label = history.start_date === history.end_date
            ? formatDateDisplay(history.start_date)
            : `${formatDateDisplay(history.start_date)} - ${formatDateDisplay(history.end_date)}`;

          setEditingHistory({
            id: history.id,
            label,
            startDate: history.start_date,
            endDate: history.end_date,
            createdAt: history.created_at,
          });
        }

        const loadedItems: InventoryItem[] = data.map((record) => {
          const item = items.find((i) => i.id === record.item_id);
          const category = item ? categories.find((c) => c.id === item.category_id) : null;

          return {
            id: record.item_id,
            name: record.item_name,
            unit: category?.name || "",
            categoryId: item?.category_id || "",
            openingStock: record.opening_stock,
            imported: record.imported,
            exported: record.sold,
            theoreticalStock: record.theoretical_stock,
            actualStock: record.actual_stock,
            difference: record.difference,
            note: record.note || "",
          };
        });

        setInventoryItems(loadedItems);
        setIsHistoryOpen(false);
        
        toast({
          title: "Đang sửa lịch sử kiểm kho",
          description: `Đã nạp số liệu kỳ kiểm (${label}). Bấm "Lưu đè lịch sử" để lưu đè lên bản ghi này.`,
        });
      }
    } catch (error) {
      console.error("Error loading history for edit:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải chi tiết kiểm kho để sửa",
        variant: "destructive",
      });
    } finally {
      setViewingHistoryId(null);
    }
  };

  // Delete history
  const handleDeleteHistory = async (historyId: string) => {
    if (!canDeleteHistory) {
      toast({
        title: "Không có quyền",
        description: "Bạn không có quyền xóa lịch sử kiểm kho",
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await supabase
        .from("inventory_checks")
        .delete()
        .eq("id", historyId);

      if (error) {
        throw error;
      }

      setHistoryList((prev) => prev.filter((h) => h.id !== historyId));
      setSelectedHistoryIds((prev) => prev.filter((id) => id !== historyId));
      if (editingHistory?.id === historyId) {
        setEditingHistory(null);
      }
      
      toast({
        title: "Đã xóa",
        description: "Đã xóa lịch sử kiểm kho",
      });
    } catch (error) {
      console.error("Error deleting history:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa lịch sử kiểm kho",
        variant: "destructive",
      });
    }
  };

  // Delete multiple history records
  const handleDeleteMultipleHistory = async () => {
    if (!canDeleteHistory) {
      toast({
        title: "Không có quyền",
        description: "Bạn không có quyền xóa lịch sử kiểm kho",
        variant: "destructive",
      });
      return;
    }
    if (selectedHistoryIds.length === 0) return;
    
    setIsDeletingMultiple(true);
    try {
      const { error } = await supabase
        .from("inventory_checks")
        .delete()
        .in("id", selectedHistoryIds);

      if (error) {
        throw error;
      }

      setHistoryList((prev) => prev.filter((h) => !selectedHistoryIds.includes(h.id)));
      setSelectedHistoryIds([]);
      
      toast({
        title: "Đã xóa",
        description: `Đã xóa ${selectedHistoryIds.length} lịch sử kiểm kho`,
      });
    } catch (error) {
      console.error("Error deleting multiple history:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa lịch sử kiểm kho",
        variant: "destructive",
      });
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (inventoryItems.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Vui lòng thêm món để kiểm kho trước khi xuất",
        variant: "destructive",
      });
      return;
    }

    const XLSX = await import("@datalens-tech/xlsx");
    const exportData = inventoryItems.map((item) => ({
      "Hàng hóa": item.name,
      "ĐVT": item.unit,
      "Tồn đầu": item.openingStock,
      "Nhập": item.imported,
      "Xuất": item.exported,
      "Tồn lý thuyết": item.theoreticalStock.toFixed(2),
      "Tồn thực tế": item.actualStock,
      "Chênh lệch": item.difference.toFixed(2),
      "Ghi chú": item.note,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kiểm kho");
    
    const formatDate = (date: string) => {
      const [y, m, d] = date.split("-");
      return `${d}-${m}-${y}`;
    };
    
    XLSX.writeFile(wb, `Kiem_kho_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`);
    
    toast({
      title: "Xuất thành công",
      description: "Đã xuất báo cáo kiểm kho ra file Excel",
    });
  };

  // Group items by category for selection dialog
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, typeof items> = {};
    
    categories.forEach((cat) => {
      const categoryItems = items.filter((item) => item.category_id === cat.id);
      if (categoryItems.length > 0) {
        grouped[cat.name] = categoryItems;
      }
    });
    
    return grouped;
  }, [items, categories]);

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSelectCategory = (categoryName: string) => {
    const categoryItemIds = itemsByCategory[categoryName]?.map((i) => i.id) || [];
    const allSelected = categoryItemIds.every((id) => selectedItemIds.includes(id));
    
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !categoryItemIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => [...new Set([...prev, ...categoryItemIds])]);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 p-6">
        {editingHistory && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                <Pencil className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  Đang ở chế độ sửa lịch sử: {editingHistory.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    (Ghi nhận: {new Date(editingHistory.createdAt).toLocaleString("vi-VN")})
                  </span>
                </p>
                <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                  Bạn có thể chỉnh sửa số liệu các cột, khi bấm nút <strong>"Lưu đè lịch sử"</strong> hệ thống sẽ cập nhật đè trực tiếp lên bản ghi này.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingHistory(null);
                toast({
                  title: "Đã hủy chế độ sửa",
                  description: "Đã chuyển về chế độ lưu kiểm kho mới",
                });
              }}
              className="h-8 text-xs border-amber-400 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Hủy sửa (Lưu mới)
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label
              className="mb-1.5 block cursor-pointer select-none"
              onClick={() => setIsModeExpanded((prev) => !prev)}
            >
              Chế độ
            </Label>
            {!isModeExpanded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModeExpanded(true)}
                className="h-9 text-xs gap-1.5 px-3"
              >
                {checkMode === "daily" ? (
                  <>
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>Theo ngày</span>
                  </>
                ) : (
                  <>
                    <CalendarRange className="h-3.5 w-3.5" />
                    <span>Theo khoảng</span>
                  </>
                )}
              </Button>
            ) : (
              <Tabs
                value={checkMode}
                onValueChange={(v) => {
                  setCheckMode(v as "daily" | "range");
                  setIsModeExpanded(false);
                }}
              >
                <TabsList className="h-9">
                  <TabsTrigger
                    value="daily"
                    className="text-xs gap-1"
                    onClick={() => setIsModeExpanded(false)}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Theo ngày
                  </TabsTrigger>
                  <TabsTrigger
                    value="range"
                    className="text-xs gap-1"
                    onClick={() => setIsModeExpanded(false)}
                  >
                    <CalendarRange className="h-3.5 w-3.5" />
                    Theo khoảng
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          {checkMode === "daily" ? (
            <div>
              <Label className="mb-1.5 block">Ngày kiểm kho</Label>
              <Input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
          ) : (
            <>
              <div>
                <Label className="mb-1.5 block">Từ ngày</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Đến ngày</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
            </>
          )}
          <Button
            onClick={handleLoadSalesData}
            variant="secondary"
            disabled={isAutoLoadingStock || inventoryItems.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoLoadingStock ? "animate-spin" : ""}`} />
            {isAutoLoadingStock ? "Đang đổ dữ liệu..." : "Đổ dữ liệu"}
          </Button>
          <Dialog open={isSelectDialogOpen} onOpenChange={setIsSelectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Thêm món kiểm kho
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Chọn món để kiểm kho</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {Object.entries(itemsByCategory).map(([categoryName, categoryItems]) => {
                    const categoryItemIds = categoryItems.map((i) => i.id);
                    const allSelected = categoryItemIds.every((id) => selectedItemIds.includes(id));
                    const someSelected = categoryItemIds.some((id) => selectedItemIds.includes(id));
                    
                    return (
                      <div key={categoryName} className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            id={`cat-${categoryName}`}
                            checked={allSelected}
                            onCheckedChange={() => toggleSelectCategory(categoryName)}
                            className={someSelected && !allSelected ? "opacity-50" : ""}
                          />
                          <Label
                            htmlFor={`cat-${categoryName}`}
                            className="font-semibold cursor-pointer"
                          >
                            {categoryName}
                          </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          {categoryItems.map((item) => (
                            <div key={item.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`item-${item.id}`}
                                checked={selectedItemIds.includes(item.id)}
                                onCheckedChange={() => toggleSelectItem(item.id)}
                                disabled={inventoryItems.some((i) => i.id === item.id)}
                              />
                              <Label
                                htmlFor={`item-${item.id}`}
                                className={`cursor-pointer text-sm ${
                                  inventoryItems.some((i) => i.id === item.id)
                                    ? "text-muted-foreground line-through"
                                    : ""
                                }`}
                              >
                                {item.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedItemIds([]);
                    setIsSelectDialogOpen(false);
                  }}
                >
                  Hủy
                </Button>
                <Button onClick={handleAddItems} disabled={selectedItemIds.length === 0}>
                  Thêm ({selectedItemIds.length} món)
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
          <div className="flex flex-wrap items-center gap-4">
          {/* Quick Input Dialog */}
          <Dialog open={isQuickInputOpen} onOpenChange={setIsQuickInputOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Nhập nhanh tồn thực tế
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  Nhập nhanh tồn thực tế từ chuỗi
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsShorthandConfigOpen(!isShorthandConfigOpen)}
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Viết tắt
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {isShorthandConfigOpen && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Cấu hình viết tắt cho hàng hoá trong kiểm kho</Label>
                      <span className="text-xs flex items-center gap-1 font-normal text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Tự động lưu khi sửa
                      </span>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {categories.map((cat) => {
                          const catItems = inventoryItems.filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          return (
                            <div key={cat.id}>
                              <p className="text-xs font-semibold text-primary mb-1">{cat.name}</p>
                              <div className="space-y-1.5 ml-2">
                                {catItems.map((invItem) => (
                                  <div key={invItem.id} className="flex items-center gap-2">
                                    <span className="text-sm min-w-[140px] truncate">{invItem.name}</span>
                                    <div className="relative flex items-center">
                                      <Input
                                        value={shorthandEdits[invItem.id] ?? ""}
                                        onChange={(e) => handleShorthandChange(invItem.id, e.target.value)}
                                        onBlur={() => handleShorthandBlur(invItem.id)}
                                        placeholder="VD: sg, ken..."
                                        className="h-7 w-[130px] text-sm pr-6"
                                      />
                                      {shorthandSaveStatus[invItem.id] === "saving" && (
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground absolute right-2 pointer-events-none" />
                                      )}
                                      {shorthandSaveStatus[invItem.id] === "saved" && (
                                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 absolute right-2 pointer-events-none" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground">Thay đổi sẽ tự động lưu khi gõ hoặc rời khỏi ô nhập.</p>
                      <Button size="sm" onClick={handleSaveShorthands}>
                        <Save className="h-3 w-3 mr-1" />
                        Lưu tất cả
                      </Button>
                    </div>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <p>Mẫu mỗi dòng: <code className="bg-muted px-1 rounded">sg 14t10l</code> (t = thùng 24 lon, l = lon).</p>
                  <p className="mt-1">Dùng viết tắt hoặc tên đầy đủ. Ví dụ:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {inventoryItems.slice(0, 3).map((invItem) => {
                      const sh = shorthandEdits[invItem.id] ?? items.find((i) => i.id === invItem.id)?.shorthand;
                      return (
                        <li key={invItem.id}>
                          {sh || invItem.name.toLowerCase()} 14t10l
                          {sh && <span className="text-xs ml-1">({invItem.name})</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Textarea
                  placeholder="sg 4t 5l&#10;ken 2t 19l&#10;bạc cao 8t 3l"
                  value={quickInputText}
                  onChange={(e) => setQuickInputText(e.target.value)}
                  className="min-h-[150px] font-mono"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuickInputText("");
                      setIsQuickInputOpen(false);
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={handleApplyQuickInput} disabled={!quickInputText.trim()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Đổ dữ liệu vào cột "Tồn thực tế"
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Quick Import Dialog */}
          <Dialog open={isQuickImportOpen} onOpenChange={setIsQuickImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Nhập nhanh nhập hàng
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  Nhập nhanh nhập hàng
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsImportShorthandConfigOpen(!isImportShorthandConfigOpen)}
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Viết tắt
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {isImportShorthandConfigOpen && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Cấu hình viết tắt nhập hàng</Label>
                      <span className="text-xs flex items-center gap-1 font-normal text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Tự động lưu khi sửa
                      </span>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {categories.map((cat) => {
                          const catItems = inventoryItems.filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          return (
                            <div key={cat.id}>
                              <p className="text-xs font-semibold text-primary mb-1">{cat.name}</p>
                              <div className="space-y-1.5 ml-2">
                                {catItems.map((invItem) => (
                                  <div key={invItem.id} className="flex items-center gap-2">
                                    <span className="text-sm min-w-[140px] truncate">{invItem.name}</span>
                                    <div className="relative flex items-center">
                                      <Input
                                        value={importShorthandEdits[invItem.id] ?? ""}
                                        onChange={(e) => handleImportShorthandChange(invItem.id, e.target.value)}
                                        onBlur={() => handleImportShorthandBlur(invItem.id)}
                                        placeholder="VD: sg, ken..."
                                        className="h-7 w-[130px] text-sm pr-6"
                                      />
                                      {importShorthandSaveStatus[invItem.id] === "saving" && (
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground absolute right-2 pointer-events-none" />
                                      )}
                                      {importShorthandSaveStatus[invItem.id] === "saved" && (
                                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 absolute right-2 pointer-events-none" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-muted-foreground">Thay đổi sẽ tự động lưu khi gõ hoặc rời khỏi ô nhập.</p>
                      <Button size="sm" onClick={handleSaveImportShorthands}>
                        <Save className="h-3 w-3 mr-1" />
                        Lưu tất cả
                      </Button>
                    </div>
                  </div>
                )}
                {/* Category multiplier config */}
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <Label className="text-sm font-semibold">Hệ số nhân mặc định theo loại</Label>
                  <div className="space-y-1.5">
                    {categories
                      .filter((cat) => inventoryItems.some((i) => i.categoryId === cat.id))
                      .map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2">
                          <span className="text-sm min-w-[120px] truncate">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={categoryMultipliers[cat.id] ?? 24}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 1;
                              setCategoryMultipliers((prev) => ({
                                ...prev,
                                [cat.id]: val,
                              }));
                              // Save to DB
                              supabase
                                .from("categories")
                                .update({ unit_multiplier: val } as any)
                                .eq("id", cat.id)
                                .then();
                            }}
                            className="h-7 w-[80px] text-sm text-center"
                            min={1}
                          />
                        </div>
                      ))}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Mỗi dòng: <code className="bg-muted px-1 rounded">tên số_lượng</code> — tự nhân theo hệ số loại.</p>
                  <p className="mt-1">Cũng hỗ trợ: <code className="bg-muted px-1 rounded">sg 14t10l</code> (t=24, l=1).</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {inventoryItems.slice(0, 3).map((invItem) => {
                      const sh = importShorthandEdits[invItem.id] ?? (items.find((i) => i.id === invItem.id) as any)?.import_shorthand;
                      const mult = getItemMultiplier(invItem.id);
                      return (
                        <li key={invItem.id}>
                          {sh || invItem.name.toLowerCase()} 5
                          <span className="text-xs ml-1">
                            {sh && `(${invItem.name}) `}= {5 * mult} đơn vị (×{mult})
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Textarea
                  placeholder="sg 14&#10;ken 8&#10;bạc cao 5"
                  value={quickImportText}
                  onChange={(e) => setQuickImportText(e.target.value)}
                  className="min-h-[150px] font-mono"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuickImportText("");
                      setIsQuickImportOpen(false);
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={handleApplyQuickImport} disabled={!quickImportText.trim()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Đổ dữ liệu vào cột "Nhập"
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* 1. Save to History Button */}
          <Button
            onClick={handleSaveToHistory}
            disabled={isSaving || inventoryItems.length === 0}
            className={editingHistory ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Đang lưu..." : editingHistory ? "Lưu đè lịch sử" : "Lưu"}
          </Button>

          {/* 2. History Dialog (Lịch sử kiểm kho) */}
          <Dialog open={isHistoryOpen} onOpenChange={(open) => {
            setIsHistoryOpen(open);
            if (open) {
              loadHistoryList();
              setSelectedHistoryIds([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="h-4 w-4 mr-2" />
                Lịch sử kiểm kho
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Lịch sử kiểm kho</DialogTitle>
                  {canDeleteHistory && selectedHistoryIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteMultipleHistory}
                      disabled={isDeletingMultiple}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Xóa {selectedHistoryIds.length} mục
                    </Button>
                  )}
                </div>
              </DialogHeader>
              <ScrollArea className="h-[400px]">
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Đang tải...
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có lịch sử kiểm kho
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canDeleteHistory && (
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={historyList.length > 0 && selectedHistoryIds.length === historyList.length}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedHistoryIds(historyList.map((h) => h.id));
                                } else {
                                  setSelectedHistoryIds([]);
                                }
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead>Loại</TableHead>
                        <TableHead>Ngày kiểm</TableHead>
                        <TableHead>Khoảng thời gian</TableHead>
                        <TableHead>Thời gian tạo</TableHead>
                        <TableHead className="w-[150px] text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyList.map((history) => (
                        <TableRow key={history.id}>
                          {canDeleteHistory && (
                            <TableCell>
                              <Checkbox
                                checked={selectedHistoryIds.includes(history.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedHistoryIds((prev) => [...prev, history.id]);
                                  } else {
                                    setSelectedHistoryIds((prev) => prev.filter((id) => id !== history.id));
                                  }
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${history.check_mode === 'daily' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {history.check_mode === 'daily' ? 'Ngày' : 'Khoảng'}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatDateDisplay(history.check_date)}
                          </TableCell>
                          <TableCell>
                            {history.start_date === history.end_date 
                              ? formatDateDisplay(history.start_date)
                              : `${formatDateDisplay(history.start_date)} - ${formatDateDisplay(history.end_date)}`
                            }
                          </TableCell>
                          <TableCell>
                            {new Date(history.created_at).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canEditHistory && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditHistory(history.id)}
                                  disabled={viewingHistoryId === history.id}
                                  className="h-8 px-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  title="Sửa lịch sử này (khi lưu sẽ lưu đè)"
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Sửa
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewHistory(history.id)}
                                disabled={viewingHistoryId === history.id}
                                className="h-8 w-8"
                                title="Xem / Nạp dữ liệu vào bảng"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canDeleteHistory && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteHistory(history.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  title="Xóa lịch sử"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* 3. Inventory Analytics Dialog (Báo cáo) */}
          <Button
            variant="outline"
            onClick={() => {
              setAnalyticsMounted(true);
              setIsAnalyticsOpen(true);
            }}
            className="border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
          >
            <BarChart3 className="h-4 w-4 mr-1.5 text-amber-600 dark:text-amber-400" />
            <span>Báo cáo</span>
          </Button>
          {analyticsMounted && (
            <Suspense fallback={null}>
              <InventoryAnalyticsDialog
                items={items}
                categories={categories}
                open={isAnalyticsOpen}
                onOpenChange={setIsAnalyticsOpen}
              />
            </Suspense>
          )}

          {/* 4. Inventory Check Activity Log Button & Modal (Log) */}
          <Dialog open={isLogsOpen} onOpenChange={(open) => {
            setIsLogsOpen(open);
            if (open) loadInventoryLogs();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40">
                <Activity className="h-4 w-4 mr-1.5" />
                <span>Log</span>
                {inventoryLogs.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    {inventoryLogs.length}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-950/60 rounded-lg text-blue-600 dark:text-blue-400">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold">
                        Nhật Ký Thao Tác Kiểm Kho
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground">
                        Ghi nhận chi tiết từng thao tác sửa số lượng nhập, tồn thực tế, nhập nhanh, đổ dữ liệu...
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadInventoryLogs}
                    disabled={isLoadingLogs}
                    className="h-8 text-xs gap-1"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
                    Làm mới
                  </Button>
                </div>
              </DialogHeader>

              {/* Log Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-y border-border">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm tên món, hành động, người thực hiện..."
                    value={logsSearchQuery}
                    onChange={(e) => setLogsSearchQuery(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    Tổng: <strong>{filteredLogs.length}</strong> nhật ký
                  </span>
                  {filteredLogs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportLogsExcel}
                      className="h-8 text-xs gap-1 text-emerald-700 dark:text-emerald-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Xuất Excel
                    </Button>
                  )}
                  {canDeleteHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearLogs}
                      className="h-8 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa nhật ký
                    </Button>
                  )}
                </div>
              </div>

              {/* Logs List Table */}
              <ScrollArea className="flex-1 max-h-[480px] pr-2 mt-2">
                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    Chưa có nhật ký thao tác kiểm kho nào.
                  </div>
                ) : (
                  <Table className="text-xs">
                    <TableHeader className="sticky top-0 bg-background z-10 border-b">
                      <TableRow>
                        <TableHead className="w-[140px]">Thời gian</TableHead>
                        <TableHead className="w-[160px]">Mặt hàng</TableHead>
                        <TableHead className="w-[130px]">Hành động</TableHead>
                        <TableHead>Nội dung chi tiết</TableHead>
                        <TableHead className="w-[120px] text-right">Người thực hiện</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/40">
                          <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {log.item_name}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                              {log.action_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground">
                            {log.description}
                          </TableCell>
                          <TableCell className="text-right font-medium text-muted-foreground">
                            {log.username || "Quản trị viên"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
        </div>

        {inventoryItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Chưa có món nào được thêm vào kiểm kho. Bấm "Thêm món kiểm kho" để bắt đầu.
          </div>
        ) : isMobileMode ? (
          /* Mobile View Optimized for Touch & Phone (Clean 100% width table, no horizontal scroll needed) */
          <div className="space-y-3 pb-28">
            {/* Mobile Touch Quick Action Toolbar */}
            <div className="bg-muted/40 border rounded-xl p-2.5 space-y-2">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadSalesData}
                  disabled={isAutoLoadingStock || inventoryItems.length === 0}
                  className="h-8 text-xs gap-1 px-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${isAutoLoadingStock ? "animate-spin" : ""}`} />
                  <span>{isAutoLoadingStock ? "Đang đổ..." : "Đổ dữ liệu"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickInputOpen(true)}
                  className="h-8 text-xs gap-1 px-2"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Nhập tồn</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickImportOpen(true)}
                  className="h-8 text-xs gap-1 px-2"
                >
                  <Package className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Nhập hàng</span>
                </Button>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSaveToHistory}
                  disabled={isSaving || inventoryItems.length === 0}
                  className={`h-8 text-xs gap-1 px-2 shadow-xs ${editingHistory ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? "Đang lưu..." : editingHistory ? "Lưu đè" : "Lưu"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadHistoryList();
                    setSelectedHistoryIds([]);
                    setIsHistoryOpen(true);
                  }}
                  className="h-8 text-xs gap-1 px-2"
                >
                  <History className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Lịch sử</span>
                </Button>
              </div>
            </div>

            {/* Compact Mobile Column Table (100% width, no horizontal scroll needed) */}
            <div className="border rounded-xl bg-card shadow-xs overflow-hidden">
              <Table className="w-full table-fixed text-xs">
                <TableHeader className="bg-muted/80">
                  <TableRow className="border-b border-border">
                    <TableHead className="py-1.5 px-1 font-bold text-foreground text-left w-[32%] text-[11px]">Hàng hóa</TableHead>
                    <TableHead className="py-1.5 px-0.5 font-bold text-foreground text-center w-[13%] text-[11px]">Đầu</TableHead>
                    <TableHead className="py-1.5 px-0.5 font-bold text-foreground text-center w-[13%] text-[11px]">Nhập</TableHead>
                    <TableHead className="py-1.5 px-0.5 font-bold text-foreground text-center w-[13%] text-[11px]">Xuất</TableHead>
                    <TableHead className="py-1.5 px-0.5 font-bold text-primary text-center w-[16%] text-[11px]">Thực tế</TableHead>
                    <TableHead className="py-1.5 px-0.5 font-bold text-foreground text-center w-[13%] text-[11px]">Lệch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map((item, index) => {
                    const prevItem = index > 0 ? inventoryItems[index - 1] : null;
                    const showCategoryHeader = !prevItem || prevItem.categoryId !== item.categoryId;
                    const categoryName = categories.find((c) => c.id === item.categoryId)?.name || item.unit || "Khác";

                    return (
                      <Fragment key={item.id}>
                        {showCategoryHeader && (
                          <TableRow className="bg-muted/60 border-b border-border/60">
                            <TableCell colSpan={6} className="py-1 px-1.5 font-bold text-[11px] text-primary">
                              {categoryName}
                            </TableCell>
                          </TableRow>
                        )}
                        <MobileCompactRow
                          item={item}
                          updateItem={updateItem}
                          handleRemoveItem={handleRemoveItem}
                        />
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          /* Desktop Drag & Drop Table View */
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[180px]">Hàng hóa</TableHead>
                    <TableHead className="w-[100px] text-center">Tồn đầu</TableHead>
                    <TableHead className="w-[100px] text-center">Nhập</TableHead>
                    <TableHead className="w-[100px] text-center">Xuất</TableHead>
                    <TableHead className="w-[120px] text-center">Tồn lý thuyết</TableHead>
                    <TableHead className="w-[100px] text-center">Tồn thực tế</TableHead>
                    <TableHead className="w-[100px] text-center">Chênh lệch</TableHead>
                    <TableHead className="w-[150px]">Ghi chú</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={inventoryItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {inventoryItems.map((item, index) => {
                      const prevItem = index > 0 ? inventoryItems[index - 1] : null;
                      const showCategoryHeader = !prevItem || prevItem.categoryId !== item.categoryId;
                      const categoryName = categories.find((c) => c.id === item.categoryId)?.name || item.unit || "Khác";
                      return (
                        <Fragment key={item.id}>
                          {showCategoryHeader && (
                            <TableRow key={`cat-${item.categoryId}-${index}`} className="bg-muted/50">
                              <TableCell colSpan={10} className="py-1.5 px-3">
                                <span className="text-sm font-semibold text-primary">{categoryName}</span>
                              </TableCell>
                            </TableRow>
                          )}
                          <SortableInventoryRow
                            item={item}
                            updateItem={updateItem}
                            handleRemoveItem={handleRemoveItem}
                          />
                        </Fragment>
                      );
                    })}
                  </SortableContext>
                </TableBody>
              </Table>
            </div>
          </DndContext>
        )}
      </Card>
    </div>
  );
};

export default InventoryCheckTab;
