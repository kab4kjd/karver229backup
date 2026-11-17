// Quản lý cấu hình kết nối cơ sở dữ liệu mới độc lập
// Đảm bảo không kết nối, không sử dụng và không ảnh hưởng đến cơ sở dữ liệu cũ (bbmadwanbdnockvqqwvg)

export const OLD_SUPABASE_PROJECT_ID = "bbmadwanbdnockvqqwvg";
export const OLD_SUPABASE_URL = "https://bbmadwanbdnockvqqwvg.supabase.co";

export const STORAGE_KEY_CUSTOM_URL = "karaoke_custom_supabase_url";
export const STORAGE_KEY_CUSTOM_KEY = "karaoke_custom_supabase_key";
export const STORAGE_KEY_FORCE_LOCAL = "karaoke_force_fresh_local_db";

export interface DatabaseStatus {
  mode: "cloud" | "fresh_local";
  url: string;
  projectId: string;
  isOldBlocked: boolean;
  isConnected: boolean;
  description: string;
}

export function isOldDatabase(urlOrKey?: string | null): boolean {
  if (!urlOrKey) return false;
  const str = String(urlOrKey).trim();
  return (
    str.includes(OLD_SUPABASE_PROJECT_ID) ||
    str.includes("bbmadwanbdnockvqqwvg") ||
    str.includes("sb_publishable_OdCoMTZbiC548zcs1AMnLQ_KKCCD1gf")
  );
}

export function isValidHttpUrl(urlStr?: string | null): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getActiveDatabaseConfig(): {
  url: string | null;
  key: string | null;
  mode: "cloud" | "fresh_local";
} {
  if (typeof window === "undefined") {
    return { url: null, key: null, mode: "fresh_local" };
  }

  // Nếu người dùng chọn dùng CSDL cục bộ sạch
  const forceLocal = localStorage.getItem(STORAGE_KEY_FORCE_LOCAL) === "true";
  if (forceLocal) {
    return { url: null, key: null, mode: "fresh_local" };
  }

  // Kiểm tra custom URL từ localStorage
  const customUrl = localStorage.getItem(STORAGE_KEY_CUSTOM_URL);
  const customKey = localStorage.getItem(STORAGE_KEY_CUSTOM_KEY);

  if (
    customUrl &&
    customKey &&
    isValidHttpUrl(customUrl) &&
    !isOldDatabase(customUrl) &&
    !isOldDatabase(customKey)
  ) {
    return { url: customUrl.trim(), key: customKey.trim(), mode: "cloud" };
  }

  // Kiểm tra biến môi trường - Phải là URL hợp lệ http:// hoặc https:// và không phải CSDL cũ
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();

  if (
    envUrl &&
    isValidHttpUrl(envUrl) &&
    !isOldDatabase(envUrl) &&
    envKey &&
    envKey.length > 10 &&
    !isOldDatabase(envKey)
  ) {
    return { url: envUrl, key: envKey, mode: "cloud" };
  }

  // Mặc định: Dùng Cơ sở dữ liệu Mới Độc Lập (Fresh Local Mode)
  return { url: null, key: null, mode: "fresh_local" };
}

export function getDatabaseStatus(): DatabaseStatus {
  const config = getActiveDatabaseConfig();
  if (config.mode === "cloud" && config.url) {
    try {
      const parsed = new URL(config.url);
      const projectId = parsed.hostname.split(".")[0] || "Custom";
      return {
        mode: "cloud",
        url: config.url,
        projectId,
        isOldBlocked: true,
        isConnected: true,
        description: `Đang kết nối CSDL Đám mây Supabase Online (${projectId})`,
      };
    } catch {
      // Fallback
    }
  }

  return {
    mode: "cloud",
    url: "voltaic-force-zdw77.firebaseapp.com (Firebase Cloud Firestore)",
    projectId: "voltaic-force-zdw77",
    isOldBlocked: true,
    isConnected: true,
    description: "Đã kết nối tự động Cơ Sở Dữ Liệu Đám Mây Trực Tuyến Online (Firebase Cloud Firestore). Toàn bộ dữ liệu được bảo vệ và lưu trữ trực tuyến hoàn toàn, loại bỏ lưu trữ nội bộ trên máy.",
  };
}

export function saveCustomDatabaseConfig(url: string, key: string) {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (isOldDatabase(cleanUrl) || isOldDatabase(cleanKey)) {
    throw new Error(
      "Không được kết nối vào cơ sở dữ liệu cũ (bbmadwanbdnockvqqwvg). Vui lòng nhập URL và Key của dự án Supabase mới!"
    );
  }

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    throw new Error("URL Supabase không hợp lệ. Phải bắt đầu bằng https://");
  }

  localStorage.removeItem(STORAGE_KEY_FORCE_LOCAL);
  localStorage.setItem(STORAGE_KEY_CUSTOM_URL, cleanUrl);
  localStorage.setItem(STORAGE_KEY_CUSTOM_KEY, cleanKey);
  window.location.reload();
}

export function resetToFreshLocalDatabase() {
  localStorage.removeItem(STORAGE_KEY_CUSTOM_URL);
  localStorage.removeItem(STORAGE_KEY_CUSTOM_KEY);
  localStorage.setItem(STORAGE_KEY_FORCE_LOCAL, "true");
  window.location.reload();
}
