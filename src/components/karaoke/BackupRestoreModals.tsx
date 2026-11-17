import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Download,
  Upload,
  Database,
  Receipt,
  Users,
  DollarSign,
  Utensils,
  Boxes,
  Shield,
  Sliders,
  Activity,
  FileCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  BACKUP_CATEGORIES,
  BackupDataCategory,
  BackupPackage,
  exportBackup,
  parseBackupFile,
  restoreBackup,
  getTableCount,
  getCategoryTotalCount,
  RestoreMode,
} from "@/integrations/supabase/databaseBackup";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  invoices: <Receipt className="h-4 w-4 text-blue-500" />,
  customers: <Users className="h-4 w-4 text-emerald-500" />,
  expenses: <DollarSign className="h-4 w-4 text-amber-500" />,
  menu_rooms: <Utensils className="h-4 w-4 text-rose-500" />,
  inventory: <Boxes className="h-4 w-4 text-purple-500" />,
  users_auth: <Shield className="h-4 w-4 text-indigo-500" />,
  settings: <Sliders className="h-4 w-4 text-slate-500" />,
  activity_logs: <Activity className="h-4 w-4 text-teal-500" />,
};

// -------------------------------------------------------------
// COMPONENT DIALOG SAO LƯU (BACKUP MODAL)
// -------------------------------------------------------------
interface BackupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupModal({ open, onOpenChange }: BackupModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    BACKUP_CATEGORIES.map((c) => c.id)
  );
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      const newCounts: Record<string, number> = {};
      BACKUP_CATEGORIES.forEach((cat) => {
        newCounts[cat.id] = getCategoryTotalCount(cat);
      });
      setCounts(newCounts);
      // Mặc định chọn tất cả
      setSelectedIds(BACKUP_CATEGORIES.map((c) => c.id));
    }
  }, [open]);

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === BACKUP_CATEGORIES.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(BACKUP_CATEGORIES.map((c) => c.id));
    }
  };

  const handleExport = async () => {
    const ok = await exportBackup(selectedIds);
    if (ok) {
      onOpenChange(false);
    }
  };

  const totalRecordsToBackup = selectedIds.reduce(
    (sum, id) => sum + (counts[id] || 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 rounded-lg text-blue-600 dark:text-blue-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Sao Lưu Dữ Liệu Cơ Sở Dữ Liệu (Backup)
              </DialogTitle>
              <DialogDescription>
                Chọn các loại dữ liệu bạn muốn kết xuất và tải về máy dưới dạng tệp JSON bảo mật.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-y border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="text-xs h-8"
          >
            {selectedIds.length === BACKUP_CATEGORIES.length
              ? "Bỏ chọn tất cả"
              : "Chọn tất cả danh mục"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Đã chọn:{" "}
            <strong className="text-foreground">
              {selectedIds.length}/{BACKUP_CATEGORIES.length}
            </strong>{" "}
            danh mục ({totalRecordsToBackup} bản ghi)
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 py-2">
          {BACKUP_CATEGORIES.map((category) => {
            const isChecked = selectedIds.includes(category.id);
            const count = counts[category.id] ?? 0;

            return (
              <div
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  isChecked
                    ? "bg-primary/5 border-primary/40"
                    : "bg-card border-border hover:bg-muted/40"
                }`}
              >
                <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    id={`backup-${category.id}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor={`backup-${category.id}`}
                      className="font-medium text-sm text-foreground flex items-center gap-1.5 cursor-pointer"
                    >
                      {CATEGORY_ICONS[category.id] || <Database className="h-4 w-4" />}
                      {category.name}
                    </Label>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {count} bản ghi
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {category.description}
                  </p>
                  <div className="text-[11px] text-muted-foreground/80 mt-1 font-mono">
                    Bảng: {category.tables.join(", ")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={selectedIds.length === 0}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4" />
            Tải về tệp Sao Lưu (.JSON)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// COMPONENT DIALOG PHỤC HỒI (RESTORE MODAL)
// -------------------------------------------------------------
interface RestoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreSuccess?: () => void;
}

export function RestoreModal({
  open,
  onOpenChange,
  onRestoreSuccess,
}: RestoreModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupPackage, setBackupPackage] = useState<BackupPackage | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("overwrite");
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!open) {
      setBackupPackage(null);
      setSelectedIds([]);
      setFileName("");
      setIsProcessing(false);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseBackupFile(text);
        setBackupPackage(parsed);

        // Tự động tìm các danh mục có dữ liệu trong backup
        const availableCategoryIds = BACKUP_CATEGORIES.filter((cat) =>
          cat.tables.some((t) => parsed.data && Array.isArray(parsed.data[t]) && parsed.data[t].length > 0)
        ).map((c) => c.id);

        setSelectedIds(availableCategoryIds.length > 0 ? availableCategoryIds : BACKUP_CATEGORIES.map((c) => c.id));
        toast({
          title: "Đã đọc tệp sao lưu",
          description: `Tệp tạo lúc ${parsed.createdAt || parsed.timestamp}`,
        });
      } catch (err: any) {
        toast({
          title: "Lỗi định dạng tệp",
          description: err.message || "Tệp sao lưu không hợp lệ",
          variant: "destructive",
        });
        setBackupPackage(null);
      }
    };
    reader.readAsText(file);
  };

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!backupPackage) return;
    if (selectedIds.length === BACKUP_CATEGORIES.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(BACKUP_CATEGORIES.map((c) => c.id));
    }
  };

  const handleExecuteRestore = async () => {
    if (!backupPackage) return;

    if (selectedIds.length === 0) {
      toast({
        title: "Chưa chọn dữ liệu",
        description: "Vui lòng chọn ít nhất 1 mục để phục hồi",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      const result = await restoreBackup(backupPackage, selectedIds, restoreMode);

      toast({
        title: "Phục hồi & Tự động lưu Online thành công!",
        description: `Đã khôi phục ${result.restoredTables.length} bảng (${result.totalRecords} bản ghi) và tự động lưu trực tuyến lên CSDL Online. Trang sẽ tự động tải lại để áp dụng.`,
      });

      onOpenChange(false);
      if (onRestoreSuccess) onRestoreSuccess();

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      toast({
        title: "Lỗi phục hồi",
        description: err.message || "Không thể phục hồi dữ liệu",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Tính số lượng bản ghi trong file backup
  const getRecordCountInPackage = (category: BackupDataCategory): number => {
    if (!backupPackage || !backupPackage.data) return 0;
    return category.tables.reduce((sum, table) => {
      const arr = backupPackage.data[table];
      return sum + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Phục Hồi Dữ Liệu Cơ Sở Dữ Liệu (Restore)
              </DialogTitle>
              <DialogDescription>
                Tải lên tệp sao lưu (.json) để khôi phục hóa đơn, khách hàng, chi phí, thực đơn...
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Chọn file */}
        {!backupPackage ? (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors p-6 text-center">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <FileCheck className="h-12 w-12 text-muted-foreground mb-3" />
            <h4 className="text-sm font-semibold text-foreground mb-1">
              Chọn tệp sao lưu .JSON từ máy tính
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Hỗ trợ các tệp sao lưu đã tải về từ hệ thống quản lý quán Karaoke
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Chọn tệp sao lưu (.json)
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
            {/* Tóm tắt file */}
            <div className="p-3 bg-muted/50 rounded-lg border border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  Tệp: {fileName}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Ngày tạo bản sao: {backupPackage.createdAt || backupPackage.timestamp}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setBackupPackage(null);
                  setFileName("");
                }}
              >
                Chọn tệp khác
              </Button>
            </div>

            {/* Chế độ phục hồi */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Phương thức phục hồi
              </Label>
              <RadioGroup
                value={restoreMode}
                onValueChange={(val) => setRestoreMode(val as RestoreMode)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <div
                  onClick={() => setRestoreMode("overwrite")}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
                    restoreMode === "overwrite"
                      ? "bg-primary/5 border-primary/50"
                      : "bg-card border-border"
                  }`}
                >
                  <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-0.5" />
                  <div>
                    <Label htmlFor="mode-overwrite" className="font-semibold text-xs cursor-pointer">
                      Ghi đè hoàn toàn (Khuyên dùng)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Thay thế toàn bộ dữ liệu mục đã chọn bằng dữ liệu từ tệp sao lưu.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setRestoreMode("merge")}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
                    restoreMode === "merge"
                      ? "bg-primary/5 border-primary/50"
                      : "bg-card border-border"
                  }`}
                >
                  <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
                  <div>
                    <Label htmlFor="mode-merge" className="font-semibold text-xs cursor-pointer">
                      Gộp dữ liệu (Merge)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Giữ dữ liệu hiện tại, chỉ thêm các bản ghi mới từ tệp sao lưu.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Danh mục cần phục hồi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Chọn dữ liệu muốn phục hồi
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedIds.length === BACKUP_CATEGORIES.length
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả"}
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {BACKUP_CATEGORIES.map((category) => {
                  const isChecked = selectedIds.includes(category.id);
                  const countInFile = getRecordCountInPackage(category);

                  return (
                    <div
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-primary/5 border-primary/40"
                          : "bg-card border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`restore-${category.id}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Label
                            htmlFor={`restore-${category.id}`}
                            className="font-medium text-xs text-foreground flex items-center gap-1.5 cursor-pointer"
                          >
                            {CATEGORY_ICONS[category.id] || <Database className="h-4 w-4" />}
                            {category.name}
                          </Label>
                          <Badge
                            variant={countInFile > 0 ? "secondary" : "outline"}
                            className="text-[11px] font-mono"
                          >
                            {countInFile} bản ghi trong tệp
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
          {backupPackage && (
            <Button
              type="button"
              onClick={handleExecuteRestore}
              disabled={isProcessing || selectedIds.length === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isProcessing ? "Đang phục hồi..." : "Bắt đầu Phục Hồi Dữ Liệu"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
