import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getActiveDatabaseConfig } from "@/integrations/supabase/databaseConfig";
import {
  ensureTableHydratedFromFirestore,
  subscribeFirestoreTable,
} from "@/integrations/supabase/localDatabase";
import { normalizeVi } from "@/lib/normalize";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

let customerRealtimeRefCount = 0;
let unsubscribeCustomerRealtime: (() => void) | null = null;

export const useCustomers = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const qc = useQueryClient();
  const { isReady } = useAuthReady();

  useEffect(() => {
    if (!enabled || !isReady || getActiveDatabaseConfig().mode === "cloud") return;
    customerRealtimeRefCount++;
    if (customerRealtimeRefCount === 1) {
      const unsub = subscribeFirestoreTable("customers", () => {
        qc.invalidateQueries({ queryKey: ["customers"] });
      });
      unsubscribeCustomerRealtime = unsub;
    }
    return () => {
      customerRealtimeRefCount = Math.max(0, customerRealtimeRefCount - 1);
      if (customerRealtimeRefCount === 0 && unsubscribeCustomerRealtime) {
        unsubscribeCustomerRealtime();
        unsubscribeCustomerRealtime = null;
      }
    };
  }, [enabled, isReady, qc]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("customers" as any) as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as Customer[];
    },
    enabled: enabled && isReady,
    staleTime: 60 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customers"] });

  const addCustomer = useMutation({
    mutationFn: async (c: { name: string; phone?: string; address?: string; note?: string }) => {
      const name = c.name.trim();
      if (!name) throw new Error("Tên khách hàng không được để trống");

      if (getActiveDatabaseConfig().mode !== "cloud") {
        await ensureTableHydratedFromFirestore("customers", true);
        const { data: latestCustomers } = await (supabase.from("customers" as any) as any).select("*");
        const targetKey = normalizeVi(name);
        if (Array.isArray(latestCustomers) && latestCustomers.some((cust: any) => normalizeVi(cust.name || "") === targetKey)) {
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("customers" as any) as any).insert({
        name, phone: c.phone?.trim() || null, address: c.address?.trim() || null, note: c.note?.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã thêm khách hàng" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...c }: { id: string; name: string; phone?: string; address?: string; note?: string }) => {
      const name = c.name.trim();
      if (!name) throw new Error("Tên khách hàng không được để trống");
      const { error } = await (supabase.from("customers" as any) as any).update({
        name, phone: c.phone?.trim() || null, address: c.address?.trim() || null, note: c.note?.trim() || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã cập nhật khách hàng" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("customers" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã xoá khách hàng" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return { customers, isLoading, addCustomer, updateCustomer, deleteCustomer };
};
