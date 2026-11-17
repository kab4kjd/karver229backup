import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyThemeSettings, getThemeChartPalette } from "@/lib/theme";
import { toast } from "@/hooks/use-toast";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeAccent = "amber_modern" | "default" | "green" | "purple" | "rose" | "amber";
export type ThemeLayout = "sidebar" | "classic";

export interface ThemeConfig {
  mode: ThemeMode;
  accent: ThemeAccent;
  layout: ThemeLayout;
  updated_at?: string;
  updated_by_name?: string;
}

export const THEME_CONFIG_KEY = "ui_theme_config";

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: "light",
  accent: "amber_modern",
  layout: "sidebar",
};

export const getCachedThemeConfig = (): ThemeConfig => {
  const mode = (localStorage.getItem("karaoke_theme_mode") as ThemeMode) || DEFAULT_THEME_CONFIG.mode;
  const accent = (localStorage.getItem("karaoke_theme_accent") as ThemeAccent) || DEFAULT_THEME_CONFIG.accent;
  const layout = (localStorage.getItem("karaoke_layout_mode") as ThemeLayout) || DEFAULT_THEME_CONFIG.layout;
  return { mode, accent, layout };
};

export const syncThemeToLocalStorage = (config: ThemeConfig) => {
  try {
    localStorage.setItem("karaoke_theme_mode", config.mode);
    localStorage.setItem("karaoke_theme_accent", config.accent);
    localStorage.setItem("karaoke_layout_mode", config.layout);
    // Dispatch custom event for cross-component and local sync
    window.dispatchEvent(new CustomEvent("karaoke_theme_sync", { detail: config }));
  } catch (err) {
    console.error("Failed to write theme to localStorage:", err);
  }
};

/**
 * Top-level hook to be called ONCE at the root of the app (in ThemeInitializer / App.tsx).
 * Handles Supabase Realtime channel subscription and cross-tab storage sync.
 */
export function useThemeRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 1. Initial local apply
    const cached = getCachedThemeConfig();
    applyThemeSettings(cached.mode, cached.accent);

    // 2. Cross-tab & local storage events
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === "karaoke_theme_mode" ||
        e.key === "karaoke_theme_accent" ||
        e.key === "karaoke_layout_mode"
      ) {
        const latest = getCachedThemeConfig();
        applyThemeSettings(latest.mode, latest.accent);
        queryClient.setQueryData(["theme-config"], latest);
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. Supabase Realtime subscription with unique channel name
    const channelId = `theme-sync-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "global_settings",
          filter: `key=eq.${THEME_CONFIG_KEY}`,
        },
        (payload) => {
          const newVal = (payload.new as { value?: Record<string, unknown>; updated_at?: string })?.value;
          if (newVal && typeof newVal === "object") {
            const updated: ThemeConfig = {
              mode: (newVal.mode as ThemeMode) || DEFAULT_THEME_CONFIG.mode,
              accent: (newVal.accent as ThemeAccent) || DEFAULT_THEME_CONFIG.accent,
              layout: (newVal.layout as ThemeLayout) || DEFAULT_THEME_CONFIG.layout,
              updated_at: (newVal.updated_at as string) || payload.new?.updated_at || undefined,
              updated_by_name: (newVal.updated_by_name as string) || undefined,
            };
            syncThemeToLocalStorage(updated);
            applyThemeSettings(updated.mode, updated.accent);
            queryClient.setQueryData(["theme-config"], updated);
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("storage", handleStorage);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook to consume and mutate theme configuration throughout the app.
 * Does NOT create duplicate channels, avoiding Realtime channel collision.
 */
export function useThemeConfig() {
  const queryClient = useQueryClient();

  const { data: themeConfig = getCachedThemeConfig(), isLoading } = useQuery<ThemeConfig>({
    queryKey: ["theme-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_settings")
        .select("value, updated_at")
        .eq("key", THEME_CONFIG_KEY)
        .maybeSingle();

      if (error) {
        console.error("Error fetching global theme config:", error);
        return getCachedThemeConfig();
      }

      if (data?.value && typeof data.value === "object") {
        const raw = data.value as Record<string, unknown>;
        const merged: ThemeConfig = {
          mode: (raw.mode as ThemeMode) || DEFAULT_THEME_CONFIG.mode,
          accent: (raw.accent as ThemeAccent) || DEFAULT_THEME_CONFIG.accent,
          layout: (raw.layout as ThemeLayout) || DEFAULT_THEME_CONFIG.layout,
          updated_at: (raw.updated_at as string) || (data.updated_at as string) || undefined,
          updated_by_name: (raw.updated_by_name as string) || undefined,
        };
        syncThemeToLocalStorage(merged);
        applyThemeSettings(merged.mode, merged.accent);
        return merged;
      }

      // If not yet saved in global_settings, fallback to cached
      const cached = getCachedThemeConfig();
      applyThemeSettings(cached.mode, cached.accent);
      return cached;
    },
    initialData: getCachedThemeConfig,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation for Admin to update & persist theme for all users
  const mutation = useMutation({
    mutationFn: async ({
      updates,
      feedbackMessage,
    }: {
      updates: Partial<ThemeConfig>;
      feedbackMessage?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Bạn cần đăng nhập để lưu cấu hình");
      }

      // Get user name for attribution
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .maybeSingle();

      const updaterName = profile?.display_name || profile?.username || "Admin";

      const current = queryClient.getQueryData<ThemeConfig>(["theme-config"]) || getCachedThemeConfig();
      const updatedConfig: ThemeConfig = {
        ...current,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by_name: updaterName,
      };

      // Optimistically apply locally right away
      syncThemeToLocalStorage(updatedConfig);
      applyThemeSettings(updatedConfig.mode, updatedConfig.accent);
      queryClient.setQueryData(["theme-config"], updatedConfig);

      // Save to Supabase global_settings
      const { error } = await supabase.from("global_settings").upsert(
        {
          key: THEME_CONFIG_KEY,
          value: updatedConfig as any,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (error) {
        throw error;
      }

      return { updatedConfig, feedbackMessage };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["theme-config"] });
      toast({
        title: "Đã lưu cấu hình giao diện",
        description: data.feedbackMessage || "Cấu hình giao diện đã được lưu và áp dụng cho toàn bộ người dùng",
      });
    },
    onError: (err: any) => {
      console.error("Failed to save theme config to global_settings:", err);
      toast({
        title: "Không thể lưu cấu hình hệ thống",
        description: err.message || "Đã xảy ra lỗi khi lưu cấu hình giao diện. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const saveThemeConfig = async (updates: Partial<ThemeConfig>, feedbackMessage?: string) => {
    return mutation.mutateAsync({ updates, feedbackMessage });
  };

  return {
    themeConfig,
    isLoading,
    isSaving: mutation.isPending,
    saveThemeConfig,
  };
}

export function useThemeChartColors() {
  const { themeConfig } = useThemeConfig();
  const palette = getThemeChartPalette(themeConfig?.accent);
  return {
    primary: palette[0],
    secondary: palette[1],
    chart2: palette[1],
    chart3: palette[2],
    chart4: palette[3],
    chart5: palette[4],
    palette,
  };
}
