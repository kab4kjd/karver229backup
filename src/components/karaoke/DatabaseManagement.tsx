import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Database,
  CheckCircle2,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Server,
  HardDriveDownload,
  Trash2,
  Cloud,
  CloudUpload,
  Globe,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  getDatabaseStatus,
  resetToFreshLocalDatabase,
  saveCustomDatabaseConfig,
  STORAGE_KEY_CUSTOM_URL,
  STORAGE_KEY_CUSTOM_KEY,
} from "@/integrations/supabase/databaseConfig";
import { cleanAllDatabaseKeepAdminOnly } from "@/integrations/supabase/localDatabase";
import { BackupModal, RestoreModal } from "./BackupRestoreModals";

export default function DatabaseManagement() {
  const status = getDatabaseStatus();

  // Trạng thái cấu hình kết nối CSDL Online Cloud
  const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || "");
  const [cloudKey, setCloudKey] = useState(() => localStorage.getItem(STORAGE_KEY_CUSTOM_KEY) || "");

  // Trạng thái mở modal Backup & Restore
  const [backupOpen, setBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  // Trạng thái mở AlertDialog xác nhận làm sạch và reset
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const confirmResetToFresh = () => {
    setResetDialogOpen(false);
    toast({
      title: "Đang chuyển chế độ...",
      description: "Hệ thống đang chuyển về CSDL độc lập",
    });
    resetToFreshLocalDatabase();
  };

  const confirmCleanDatabase = () => {
    setIsCleaning(true);
    setCleanDialogOpen(false);
    toast({
      title: "Đang làm sạch dữ liệu...",
      description: "Đang xóa dữ liệu kinh doanh và bảo lưu tài khoản admin",
    });
    cleanAllDatabaseKeepAdminOnly();
  };

  const handleConnectCloud = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUrl.trim() || !cloudKey.trim()) {
      toast({
        title: "Chưa nhập đủ thông tin",
        description: "Vui lòng nhập URL và Khóa API của dự án Supabase Cloud Online",
        variant: "destructive",
      });
      return;
    }
    try {
      saveCustomDatabaseConfig(cloudUrl, cloudKey);
      toast({
        title: "Đang kết nối CSDL Online...",
        description: "Đang khởi động lại hệ thống với cơ sở dữ liệu trực tuyến",
      });
    } catch (err: any) {
      toast({
        title: "Lỗi kết nối CSDL Online",
        description: err?.message || "Không thể kết nối với URL/Key đã nhập",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Trạng thái kết nối CSDL hiện tại */}
      <Card className="p-5 border-l-4 border-l-emerald-500 bg-card shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-foreground">
                  Cơ Sở Dữ Liệu: {status.mode === "cloud" ? "Đám Mây Supabase Mới (Online)" : "Lưu Trữ Nội Bộ (Máy)"}
                </h3>
                {status.mode === "cloud" ? (
                  <Badge className="bg-emerald-600 text-white flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Đang lưu Online Đám Mây
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                    <Server className="h-3.5 w-3.5" />
                    Đang lưu trên máy
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {status.description}
              </p>
              <div className="mt-2 text-xs font-mono bg-muted/60 px-2.5 py-1 rounded inline-block text-muted-foreground">
                Đích: {status.url}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {status.mode === "cloud" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Server className="h-3.5 w-3.5" />
                Về lưu trữ trên máy
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanDialogOpen(true)}
              className="gap-1.5 text-xs text-rose-700 hover:text-rose-800 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm sạch dữ liệu
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>
            Bảo đảm an toàn: Cơ sở dữ liệu cũ <code>bbmadwanbdnockvqqwvg</code> đã được gỡ bỏ hoàn toàn.
          </span>
        </div>
      </Card>

      {/* 2. KẾT NỐI CƠ SỞ DỮ LIỆU ONLINE ĐÁM MÂY (SUPABASE CLOUD) */}
      <Card className="p-5 border-2 border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-blue-500/5 to-transparent shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Cloud className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Lưu Trữ Cơ Sở Dữ Liệu Online (Đám Mây Supabase)
              {status.mode === "cloud" ? (
                <Badge className="bg-emerald-600 text-white text-xs">Đang hoạt động Online</Badge>
              ) : (
                <Badge variant="outline" className="text-indigo-600 border-indigo-300 dark:text-indigo-400 text-xs">
                  Cấu hình kết nối Online
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Để dữ liệu tự động lưu trực tuyến Online (không lưu trên máy), hãy nhập URL và Khóa API của dự án Supabase Cloud. Tất cả hóa đơn, khách hàng, kiểm kho sẽ được đồng bộ trực tuyến.
            </p>
          </div>
        </div>

        <form onSubmit={handleConnectCloud} className="space-y-3 pt-3 border-t border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">URL Dự Án Supabase Online</Label>
              <Input
                value={cloudUrl}
                onChange={(e) => setCloudUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="h-9 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Khóa API Công Khai (Anon / Publishable Key)</Label>
              <Input
                type="password"
                value={cloudKey}
                onChange={(e) => setCloudKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                className="h-9 text-xs font-mono mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 text-indigo-500" />
              <span>Khi kết nối Online thành công, toàn bộ dữ liệu sẽ tự động đồng bộ trên máy chủ Cloud.</span>
            </div>
            <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 shadow-xs">
              <CloudUpload className="h-4 w-4" />
              Kết Nối & Lưu Online Ngay
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. KHU VỰC SAO LƯU & PHỤC HỒI DỮ LIỆU CSDL (BACKUP & RESTORE) */}
      <Card className="p-5 border-2 border-primary/20 bg-gradient-to-r from-blue-500/5 via-emerald-500/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <HardDriveDownload className="h-5 w-5" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Sao Lưu & Phục Hồi Dữ Liệu (Backup & Restore)
              </h3>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                Tùy chọn danh mục
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Xuất tệp sao lưu hoặc phục hồi dữ liệu linh hoạt: Hóa đơn bán hàng, Danh sách khách hàng & công nợ, Thu chi sổ quỹ, Phòng hát, Thực đơn món ăn, Kiểm kho, Tài khoản & Phân quyền...
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => setBackupOpen(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold"
            >
              <Download className="h-4 w-4" />
              Sao Lưu Dữ Liệu (Backup)
            </Button>
            <Button
              variant="outline"
              onClick={() => setRestoreOpen(true)}
              className="gap-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold"
            >
              <Upload className="h-4 w-4" />
              Phục Hồi Dữ Liệu (Restore)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/60 text-xs">
          <div className="p-2 rounded-md bg-muted/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Hóa đơn & Bán hàng</span>
          </div>
          <div className="p-2 rounded-md bg-muted/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Khách hàng & Công nợ</span>
          </div>
          <div className="p-2 rounded-md bg-muted/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Thu chi sổ quỹ</span>
          </div>
          <div className="p-2 rounded-md bg-muted/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>Phòng & Thực đơn</span>
          </div>
        </div>
      </Card>

      {/* Modal Sao lưu & Phục hồi */}
      <BackupModal open={backupOpen} onOpenChange={setBackupOpen} />
      <RestoreModal open={restoreOpen} onOpenChange={setRestoreOpen} />

      {/* Dialog Xác nhận Làm Sạch Dữ Liệu */}
      <AlertDialog open={cleanDialogOpen} onOpenChange={setCleanDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-foreground">
                  Làm sạch toàn bộ dữ liệu?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Hành động này sẽ xóa toàn bộ dữ liệu kinh doanh thử nghiệm
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-2.5 py-2 text-xs text-muted-foreground">
            <div className="p-3 bg-muted/60 rounded-lg border border-border space-y-1.5">
              <div className="font-semibold text-foreground">Dữ liệu sẽ được xóa sạch:</div>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Tất cả hóa đơn tính tiền & lịch sử gọi món</li>
                <li>Danh sách khách hàng & công nợ</li>
                <li>Các khoản thu chi & sổ quỹ</li>
                <li>Danh mục phòng hát & thực đơn món ăn</li>
                <li>Lịch sử kiểm kho & nhật ký hoạt động</li>
              </ul>
            </div>

            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Bảo lưu tài khoản:</strong> Tài khoản quản trị mặc định (<strong>admin</strong> / mật khẩu: <strong>123456</strong>) sẽ được giữ lại để tiếp tục sử dụng.
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isCleaning}>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCleanDatabase}
              disabled={isCleaning}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isCleaning ? "Đang xử lý..." : "Xác nhận Làm sạch ngay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Xác nhận Chuyển về CSDL độc lập */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-foreground">
                  Chuyển về CSDL độc lập?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Ngắt kết nối đám mây và sử dụng CSDL lưu trữ nội bộ
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <p className="text-xs text-muted-foreground py-2">
            Hệ thống sẽ chuyển về chế độ Cơ sở Dữ Liệu độc lập, không kết nối với bất kỳ dự án đám mây nào. Dữ liệu sẽ được bảo vệ tuyệt đối.
          </p>

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResetToFresh}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Chuyển về CSDL Độc lập
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
