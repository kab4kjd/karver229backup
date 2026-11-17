import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, ClipboardPaste } from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseProductGroups, ExpenseProductItem } from "@/hooks/useExpenseProductGroups";
import { toast } from "@/hooks/use-toast";

type ColKey = "amount" | "note" | "expense_date" | "product_category" | "product_name";

interface Row {
  id: string;
  amount: string;
  note: string;
  expense_date: string; // yyyy-MM-dd
  product_category: string;
  product_name: string;
}

const COLS: { key: ColKey; label: string; width: string }[] = [
  { key: "amount", label: "Giá trị (×1.000đ)", width: "140px" },
  { key: "note", label: "Ghi chú", width: "200px" },
  { key: "expense_date", label: "Ngày chi", width: "150px" },
  { key: "product_category", label: "Nhóm sản phẩm", width: "180px" },
  { key: "product_name", label: "Sản phẩm trong nhóm", width: "200px" },
];

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const newRow = (): Row => ({
  id: crypto.randomUUID(),
  amount: "",
  note: "",
  expense_date: todayStr(),
  product_category: "",
  product_name: "",
});

interface SortableHeaderProps {
  colKey: ColKey;
  label: string;
  width: string;
}
const SortableHeader = ({ colKey, label, width }: SortableHeaderProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colKey });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    minWidth: width,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <th ref={setNodeRef} style={style} className="border bg-muted p-2 text-left text-sm font-semibold">
      <div className="flex items-center gap-1">
        <button className="cursor-grab touch-none" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span>{label}</span>
      </div>
    </th>
  );
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const QuickAddExpensesDialog = ({ open, onOpenChange }: Props) => {
  const { expenseCategories, addExpense } = useExpenses();
  const { groups: menuCategories, items: menuItems } = useExpenseProductGroups();

  const [columnOrder, setColumnOrder] = useState<ColKey[]>(COLS.map(c => c.key));
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, newRow));
  const [activeCell, setActiveCell] = useState<{ row: number; col: ColKey } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedCols = useMemo(
    () => columnOrder.map(k => COLS.find(c => c.key === k)!),
    [columnOrder]
  );

  const itemsByCategoryName = useMemo(() => {
    const map = new Map<string, ExpenseProductItem[]>();
    menuCategories.forEach(cat => {
      map.set(cat.name, menuItems.filter(i => i.group_id === cat.id));
    });
    return map;
  }, [menuCategories, menuItems]);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldI = columnOrder.indexOf(active.id as ColKey);
      const newI = columnOrder.indexOf(over.id as ColKey);
      setColumnOrder(arrayMove(columnOrder, oldI, newI));
    }
  };

  const handleAddRow = () => setRows(prev => [...prev, newRow()]);
  const handleRemoveRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));
  const handleClearAll = () => setRows(Array.from({ length: 5 }, newRow));

  const findMatch = (value: string, names: string[]): string => {
    const v = value.trim().toLowerCase();
    if (!v) return "";
    return names.find(n => n.toLowerCase() === v) || "";
  };

  // Try to parse various date formats to yyyy-MM-dd
  const parseDate = (s: string): string => {
    const t = s.trim();
    if (!t) return "";
    // dd/MM/yyyy or dd-MM-yyyy
    const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      let yy = m[3];
      if (yy.length === 2) yy = "20" + yy;
      return `${yy}-${mm}-${dd}`;
    }
    // yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    return "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    pasteText(text, activeCell?.row ?? 0, activeCell?.col ?? columnOrder[0]);
  };

  const pasteText = (text: string, startRow: number, startCol: ColKey) => {
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => !(i === a.length - 1 && l === ""));
    if (lines.length === 0) return;
    const parsed = lines.map(line => line.split("\t"));
    const startColIdx = columnOrder.indexOf(startCol);
    if (startColIdx === -1) return;

    const menuCatNames = menuCategories.map(c => c.name);

    setRows(prev => {
      const next = [...prev];
      while (next.length < startRow + parsed.length) next.push(newRow());

      parsed.forEach((cells, ri) => {
        const targetRow = startRow + ri;
        const patch: Partial<Row> = {};
        cells.forEach((cellRaw, ci) => {
          const colIdx = startColIdx + ci;
          if (colIdx >= columnOrder.length) return;
          const colKey = columnOrder[colIdx];
          const cell = cellRaw.trim();
          if (colKey === "amount") {
            patch.amount = cell.replace(/[^\d.-]/g, "");
          } else if (colKey === "note") {
            patch.note = cell;
          } else if (colKey === "expense_date") {
            patch.expense_date = parseDate(cell) || todayStr();
          } else if (colKey === "product_category") {
            patch.product_category = findMatch(cell, menuCatNames);
            patch.product_name = "";
          } else if (colKey === "product_name") {
            const pc = patch.product_category ?? next[targetRow].product_category;
            const itemNames = (itemsByCategoryName.get(pc) || []).map(i => i.name);
            patch.product_name = findMatch(cell, itemNames);
          }
        });
        next[targetRow] = { ...next[targetRow], ...patch };
      });
      return next;
    });

    toast({ title: "Đã dán dữ liệu", description: `${parsed.length} dòng` });
  };

  const handleSubmit = async () => {
    const valid = rows.filter(r => Number(r.amount) > 0);
    if (valid.length === 0) {
      toast({ title: "Không có dòng hợp lệ", description: "Cần ít nhất giá trị > 0.", variant: "destructive" });
      return;
    }
    const defaultCategory = expenseCategories[0]?.name || "Chung";
    setSubmitting(true);
    let ok = 0, fail = 0;
    for (const r of valid) {
      try {
        await addExpense.mutateAsync({
          category_name: defaultCategory,
          expense_date: r.expense_date || todayStr(),
          amount: Number(r.amount) * 1000,
          note: r.note,
          product_category: r.product_category || null,
          product_name: r.product_name || null,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setSubmitting(false);
    toast({ title: "Hoàn tất", description: `Thêm ${ok} chi phí${fail ? `, ${fail} lỗi` : ""}` });
    if (fail === 0) {
      handleClearAll();
      onOpenChange(false);
    }
  };

  const renderCell = (rowIdx: number, row: Row, colKey: ColKey) => {
    const setActive = () => setActiveCell({ row: rowIdx, col: colKey });
    if (colKey === "amount") {
      return (
        <Input
          type="number"
          value={row.amount}
          onChange={e => updateRow(rowIdx, { amount: e.target.value })}
          onFocus={setActive}
          className="h-8 border-0 focus-visible:ring-1"
          placeholder="0"
        />
      );
    }
    if (colKey === "note") {
      return (
        <Input
          value={row.note}
          onChange={e => updateRow(rowIdx, { note: e.target.value })}
          onFocus={setActive}
          className="h-8 border-0 focus-visible:ring-1"
        />
      );
    }
    if (colKey === "expense_date") {
      return (
        <Input
          type="date"
          value={row.expense_date}
          onChange={e => updateRow(rowIdx, { expense_date: e.target.value })}
          onFocus={setActive}
          className="h-8 border-0 focus-visible:ring-1"
        />
      );
    }
    if (colKey === "product_category") {
      return (
        <Select value={row.product_category || "__none__"} onValueChange={v => { setActive(); updateRow(rowIdx, { product_category: v === "__none__" ? "" : v, product_name: "" }); }}>
          <SelectTrigger className="h-8 border-0 focus:ring-1"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent className="bg-popover z-50 max-h-72">
            <SelectItem value="__none__">—</SelectItem>
            {menuCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    // product_name
    const items = itemsByCategoryName.get(row.product_category) || [];
    return (
      <Select
        value={row.product_name || "__none__"}
        onValueChange={v => { setActive(); updateRow(rowIdx, { product_name: v === "__none__" ? "" : v }); }}
        disabled={!row.product_category}
      >
        <SelectTrigger className="h-8 border-0 focus:ring-1"><SelectValue placeholder={row.product_category ? "—" : "Chọn nhóm"} /></SelectTrigger>
        <SelectContent className="bg-popover z-50 max-h-72">
          <SelectItem value="__none__">—</SelectItem>
          {items.map(it => <SelectItem key={it.id} value={it.name}>{it.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Thêm nhanh chi phí (dạng bảng)</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Kéo biểu tượng <GripVertical className="inline h-3 w-3" /> trên tiêu đề cột để đổi thứ tự cột.</p>
          <p>• Bấm vào một ô rồi dán (Ctrl/Cmd+V) dữ liệu từ Excel để thêm nhiều dòng cùng lúc.</p>
          <p>• <strong>Giá trị nhập sẽ tự động nhân 1.000</strong> (vd: nhập 50 → lưu 50.000đ). Ngày chi mặc định là hôm nay.</p>
        </div>

        <div className="border rounded-md overflow-x-auto" onPaste={handlePaste} tabIndex={0}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full border-collapse">
              <thead>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                  <tr>
                    <th className="border bg-muted p-2 w-10 text-xs text-muted-foreground">#</th>
                    {orderedCols.map(c => (
                      <SortableHeader key={c.key} colKey={c.key} label={c.label} width={c.width} />
                    ))}
                    <th className="border bg-muted p-2 w-10"></th>
                  </tr>
                </SortableContext>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={row.id} className={activeCell?.row === rowIdx ? "bg-accent/30" : ""}>
                    <td className="border p-1 text-center text-xs text-muted-foreground">{rowIdx + 1}</td>
                    {orderedCols.map(c => (
                      <td
                        key={c.key}
                        className={`border p-0.5 ${activeCell?.row === rowIdx && activeCell?.col === c.key ? "ring-1 ring-primary ring-inset" : ""}`}
                        onClick={() => setActiveCell({ row: rowIdx, col: c.key })}
                      >
                        {renderCell(rowIdx, row, c.key)}
                      </td>
                    ))}
                    <td className="border p-1 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemoveRow(rowIdx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DndContext>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" />Thêm dòng
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                pasteText(text, activeCell?.row ?? 0, activeCell?.col ?? columnOrder[0]);
              } catch {
                toast({ title: "Không đọc được clipboard", description: "Hãy bấm vào ô rồi nhấn Ctrl+V.", variant: "destructive" });
              }
            }}
          >
            <ClipboardPaste className="h-4 w-4 mr-1" />Dán từ clipboard
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>Xoá tất cả dòng</Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu tất cả"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickAddExpensesDialog;
