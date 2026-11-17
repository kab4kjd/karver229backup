import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatAuthPassword } from "@/utils/authPassword";

export type UserRole = "admin" | "staff";

export interface UserPermissions {
  can_view_invoice: boolean;
  can_view_history: boolean;
  can_delete_history: boolean;
  can_view_reports: boolean;
  can_view_inventory: boolean;
  can_edit_inventory_history: boolean;
  can_delete_inventory_history: boolean;
  can_view_config: boolean;
  can_view_logs: boolean;
  can_delete_logs: boolean;
  can_view_expenses: boolean;
  can_view_customers: boolean;
  can_delete_customers: boolean;
  edit_invoice_minutes: number;
  can_config_rooms: boolean;
  can_config_items: boolean;
  can_config_pricelist: boolean;
  can_config_layout: boolean;
  can_config_print: boolean;
  lock_screen_enabled: boolean;
  lock_screen_minutes: number;
}

export interface UserWithRole {
  id: string;
  username: string;
  display_name: string;
  role: UserRole | null;
  created_at: string;
  permissions: UserPermissions | null;
}

async function callManageUsers(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await supabase.functions.invoke("manage-users", {
    body: { action, ...params },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  if (response.error) {
    // Try to parse error context if available
    let msg = response.error.message;
    try {
      if (response.error && typeof response.error === 'object' && 'context' in response.error) {
        const ctx = (response.error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const json = await ctx.json();
          if (json?.error) msg = json.error;
        }
      }
    } catch {}
    throw new Error(msg);
  }

  return response.data;
}

export function useUserManagement() {
  const queryClient = useQueryClient();

  // Fetch all users with their roles and permissions
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const data = await callManageUsers("list");
      return data.users as UserWithRole[];
    },
  });

  // Create new user
  const createUser = useMutation({
    mutationFn: async ({ username, password, role }: { username: string; password: string; role: UserRole }) => {
      const authPassword = formatAuthPassword(password);
      return await callManageUsers("create", { username, password: authPassword, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({
        title: "Thành công",
        description: "Đã tạo người dùng mới",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo người dùng",
        variant: "destructive",
      });
    },
  });

  // Update user role
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return await callManageUsers("updateRole", { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật vai trò người dùng",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật vai trò",
        variant: "destructive",
      });
    },
  });

  // Update user permissions
  const updateUserPermissions = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Partial<UserPermissions> }) => {
      return await callManageUsers("updatePermissions", { userId, permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
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

  // Delete user
  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      return await callManageUsers("delete", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({
        title: "Thành công",
        description: "Đã xóa người dùng",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa người dùng",
        variant: "destructive",
      });
    },
  });

  // Update user password
  const updatePassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const authPassword = formatAuthPassword(password);
      return await callManageUsers("updatePassword", { userId, password: authPassword });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: "Thành công", description: "Đã cập nhật mật khẩu" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật mật khẩu", variant: "destructive" });
    },
  });

  // Update display name
  const updateDisplayName = useMutation({
    mutationFn: async ({ userId, displayName }: { userId: string; displayName: string }) => {
      return await callManageUsers("updateDisplayName", { userId, displayName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({ title: "Thành công", description: "Đã cập nhật tên nhân viên" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật tên", variant: "destructive" });
    },
  });

  return {
    users,
    isLoading,
    createUser,
    updateUserRole,
    updateUserPermissions,
    deleteUser,
    updatePassword,
    updateDisplayName,
  };
}
