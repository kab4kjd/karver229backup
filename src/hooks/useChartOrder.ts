import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const PREFERENCE_KEY = "report_chart_order";

const DEFAULT_ORDER = [
  "products_sold",
  "revenue_source",
  "top_products",
  "room_revenue",
  "category_revenue",
  "room_time",
  "revenue_detail",
  "revenue_trend",
  "room_timeline",
  "occupancy_heatmap",
  "hourly_occupancy",
  "duration_histogram",
];

export const useChartOrder = () => {
  const [chartOrder, setChartOrder] = useState<string[]>(DEFAULT_ORDER);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      const { data } = await supabase
        .from("user_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", PREFERENCE_KEY)
        .maybeSingle();

      if (data?.preference_value && Array.isArray(data.preference_value)) {
        // Merge: keep saved order, append any new charts not in saved list
        const saved = data.preference_value as string[];
        const merged = [
          ...saved.filter((id: string) => DEFAULT_ORDER.includes(id)),
          ...DEFAULT_ORDER.filter(id => !saved.includes(id)),
        ];
        setChartOrder(merged);
      }
      setIsLoading(false);
    };
    loadOrder();
  }, []);

  const saveOrder = useCallback(async (newOrder: string[]) => {
    setChartOrder(newOrder);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          preference_key: PREFERENCE_KEY,
          preference_value: newOrder as any,
        },
        { onConflict: "user_id,preference_key" }
      );
  }, []);

  return { chartOrder, saveOrder, isLoading };
};
