import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  Sparkles,
  LayoutGrid,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  Globe,
  Clock,
  UserCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useThemeConfig,
  type ThemeMode,
  type ThemeAccent,
  type ThemeLayout,
} from "@/hooks/useThemeConfig";

interface ThemeSettingsProps {
  isAdmin?: boolean;
}

export default function ThemeSettings({ isAdmin: propIsAdmin }: ThemeSettingsProps) {
  const { isAdmin: authIsAdmin } = useAuth();
  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : authIsAdmin;

  const { themeConfig, isSaving, saveThemeConfig } = useThemeConfig();
  const { mode, accent, layout, updated_at, updated_by_name } = themeConfig;

  const handleModeChange = async (newMode: ThemeMode) => {
    if (!isAdmin) {
      toast({
        title: "Quyền hạn chế",
        description: "Chỉ Quản trị viên (Admin) mới có quyền thay đổi cấu hình giao diện hệ thống.",
        variant: "destructive",
      });
      return;
    }

    const modeLabel = newMode === "dark" ? "Tối" : newMode === "light" ? "Sáng" : "Theo hệ thống";
    await saveThemeConfig(
      { mode: newMode },
      `Đã chuyển chế độ "${modeLabel}" và áp dụng cho toàn bộ người dùng`
    );
  };

  const handleAccentChange = async (newAccent: ThemeAccent) => {
    if (!isAdmin) {
      toast({
        title: "Quyền hạn chế",
        description: "Chỉ Quản trị viên (Admin) mới có quyền thay đổi cấu hình giao diện hệ thống.",
        variant: "destructive",
      });
      return;
    }

    const accentObj = accents.find((a) => a.id === newAccent);
    const label = accentObj ? accentObj.label : newAccent;
    await saveThemeConfig(
      { accent: newAccent },
      `Đã chuyển màu chủ đạo "${label}" và áp dụng cho toàn bộ người dùng`
    );
  };

  const handleLayoutChange = async (newLayout: ThemeLayout) => {
    if (!isAdmin) {
      toast({
        title: "Quyền hạn chế",
        description: "Chỉ Quản trị viên (Admin) mới có quyền thay đổi bố cục hệ thống.",
        variant: "destructive",
      });
      return;
    }

    const layoutLabel = newLayout === "sidebar" ? "Sidebar Modern (Thanh bên)" : "Classic Top Tabs (Tab trên)";
    await saveThemeConfig(
      { layout: newLayout },
      `Đã chuyển bố cục "${layoutLabel}" và áp dụng cho toàn bộ người dùng`
    );
  };

  const handleSaveAll = async () => {
    if (!isAdmin) return;
    await saveThemeConfig(
      { mode, accent, layout },
      "Đã lưu và đồng bộ toàn bộ cấu hình giao diện cho tất cả người dùng hệ thống"
    );
  };

  const modes: { id: ThemeMode; label: string; icon: typeof Sun; desc: string }[] = [
    { id: "light", label: "Sáng", icon: Sun, desc: "Giao diện sáng sủa, rõ ràng, dễ nhìn ban ngày" },
    { id: "dark", label: "Tối", icon: Moon, desc: "Bảo vệ mắt, dịu nhẹ ban đêm, tiết kiệm năng lượng" },
    { id: "system", label: "Hệ thống", icon: Monitor, desc: "Tự động đồng bộ theo cài đặt thiết bị" },
  ];

  const accents: { id: ThemeAccent; label: string; color: string; sample: string }[] = [
    { id: "amber_modern", label: "Modern Amber (Vàng Hổ Phách)", color: "bg-amber-500", sample: "text-amber-600 bg-amber-50 border-amber-200" },
    { id: "default", label: "Xanh Dương Tiêu Chuẩn", color: "bg-blue-600", sample: "text-blue-600 bg-blue-50 border-blue-200" },
    { id: "green", label: "Xanh Lá Ngọc (Emerald)", color: "bg-emerald-600", sample: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { id: "purple", label: "Tím Sang Trọng (Purple)", color: "bg-purple-600", sample: "text-purple-600 bg-purple-50 border-purple-200" },
    { id: "rose", label: "Hồng Quyến Rũ (Rose)", color: "bg-rose-600", sample: "text-rose-600 bg-rose-50 border-rose-200" },
    { id: "amber", label: "Cam Ấm Áp (Warm Amber)", color: "bg-amber-600", sample: "text-amber-700 bg-amber-50 border-amber-200" },
  ];

  const layouts: { id: ThemeLayout; label: string; desc: string; badge: string }[] = [
    {
      id: "sidebar",
      label: "Sidebar Modern (Thanh điều hướng bên trái)",
      desc: "Menu điều hướng bên trái, thanh tiêu đề tinh gọn, tối ưu cho màn hình rộng và máy tính bảng",
      badge: "Hiện đại & Khuyên dùng",
    },
    {
      id: "classic",
      label: "Classic Top Tabs (Tab ngang truyền thống)",
      desc: "Thanh tab ngang trải dài ở phía trên, phong cách quen thuộc và dễ dàng thao tác nhanh",
      badge: "Truyền thống",
    },
  ];

  const formatUpdatedAt = (isoString?: string) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return `${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}, ${d.toLocaleDateString("vi-VN")}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Central Management Banner */}
      <Card
        className={`p-5 border shadow-sm transition-all ${
          isAdmin
            ? "border-primary/30 bg-gradient-to-r from-primary/5 via-background to-primary/5"
            : "border-muted-foreground/20 bg-muted/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-base text-foreground">
                    Cấu hình giao diện toàn hệ thống
                  </span>
                  <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700 font-normal">
                    Quyền Admin
                  </Badge>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="font-semibold text-base text-foreground">
                    Cấu hình giao diện hệ thống
                  </span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    Chế độ xem nhân viên
                  </Badge>
                </>
              )}
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">
              {isAdmin
                ? "Tất cả thay đổi về bố cục, chế độ sáng/tối và màu chủ đạo sẽ được lưu vào hệ cơ sở dữ liệu và tự động áp dụng đồng bộ cho toàn bộ tài khoản người dùng và nhân viên."
                : "Giao diện và bố cục được cấu hình và lưu trạng thái bởi Quản trị viên (Admin) áp dụng đồng bộ cho tất cả tài khoản. Bạn đang xem thiết lập hiện hành."}
            </p>

            {(updated_at || updated_by_name) && (
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground flex-wrap">
                {updated_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Áp dụng lần cuối: {formatUpdatedAt(updated_at)}
                  </span>
                )}
                {updated_by_name && (
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    Bởi: <strong className="font-medium text-foreground">{updated_by_name}</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <Globe className="h-3.5 w-3.5" />
                  Đồng bộ thời gian thực
                </span>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="gap-2 shadow-sm font-medium"
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Lưu & Áp dụng cho tất cả
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 1. Layout Selection */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">1. Bố Cục Điều Hướng (Layout)</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {isAdmin ? "Nhấp để áp dụng ngay cho toàn hệ thống" : "Được quản lý bởi Admin"}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Chọn kiểu giao diện hiển thị cho ứng dụng quản lý Karaoke.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {layouts.map(({ id, label, desc, badge }) => {
            const isSelected = layout === id;
            return (
              <div
                key={id}
                onClick={() => handleLayoutChange(id)}
                className={`border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  isAdmin ? "cursor-pointer hover:border-primary/60 hover:bg-muted/30" : "cursor-default"
                } ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/25 font-medium"
                    : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm sm:text-base">{label}</span>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{desc}</p>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs">
                  <span className="text-muted-foreground font-mono">{badge}</span>
                  {isSelected ? (
                    <span className="text-primary font-semibold">Đang áp dụng</span>
                  ) : (
                    isAdmin && <span className="text-muted-foreground">Nhấp để chọn</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. Light / Dark Display Mode */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">2. Chế Độ Hiển Thị (Sáng / Tối)</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {isAdmin ? "Nhấp để áp dụng ngay cho toàn hệ thống" : "Được quản lý bởi Admin"}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Cài đặt chế độ nền sáng, tối hoặc tự động theo hệ điều hành.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map(({ id, label, icon: Icon, desc }) => {
            const isSelected = mode === id;
            return (
              <div
                key={id}
                onClick={() => handleModeChange(id)}
                className={`border rounded-xl p-4 flex flex-col items-start justify-between transition-all ${
                  isAdmin ? "cursor-pointer hover:border-primary/60 hover:bg-muted/30" : "cursor-default"
                } ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div
                    className={`p-2.5 rounded-lg ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-base mb-1">{label}</h4>
                    {isSelected && (
                      <span className="text-[11px] font-semibold text-primary">Đang dùng</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Theme & Accent Colors */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">3. Màu Sắc & Chủ Đề (Accent Color)</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {isAdmin ? "Nhấp để áp dụng ngay cho toàn hệ thống" : "Được quản lý bởi Admin"}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Chọn phong cách bảng màu sắc thương hiệu áp dụng cho các nút bấm, phòng hoạt động và điểm nhấn.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accents.map(({ id, label, color, sample }) => {
            const isSelected = accent === id;
            return (
              <div
                key={id}
                onClick={() => handleAccentChange(id)}
                className={`border rounded-lg p-3.5 flex items-center justify-between gap-3 transition-all ${
                  isAdmin ? "cursor-pointer hover:border-primary/60 hover:bg-muted/30" : "cursor-default"
                } ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20 font-medium"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-7 w-7 rounded-full ${color} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <span className="text-sm truncate">{label}</span>
                </div>
                {isSelected ? (
                  <Badge variant="secondary" className="text-[10px] shrink-0 font-medium">
                    Đang chọn
                  </Badge>
                ) : (
                  isAdmin && <span className="text-xs text-muted-foreground shrink-0">Chọn</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Floating or Footer Confirmation for Admin */}
      {isAdmin && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-card border shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground">
            Cấu hình giao diện đã chọn được lưu tự động và đồng bộ tức thì cho tất cả nhân viên qua Supabase Realtime.
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Lưu cấu hình hệ thống
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
