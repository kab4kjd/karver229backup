import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { InvoiceItem } from "@/pages/Index";
import { z } from "zod";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getActiveDatabaseConfig } from "@/integrations/supabase/databaseConfig";
import {
  atomicDeleteInvoices,
  atomicSaveInvoice,
  atomicUpdateInvoice,
  checkDuplicateInvoiceOnServer,
  getInvoiceFromFirestoreServer,
  subscribeFirestoreTable,
  type DuplicateInvoiceInfo,
} from "@/integrations/supabase/localDatabase";

const invoiceSchema = z.object({
  roomName: z.string({
    required_error: "Vui lòng chọn phòng",
    invalid_type_error: "Tên phòng không hợp lệ",
  }).trim().min(1, "Vui lòng chọn phòng").max(100, "Tên phòng quá dài"),
  roomPrice: z.number({
    required_error: "Thiếu giá phòng",
    invalid_type_error: "Giá phòng không hợp lệ",
  }).min(0, "Giá phòng không được âm"),
  checkInDate: z.string({
    required_error: "Vui lòng chọn ngày vào",
    invalid_type_error: "Ngày vào không hợp lệ",
  }).min(1, "Vui lòng chọn ngày vào"),
  checkOutDate: z.string({
    required_error: "Vui lòng chọn ngày ra",
    invalid_type_error: "Ngày ra không hợp lệ",
  }).min(1, "Vui lòng chọn ngày ra"),
  checkIn: z.string({
    required_error: "Vui lòng nhập giờ vào",
    invalid_type_error: "Giờ vào không hợp lệ",
  }).min(1, "Vui lòng nhập giờ vào"),
  checkOut: z.string({
    required_error: "Vui lòng nhập giờ ra",
    invalid_type_error: "Giờ ra không hợp lệ",
  }).min(1, "Vui lòng nhập giờ ra"),
  duration: z.number({
    required_error: "Thiếu thời lượng",
    invalid_type_error: "Thời lượng không hợp lệ",
  }).min(0, "Thời lượng không được âm"),
  discountType: z.enum(["percentage", "fixed"], {
    required_error: "Vui lòng chọn loại giảm giá",
    invalid_type_error: "Loại giảm giá không hợp lệ",
  }),
  discountValue: z.number({
    required_error: "Giá trị giảm giá không hợp lệ",
    invalid_type_error: "Giá trị giảm giá không được âm",
  }).min(0, "Giá trị giảm giá không được âm"),
  taxRate: z.number({
    required_error: "Thuế/phí không hợp lệ",
    invalid_type_error: "Thuế/phí không hợp lệ",
  }).min(0, "Thuế/phí không được âm").max(100, "Thuế/phí tối đa 100%"),
  totalAmount: z.number({
    required_error: "Tổng tiền không hợp lệ",
    invalid_type_error: "Tổng tiền không hợp lệ",
  }).min(0, "Tổng tiền không được âm"),
});

const invoiceItemSchema = z.object({
  name: z.string({
    required_error: "Tên món không được để trống",
    invalid_type_error: "Tên món không hợp lệ",
  }).trim().min(1, "Tên món không được để trống").max(200, "Tên món quá dài"),
  price: z.number({
    required_error: "Giá món không được để trống",
    invalid_type_error: "Giá món không hợp lệ",
  }).min(0, "Giá món không được âm"),
  quantity: z.number({
    required_error: "Số lượng không được để trống",
    invalid_type_error: "Số lượng không hợp lệ",
  }).positive("Số lượng phải lớn hơn 0"),
  category: z.string().optional().nullable(),
});

export type PaymentStatus = "paid" | "partial" | "debt";

export interface DBInvoice {
  id: string;
  room_name: string;
  room_price: number;
  check_in: string;
  check_out: string;
  duration: number;
  discount_type: string | null;
  discount_value: number;
  tax_rate: number;
  total_amount: number;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  staff_name: string | null;
}

interface SaveInvoiceParams {
  roomName: string;
  roomPrice: number;
  checkInDate: string;
  checkOutDate: string;
  checkIn: string;
  checkOut: string;
  duration: number;
  items: InvoiceItem[];
  discountType: "percentage" | "fixed";
  discountValue: number;
  taxRate: number;
  totalAmount: number;
  staffName?: string;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  customerName?: string;
}

interface UpdateInvoiceParams extends Omit<SaveInvoiceParams, "staffName"> {
  id: string;
}

function parseTimeComponents(timeStr: string) {
  const match = (timeStr || "").trim().match(/(\d{1,2}):(\d{1,2})/);
  if (!match) return "00:00";
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}

function parseDateString(dateStr: string) {
  if (!dateStr || !dateStr.trim()) {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
  }
  return dateStr.trim();
}

export function validateAndParseDateTime(params: {
  checkInDate: string; checkIn: string; checkOutDate: string; checkOut: string;
  roomPrice?: number;
}) {
  const cleanInTime = parseTimeComponents(params.checkIn);
  const cleanOutTime = parseTimeComponents(params.checkOut);
  const cleanInDate = parseDateString(params.checkInDate);
  const cleanOutDate = parseDateString(params.checkOutDate);

  const checkInAt = new Date(`${cleanInDate}T${cleanInTime}:00`);
  const checkOutAt = new Date(`${cleanOutDate}T${cleanOutTime}:00`);

  if (Number.isNaN(checkInAt.getTime()) || Number.isNaN(checkOutAt.getTime())) {
    throw new Error("Thời gian vào/ra không hợp lệ. Vui lòng kiểm tra lại ngày và giờ.");
  }
  // Cho phép check-out cùng lúc hoặc sau check-in
  if (checkOutAt < checkInAt) {
    throw new Error("Thời gian giờ ra (check-out) phải cùng lúc hoặc sau giờ vào (check-in)");
  }
  return { checkInAt, checkOutAt };
}

function sanitizeInvoiceParams<T extends SaveInvoiceParams | UpdateInvoiceParams>(params: T): T {
  const safeItems = (params.items || [])
    .filter(item => item && typeof item.name === "string" && item.name.trim() !== "")
    .map(item => ({
      ...item,
      name: item.name.trim(),
      price: Number.isNaN(Number(item.price)) ? 0 : Number(item.price),
      quantity: Number.isNaN(Number(item.quantity)) || Number(item.quantity) <= 0 ? 1 : Number(item.quantity),
      category: item.category || "",
    }));

  return {
    ...params,
    roomName: (params.roomName || "").trim(),
    roomPrice: Number.isNaN(Number(params.roomPrice)) ? 0 : Number(params.roomPrice),
    checkInDate: parseDateString(params.checkInDate),
    checkOutDate: parseDateString(params.checkOutDate),
    checkIn: parseTimeComponents(params.checkIn),
    checkOut: parseTimeComponents(params.checkOut),
    duration: Number.isNaN(Number(params.duration)) ? 0 : Math.max(0, Number(params.duration)),
    discountType: params.discountType === "fixed" ? "fixed" : "percentage",
    discountValue: Number.isNaN(Number(params.discountValue)) ? 0 : Math.max(0, Number(params.discountValue)),
    taxRate: Number.isNaN(Number(params.taxRate)) ? 0 : Math.min(100, Math.max(0, Number(params.taxRate))),
    totalAmount: Number.isNaN(Number(params.totalAmount)) ? 0 : Math.max(0, Number(params.totalAmount)),
    paidAmount: Number.isNaN(Number(params.paidAmount)) ? 0 : Math.max(0, Number(params.paidAmount)),
    paymentStatus: params.paymentStatus || "paid",
    customerName: params.customerName?.trim() || undefined,
    items: safeItems,
  };
}

function validateInvoice(rawParams: SaveInvoiceParams | UpdateInvoiceParams) {
  const params = sanitizeInvoiceParams(rawParams);
  const result = invoiceSchema.safeParse(params);
  if (!result.success) {
    const firstErr = result.error.errors[0];
    const fieldName = firstErr.path.join(".");
    const msg = firstErr.message === "Required" ? `Thiếu thông tin trường ${fieldName}` : firstErr.message;
    throw new Error(msg);
  }
  for (const item of params.items) {
    const r = invoiceItemSchema.safeParse(item);
    if (!r.success) {
      const firstErr = r.error.errors[0];
      const msg = firstErr.message === "Required" ? `Món ${item.name}: Thiếu thông tin` : `Món ${item.name}: ${firstErr.message}`;
      throw new Error(msg);
    }
  }
  return params;
}

// Singleton subscription manager so multiple hook callers share one Firestore listener per collection
let invoiceRealtimeRefCount = 0;
let unsubscribeRealtime: (() => void) | null = null;
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

function isFirestoreMode() {
  return getActiveDatabaseConfig().mode !== "cloud";
}

export async function checkDuplicateInvoice(params: {
  roomName: string;
  checkInDate: string;
  checkIn: string;
  checkOutDate: string;
  checkOut: string;
}): Promise<DuplicateInvoiceInfo | null> {
  if (!isFirestoreMode()) return null;
  try {
    const { checkInAt } = validateAndParseDateTime(params);
    return await checkDuplicateInvoiceOnServer(params.roomName, checkInAt.toISOString());
  } catch {
    return null;
  }
}

export const useInvoices = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  useEffect(() => {
    if (!enabled || !isReady || !isFirestoreMode()) return;

    const scheduleInvalidate = () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      invalidateTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }, 80);
    };

    invoiceRealtimeRefCount++;
    if (invoiceRealtimeRefCount === 1) {
      const unsubInvoices = subscribeFirestoreTable("invoices", scheduleInvalidate);
      const unsubItems = subscribeFirestoreTable("invoice_items", scheduleInvalidate);
      const handleStorage = (e: StorageEvent) => {
        if (e.key === "karaoke_db_v2_invoices" || e.key === "karaoke_db_v2_invoice_items") {
          scheduleInvalidate();
        }
      };
      window.addEventListener("storage", handleStorage);
      unsubscribeRealtime = () => {
        unsubInvoices();
        unsubItems();
        window.removeEventListener("storage", handleStorage);
        if (invalidateTimer) {
          clearTimeout(invalidateTimer);
          invalidateTimer = null;
        }
      };
    }

    return () => {
      invoiceRealtimeRefCount = Math.max(0, invoiceRealtimeRefCount - 1);
      if (invoiceRealtimeRefCount === 0 && unsubscribeRealtime) {
        unsubscribeRealtime();
        unsubscribeRealtime = null;
      }
    };
  }, [enabled, isReady, queryClient]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, invoice_items (*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const saveInvoice = useMutation({
    mutationFn: async (params: SaveInvoiceParams) => {
      const cleanParams = validateInvoice(params);
      const { checkInAt, checkOutAt } = validateAndParseDateTime(cleanParams);
      const durationInMinutes = Math.round(cleanParams.duration * 60);

      const invoicePayload = {
        room_name: cleanParams.roomName,
        room_price: cleanParams.roomPrice,
        check_in: checkInAt.toISOString(),
        check_out: checkOutAt.toISOString(),
        duration: durationInMinutes,
        discount_type: cleanParams.discountType,
        discount_value: cleanParams.discountValue,
        tax_rate: cleanParams.taxRate,
        total_amount: cleanParams.totalAmount,
        staff_name: params.staffName || null,
        paid_amount: cleanParams.paidAmount,
        payment_status: cleanParams.paymentStatus,
        customer_name: cleanParams.customerName?.trim() || null,
      };

      const itemPayloads = cleanParams.items.map((item) => ({
        item_name: item.name,
        item_price: item.price,
        quantity: item.quantity,
        category: item.category || "",
      }));

      if (isFirestoreMode()) {
        return await atomicSaveInvoice(invoicePayload, itemPayloads);
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoicePayload as any)
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      if (itemPayloads.length > 0) {
        const { error: itemsError } = await supabase.from("invoice_items").insert(
          itemPayloads.map((it) => ({
            invoice_id: invoice.id,
            ...it,
          }))
        );
        if (itemsError) throw itemsError;
      }
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Đã lưu", description: "Hóa đơn đã được lưu vào cơ sở dữ liệu" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể lưu hóa đơn", variant: "destructive" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async (params: UpdateInvoiceParams) => {
      const cleanParams = validateInvoice(params);
      const { checkInAt, checkOutAt } = validateAndParseDateTime(cleanParams);
      const durationInMinutes = Math.round(cleanParams.duration * 60);

      const invoiceUpdates = {
        room_name: cleanParams.roomName,
        room_price: cleanParams.roomPrice,
        check_in: checkInAt.toISOString(),
        check_out: checkOutAt.toISOString(),
        duration: durationInMinutes,
        discount_type: cleanParams.discountType,
        discount_value: cleanParams.discountValue,
        tax_rate: cleanParams.taxRate,
        total_amount: cleanParams.totalAmount,
        paid_amount: cleanParams.paidAmount,
        payment_status: cleanParams.paymentStatus,
        customer_name: cleanParams.customerName?.trim() || null,
      };

      const itemPayloads = cleanParams.items.map((item) => ({
        item_name: item.name,
        item_price: item.price,
        quantity: item.quantity,
        category: item.category || "",
      }));

      if (isFirestoreMode()) {
        return await atomicUpdateInvoice(params.id, invoiceUpdates, itemPayloads);
      }

      const { error: invoiceError } = await supabase
        .from("invoices")
        .update(invoiceUpdates as any)
        .eq("id", params.id);
      if (invoiceError) throw invoiceError;

      const { error: deleteItemsError } = await supabase.from("invoice_items").delete().eq("invoice_id", params.id);
      if (deleteItemsError) throw deleteItemsError;

      if (itemPayloads.length > 0) {
        const { error: itemsError } = await supabase.from("invoice_items").insert(
          itemPayloads.map((it) => ({
            invoice_id: params.id,
            ...it,
          }))
        );
        if (itemsError) throw itemsError;
      }
      return { id: params.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Đã cập nhật", description: "Hóa đơn đã được cập nhật" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật hóa đơn", variant: "destructive" });
    },
  });

  const payDebt = useMutation({
    mutationFn: async ({
      id, paidAmount, customerName, note, paymentDelta,
    }: {
      id: string;
      paidAmount: number;
      customerName?: string;
      note?: string;
      /** Optional incremental payment amount to log into debt_payments history */
      paymentDelta?: number;
    }) => {
      let inv: any = null;
      if (isFirestoreMode()) {
        inv = await getInvoiceFromFirestoreServer(id);
        if (!inv) {
          throw new Error("Hóa đơn này không còn tồn tại hoặc vừa bị tài khoản khác xóa.");
        }
      } else {
        const { data, error: fetchError } = await supabase
          .from("invoices")
          .select("total_amount, paid_amount")
          .eq("id", id)
          .single();
        if (fetchError) throw fetchError;
        inv = data;
      }

      const newStatus: PaymentStatus = paidAmount >= inv.total_amount ? "paid" : paidAmount > 0 ? "partial" : "debt";

      const updatePayload: Record<string, any> = { paid_amount: paidAmount, payment_status: newStatus };
      if (customerName !== undefined) updatePayload.customer_name = customerName?.trim() || null;

      const { error } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;

      // Record incremental payment into debt_payments history
      const delta = paymentDelta ?? (paidAmount - (inv.paid_amount || 0));
      if (delta > 0) {
        const { data: userData } = await supabase.auth.getUser();
        await (supabase.from("debt_payments" as any) as any).insert({
          invoice_id: id,
          amount: delta,
          note: note || null,
          created_by: userData.user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["debt-payments"] });
      toast({ title: "Đã cập nhật", description: "Trạng thái thanh toán đã được cập nhật" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật thanh toán", variant: "destructive" });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      if (isFirestoreMode()) {
        await atomicDeleteInvoices([id]);
        return;
      }
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Đã xóa", description: "Đã xóa hóa đơn" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa hóa đơn", variant: "destructive" });
    },
  });

  const deleteInvoicesBatch = useMutation({
    mutationFn: async (ids: string[]) => {
      const cleanIds = Array.from(new Set(ids.filter(Boolean)));
      if (cleanIds.length === 0) return 0;
      if (isFirestoreMode()) {
        await atomicDeleteInvoices(cleanIds);
        return cleanIds.length;
      }
      const { error } = await supabase.from("invoices").delete().in("id", cleanIds);
      if (error) throw error;
      return cleanIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({
        title: "Đã xóa",
        description: count && count > 1 ? `Đã xóa ${count} hóa đơn` : "Đã xóa hóa đơn",
      });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa hóa đơn", variant: "destructive" });
    },
  });

  const deleteAllInvoices = useMutation({
    mutationFn: async () => {
      if (isFirestoreMode()) {
        const allIds = (invoices as any[]).map((inv) => inv.id).filter(Boolean);
        await atomicDeleteInvoices(allIds);
        return;
      }
      const { error } = await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Đã xóa", description: "Đã xóa toàn bộ lịch sử hóa đơn" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa hóa đơn", variant: "destructive" });
    },
  });

  return {
    invoices,
    isLoading,
    saveInvoice,
    updateInvoice,
    deleteInvoice,
    deleteInvoicesBatch,
    deleteAllInvoices,
    payDebt,
  };
};

