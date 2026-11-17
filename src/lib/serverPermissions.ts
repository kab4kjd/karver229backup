import { collection, getDocsFromServer, query, where } from "firebase/firestore";
import { db, auth } from "@/integrations/firebase/config";
import type { UserPermissions, UserRole } from "@/hooks/useAuth";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const restrictivePermissions: UserPermissions = {
  can_view_invoice: false,
  can_view_history: false,
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
  edit_invoice_minutes: 0,
  can_config_rooms: false,
  can_config_items: false,
  can_config_pricelist: false,
  can_config_layout: false,
  can_config_print: false,
  lock_screen_enabled: false,
  lock_screen_minutes: 5,
};

export interface ServerAuthResult {
  role: UserRole;
  permissions: UserPermissions;
  username: string;
  displayName: string;
  verifiedFromServer: boolean;
}

function syncUserRecordToLocalCache(table: string, userId: string, record: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    const key = `karaoke_db_v2_${table}`;
    const raw = localStorage.getItem(key);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((item) => item.user_id === userId || item.id === record.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.push(record);
    }
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore local cache sync errors
  }
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = (err as any)?.code || "";
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === "permission-denied" ||
    msg.toLowerCase().includes("missing or insufficient permissions") ||
    msg.toLowerCase().includes("permission-denied")
  );
}

export async function verifyUserPermissionsFromFirestoreServer(
  userId: string,
  sessionEmail: string | undefined,
  fallbackDefaults: UserPermissions,
  adminPerms: UserPermissions
): Promise<ServerAuthResult | null> {
  if (!db || !userId) return null;

  try {
    const [roleSnap, profileSnap, permSnap] = await Promise.all([
      getDocsFromServer(query(collection(db, "user_roles"), where("user_id", "==", userId))),
      getDocsFromServer(query(collection(db, "profiles"), where("user_id", "==", userId))),
      getDocsFromServer(query(collection(db, "user_permissions"), where("user_id", "==", userId))),
    ]);

    const roleDoc = roleSnap.empty ? null : { id: roleSnap.docs[0].id, ...roleSnap.docs[0].data() } as Record<string, any>;
    const profileDoc = profileSnap.empty ? null : { id: profileSnap.docs[0].id, ...profileSnap.docs[0].data() } as Record<string, any>;
    const permDoc = permSnap.empty ? null : { id: permSnap.docs[0].id, ...permSnap.docs[0].data() } as Record<string, any>;

    if (roleDoc) syncUserRecordToLocalCache("user_roles", userId, roleDoc);
    if (profileDoc) syncUserRecordToLocalCache("profiles", userId, profileDoc);
    if (permDoc) syncUserRecordToLocalCache("user_permissions", userId, permDoc);

    let resolvedRole: UserRole = (roleDoc?.role as UserRole) || null;
    if (!resolvedRole && (userId === "00000000-0000-0000-0000-000000000001" || sessionEmail?.includes("admin"))) {
      resolvedRole = "admin";
    }

    const resolvedUsername = profileDoc?.username || (resolvedRole === "admin" ? "admin" : "");
    const resolvedDisplayName = profileDoc?.display_name || profileDoc?.username || "";

    if (resolvedRole === "admin") {
      return {
        role: "admin",
        permissions: adminPerms,
        username: resolvedUsername,
        displayName: resolvedDisplayName,
        verifiedFromServer: true,
      };
    }

    if (permDoc) {
      const resolvedPerms: UserPermissions = {
        can_view_invoice: permDoc.can_view_invoice ?? true,
        can_view_history: Boolean(permDoc.can_view_history),
        can_delete_history: Boolean(permDoc.can_delete_history),
        can_view_reports: Boolean(permDoc.can_view_reports),
        can_view_inventory: Boolean(permDoc.can_view_inventory),
        can_edit_inventory_history: Boolean(permDoc.can_edit_inventory_history ?? false),
        can_delete_inventory_history: Boolean(permDoc.can_delete_inventory_history ?? false),
        can_view_config: Boolean(permDoc.can_view_config),
        can_view_logs: Boolean(permDoc.can_view_logs ?? false),
        can_delete_logs: Boolean(permDoc.can_delete_logs ?? false),
        can_view_expenses: Boolean(permDoc.can_view_expenses ?? false),
        can_view_customers: Boolean(permDoc.can_view_customers ?? false),
        can_delete_customers: Boolean(permDoc.can_delete_customers ?? false),
        edit_invoice_minutes: Number(permDoc.edit_invoice_minutes ?? 60),
        can_config_rooms: Boolean(permDoc.can_config_rooms ?? true),
        can_config_items: Boolean(permDoc.can_config_items ?? true),
        can_config_pricelist: Boolean(permDoc.can_config_pricelist ?? false),
        can_config_layout: Boolean(permDoc.can_config_layout ?? false),
        can_config_print: Boolean(permDoc.can_config_print ?? false),
        lock_screen_enabled: Boolean(permDoc.lock_screen_enabled ?? false),
        lock_screen_minutes: Number(permDoc.lock_screen_minutes ?? 5),
      };

      return {
        role: resolvedRole,
        permissions: resolvedPerms,
        username: resolvedUsername,
        displayName: resolvedDisplayName,
        verifiedFromServer: true,
      };
    }

    // No permission document on server -> use fallback only if authenticated user has a role
    return {
      role: resolvedRole,
      permissions: resolvedRole ? fallbackDefaults : restrictivePermissions,
      username: resolvedUsername,
      displayName: resolvedDisplayName,
      verifiedFromServer: true,
    };
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.GET, "user_permissions");
    }
    // Transient offline/network issue: return null so caller decides fallback safely
    console.warn("[ServerAuth] Không thể đọc phân quyền trực tiếp từ Firestore server:", err);
    return null;
  }
}
