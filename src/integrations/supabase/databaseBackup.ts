// Quản lý Sao lưu (Backup) & Phục hồi (Restore) dữ liệu có lựa chọn bảng / danh mục
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { syncTableToFirestore } from "@/integrations/supabase/localDatabase";

export interface BackupDataCategory {
  id: string;
  name: string;
  description: string;
  tables: string[];
  iconName?: string;
  countFn?: () => number;
}

export const BACKUP_CATEGORIES: BackupDataCategory[] = [
  {
    id: "invoices",
    name: "Hóa đơn & Bán hàng",
    description: "Lịch sử tất cả hóa đơn tính tiền, chi tiết món gọi và thời gian hát",
    tables: ["invoices", "invoice_items"],
  },
  {
    id: "customers",
    name: "Khách hàng & Công nợ",
    description: "Danh sách khách hàng, công nợ và các lần thanh toán nợ",
    tables: ["customers", "debt_payments"],
  },
  {
    id: "expenses",
    name: "Thu chi & Sổ quỹ",
    description: "Các khoản chi tiêu nội bộ, nhóm chi và danh mục chi phí",
    tables: ["expenses", "expense_categories", "expense_product_groups", "expense_product_items"],
  },
  {
    id: "menu_rooms",
    name: "Phòng hát & Thực đơn (Menu)",
    description: "Danh mục phòng hát, nhóm phòng, món ăn/đồ uống và bảng giá phòng",
    tables: ["rooms", "room_groups", "categories", "items", "price_list_items"],
  },
  {
    id: "inventory",
    name: "Kho & Kiểm kê",
    description: "Dữ liệu kiểm kho, tồn kho, lịch sử kiểm kê",
    tables: ["inventory_checks", "inventory_check_items", "inventory_check_records"],
  },
  {
    id: "users_auth",
    name: "Tài khoản & Phân quyền",
    description: "Danh sách nhân viên, thông tin tài khoản, vai trò và bảng quyền hạn chi tiết",
    tables: ["auth_users", "profiles", "user_roles", "user_permissions"],
  },
  {
    id: "settings",
    name: "Cấu hình quán & In ấn",
    description: "Mẫu in hóa đơn, giờ hoạt động, cấu hình chung quán",
    tables: ["operating_hours", "print_settings", "user_preferences", "global_settings"],
  },
  {
    id: "activity_logs",
    name: "Nhật ký hoạt động (Logs)",
    description: "Nhật ký các thao tác của nhân viên trong hệ thống",
    tables: ["activity_logs"],
  },
];

const DB_PREFIX = "karaoke_db_v2_";

export interface BackupPackage {
  version: "2.0";
  timestamp: string;
  createdAt: string;
  metadata: {
    selectedCategoryIds: string[];
    tableCounts: Record<string, number>;
  };
  data: Record<string, any[]>;
}

// Lấy số lượng bản ghi của 1 bảng trong localStorage
export function getTableCount(table: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(DB_PREFIX + table);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch (e) {
    return 0;
  }
}

// Lấy tổng số bản ghi của 1 danh mục
export function getCategoryTotalCount(category: BackupDataCategory): number {
  return category.tables.reduce((sum, table) => sum + getTableCount(table), 0);
}

// Tạo file backup JSON và tải về (Lấy từ Online CSDL trước, fallback localStorage)
export async function exportBackup(selectedCategoryIds: string[], filenamePrefix: string = "karaoke_backup"): Promise<boolean> {
  try {
    if (selectedCategoryIds.length === 0) {
      toast({
        title: "Chưa chọn dữ liệu",
        description: "Vui lòng chọn ít nhất 1 mục để tiến hành sao lưu",
        variant: "destructive",
      });
      return false;
    }

    const selectedCategories = BACKUP_CATEGORIES.filter((c) => selectedCategoryIds.includes(c.id));
    const allSelectedTables = Array.from(new Set(selectedCategories.flatMap((c) => c.tables)));

    const backupData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const table of allSelectedTables) {
      try {
        let tableRows: any[] = [];
        // Thử truy vấn dữ liệu từ CSDL Online trước
        if (supabase && typeof supabase.from === "function") {
          const { data, error } = await supabase.from(table as any).select("*");
          if (!error && Array.isArray(data) && data.length > 0) {
            tableRows = data;
          }
        }

        // Nếu CSDL Online trống hoặc lỗi, lấy từ localStorage làm fallback
        if (tableRows.length === 0) {
          const raw = localStorage.getItem(DB_PREFIX + table);
          if (raw) {
            const parsed = JSON.parse(raw);
            tableRows = Array.isArray(parsed) ? parsed : [];
          }
        }

        backupData[table] = tableRows;
        tableCounts[table] = tableRows.length;
      } catch (e) {
        backupData[table] = [];
        tableCounts[table] = 0;
      }
    }

    const now = new Date();
    const backupPackage: BackupPackage = {
      version: "2.0",
      timestamp: now.toISOString(),
      createdAt: now.toLocaleString("vi-VN"),
      metadata: {
        selectedCategoryIds,
        tableCounts,
      },
      data: backupData,
    };

    const jsonString = JSON.stringify(backupPackage, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const filename = `${filenamePrefix}_${dateStr}_${timeStr}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Sao lưu thành công!",
      description: `Đã tải về tệp ${filename} với ${allSelectedTables.length} bảng dữ liệu`,
    });
    return true;
  } catch (error: any) {
    console.error("Lỗi tạo backup:", error);
    toast({
      title: "Lỗi sao lưu",
      description: error?.message || "Không thể tạo file sao lưu",
      variant: "destructive",
    });
    return false;
  }
}

// Phân tích file JSON Restore để kiểm tra trước khi ghi
export function parseBackupFile(jsonString: string): BackupPackage {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("Tệp sao lưu không đúng định dạng chuẩn");
  }
  return parsed as BackupPackage;
}

export type RestoreMode = "overwrite" | "merge";

// Tiến hành Phục hồi dữ liệu từ Backup (TỰ ĐỘNG ĐẨY & LƯU LÊN CƠ SỞ DỮ LIỆU ONLINE)
export async function restoreBackup(
  backupPackage: BackupPackage,
  selectedCategoryIds: string[],
  mode: RestoreMode = "overwrite"
): Promise<{ success: boolean; restoredTables: string[]; totalRecords: number }> {
  try {
    const selectedCategories = BACKUP_CATEGORIES.filter((c) => selectedCategoryIds.includes(c.id));
    const allSelectedTables = Array.from(new Set(selectedCategories.flatMap((c) => c.tables)));

    let restoredCount = 0;
    const restoredTables: string[] = [];

    for (const table of allSelectedTables) {
      const incomingData = backupPackage.data[table];
      if (incomingData !== undefined && Array.isArray(incomingData)) {
        let finalRecords = incomingData;

        if (mode === "overwrite") {
          localStorage.setItem(DB_PREFIX + table, JSON.stringify(incomingData));
          restoredCount += incomingData.length;
          restoredTables.push(table);
        } else {
          // Merge mode: gộp dữ liệu theo ID tránh trùng
          let current: any[] = [];
          try {
            const raw = localStorage.getItem(DB_PREFIX + table);
            if (raw) current = JSON.parse(raw);
          } catch (e) {
            current = [];
          }
          if (!Array.isArray(current)) current = [];

          const mapById = new Map<string, any>();
          current.forEach((item) => {
            if (item && item.id) mapById.set(String(item.id), item);
          });
          incomingData.forEach((item) => {
            if (item && item.id) {
              mapById.set(String(item.id), item);
            } else {
              mapById.set(Math.random().toString(), item);
            }
          });

          finalRecords = Array.from(mapById.values());
          localStorage.setItem(DB_PREFIX + table, JSON.stringify(finalRecords));
          restoredCount += incomingData.length;
          restoredTables.push(table);
        }

        // TỰ ĐỘNG LƯU TRỰC TIẾP LÊN CƠ SỞ DỮ LIỆU ONLINE FIRESTORE
        if (finalRecords.length > 0) {
          try {
            await syncTableToFirestore(table, finalRecords);
            console.log(`[Phục hồi Cloud] Đã tự động lưu Online ${finalRecords.length} bản ghi vào bảng ${table} trên Firestore`);
          } catch (cloudErr) {
            console.warn(`Không thể đồng bộ bảng ${table} lên Cloud Firestore:`, cloudErr);
          }
        }
      }
    }

    return {
      success: true,
      restoredTables,
      totalRecords: restoredCount,
    };
  } catch (error: any) {
    console.error("Lỗi phục hồi dữ liệu:", error);
    throw error;
  }
}
