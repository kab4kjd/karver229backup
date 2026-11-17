import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface ExpenseProductGroup {
  id: string;
  name: string;
  sort_order: number;
}

export interface ExpenseProductItem {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
}

export const useExpenseProductGroups = () => {
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["expense_product_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_product_groups")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as ExpenseProductGroup[];
    },
    enabled: isReady,
    staleTime: 5 * 60 * 1000,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["expense_product_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_product_items")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as ExpenseProductItem[];
    },
    enabled: isReady,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["expense_product_groups"] });
    queryClient.invalidateQueries({ queryKey: ["expense_product_items"] });
  };

  const addGroup = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tên nhóm không được để trống");
      const { error } = await supabase.from("expense_product_groups").insert({ name: trimmed });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã thêm nhóm sản phẩm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const renameGroup = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tên nhóm không được để trống");
      const { error } = await supabase.from("expense_product_groups").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã đổi tên nhóm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_product_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã xoá nhóm sản phẩm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: async ({ group_id, name }: { group_id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tên sản phẩm không được để trống");
      const { error } = await supabase.from("expense_product_items").insert({ group_id, name: trimmed });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã thêm sản phẩm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const renameItem = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Tên sản phẩm không được để trống");
      const { error } = await supabase.from("expense_product_items").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã đổi tên sản phẩm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_product_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Thành công", description: "Đã xoá sản phẩm" }); },
    onError: (e: any) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return {
    groups,
    items,
    isLoading: groupsLoading || itemsLoading,
    addGroup,
    renameGroup,
    deleteGroup,
    addItem,
    renameItem,
    deleteItem,
  };
};
