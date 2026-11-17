import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface Expense {
  id: string;
  category_name: string;
  expense_date: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  product_category: string | null;
  product_name: string | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export const useExpenses = () => {
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: isReady,
  });

  const { data: expenseCategories = [], isLoading: catLoading } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ExpenseCategory[];
    },
    enabled: isReady,
  });

  const addExpense = useMutation({
    mutationFn: async (input: { category_name: string; expense_date: string; amount: number; note?: string; product_category?: string | null; product_name?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Chưa đăng nhập");
      const { error } = await supabase.from("expenses").insert({
        category_name: input.category_name,
        expense_date: input.expense_date,
        amount: input.amount,
        note: input.note || null,
        product_category: input.product_category || null,
        product_name: input.product_name || null,
        user_id: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Thành công", description: "Đã thêm chi phí" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const updateExpense = useMutation({
    mutationFn: async (input: { id: string; category_name: string; expense_date: string; amount: number; note?: string; product_category?: string | null; product_name?: string | null }) => {
      const { error } = await supabase.from("expenses").update({
        category_name: input.category_name,
        expense_date: input.expense_date,
        amount: input.amount,
        note: input.note || null,
        product_category: input.product_category || null,
        product_name: input.product_name || null,
      } as any).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Thành công", description: "Đã cập nhật chi phí" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Thành công", description: "Đã xóa chi phí" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const addExpenseCategory = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tên hạng mục không được để trống");
      const { error } = await supabase.from("expense_categories").insert({ name: trimmed });
      if (error) throw error;
      return trimmed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      toast({ title: "Thành công", description: "Đã thêm hạng mục" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const updateExpenseCategory = useMutation({
    mutationFn: async (input: { id: string; oldName: string; newName: string }) => {
      const trimmed = input.newName.trim();
      if (!trimmed) throw new Error("Tên hạng mục không được để trống");
      const { error } = await supabase.from("expense_categories").update({ name: trimmed }).eq("id", input.id);
      if (error) throw error;
      // Cascade rename across existing expenses
      if (trimmed !== input.oldName) {
        await supabase.from("expenses").update({ category_name: trimmed }).eq("category_name", input.oldName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Thành công", description: "Đã cập nhật hạng mục" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteExpenseCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      toast({ title: "Thành công", description: "Đã xóa hạng mục" });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteExpensesBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("expenses").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Thành công", description: `Đã xóa ${ids.length} chi phí` });
    },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return {
    expenses,
    expenseCategories,
    isLoading: expensesLoading || catLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    deleteExpensesBulk,
  };
};