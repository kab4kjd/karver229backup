import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useAuthReady } from "@/hooks/useAuthReady";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Tên loại món không được để trống").max(100, "Tên loại món không được quá 100 ký tự"),
});

const itemSchema = z.object({
  name: z.string().trim().min(1, "Tên món không được để trống").max(200, "Tên món không được quá 200 ký tự"),
  price: z.number().min(0, "Giá không được âm"),
  category_id: z.string().min(1, "ID loại món không hợp lệ"),
});

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  unit_multiplier: number;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  category_id: string;
  sort_order: number;
  custom_quantity?: boolean;
  shorthand?: string | null;
  import_shorthand?: string | null;
}

export const useCategories = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Item[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const validation = categorySchema.safeParse({ name });
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      const { data, error } = await supabase
        .from("categories")
        .insert({ name: validation.data.name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Thành công",
        description: "Đã thêm loại món mới",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm loại món",
        variant: "destructive",
      });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("items").delete().eq("category_id", id);
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: "Thành công",
        description: "Đã xóa loại món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa loại món",
        variant: "destructive",
      });
    },
  });

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const validation = categorySchema.safeParse({ name });
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }
      const { error } = await supabase
        .from("categories")
        .update({ name: validation.data.name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Thành công",
        description: "Đã đổi tên loại món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể đổi tên loại món",
        variant: "destructive",
      });
    },
  });

  const updateCategoryOrder = useMutation({
    mutationFn: async (categories: { id: string; sort_order: number }[]) => {
      const promises = categories.map(cat =>
        supabase
          .from("categories")
          .update({ sort_order: cat.sort_order })
          .eq("id", cat.id)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật thứ tự loại món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật thứ tự",
        variant: "destructive",
      });
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ name, price, category_id, custom_quantity }: { name: string; price: number; category_id: string; custom_quantity?: boolean }) => {
      const validation = itemSchema.safeParse({ name, price, category_id });
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      const validatedData = validation.data;
      const { data, error } = await supabase
        .from("items")
        .insert({
          name: validatedData.name,
          price: validatedData.price,
          category_id: validatedData.category_id,
          custom_quantity: !!custom_quantity,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: "Thành công",
        description: "Đã thêm món mới",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể thêm món",
        variant: "destructive",
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, name, price, custom_quantity }: { id: string; name: string; price: number; custom_quantity?: boolean }) => {
      const nameValidation = z.string().trim().min(1, "Tên món không được để trống").max(200, "Tên món không được quá 200 ký tự").safeParse(name);
      if (!nameValidation.success) {
        throw new Error(nameValidation.error.errors[0].message);
      }

      const priceValidation = z.number().min(0, "Giá không được âm").safeParse(price);
      if (!priceValidation.success) {
        throw new Error(priceValidation.error.errors[0].message);
      }

      const updatePayload: { name: string; price: number; custom_quantity?: boolean } = {
        name: nameValidation.data,
        price: priceValidation.data,
      };
      if (typeof custom_quantity === "boolean") updatePayload.custom_quantity = custom_quantity;

      const { data, error } = await supabase
        .from("items")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật món",
        variant: "destructive",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: "Thành công",
        description: "Đã xóa món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể xóa món",
        variant: "destructive",
      });
    },
  });

  const updateItemOrder = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      const promises = items.map(item =>
        supabase
          .from("items")
          .update({ sort_order: item.sort_order })
          .eq("id", item.id)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({
        title: "Thành công",
        description: "Đã cập nhật thứ tự món",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể cập nhật thứ tự",
        variant: "destructive",
      });
    },
  });

  return {
    categories,
    items,
    isLoading: categoriesLoading || itemsLoading,
    addCategory,
    deleteCategory,
    renameCategory,
    updateCategoryOrder,
    addItem,
    updateItem,
    deleteItem,
    updateItemOrder,
  };
};
