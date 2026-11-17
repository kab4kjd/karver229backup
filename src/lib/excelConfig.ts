import type * as XLSXTypes from "@datalens-tech/xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface RoomRow {
  name: string;
  price: number;
  block_minutes: number;
}

export interface CategoryRow {
  name: string;
  sort_order: number;
}

export interface ItemRow {
  category_name: string;
  name: string;
  price: number;
  custom_quantity: boolean;
  shorthand?: string;
  import_shorthand?: string;
}

const loadXLSX = () => import("@datalens-tech/xlsx");

const downloadWorkbook = (XLSX: typeof XLSXTypes, wb: XLSXTypes.WorkBook, filename: string) => {
  XLSX.writeFile(wb, filename);
};

export const exportRoomsToExcel = async (
  rooms: { name: string; price: number; block_minutes?: number }[]
) => {
  const XLSX = await loadXLSX();
  const data: RoomRow[] = rooms.map((r) => ({
    name: r.name,
    price: r.price,
    block_minutes: r.block_minutes ?? 60,
  }));
  const ws = XLSX.utils.json_to_sheet(data, {
    header: ["name", "price", "block_minutes"],
  });
  ws["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Phong");
  downloadWorkbook(XLSX, wb, `phong-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportItemsToExcel = async (
  categories: { id: string; name: string; sort_order: number }[],
  items: {
    name: string;
    price: number;
    category_id: string;
    custom_quantity?: boolean;
    shorthand?: string | null;
    import_shorthand?: string | null;
  }[]
) => {
  const XLSX = await loadXLSX();
  const catData: CategoryRow[] = categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ name: c.name, sort_order: c.sort_order }));

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const itemData: ItemRow[] = items.map((i) => ({
    category_name: catMap.get(i.category_id) || "",
    name: i.name,
    price: i.price,
    custom_quantity: !!i.custom_quantity,
    shorthand: i.shorthand || "",
    import_shorthand: i.import_shorthand || "",
  }));

  const wsCat = XLSX.utils.json_to_sheet(catData, {
    header: ["name", "sort_order"],
  });
  wsCat["!cols"] = [{ wch: 24 }, { wch: 12 }];

  const wsItems = XLSX.utils.json_to_sheet(itemData, {
    header: [
      "category_name",
      "name",
      "price",
      "custom_quantity",
      "shorthand",
      "import_shorthand",
    ],
  });
  wsItems["!cols"] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsCat, "LoaiMon");
  XLSX.utils.book_append_sheet(wb, wsItems, "MonAn");
  downloadWorkbook(
    XLSX,
    wb,
    `mon-an-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

const readFile = async (file: File): Promise<{ wb: XLSXTypes.WorkBook; XLSX: typeof XLSXTypes }> => {
  const XLSX = await loadXLSX();
  const wb = await new Promise<XLSXTypes.WorkBook>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        resolve(XLSX.read(data, { type: "array" }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  return { wb, XLSX };
};

const toBool = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "x" || s === "có";
  }
  return false;
};

export const importRoomsFromExcel = async (
  file: File,
  existingRooms: { id: string; name: string }[]
): Promise<{ inserted: number; updated: number }> => {
  const { wb, XLSX } = await readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

  const existingByName = new Map(
    existingRooms.map((r) => [r.name.trim().toLowerCase(), r.id])
  );

  let inserted = 0;
  let updated = 0;
  const maxOrderRes = await supabase
    .from("rooms")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  let nextOrder =
    (maxOrderRes.data?.[0]?.sort_order ?? -1) + 1;

  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const price = Number(r.price) || 0;
    const block_minutes = Number(r.block_minutes) || 60;

    const existId = existingByName.get(name.toLowerCase());
    if (existId) {
      const { error } = await supabase
        .from("rooms")
        .update({ name, price, block_minutes })
        .eq("id", existId);
      if (error) throw error;
      updated++;
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({ name, price, block_minutes, sort_order: nextOrder++ });
      if (error) throw error;
      inserted++;
    }
  }
  return { inserted, updated };
};

export const importItemsFromExcel = async (
  file: File,
  existingCategories: { id: string; name: string }[],
  existingItems: { id: string; name: string; category_id: string }[]
): Promise<{
  catsInserted: number;
  catsUpdated: number;
  itemsInserted: number;
  itemsUpdated: number;
}> => {
  const { wb, XLSX } = await readFile(file);

  // Categories sheet (optional)
  const catSheetName =
    wb.SheetNames.find((n) => /loai|cat/i.test(n)) || wb.SheetNames[0];
  const itemSheetName =
    wb.SheetNames.find(
      (n) => n !== catSheetName && /(mon\s*an|monan|item|dish|food)/i.test(n)
    ) ||
    wb.SheetNames.find((n) => n !== catSheetName) ||
    wb.SheetNames[0];

  const catRows = catSheetName
    ? XLSX.utils.sheet_to_json<any>(wb.Sheets[catSheetName], { defval: "" })
    : [];
  const itemRows = itemSheetName
    ? XLSX.utils.sheet_to_json<any>(wb.Sheets[itemSheetName], { defval: "" })
    : [];

  const catByName = new Map(
    existingCategories.map((c) => [c.name.trim().toLowerCase(), c.id])
  );

  let catsInserted = 0;
  let catsUpdated = 0;

  // Process categories (only if rows have 'name' and either 'sort_order' or look like categories - skip if these look like items)
  const validCatRows = catRows.filter(
    (r) => r.name && !r.category_name && !r.price
  );
  for (const r of validCatRows) {
    const name = String(r.name).trim();
    if (!name) continue;
    const sort_order = Number(r.sort_order) || 0;
    const existId = catByName.get(name.toLowerCase());
    if (existId) {
      const { error } = await supabase
        .from("categories")
        .update({ name, sort_order })
        .eq("id", existId);
      if (error) throw error;
      catsUpdated++;
    } else {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, sort_order })
        .select()
        .single();
      if (error) throw error;
      catByName.set(name.toLowerCase(), data.id);
      catsInserted++;
    }
  }

  // Item key: categoryId + name
  const itemKey = (catId: string, name: string) =>
    `${catId}::${name.trim().toLowerCase()}`;
  const itemMap = new Map(
    existingItems.map((i) => [itemKey(i.category_id, i.name), i.id])
  );
  // refresh with newly created cats
  for (const c of existingCategories) catByName.set(c.name.trim().toLowerCase(), c.id);

  let itemsInserted = 0;
  let itemsUpdated = 0;

  for (const r of itemRows) {
    const name = String(r.name ?? "").trim();
    const catName = String(r.category_name ?? "").trim();
    if (!name || !catName) continue;

    let catId = catByName.get(catName.toLowerCase());
    if (!catId) {
      // auto-create the category
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: catName })
        .select()
        .single();
      if (error) throw error;
      catId = data.id;
      catByName.set(catName.toLowerCase(), catId);
      catsInserted++;
    }

    const price = Number(r.price) || 0;
    const payload = {
      name,
      price,
      category_id: catId,
      custom_quantity: toBool(r.custom_quantity),
      shorthand: String(r.shorthand ?? "").trim() || null,
      import_shorthand: String(r.import_shorthand ?? "").trim() || null,
    };

    const existId = itemMap.get(itemKey(catId, name));
    if (existId) {
      const { error } = await supabase
        .from("items")
        .update(payload)
        .eq("id", existId);
      if (error) throw error;
      itemsUpdated++;
    } else {
      const { error } = await supabase.from("items").insert(payload);
      if (error) throw error;
      itemsInserted++;
    }
  }

  return { catsInserted, catsUpdated, itemsInserted, itemsUpdated };
};
