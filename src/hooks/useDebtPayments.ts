import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface DebtPaymentRecord {
  id: string;
  invoice_id: string;
  amount: number;
  note: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

export const useDebtPayments = (invoiceId?: string) => {
  const { isReady } = useAuthReady();
  const { data = [], isLoading } = useQuery({
    queryKey: ["debt-payments", invoiceId || "all"],
    queryFn: async () => {
      const q = (supabase.from("debt_payments" as any) as any)
        .select("*")
        .order("paid_at", { ascending: false });
      const { data, error } = invoiceId ? await q.eq("invoice_id", invoiceId) : await q;
      if (error) throw error;
      return (data || []) as DebtPaymentRecord[];
    },
    enabled: isReady,
    staleTime: 60 * 1000,
  });
  return { payments: data, isLoading };
};
