import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface RoomGroup {
  id: string;
  name: string;
  sort_order: number;
  block_minutes: number;
}

export interface PriceListItem {
  id: string;
  room_group_id: string;
  item_id: string;
  custom_price: number;
}

export const useRoomGroups = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const { isReady } = useAuthReady();

  const { data: roomGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["room_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_groups")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as RoomGroup[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const { data: priceListItems = [], isLoading: pricesLoading } = useQuery({
    queryKey: ["price_list_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("*");
      if (error) throw error;
      return data as PriceListItem[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && isReady,
  });

  const addGroup = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = roomGroups.length > 0 ? Math.max(...roomGroups.map(g => g.sort_order)) + 1 : 0;
      const { data, error } = await supabase
        .from("room_groups")
        .insert({ name, sort_order: maxOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_groups"] });
      toast({ title: "Thành công", description: "Đã thêm nhóm phòng" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể thêm nhóm phòng", variant: "destructive" });
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, name, block_minutes }: { id: string; name?: string; block_minutes?: number }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (block_minutes !== undefined) updates.block_minutes = block_minutes;
      const { error } = await supabase
        .from("room_groups")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_groups"] });
      toast({ title: "Thành công", description: "Đã cập nhật nhóm phòng" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật nhóm phòng", variant: "destructive" });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("room_groups")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_groups"] });
      queryClient.invalidateQueries({ queryKey: ["price_list_items"] });
      toast({ title: "Thành công", description: "Đã xóa nhóm phòng" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa nhóm phòng", variant: "destructive" });
    },
  });

  const setPriceOverride = useMutation({
    mutationFn: async ({ roomGroupId, itemId, customPrice }: { roomGroupId: string; itemId: string; customPrice: number }) => {
      const { error } = await supabase
        .from("price_list_items")
        .upsert(
          { room_group_id: roomGroupId, item_id: itemId, custom_price: customPrice },
          { onConflict: "room_group_id,item_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price_list_items"] });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật giá", variant: "destructive" });
    },
  });

  const removePriceOverride = useMutation({
    mutationFn: async ({ roomGroupId, itemId }: { roomGroupId: string; itemId: string }) => {
      const { error } = await supabase
        .from("price_list_items")
        .delete()
        .eq("room_group_id", roomGroupId)
        .eq("item_id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price_list_items"] });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa giá tùy chỉnh", variant: "destructive" });
    },
  });

  const getGroupPriceMap = (groupId: string): Record<string, number> => {
    const map: Record<string, number> = {};
    priceListItems
      .filter(p => p.room_group_id === groupId)
      .forEach(p => { map[p.item_id] = p.custom_price; });
    return map;
  };

  return {
    roomGroups,
    priceListItems,
    isLoading: groupsLoading || pricesLoading,
    addGroup,
    updateGroup,
    deleteGroup,
    setPriceOverride,
    removePriceOverride,
    getGroupPriceMap,
  };
};
