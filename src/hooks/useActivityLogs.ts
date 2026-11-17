import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface ActivityLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const useActivityLogs = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as ActivityLog[];
    },
    staleTime: 1 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const addLogMutation = useMutation({
    mutationFn: async (log: {
      action: string;
      description: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get username from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("activity_logs").insert([{
        user_id: user.id,
        username: profile?.username || user.email?.split("@")[0] || "Unknown",
        action: log.action,
        description: log.description,
        metadata: (log.metadata || {}) as unknown as Record<string, never>,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
  });

  const deleteAllLogsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("activity_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      toast({
        title: "Đã xóa",
        description: "Đã xóa tất cả log hoạt động",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa log: " + error.message,
        variant: "destructive",
      });
    },
  });

  const addLog = (action: string, description: string, metadata?: Record<string, unknown>) => {
    addLogMutation.mutate({ action, description, metadata });
  };

  return {
    logs,
    isLoading,
    refetch,
    addLog,
    deleteAllLogs: deleteAllLogsMutation.mutate,
    isDeleting: deleteAllLogsMutation.isPending,
  };
};
