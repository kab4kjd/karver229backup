import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthReady } from "@/hooks/useAuthReady";

interface OperatingHours {
  id: string;
  start_time: string;
  end_time: string;
}

export const useOperatingHours = () => {
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data, isLoading } = useQuery({
    queryKey: ["operating-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operating_hours")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OperatingHours | null;
    },
    enabled: isReady,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ startTime, endTime }: { startTime: string; endTime: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (data?.id) {
        const { error } = await supabase
          .from("operating_hours")
          .update({
            start_time: startTime,
            end_time: endTime,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("operating_hours")
          .insert({
            start_time: startTime,
            end_time: endTime,
            updated_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operating-hours"] });
      toast.success("Đã lưu giờ hoạt động");
    },
    onError: (error: any) => {
      toast.error("Lỗi: " + error.message);
    },
  });

  return {
    startTime: data?.start_time ?? "08:00",
    endTime: data?.end_time ?? "02:00",
    isLoading,
    updateOperatingHours: updateMutation.mutate,
    isSaving: updateMutation.isPending,
  };
};
