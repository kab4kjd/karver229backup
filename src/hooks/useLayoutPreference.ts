import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const RATIO_KEY = "invoice_layout_ratio";
const TITLE_KEY = "app_title";
const SUBTITLE_KEY = "app_subtitle";
const DEFAULT_RATIO = 50;
const DEFAULT_TITLE = "QUẢN LÝ PHÒNG HÁT";
const DEFAULT_SUBTITLE = "Hệ thống quản lý phòng hát & hóa đơn";

export const useLayoutPreference = () => {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_RATIO);
  const [appTitle, setAppTitle] = useState(DEFAULT_TITLE);
  const [appSubtitle, setAppSubtitle] = useState(DEFAULT_SUBTITLE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("key, value")
        .in("key", [RATIO_KEY, TITLE_KEY, SUBTITLE_KEY]);

      if (data) {
        data.forEach(row => {
          if (row.key === RATIO_KEY && row.value != null) {
            const v = typeof row.value === "number" ? row.value : Number(row.value);
            if (!Number.isNaN(v)) setLeftWidth(v);
          } else if (row.key === TITLE_KEY && typeof row.value === "string") {
            setAppTitle(row.value);
          } else if (row.key === SUBTITLE_KEY && typeof row.value === "string") {
            setAppSubtitle(row.value);
          }
        });
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const saveLeftWidth = useCallback(async (value: number) => {
    setLeftWidth(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Only admins can write (RLS will block non-admins silently)
    await supabase
      .from("global_settings")
      .upsert(
        { key: RATIO_KEY, value: value as any, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }, []);

  const saveAppTitle = useCallback(async (value: string) => {
    setAppTitle(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("global_settings")
      .upsert(
        { key: TITLE_KEY, value: value as any, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }, []);

  const saveAppSubtitle = useCallback(async (value: string) => {
    setAppSubtitle(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("global_settings")
      .upsert(
        { key: SUBTITLE_KEY, value: value as any, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }, []);

  return { leftWidth, saveLeftWidth, appTitle, saveAppTitle, appSubtitle, saveAppSubtitle, isLoading };
};
