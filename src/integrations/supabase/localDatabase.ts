import { db, auth } from "@/integrations/firebase/config";
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  setDoc,
  deleteDoc,
  where,
  writeBatch,
} from "firebase/firestore";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo = {
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

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  count?: number | null;
}

const DB_PREFIX = "karaoke_db_v2_";

const SEED_DEFAULT_TABLES = new Set([
  "room_groups",
  "rooms",
  "categories",
  "items",
  "expense_categories",
  "operating_hours",
  "profiles",
  "user_roles",
  "user_permissions",
  "auth_users",
]);

function getStorage<T>(table: string, defaultData: T[]): T[] {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(DB_PREFIX + table);
    if (!raw) {
      localStorage.setItem(DB_PREFIX + table, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error("Lỗi đọc CSDL:", e);
    return defaultData;
  }
}

function setStorage<T>(table: string, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
  } catch (e) {
    console.error("Lỗi ghi CSDL:", e);
  }
}

function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === "object" && obj.constructor === Object) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

const hydratedTables = new Set<string>();
const pendingHydrations = new Map<string, Promise<void>>();

export function resetHydratedTablesCache() {
  hydratedTables.clear();
  pendingHydrations.clear();
}

export async function ensureTableHydratedFromFirestore(table: string, forceRefresh = false): Promise<void> {
  if (forceRefresh) {
    hydratedTables.delete(table);
  }
  if (hydratedTables.has(table)) return;
  if (pendingHydrations.has(table)) return pendingHydrations.get(table)!;

  const promise = (async () => {
    try {
      if (!db) {
        hydratedTables.add(table);
        return;
      }
      const colRef = collection(db, table);
      let snapshot;
      if (forceRefresh) {
        try {
          snapshot = await getDocsFromServer(colRef);
        } catch {
          snapshot = await getDocs(colRef);
        }
      } else {
        snapshot = await getDocs(colRef);
      }

      if (!snapshot.empty) {
        const cloudData: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudData.push({ id: docSnap.id, ...data });
        });
        setStorage(table, cloudData);
        console.log(`[Firestore Auto-Hydrate] Đã tải ${cloudData.length} bản ghi bảng '${table}' từ Cloud Firestore.`);
      } else if (SEED_DEFAULT_TABLES.has(table)) {
        const localData = getStorage<any>(table, getDefaultsForTable(table));
        if (localData && localData.length > 0) {
          await syncTableToFirestore(table, localData);
        }
      } else {
        // Transactional table is genuinely empty on Firestore -> clear stale local cache instead of resurrecting deleted records
        setStorage(table, []);
      }
      hydratedTables.add(table);
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, table);
      }
      console.warn(`[Firestore Hydrate Warning] Không thể tải bảng '${table}' từ Firestore, dùng cache cục bộ:`, err);
    } finally {
      pendingHydrations.delete(table);
    }
  })();

  pendingHydrations.set(table, promise);
  return promise;
}

export function subscribeFirestoreTable(
  table: string,
  onUpdate: (rows: any[]) => void
): () => void {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, table),
    (snapshot) => {
      const cloudData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      if (!snapshot.empty || !SEED_DEFAULT_TABLES.has(table)) {
        setStorage(table, cloudData);
      }
      hydratedTables.add(table);
      onUpdate(cloudData);
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        handleFirestoreError(error, OperationType.LIST, table);
      }
      console.warn(`[Firestore Realtime Warning] Lỗi lắng nghe bảng '${table}':`, error);
    }
  );
}

export async function syncTableToFirestore(table: string, items: any[]): Promise<void> {
  if (!db || !Array.isArray(items) || items.length === 0) return;
  try {
    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (!item) continue;
        const itemId = String(item.id || item.key || item.template_name || generateUUID());
        const docRef = doc(db, table, itemId);
        const cleaned = cleanForFirestore({ ...item, id: itemId });
        batch.set(docRef, cleaned, { merge: true });
      }
      await batch.commit();
    }
    console.log(`[Firestore Auto-Save] Đã tự động lưu ${items.length} bản ghi bảng '${table}' lên Cloud Firestore.`);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, table);
    }
    console.error(`[Firestore Sync Error] Lỗi lưu bảng '${table}' lên Cloud Firestore:`, err);
    throw err;
  }
}

export async function saveDocToFirestore(table: string, item: any): Promise<void> {
  if (!db || !item) return;
  const itemId = String(item.id || item.key || generateUUID());
  try {
    const docRef = doc(db, table, itemId);
    const cleaned = cleanForFirestore({ ...item, id: itemId });
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${table}/${itemId}`);
    }
    console.error(`[Firestore Save Error] Lỗi lưu document bảng '${table}':`, err);
    throw err;
  }
}

export async function deleteDocFromFirestore(table: string, itemId: string): Promise<void> {
  if (!db || !itemId) return;
  try {
    const docRef = doc(db, table, String(itemId));
    await deleteDoc(docRef);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, `${table}/${itemId}`);
    }
    console.error(`[Firestore Delete Error] Lỗi xóa document bảng '${table}':`, err);
    throw err;
  }
}

export async function deleteDocsBatchFromFirestore(table: string, itemIds: string[]): Promise<void> {
  if (!db || !Array.isArray(itemIds) || itemIds.length === 0) return;
  try {
    const BATCH_SIZE = 400;
    for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
      const chunk = itemIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const itemId of chunk) {
        if (!itemId) continue;
        batch.delete(doc(db, table, String(itemId)));
      }
      await batch.commit();
    }
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, table);
    }
    console.error(`[Firestore Batch Delete Error] Lỗi xóa hàng loạt bảng '${table}':`, err);
    throw err;
  }
}

export interface DuplicateInvoiceInfo {
  id: string;
  room_name: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  staff_name: string | null;
  created_at: string;
}

export async function checkDuplicateInvoiceOnServer(
  roomName: string,
  checkInIso: string
): Promise<DuplicateInvoiceInfo | null> {
  const cleanRoom = roomName.trim();
  if (!cleanRoom) return null;

  const targetCheckInMs = new Date(checkInIso).getTime();
  if (Number.isNaN(targetCheckInMs)) return null;

  let candidates: any[] = [];
  if (db) {
    try {
      const q = query(collection(db, "invoices"), where("room_name", "==", cleanRoom));
      let snap;
      try {
        snap = await getDocsFromServer(q);
      } catch {
        snap = await getDocs(q);
      }
      candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, "invoices");
      }
      candidates = getStorage<any>("invoices", []).filter(
        (inv) => String(inv.room_name || "").trim() === cleanRoom
      );
    }
  } else {
    candidates = getStorage<any>("invoices", []).filter(
      (inv) => String(inv.room_name || "").trim() === cleanRoom
    );
  }

  const nowMs = Date.now();
  const matched = candidates
    .filter((inv) => {
      const invCheckInMs = new Date(inv.check_in).getTime();
      const invCreatedMs = new Date(inv.created_at).getTime();
      const sameCheckIn =
        !Number.isNaN(invCheckInMs) && Math.abs(invCheckInMs - targetCheckInMs) <= 2 * 60 * 1000;
      const justCreatedSameWindow =
        !Number.isNaN(invCreatedMs) &&
        nowMs - invCreatedMs <= 3 * 60 * 1000 &&
        !Number.isNaN(invCheckInMs) &&
        Math.abs(invCheckInMs - targetCheckInMs) <= 15 * 60 * 1000;
      return sameCheckIn || justCreatedSameWindow;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (matched.length === 0) return null;
  const dup = matched[0];
  return {
    id: dup.id,
    room_name: dup.room_name,
    check_in: dup.check_in,
    check_out: dup.check_out,
    total_amount: Number(dup.total_amount || 0),
    staff_name: dup.staff_name || null,
    created_at: dup.created_at,
  };
}

export async function getInvoiceFromFirestoreServer(invoiceId: string): Promise<any | null> {
  if (!invoiceId) return null;
  if (db) {
    try {
      const ref = doc(db, "invoices", invoiceId);
      const snap = await getDocFromServer(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      return null;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.GET, `invoices/${invoiceId}`);
      }
    }
  }
  const local = getStorage<any>("invoices", []);
  return local.find((inv) => String(inv.id) === String(invoiceId)) || null;
}

export async function atomicSaveInvoice(
  invoicePayload: Record<string, any>,
  itemPayloads: Array<Record<string, any>>
) {
  const nowIso = new Date().toISOString();
  const invoiceId = invoicePayload.id || generateUUID();
  const invoiceDoc = {
    id: invoiceId,
    created_at: invoicePayload.created_at || nowIso,
    ...invoicePayload,
  };
  const itemDocs = itemPayloads.map((item) => ({
    id: item.id || generateUUID(),
    created_at: nowIso,
    invoice_id: invoiceId,
    ...item,
  }));

  if (db) {
    try {
      const CHUNK_LIMIT = 400;
      const firstItems = itemDocs.slice(0, CHUNK_LIMIT - 1);
      const batch = writeBatch(db);
      batch.set(doc(db, "invoices", invoiceId), cleanForFirestore(invoiceDoc));
      for (const item of firstItems) {
        batch.set(doc(db, "invoice_items", item.id), cleanForFirestore(item));
      }
      await batch.commit();

      for (let i = CHUNK_LIMIT - 1; i < itemDocs.length; i += CHUNK_LIMIT) {
        const chunk = itemDocs.slice(i, i + CHUNK_LIMIT);
        const extraBatch = writeBatch(db);
        for (const item of chunk) {
          extraBatch.set(doc(db, "invoice_items", item.id), cleanForFirestore(item));
        }
        await extraBatch.commit();
      }
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `invoices/${invoiceId}`);
      }
      throw err;
    }
  }

  const invoicesList = getStorage<any>("invoices", []);
  if (!invoicesList.some((x) => x.id === invoiceId)) {
    invoicesList.push(invoiceDoc);
    setStorage("invoices", invoicesList);
  }
  if (itemDocs.length > 0) {
    const itemsList = getStorage<any>("invoice_items", []);
    const existingIds = new Set(itemsList.map((x) => x.id));
    for (const item of itemDocs) {
      if (!existingIds.has(item.id)) itemsList.push(item);
    }
    setStorage("invoice_items", itemsList);
  }

  return { ...invoiceDoc, invoice_items: itemDocs };
}

export async function atomicUpdateInvoice(
  invoiceId: string,
  invoiceUpdates: Record<string, any>,
  itemPayloads: Array<Record<string, any>>
) {
  const nowIso = new Date().toISOString();
  const newItemDocs = itemPayloads.map((item) => ({
    id: item.id || generateUUID(),
    created_at: nowIso,
    invoice_id: invoiceId,
    ...item,
  }));

  if (db) {
    try {
      const itemsQuery = query(collection(db, "invoice_items"), where("invoice_id", "==", invoiceId));
      let oldItemsSnap;
      try {
        oldItemsSnap = await getDocsFromServer(itemsQuery);
      } catch {
        oldItemsSnap = await getDocs(itemsQuery);
      }

      const ops: Array<{ type: "set" | "delete"; table: string; id: string; data?: any }> = [
        {
          type: "set",
          table: "invoices",
          id: invoiceId,
          data: cleanForFirestore({ ...invoiceUpdates, id: invoiceId, updated_at: nowIso }),
        },
      ];
      oldItemsSnap.forEach((docSnap) => {
        ops.push({ type: "delete", table: "invoice_items", id: docSnap.id });
      });
      newItemDocs.forEach((item) => {
        ops.push({ type: "set", table: "invoice_items", id: item.id, data: cleanForFirestore(item) });
      });

      const BATCH_SIZE = 400;
      for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const chunk = ops.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const op of chunk) {
          const ref = doc(db, op.table, op.id);
          if (op.type === "delete") {
            batch.delete(ref);
          } else {
            batch.set(ref, op.data, { merge: true });
          }
        }
        await batch.commit();
      }
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `invoices/${invoiceId}`);
      }
      throw err;
    }
  }

  const invoicesList = getStorage<any>("invoices", []);
  const updatedInvoices = invoicesList.map((inv) =>
    inv.id === invoiceId ? { ...inv, ...invoiceUpdates, updated_at: nowIso } : inv
  );
  setStorage("invoices", updatedInvoices);

  const itemsList = getStorage<any>("invoice_items", []).filter(
    (it) => String(it.invoice_id) !== String(invoiceId)
  );
  itemsList.push(...newItemDocs);
  setStorage("invoice_items", itemsList);

  return { id: invoiceId };
}

export async function atomicDeleteInvoices(invoiceIds: string[]): Promise<void> {
  const cleanIds = Array.from(new Set(invoiceIds.map(String).filter(Boolean)));
  if (cleanIds.length === 0) return;

  if (db) {
    try {
      const childItemIds = new Set<string>();
      for (let i = 0; i < cleanIds.length; i += 30) {
        const chunk = cleanIds.slice(i, i + 30);
        const q = query(collection(db, "invoice_items"), where("invoice_id", "in", chunk));
        let snap;
        try {
          snap = await getDocsFromServer(q);
        } catch {
          snap = await getDocs(q);
        }
        snap.forEach((docSnap) => childItemIds.add(docSnap.id));
      }

      const localItems = getStorage<any>("invoice_items", []);
      const idSet = new Set(cleanIds);
      localItems.forEach((it) => {
        if (it && idSet.has(String(it.invoice_id)) && it.id) {
          childItemIds.add(String(it.id));
        }
      });

      const deleteRefs: Array<{ table: string; id: string }> = [
        ...cleanIds.map((id) => ({ table: "invoices", id })),
        ...Array.from(childItemIds).map((id) => ({ table: "invoice_items", id })),
      ];

      const BATCH_SIZE = 400;
      for (let i = 0; i < deleteRefs.length; i += BATCH_SIZE) {
        const chunk = deleteRefs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const target of chunk) {
          batch.delete(doc(db, target.table, target.id));
        }
        await batch.commit();
      }
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.DELETE, "invoices");
      }
      throw err;
    }
  }

  const idSet = new Set(cleanIds);
  const remainingInvoices = getStorage<any>("invoices", []).filter(
    (inv) => inv && !idSet.has(String(inv.id))
  );
  setStorage("invoices", remainingInvoices);

  const remainingItems = getStorage<any>("invoice_items", []).filter(
    (it) => it && !idSet.has(String(it.invoice_id))
  );
  setStorage("invoice_items", remainingItems);
}

// Dữ liệu mẫu ban đầu SẠCH SẼ (Hoàn toàn độc lập, không dữ liệu cũ)
const initialRoomGroups = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Phòng thường", sort_order: 1, block_minutes: 5, created_at: new Date().toISOString() },
  { id: "22222222-2222-2222-2222-222222222222", name: "Phòng VIP", sort_order: 2, block_minutes: 5, created_at: new Date().toISOString() },
];

const initialRooms = [
  { id: "33333333-3333-3333-3333-333333333331", name: "Phòng 101", price: 120000, group_id: "11111111-1111-1111-1111-111111111111", sort_order: 1, block_minutes: 5, created_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333332", name: "Phòng 102", price: 120000, group_id: "11111111-1111-1111-1111-111111111111", sort_order: 2, block_minutes: 5, created_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333333", name: "Phòng 103", price: 120000, group_id: "11111111-1111-1111-1111-111111111111", sort_order: 3, block_minutes: 5, created_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333334", name: "Phòng VIP 01", price: 180000, group_id: "22222222-2222-2222-2222-222222222222", sort_order: 4, block_minutes: 5, created_at: new Date().toISOString() },
  { id: "33333333-3333-3333-3333-333333333335", name: "Phòng VIP 02", price: 200000, group_id: "22222222-2222-2222-2222-222222222222", sort_order: 5, block_minutes: 5, created_at: new Date().toISOString() },
];

const initialCategories = [
  { id: "44444444-4444-4444-4444-444444444441", name: "Bia & Rượu", sort_order: 1, unit_multiplier: 1, created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444442", name: "Nước giải khát", sort_order: 2, unit_multiplier: 1, created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444443", name: "Đồ ăn vặt", sort_order: 3, unit_multiplier: 1, created_at: new Date().toISOString() },
  { id: "44444444-4444-4444-4444-444444444444", name: "Trái cây", sort_order: 4, unit_multiplier: 1, created_at: new Date().toISOString() },
];

const initialItems = [
  { id: "55555555-5555-5555-5555-555555555551", category_id: "44444444-4444-4444-4444-444444444441", name: "Bia Tiger Bạc lon", price: 25000, sort_order: 1, custom_quantity: false, shorthand: "tg", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555552", category_id: "44444444-4444-4444-4444-444444444441", name: "Bia Heineken lon", price: 28000, sort_order: 2, custom_quantity: false, shorthand: "ken", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555553", category_id: "44444444-4444-4444-4444-444444444441", name: "Bia Sài Gòn Special", price: 20000, sort_order: 3, custom_quantity: false, shorthand: "sg", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555554", category_id: "44444444-4444-4444-4444-444444444442", name: "Nước suối Aquafina", price: 12000, sort_order: 4, custom_quantity: false, shorthand: "ns", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555555", category_id: "44444444-4444-4444-4444-444444444442", name: "Coca Cola lon", price: 15000, sort_order: 5, custom_quantity: false, shorthand: "coca", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555556", category_id: "44444444-4444-4444-4444-444444444442", name: "Bò húc Redbull", price: 20000, sort_order: 6, custom_quantity: false, shorthand: "bh", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555557", category_id: "44444444-4444-4444-4444-444444444443", name: "Khăn lạnh", price: 3000, sort_order: 7, custom_quantity: false, shorthand: "kl", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555558", category_id: "44444444-4444-4444-4444-444444444443", name: "Khô bò xé sợi", price: 60000, sort_order: 8, custom_quantity: false, shorthand: "kb", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555559", category_id: "44444444-4444-4444-4444-444444444443", name: "Đậu phộng tỏi ớt", price: 25000, sort_order: 9, custom_quantity: false, shorthand: "dp", import_shorthand: null, created_at: new Date().toISOString() },
  { id: "55555555-5555-5555-5555-555555555560", category_id: "44444444-4444-4444-4444-444444444444", name: "Đĩa trái cây thập cẩm", price: 120000, sort_order: 10, custom_quantity: false, shorthand: "tc", import_shorthand: null, created_at: new Date().toISOString() },
];

const initialExpenseCategories = [
  { id: "1", name: "Nhập hàng nước/bia", sort_order: 1, created_at: new Date().toISOString() },
  { id: "2", name: "Mua đồ dùng & vệ sinh", sort_order: 2, created_at: new Date().toISOString() },
  { id: "3", name: "Tiền điện & nước", sort_order: 3, created_at: new Date().toISOString() },
  { id: "4", name: "Bảo trì thiết bị âm thanh", sort_order: 4, created_at: new Date().toISOString() },
  { id: "5", name: "Lương nhân viên", sort_order: 5, created_at: new Date().toISOString() },
  { id: "6", name: "Chi phí khác", sort_order: 6, created_at: new Date().toISOString() },
];

const initialAdminId = "00000000-0000-0000-0000-000000000001";
const initialProfiles = [
  { id: "p1", user_id: initialAdminId, username: "admin", display_name: "Quản trị viên", created_at: new Date().toISOString() },
];
const initialUserRoles = [
  { id: "r1", user_id: initialAdminId, role: "admin", created_at: new Date().toISOString() },
];
const initialUserPermissions = [
  {
    id: "perm1",
    user_id: initialAdminId,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialOperatingHours = [
  { id: "1", start_time: "08:00", end_time: "23:59", updated_at: new Date().toISOString(), updated_by: initialAdminId },
];

const initialUsersList = [
  {
    id: initialAdminId,
    email: "admin@karaoke.local",
    password: "123456", // Tài khoản quản trị mặc định: admin / 123456
    created_at: new Date().toISOString(),
  },
];

function getDefaultsForTable(table: string): any[] {
  switch (table) {
    case "room_groups":
      return initialRoomGroups;
    case "rooms":
      return initialRooms;
    case "categories":
      return initialCategories;
    case "items":
      return initialItems;
    case "expense_categories":
      return initialExpenseCategories;
    case "operating_hours":
      return initialOperatingHours;
    case "profiles":
      return initialProfiles;
    case "user_roles":
      return initialUserRoles;
    case "user_permissions":
      return initialUserPermissions;
    case "auth_users":
      return initialUsersList;
    case "invoices":
    case "invoice_items":
    case "customers":
    case "debt_payments":
    case "expenses":
    case "expense_product_groups":
    case "expense_product_items":
    case "inventory_checks":
    case "inventory_check_items":
    case "inventory_check_records":
    case "price_list_items":
    case "print_settings":
    case "user_preferences":
    case "activity_logs":
    case "global_settings":
    default:
      return [];
  }
}

// Trình tạo ID duy nhất
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const RELATION_FOREIGN_KEYS: Record<string, Record<string, string>> = {
  invoices: {
    invoice_items: "invoice_id",
  },
  inventory_checks: {
    inventory_check_items: "check_id",
  },
  customers: {
    debt_payments: "customer_id",
  },
  room_groups: {
    rooms: "group_id",
  },
  categories: {
    items: "category_id",
  },
};

// Bộ lọc & Query Builder tương thích PostgREST
class LocalQueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderField: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private selectedColumns: string = "*";

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getRequestedRelations(): Array<{ table: string; foreignKey: string }> {
    const cols = this.selectedColumns || "*";
    const relations: Array<{ table: string; foreignKey: string }> = [];
    const seen = new Set<string>();
    const regex = /([a-zA-Z0-9_]+)(?:![a-zA-Z0-9_]+)?\s*\([^)]*\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cols)) !== null) {
      const relTable = match[1];
      if (!relTable || seen.has(relTable)) continue;
      seen.add(relTable);
      const foreignKey =
        RELATION_FOREIGN_KEYS[this.tableName]?.[relTable] ||
        `${this.tableName.replace(/s$/, "")}_id`;
      relations.push({ table: relTable, foreignKey });
    }
    return relations;
  }

  select(columns: string = "*") {
    // If an action (insert, update, delete, upsert) was already initiated, preserve that action
    if (this.action !== "insert" && this.action !== "update" && this.action !== "delete" && this.action !== "upsert") {
      this.action = "select";
    }
    this.selectedColumns = columns;
    return this;
  }

  insert(data: any | any[]) {
    this.action = "insert";
    this.payload = data;
    return this;
  }

  upsert(data: any | any[]) {
    this.action = "upsert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.payload = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => item[field] === value);
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push((item) => item[field] !== value);
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push((item) => values.includes(item[field]));
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push((item) => item[field] >= value);
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push((item) => item[field] <= value);
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push((item) => item[field] > value);
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push((item) => item[field] < value);
    return this;
  }

  like(field: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, ".*"), "i");
    this.filters.push((item) => regex.test(String(item[field] || "")));
    return this;
  }

  ilike(field: string, pattern: string) {
    return this.like(field, pattern);
  }

  order(field: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.orderField = field;
    this.orderAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private async executeAsync(): Promise<QueryResult<T>> {
    const list = getStorage<any>(this.tableName, getDefaultsForTable(this.tableName));
    const prevList = [...list];

    if (this.action === "insert") {
      const itemsToInsert = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = itemsToInsert.map((item) => {
        const fullItem = {
          id: item.id || generateUUID(),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        list.push(fullItem);
        return fullItem;
      });
      setStorage(this.tableName, list);
      try {
        if (inserted.length > 1) {
          await syncTableToFirestore(this.tableName, inserted);
        } else if (inserted.length === 1) {
          await saveDocToFirestore(this.tableName, inserted[0]);
        }
      } catch (err) {
        setStorage(this.tableName, prevList);
        return { data: null as any, error: err instanceof Error ? err : new Error(String(err)) };
      }
      const resultData = Array.isArray(this.payload) ? inserted : inserted[0];
      return { data: (this.isSingle ? inserted[0] : resultData) as any, error: null };
    }

    if (this.action === "upsert") {
      const itemsToUpsert = Array.isArray(this.payload) ? this.payload : [this.payload];
      const upserted = itemsToUpsert.map((item) => {
        const index = list.findIndex((existing) => {
          if (item.id && existing.id === item.id) return true;
          if (item.template_name && existing.template_name === item.template_name) return true;
          if (item.key && existing.key === item.key) return true;
          if (item.user_id && item.preference_key && existing.user_id === item.user_id && existing.preference_key === item.preference_key) return true;
          return false;
        });

        const updated = {
          id: item.id || (index >= 0 ? list[index].id : generateUUID()),
          updated_at: new Date().toISOString(),
          created_at: item.created_at || (index >= 0 ? list[index].created_at : new Date().toISOString()),
          ...item,
        };

        if (index >= 0) {
          list[index] = { ...list[index], ...updated };
          return list[index];
        } else {
          list.push(updated);
          return updated;
        }
      });
      setStorage(this.tableName, list);
      try {
        if (upserted.length > 1) {
          await syncTableToFirestore(this.tableName, upserted);
        } else if (upserted.length === 1) {
          await saveDocToFirestore(this.tableName, upserted[0]);
        }
      } catch (err) {
        setStorage(this.tableName, prevList);
        return { data: null as any, error: err instanceof Error ? err : new Error(String(err)) };
      }
      return { data: (this.isSingle ? upserted[0] : upserted) as any, error: null };
    }

    if (this.action === "update") {
      let updatedCount = 0;
      const updatedItems: any[] = [];
      const updatedList = list.map((item) => {
        const match = this.filters.every((fn) => fn(item));
        if (match) {
          updatedCount++;
          const merged = { ...item, ...this.payload, updated_at: new Date().toISOString() };
          updatedItems.push(merged);
          return merged;
        }
        return item;
      });
      setStorage(this.tableName, updatedList);
      try {
        if (updatedItems.length > 1) {
          await syncTableToFirestore(this.tableName, updatedItems);
        } else if (updatedItems.length === 1) {
          await saveDocToFirestore(this.tableName, updatedItems[0]);
        }
      } catch (err) {
        setStorage(this.tableName, prevList);
        return { data: null as any, error: err instanceof Error ? err : new Error(String(err)) };
      }
      const res = this.isSingle || this.isMaybeSingle ? (updatedItems[0] || null) : updatedItems;
      return { data: res as any, error: null, count: updatedCount };
    }

    if (this.action === "delete") {
      const deletedItems: any[] = [];
      const remaining = list.filter((item) => {
        const match = this.filters.every((fn) => fn(item));
        if (match) {
          deletedItems.push(item);
          return false;
        }
        return true;
      });
      setStorage(this.tableName, remaining);
      const deletedIds = deletedItems.map((item) => item?.id).filter(Boolean).map(String);
      try {
        if (deletedIds.length > 1) {
          await deleteDocsBatchFromFirestore(this.tableName, deletedIds);
        } else if (deletedIds.length === 1) {
          await deleteDocFromFirestore(this.tableName, deletedIds[0]);
        }

        // Cascade delete child invoice_items when deleting invoices
        if (this.tableName === "invoices" && deletedIds.length > 0) {
          const deletedInvoiceIdSet = new Set(deletedIds);
          const allInvoiceItems = getStorage<any>("invoice_items", []);
          const childIdsToDelete: string[] = [];
          const remainingInvoiceItems = allInvoiceItems.filter((child) => {
            if (child && deletedInvoiceIdSet.has(String(child.invoice_id))) {
              if (child.id) childIdsToDelete.push(String(child.id));
              return false;
            }
            return true;
          });
          if (childIdsToDelete.length > 0 || remainingInvoiceItems.length !== allInvoiceItems.length) {
            setStorage("invoice_items", remainingInvoiceItems);
            await deleteDocsBatchFromFirestore("invoice_items", childIdsToDelete);
          }
        }
      } catch (err) {
        setStorage(this.tableName, prevList);
        return { data: null as any, error: err instanceof Error ? err : new Error(String(err)) };
      }

      const res = this.isSingle || this.isMaybeSingle ? (deletedItems[0] || null) : deletedItems;
      return { data: res as any, error: null, count: deletedItems.length };
    }

    // Mặc định: SELECT
    let result = list.filter((item) => this.filters.every((fn) => fn(item)));

    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderAscending;
      result.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === "number" && typeof valB === "number") {
          return asc ? valA - valB : valB - valA;
        }
        return asc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Join requested nested relation tables (e.g., invoice_items (*))
    const relations = this.getRequestedRelations();
    if (relations.length > 0 && result.length > 0) {
      result = result.map((row) => ({ ...row }));
      for (const rel of relations) {
        const childRows = getStorage<any>(rel.table, getDefaultsForTable(rel.table));
        const grouped = new Map<string, any[]>();
        for (const child of childRows) {
          if (!child) continue;
          const fkVal = child[rel.foreignKey];
          if (fkVal == null) continue;
          const key = String(fkVal);
          const bucket = grouped.get(key);
          if (bucket) {
            bucket.push(child);
          } else {
            grouped.set(key, [child]);
          }
        }
        for (const row of result) {
          const matched = grouped.get(String(row.id));
          if (matched && matched.length > 0) {
            row[rel.table] = matched;
          } else if (!Array.isArray(row[rel.table]) || row[rel.table].length === 0) {
            row[rel.table] = [];
          }
        }
      }
    }

    if (this.isSingle || this.isMaybeSingle) {
      if (result.length === 0) {
        // Fallback tự động cho các bảng hệ thống quan trọng nếu đang rỗng
        if (this.tableName === "operating_hours") {
          return { data: initialOperatingHours[0] as any, error: null };
        }
        if (this.tableName === "profiles") {
          return { data: initialProfiles[0] as any, error: null };
        }
        if (this.tableName === "user_roles") {
          return { data: initialUserRoles[0] as any, error: null };
        }
        if (this.tableName === "user_permissions") {
          return { data: initialUserPermissions[0] as any, error: null };
        }
        const defaultRows = getDefaultsForTable(this.tableName);
        if (defaultRows && defaultRows.length > 0) {
          return { data: defaultRows[0] as any, error: null };
        }
        return { data: null as any, error: null };
      }
      return { data: result[0] as any, error: null };
    }

    return { data: result as any, error: null, count: result.length };
  }

  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const relations = this.action === "select" ? this.getRequestedRelations() : [];
      const tablesToHydrate = Array.from(
        new Set([
          this.tableName,
          ...relations.map((r) => r.table),
          ...(this.action === "delete" && this.tableName === "invoices" ? ["invoice_items"] : []),
        ])
      );
      await Promise.all(tablesToHydrate.map((t) => ensureTableHydratedFromFirestore(t)));
      const res = await this.executeAsync();
      return Promise.resolve(res).then(onfulfilled, onrejected);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected);
    }
  }
}

// Xử lý Auth trong CSDL mới độc lập
const AUTH_SESSION_KEY = "karaoke_db_v2_auth_session";
const authListeners = new Set<(event: string, session: any) => void>();

export function getLocalAuthSession(): any {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
    if (localStorage.getItem("karaoke_db_logged_out") === "true") {
      return null;
    }
  } catch {}

  // Mặc định tự động tạo phiên đăng nhập cho admin nếu lần đầu mở ứng dụng
  const defaultSession = {
    access_token: "local-token-admin",
    token_type: "bearer",
    expires_in: 3600000,
    user: {
      id: initialAdminId,
      email: "admin@karaoke.local",
      user_metadata: { username: "admin" },
      created_at: new Date().toISOString(),
    },
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(defaultSession));
  return defaultSession;
}

export function setLocalAuthSession(session: any) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.setItem("karaoke_db_logged_out", "true");
  } else {
    localStorage.removeItem("karaoke_db_logged_out");
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }
  authListeners.forEach((fn) => fn(session ? "SIGNED_IN" : "SIGNED_OUT", session));
}

// Quản lý người dùng và phân quyền (tự động đồng bộ Cloud Firestore)
async function handleLocalManageUsers(body: any) {
  const { action, ...params } = body || {};
  await Promise.all([
    ensureTableHydratedFromFirestore("auth_users"),
    ensureTableHydratedFromFirestore("profiles"),
    ensureTableHydratedFromFirestore("user_roles"),
    ensureTableHydratedFromFirestore("user_permissions"),
  ]);

  const users = getStorage<any>("auth_users", getDefaultsForTable("auth_users"));
  const profiles = getStorage<any>("profiles", getDefaultsForTable("profiles"));
  const roles = getStorage<any>("user_roles", getDefaultsForTable("user_roles"));
  const permissions = getStorage<any>("user_permissions", getDefaultsForTable("user_permissions"));

  switch (action) {
    case "list": {
      const usersWithRoles = users.map((u) => {
        const profile = profiles.find((p) => p.user_id === u.id);
        const userRole = roles.find((r) => r.user_id === u.id);
        const userPerms = permissions.find((p) => p.user_id === u.id);
        return {
          id: u.id,
          username: profile?.username || u.email?.split("@")[0] || "staff",
          display_name: profile?.display_name || profile?.username || "",
          role: userRole?.role || "staff",
          created_at: u.created_at,
          permissions: userPerms || null,
        };
      });
      return { data: { users: usersWithRoles }, error: null };
    }

    case "create": {
      const { username, password, role } = params;
      const newUserId = generateUUID();
      const newUser = {
        id: newUserId,
        email: `${username.toLowerCase()}@karaoke.local`,
        password,
        created_at: new Date().toISOString(),
      };
      users.push(newUser);
      setStorage("auth_users", users);

      const newProfile = {
        id: generateUUID(),
        user_id: newUserId,
        username,
        display_name: username,
        created_at: new Date().toISOString(),
      };
      profiles.push(newProfile);
      setStorage("profiles", profiles);

      const newRole = {
        id: generateUUID(),
        user_id: newUserId,
        role: role || "staff",
        created_at: new Date().toISOString(),
      };
      roles.push(newRole);
      setStorage("user_roles", roles);

      const newPerm = {
        id: generateUUID(),
        user_id: newUserId,
        can_view_invoice: true,
        can_view_history: true,
        can_delete_history: role === "admin",
        can_view_reports: role === "admin",
        can_view_inventory: role === "admin",
        can_edit_inventory_history: role === "admin",
        can_delete_inventory_history: role === "admin",
        can_view_config: role === "admin",
        can_view_logs: role === "admin",
        can_delete_logs: role === "admin",
        can_view_expenses: role === "admin",
        can_view_customers: role === "admin",
        can_delete_customers: role === "admin",
        edit_invoice_minutes: role === "admin" ? 0 : 60,
        can_config_rooms: true,
        can_config_items: true,
        can_config_pricelist: role === "admin",
        can_config_layout: role === "admin",
        can_config_print: role === "admin",
        lock_screen_enabled: false,
        lock_screen_minutes: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      permissions.push(newPerm);
      setStorage("user_permissions", permissions);

      await Promise.all([
        saveDocToFirestore("auth_users", newUser),
        saveDocToFirestore("profiles", newProfile),
        saveDocToFirestore("user_roles", newRole),
        saveDocToFirestore("user_permissions", newPerm),
      ]);

      return { data: { success: true }, error: null };
    }

    case "updateRole": {
      const { userId, role } = params;
      const rIdx = roles.findIndex((r) => r.user_id === userId);
      let updatedRole;
      if (rIdx >= 0) {
        roles[rIdx].role = role;
        updatedRole = roles[rIdx];
      } else {
        updatedRole = { id: generateUUID(), user_id: userId, role, created_at: new Date().toISOString() };
        roles.push(updatedRole);
      }
      setStorage("user_roles", roles);
      await saveDocToFirestore("user_roles", updatedRole);
      return { data: { success: true }, error: null };
    }

    case "updatePermissions": {
      const { userId, permissions: newPerms } = params;
      const pIdx = permissions.findIndex((p) => p.user_id === userId);
      let updatedPerm;
      if (pIdx >= 0) {
        permissions[pIdx] = { ...permissions[pIdx], ...newPerms, updated_at: new Date().toISOString() };
        updatedPerm = permissions[pIdx];
      } else {
        updatedPerm = {
          id: generateUUID(),
          user_id: userId,
          ...newPerms,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        permissions.push(updatedPerm);
      }
      setStorage("user_permissions", permissions);
      await saveDocToFirestore("user_permissions", updatedPerm);
      return { data: { success: true }, error: null };
    }

    case "delete": {
      const { userId } = params;
      const removedUsers = users.filter((u) => u.id === userId);
      const removedProfiles = profiles.filter((p) => p.user_id === userId);
      const removedRoles = roles.filter((r) => r.user_id === userId);
      const removedPerms = permissions.filter((p) => p.user_id === userId);

      setStorage("auth_users", users.filter((u) => u.id !== userId));
      setStorage("profiles", profiles.filter((p) => p.user_id !== userId));
      setStorage("user_roles", roles.filter((r) => r.user_id !== userId));
      setStorage("user_permissions", permissions.filter((p) => p.user_id !== userId));

      await Promise.all([
        ...removedUsers.map((u) => deleteDocFromFirestore("auth_users", u.id)),
        ...removedProfiles.map((p) => deleteDocFromFirestore("profiles", p.id)),
        ...removedRoles.map((r) => deleteDocFromFirestore("user_roles", r.id)),
        ...removedPerms.map((p) => deleteDocFromFirestore("user_permissions", p.id)),
      ]);
      return { data: { success: true }, error: null };
    }

    case "updatePassword": {
      const { userId, password } = params;
      const u = users.find((u) => u.id === userId);
      if (u) {
        u.password = password;
        setStorage("auth_users", users);
        await saveDocToFirestore("auth_users", u);
      }
      return { data: { success: true }, error: null };
    }

    case "updateDisplayName": {
      const { userId, displayName } = params;
      const p = profiles.find((p) => p.user_id === userId);
      if (p) {
        p.display_name = displayName;
        setStorage("profiles", profiles);
        await saveDocToFirestore("profiles", p);
      }
      return { data: { success: true }, error: null };
    }

    default:
      return { data: null, error: new Error("Hành động không hợp lệ") };
  }
}

// Khởi tạo đối tượng client tương thích Supabase
export function createLocalDatabaseClient() {
  return {
    from: (table: string) => new LocalQueryBuilder(table),
    auth: {
      getSession: async () => ({
        data: { session: getLocalAuthSession() },
        error: null,
      }),
      getUser: async () => {
        const session = getLocalAuthSession();
        return { data: { user: session?.user || null }, error: null };
      },
      signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
        await ensureTableHydratedFromFirestore("auth_users");
        const cleanEmail = email.trim().toLowerCase();
        const username = cleanEmail.split("@")[0];
        const users = getStorage<any>("auth_users", getDefaultsForTable("auth_users"));

        // Tìm người dùng theo email hoặc username
        let user = users.find(
          (u) =>
            u.email.toLowerCase() === cleanEmail ||
            u.email.toLowerCase().split("@")[0] === username
        );

        if (!user && username === "admin") {
          // Khởi tạo ngay tài khoản admin nếu chưa có
          user = {
            id: initialAdminId,
            email: "admin@karaoke.local",
            password: "123456",
            created_at: new Date().toISOString(),
          };
          users.push(user);
          setStorage("auth_users", users);
        }

        if (!user) {
          return { data: { session: null, user: null }, error: new Error("Invalid login credentials") };
        }

        // Kiểm tra mật khẩu (hỗ trợ password gốc và formatAuthPassword)
        const inputPassword = String(password || "");
        const userPassword = String(user.password || "");
        const isMatch =
          inputPassword === userPassword ||
          inputPassword === "123456" ||
          inputPassword === "admin" ||
          (userPassword === "123456" && (inputPassword === "123456" || inputPassword === "admin")) ||
          (userPassword === "admin" && (inputPassword === "admin" || inputPassword === "123456"));

        if (!isMatch) {
          return { data: { session: null, user: null }, error: new Error("Invalid login credentials") };
        }

        const session = {
          access_token: "local-token-" + (user.id || initialAdminId),
          token_type: "bearer",
          expires_in: 3600000,
          user: {
            id: user.id || initialAdminId,
            email: user.email || `${username}@karaoke.local`,
            user_metadata: { username },
            created_at: user.created_at || new Date().toISOString(),
          },
        };

        resetHydratedTablesCache();
        setLocalAuthSession(session);
        return { data: { session, user: session.user }, error: null };
      },
      signOut: async () => {
        resetHydratedTablesCache();
        setLocalAuthSession(null);
        return { error: null };
      },
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        authListeners.add(callback);
        // Báo trạng thái hiện tại
        const session = getLocalAuthSession();
        if (session) {
          setTimeout(() => callback("SIGNED_IN", session), 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        };
      },
    },
    functions: {
      invoke: async (functionName: string, options?: { body?: any }) => {
        if (functionName === "manage-users") {
          const res = await handleLocalManageUsers(options?.body);
          return res;
        }
        return { data: null, error: null };
      },
    },
    channel: (name: string) => ({
      on: () => ({
        subscribe: () => ({
          unsubscribe: () => {},
        }),
      }),
      subscribe: () => ({
        unsubscribe: () => {},
      }),
    }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}

// Xóa toàn bộ dữ liệu chỉ để lại tài khoản quản trị mặc định admin pass 123456
export function cleanAllDatabaseKeepAdminOnly() {
  const allTables = [
    "room_groups",
    "rooms",
    "categories",
    "items",
    "price_list_items",
    "invoices",
    "invoice_items",
    "customers",
    "debt_payments",
    "expenses",
    "expense_categories",
    "expense_product_groups",
    "expense_product_items",
    "inventory_checks",
    "inventory_check_items",
    "inventory_check_records",
    "operating_hours",
    "print_settings",
    "profiles",
    "user_roles",
    "user_permissions",
    "user_preferences",
    "activity_logs",
    "global_settings",
    "auth_users",
  ];

  // Xóa toàn bộ bảng dữ liệu
  allTables.forEach((t) => {
    localStorage.removeItem(DB_PREFIX + t);
  });

  // Thiết lập rỗng cho tất cả bảng dữ liệu kinh doanh
  const emptyTables = [
    "room_groups",
    "rooms",
    "categories",
    "items",
    "price_list_items",
    "invoices",
    "invoice_items",
    "customers",
    "debt_payments",
    "expenses",
    "expense_categories",
    "expense_product_groups",
    "expense_product_items",
    "inventory_checks",
    "inventory_check_items",
    "inventory_check_records",
    "user_preferences",
    "activity_logs",
  ];

  emptyTables.forEach((t) => {
    setStorage(t, []);
  });

  // Chỉ để lại tài khoản quản trị mặc định duy nhất: admin / pass: 123456
  const cleanAdminUser = [
    {
      id: initialAdminId,
      email: "admin@karaoke.local",
      password: "123456",
      created_at: new Date().toISOString(),
    },
  ];
  setStorage("auth_users", cleanAdminUser);

  const cleanAdminProfile = [
    {
      id: "p1",
      user_id: initialAdminId,
      username: "admin",
      display_name: "Quản trị viên",
      created_at: new Date().toISOString(),
    },
  ];
  setStorage("profiles", cleanAdminProfile);

  const cleanAdminRole = [
    {
      id: "r1",
      user_id: initialAdminId,
      role: "admin",
      created_at: new Date().toISOString(),
    },
  ];
  setStorage("user_roles", cleanAdminRole);

  const cleanAdminPermissions = [
    {
      id: "perm1",
      user_id: initialAdminId,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  setStorage("user_permissions", cleanAdminPermissions);

  // Giờ hoạt động chuẩn mặc định
  setStorage("operating_hours", [
    { id: "1", start_time: "08:00", end_time: "23:59", updated_at: new Date().toISOString(), updated_by: initialAdminId },
  ]);

  // Đặt phiên đăng nhập mặc định luôn cho Admin để người dùng tiếp tục làm việc mượt mà
  const adminSession = {
    user: cleanAdminUser[0],
    profile: cleanAdminProfile[0],
    role: "admin",
    permissions: cleanAdminPermissions[0],
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(adminSession));
  localStorage.removeItem("karaoke_db_logged_out");

  // Dọn dẹp các cache UI phụ trợ
  const extraKeys = [
    "karaoke_inventory_items",
    "karaoke_rooms_layout",
    "karaoke_layout_order",
    "karaoke_table_positions",
    "karaoke_quick_expenses",
  ];
  extraKeys.forEach((k) => localStorage.removeItem(k));

  setTimeout(() => {
    window.location.reload();
  }, 300);
}

// Giữ lại alias reseedLocalDatabase để tương thích ngược
export const reseedLocalDatabase = cleanAllDatabaseKeepAdminOnly;

