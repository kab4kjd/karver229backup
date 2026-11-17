import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import {
  restrictivePermissions,
  verifyUserPermissionsFromFirestoreServer,
} from "@/lib/serverPermissions";

export type UserRole = "admin" | "staff" | null;

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

const defaultPermissions: UserPermissions = {
  can_view_invoice: true,
  can_view_history: true,
  can_delete_history: false,
  can_view_reports: false,
  can_view_inventory: false,
  can_edit_inventory_history: false,
  can_delete_inventory_history: false,
  can_view_config: false,
  can_view_logs: false,
  can_delete_logs: false,
  can_view_expenses: false,
  can_view_customers: false,
  can_delete_customers: false,
  edit_invoice_minutes: 60,
  can_config_rooms: true,
  can_config_items: true,
  can_config_pricelist: false,
  can_config_layout: false,
  can_config_print: false,
  lock_screen_enabled: false,
  lock_screen_minutes: 5,
};

const adminPermissions: UserPermissions = {
  can_view_invoice: true,
  can_view_history: true,
  can_delete_history: true,
  can_view_reports: true,
  can_view_inventory: true,
  can_edit_inventory_history: true,
  can_delete_inventory_history: true,
  can_view_config: true,
  can_view_logs: true,
  can_delete_logs: true,
  can_view_expenses: true,
  can_view_customers: true,
  can_delete_customers: true,
  edit_invoice_minutes: 0,
  can_config_rooms: true,
  can_config_items: true,
  can_config_pricelist: true,
  can_config_layout: true,
  can_config_print: true,
  lock_screen_enabled: false,
  lock_screen_minutes: 5,
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  // Fail-closed until verified from server
  const [permissions, setPermissions] = useState<UserPermissions>(restrictivePermissions);
  const [permissionsVerified, setPermissionsVerified] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          setPermissions(restrictivePermissions);
          setPermissionsVerified(false);
          setLoading(true);
          setTimeout(() => {
            fetchUserRoleAndPermissions(nextSession.user.id, nextSession.user.email);
          }, 0);
        } else {
          setRole(null);
          setPermissions(restrictivePermissions);
          setPermissionsVerified(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchUserRoleAndPermissions(existingSession.user.id, existingSession.user.email);
      } else {
        setPermissions(restrictivePermissions);
        setPermissionsVerified(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoleAndPermissions = async (userId: string, userEmail?: string) => {
    try {
      // 1. Verify directly from Cloud Firestore server (bypassing browser/SDK cache)
      const serverResult = await verifyUserPermissionsFromFirestoreServer(
        userId,
        userEmail,
        defaultPermissions,
        adminPermissions
      );

      if (serverResult) {
        setRole(serverResult.role);
        setPermissions(serverResult.permissions);

        const fallbackName =
          userEmail?.split("@")[0] ||
          (serverResult.role === "admin" ? "Quản trị viên" : "Nhân viên");
        setUsername(serverResult.username || fallbackName);
        setDisplayName(serverResult.displayName || serverResult.username || fallbackName);
        setPermissionsVerified(true);
        return;
      }

      // 2. Fallback only when Firestore server cannot be reached (e.g., offline / cloud Supabase mode)
      const [roleResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("display_name, username").eq("user_id", userId).maybeSingle(),
      ]);

      let userRole = (roleResult.data?.role as UserRole) || null;
      if (!userRole && (userId === "00000000-0000-0000-0000-000000000001" || userEmail?.includes("admin"))) {
        userRole = "admin";
      }

      setRole(userRole);
      if (profileResult.data) {
        setUsername(profileResult.data.username || "");
        setDisplayName(profileResult.data.display_name || profileResult.data.username || "");
      } else {
        const fallbackName = userEmail?.split("@")[0] || (userRole === "admin" ? "Quản trị viên" : "Nhân viên");
        setUsername(fallbackName);
        setDisplayName(fallbackName);
      }

      if (userRole === "admin") {
        setPermissions(adminPermissions);
        setPermissionsVerified(true);
        return;
      }

      const { data: permData, error: permError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (permError) {
        console.error("Error fetching user permissions:", permError);
        setPermissions(restrictivePermissions);
      } else if (permData) {
        setPermissions({
          can_view_invoice: (permData as any).can_view_invoice ?? true,
          can_view_history: permData.can_view_history,
          can_delete_history: permData.can_delete_history,
          can_view_reports: permData.can_view_reports,
          can_view_inventory: permData.can_view_inventory,
          can_edit_inventory_history: (permData as any).can_edit_inventory_history ?? false,
          can_delete_inventory_history: (permData as any).can_delete_inventory_history ?? false,
          can_view_config: permData.can_view_config,
          can_view_logs: (permData as any).can_view_logs ?? false,
          can_delete_logs: (permData as any).can_delete_logs ?? false,
          can_view_expenses: (permData as any).can_view_expenses ?? false,
          can_view_customers: (permData as any).can_view_customers ?? false,
          can_delete_customers: (permData as any).can_delete_customers ?? false,
          edit_invoice_minutes: (permData as any).edit_invoice_minutes ?? 60,
          can_config_rooms: (permData as any).can_config_rooms ?? true,
          can_config_items: (permData as any).can_config_items ?? true,
          can_config_pricelist: (permData as any).can_config_pricelist ?? false,
          can_config_layout: (permData as any).can_config_layout ?? false,
          can_config_print: (permData as any).can_config_print ?? false,
          lock_screen_enabled: (permData as any).lock_screen_enabled ?? false,
          lock_screen_minutes: (permData as any).lock_screen_minutes ?? 5,
        });
      } else {
        setPermissions(defaultPermissions);
      }
      setPermissionsVerified(true);
    } catch (error) {
      console.error("Error verifying user role/permissions from server:", error);
      setRole(null);
      setPermissions(restrictivePermissions);
      setPermissionsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setPermissions(restrictivePermissions);
    setPermissionsVerified(false);
    setDisplayName("");
    setUsername("");
  };

  return {
    user,
    session,
    role,
    permissions,
    permissionsVerified,
    displayName,
    username,
    loading,
    signOut,
    isAdmin: role === "admin",
    isStaff: role === "staff" || role === "admin",
  };
}
