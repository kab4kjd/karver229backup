import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserPermissions {
  id: string;
  user_id: string;
  can_view_invoice?: boolean;
  can_view_history: boolean;
  can_delete_history: boolean;
  can_view_reports: boolean;
  can_view_inventory: boolean;
  can_edit_inventory_history?: boolean;
  can_delete_inventory_history?: boolean;
  can_view_config: boolean;
  can_delete_customers?: boolean;
  created_at: string;
  updated_at: string;
}

export function useUserPermissions(userId?: string) {
  const queryClient = useQueryClient();

  // Fetch permissions for a specific user
  const { data: permissions, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching permissions:", error);
        return null;
      }

      return data as UserPermissions | null;
    },
    enabled: !!userId,
  });

  // Fetch all user permissions (for admin)
  const { data: allPermissions = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["all-user-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*");

      if (error) {
        console.error("Error fetching all permissions:", error);
        return [];
      }

      return data as UserPermissions[];
    },
  });

  // Update or create permissions
  const updatePermissions = useMutation({
    mutationFn: async ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: Partial<Omit<UserPermissions, "id" | "user_id" | "created_at" | "updated_at">>;
    }) => {
      // First try to update
      const { data: existing } = await supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("user_permissions")
          .update(permissions)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("user_permissions")
          .insert({
            user_id: userId,
            ...permissions,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-permissions"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật quyền truy cập",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật quyền truy cập",
        variant: "destructive",
      });
    },
  });

  // Get permissions for a user from allPermissions
  const getPermissionsForUser = (targetUserId: string) => {
    return allPermissions.find((p) => p.user_id === targetUserId);
  };

  return {
    permissions,
    allPermissions,
    isLoading,
    isLoadingAll,
    updatePermissions,
    getPermissionsForUser,
  };
}
