import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SETTING_KEY = "card_layout";

export type CardId = "rooms" | "items" | "time";

export interface CardLayoutConfig {
  order: CardId[];
  heights: Record<CardId, number | null>;
}

const DEFAULT_CONFIG: CardLayoutConfig = {
  order: ["rooms", "items", "time"],
  heights: { rooms: null, items: null, time: null },
};

export const CARD_LABELS: Record<CardId, string> = {
  rooms: "Chọn Phòng",
  items: "Thêm Món",
  time: "Thời gian",
};

export const useCardLayout = () => {
  const [config, setConfig] = useState<CardLayoutConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();

      if (data?.value != null) {
        const val = data.value as unknown as CardLayoutConfig;
        setConfig({
          order: val.order || DEFAULT_CONFIG.order,
          heights: { ...DEFAULT_CONFIG.heights, ...val.heights },
        });
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const saveConfig = useCallback(async (newConfig: CardLayoutConfig) => {
    setConfig(newConfig);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Only admins can write (RLS gates non-admins)
    await supabase
      .from("global_settings")
      .upsert(
        { key: SETTING_KEY, value: newConfig as any, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
  }, []);

  const updateOrder = useCallback((newOrder: CardId[]) => {
    saveConfig({ ...config, order: newOrder });
  }, [config, saveConfig]);

  const updateHeight = useCallback((cardId: CardId, height: number | null) => {
    saveConfig({ ...config, heights: { ...config.heights, [cardId]: height } });
  }, [config, saveConfig]);

  return { config, updateOrder, updateHeight, isLoading };
};
