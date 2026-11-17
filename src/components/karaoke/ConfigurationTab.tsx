import { useState, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Loader2, Settings, Shield, DoorOpen, Printer, Tag, Layout, Palette, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { Room } from "@/hooks/useRooms";
import SortableItemsList from "./SortableItemsList";
import SortableCategoriesList from "./SortableCategoriesList";
import ExcelImportExportButtons from "./ExcelImportExportButtons";
import { useQueryClient } from "@tanstack/react-query";

const UserManagement = lazy(() => import("./UserManagement"));
const RoomManagement = lazy(() => import("./RoomManagement"));
const PrintTemplateSettings = lazy(() => import("./PrintTemplateSettings"));
const LayoutSettings = lazy(() => import("./LayoutSettings"));
const ThemeSettings = lazy(() => import("./ThemeSettings"));
const PriceListManagement = lazy(() => import("./PriceListManagement"));
const DatabaseManagement = lazy(() => import("./DatabaseManagement"));

const SubTabFallback = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
);

export interface MenuItem {
  name: string;
  price: number;
  customQuantity?: boolean;
}

export interface ItemCategories {
  [key: string]: MenuItem[];
}

interface ConfigSubPermissions {
  can_config_rooms: boolean;
  can_config_items: boolean;
  can_config_pricelist: boolean;
  can_config_layout: boolean;
  can_config_print: boolean;
}

interface ConfigurationTabProps {
  isAdmin: boolean;
  currentUserId: string;
  rooms: Room[];
  onAddRoom: (name: string, price: number, blockMinutes?: number, timeSlots?: import("@/hooks/useRooms").RoomTimeSlot[], useTimeSlots?: boolean, minPrintMinutes?: number) => void;
  onUpdateRoom: (id: string, name: string, price: number, groupId?: string, blockMinutes?: number, timeSlots?: import("@/hooks/useRooms").RoomTimeSlot[], useTimeSlots?: boolean, minPrintMinutes?: number) => void;
  onDeleteRoom: (id: string) => void;
  onReorderRooms: (rooms: Room[]) => void;
  defaultMinPrintMinutes?: number;
  onUpdateDefaultMinPrintMinutes?: (minutes: number) => void;
  leftWidth: number;
  onLeftWidthChange: (value: number) => void;
  appTitle: string;
  onAppTitleChange: (value: string) => void;
  appSubtitle: string;
  onAppSubtitleChange: (value: string) => void;
  cardOrder: import("@/hooks/useCardLayout").CardId[];
  cardHeights: Record<import("@/hooks/useCardLayout").CardId, number | null>;
  onCardOrderChange: (order: import("@/hooks/useCardLayout").CardId[]) => void;
  onCardHeightChange: (id: import("@/hooks/useCardLayout").CardId, height: number | null) => void;
  subPermissions?: Partial<ConfigSubPermissions>;
}

const ConfigurationTab = ({
  isAdmin,
  currentUserId,
  rooms,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onReorderRooms,
  defaultMinPrintMinutes,
  onUpdateDefaultMinPrintMinutes,
  leftWidth,
  onLeftWidthChange,
  appTitle,
  onAppTitleChange,
  appSubtitle,
  onAppSubtitleChange,
  cardOrder,
  cardHeights,
  onCardOrderChange,
  onCardHeightChange,
  subPermissions,
}: ConfigurationTabProps) => {
  const { 
    categories: dbCategories, 
    items: dbItems, 
    isLoading,
    addCategory,
    deleteCategory,
    renameCategory,
    updateCategoryOrder,
    addItem,
    updateItem,
    deleteItem,
    updateItemOrder
  } = useCategories();

  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCustomQty, setNewItemCustomQty] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; categoryId: string } | null>(null);

  // Tự động chọn category đầu tiên nếu chưa có
  const activeCategoryId = selectedCategory || (dbCategories.length > 0 ? dbCategories[0].id : "");

  const handleImportItems = async (file: File) => {
    const { importItemsFromExcel } = await import("@/lib/excelConfig");
    const res = await importItemsFromExcel(file, dbCategories, dbItems);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["items"] }),
    ]);
    return `Loại: +${res.catsInserted}/~${res.catsUpdated} • Món: +${res.itemsInserted}/~${res.itemsUpdated}`;
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên loại món",
        variant: "destructive",
      });
      return;
    }

    if (dbCategories.some(cat => cat.name === newCategoryName)) {
      toast({
        title: "Lỗi",
        description: "Loại món này đã tồn tại",
        variant: "destructive",
      });
      return;
    }

    await addCategory.mutateAsync(newCategoryName);
    setNewCategoryName("");
  };


  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    await deleteCategory.mutateAsync(categoryId);
    if (selectedCategory === categoryId) {
      setSelectedCategory("");
    }
  };

  const handleAddItem = async () => {
    const categoryToUse = selectedCategory || activeCategoryId;
    if (!categoryToUse) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn hoặc tạo loại món trước khi thêm món",
        variant: "destructive",
      });
      return;
    }

    if (!newItemName.trim() || !newItemPrice) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ tên và giá món",
        variant: "destructive",
      });
      return;
    }

    const price = Number(newItemPrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Lỗi",
        description: "Giá món không hợp lệ (phải từ 0đ trở lên)",
        variant: "destructive",
      });
      return;
    }

    const categoryItems = dbItems.filter(item => item.category_id === categoryToUse);
    if (categoryItems.some(item => item.name.toLowerCase().trim() === newItemName.toLowerCase().trim())) {
      toast({
        title: "Lỗi",
        description: "Món này đã tồn tại trong danh mục",
        variant: "destructive",
      });
      return;
    }

    await addItem.mutateAsync({ 
      name: newItemName.trim(), 
      price, 
      category_id: categoryToUse,
      custom_quantity: newItemCustomQty,
    });

    setNewItemName("");
    setNewItemPrice("");
    setNewItemCustomQty(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem.mutateAsync(itemId);
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !newItemName.trim() || !newItemPrice) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin món",
        variant: "destructive",
      });
      return;
    }

    const price = Number(newItemPrice);
    if (isNaN(price) || price < 0) {
      toast({
        title: "Lỗi",
        description: "Giá món không hợp lệ (phải từ 0đ trở lên)",
        variant: "destructive",
      });
      return;
    }

    await updateItem.mutateAsync({ 
      id: editingItem.id, 
      name: newItemName.trim(), 
      price,
      custom_quantity: newItemCustomQty,
    });

    setEditingItem(null);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemCustomQty(false);
  };

  const startEditItem = (itemId: string, categoryId: string, itemName: string, itemPrice: number, customQty?: boolean) => {
    setEditingItem({ id: itemId, categoryId });
    setNewItemName(itemName);
    setNewItemPrice(itemPrice.toString());
    setSelectedCategory(categoryId);
    setNewItemCustomQty(!!customQty);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemCustomQty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // For admin: every sub-tab is allowed. For staff: gated by subPermissions.
  const canRooms = isAdmin || subPermissions?.can_config_rooms !== false;
  const canItems = isAdmin || subPermissions?.can_config_items !== false;
  const canPricelist = isAdmin || subPermissions?.can_config_pricelist === true;
  const canLayout = isAdmin || subPermissions?.can_config_layout === true;
  const canPrint = isAdmin || subPermissions?.can_config_print === true;

  const visibleTabs: { value: string; label: string; icon: any }[] = [];
  if (canRooms) visibleTabs.push({ value: "rooms", label: "Phòng", icon: DoorOpen });
  if (canItems) visibleTabs.push({ value: "items", label: "Món ăn", icon: Settings });
  if (canPricelist) visibleTabs.push({ value: "pricelist", label: "Bảng giá", icon: Tag });
  if (canLayout) visibleTabs.push({ value: "layout", label: "Bố cục", icon: Layout });
  if (canPrint) visibleTabs.push({ value: "print", label: "Mẫu in", icon: Printer });
  visibleTabs.push({ value: "theme", label: "Giao diện", icon: Palette });
  if (isAdmin) visibleTabs.push({ value: "users", label: "Người dùng", icon: Shield });
  if (isAdmin) visibleTabs.push({ value: "database", label: "Cơ sở dữ liệu", icon: Database });

  if (visibleTabs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Bạn không có quyền truy cập tab con nào trong Cấu hình</p>
      </Card>
    );
  }

  const defaultTab = visibleTabs[0].value;

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div className="overflow-x-auto flex justify-start">
        <TabsList className="inline-flex h-auto w-auto justify-start gap-1 p-1">
          {visibleTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm">
              <Icon className="h-4 w-4 mr-1.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>


      <TabsContent value="rooms" className="space-y-6">
        <Suspense fallback={<SubTabFallback />}>
          <RoomManagement 
            rooms={rooms}
            onAddRoom={onAddRoom}
            onUpdateRoom={onUpdateRoom}
            onDeleteRoom={onDeleteRoom}
            onReorderRooms={onReorderRooms}
            defaultMinPrintMinutes={defaultMinPrintMinutes}
            onUpdateDefaultMinPrintMinutes={onUpdateDefaultMinPrintMinutes}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="pricelist" className="space-y-6">
        <Suspense fallback={<SubTabFallback />}>
          <PriceListManagement rooms={rooms} onUpdateRoom={onUpdateRoom} />
        </Suspense>
      </TabsContent>

      <TabsContent value="items" className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Quản Lý Loại Món & Món Ăn</h3>
            <ExcelImportExportButtons
              onExport={async () => {
                const { exportItemsToExcel } = await import("@/lib/excelConfig");
                await exportItemsToExcel(dbCategories, dbItems);
              }}
              onImport={handleImportItems}
            />
          </div>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Tên loại món (VD: Bia, Nước ngọt...)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} className="gap-2">
              <Plus className="h-4 w-4" />
              Thêm Loại
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-2">Kéo thả để sắp xếp thứ tự</p>
          <SortableCategoriesList
            categories={dbCategories}
            itemCounts={Object.fromEntries(
              dbCategories.map(cat => [cat.id, dbItems.filter(item => item.category_id === cat.id).length])
            )}
            onReorder={(updates) => updateCategoryOrder.mutateAsync(updates)}
            onDelete={handleDeleteCategory}
            onRename={(id, newName) => renameCategory.mutateAsync({ id, name: newName })}
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Quản Lý Món Ăn</h3>
            {editingItem && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                Đang chỉnh sửa món
              </span>
            )}
          </div>
          
          <div className="space-y-3 mb-4">
            <div>
              <Label>Chọn loại món</Label>
              <Select 
                value={activeCategoryId} 
                onValueChange={(val) => {
                  setSelectedCategory(val);
                  if (editingItem && editingItem.categoryId !== val) {
                    cancelEdit();
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Chọn loại món" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {dbCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeCategoryId && (
              <>
                <div>
                  <Label>Tên món</Label>
                  <Input
                    placeholder="VD: Bia Tiger"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editingItem) handleUpdateItem();
                        else handleAddItem();
                      }
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Giá (VNĐ)</Label>
                  <Input
                    type="number"
                    placeholder="VD: 25000"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editingItem) handleUpdateItem();
                        else handleAddItem();
                      }
                    }}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="custom-qty"
                    checked={newItemCustomQty}
                    onCheckedChange={(v) => setNewItemCustomQty(!!v)}
                  />
                  <Label htmlFor="custom-qty" className="text-sm font-normal cursor-pointer">
                    Tùy chỉnh số lượng khi thêm vào hóa đơn
                  </Label>
                </div>
                <div className="flex gap-2 pt-1">
                  {editingItem ? (
                    <>
                      <Button onClick={handleUpdateItem} className="flex-1 gap-2">
                        <Pencil className="h-4 w-4" />
                        Lưu Cập Nhật
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" className="flex-1">
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleAddItem} className="w-full gap-2 font-medium">
                      <Plus className="h-4 w-4" />
                      Thêm Món
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {activeCategoryId && dbItems.filter(item => item.category_id === activeCategoryId).length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Kéo thả để sắp xếp thứ tự</p>
              <SortableItemsList
                items={dbItems.filter(item => item.category_id === activeCategoryId)}
                onReorder={(updates) => updateItemOrder.mutateAsync(updates)}
                onEdit={startEditItem}
                onDelete={handleDeleteItem}
              />
            </div>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="layout" className="space-y-6">
        <Suspense fallback={<SubTabFallback />}>
          <LayoutSettings
            leftWidth={leftWidth}
            onLeftWidthChange={onLeftWidthChange}
            appTitle={appTitle}
            onAppTitleChange={onAppTitleChange}
            appSubtitle={appSubtitle}
            onAppSubtitleChange={onAppSubtitleChange}
            cardOrder={cardOrder}
            cardHeights={cardHeights}
            onCardOrderChange={onCardOrderChange}
            onCardHeightChange={onCardHeightChange}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value="print" className="space-y-6">
        <Suspense fallback={<SubTabFallback />}>
          <PrintTemplateSettings />
        </Suspense>
      </TabsContent>

      <TabsContent value="theme" className="space-y-6">
        <Suspense fallback={<SubTabFallback />}>
          <ThemeSettings isAdmin={isAdmin} />
        </Suspense>
      </TabsContent>

      {isAdmin && (
        <TabsContent value="users">
          <Suspense fallback={<SubTabFallback />}>
            <UserManagement currentUserId={currentUserId} />
          </Suspense>
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="database" className="space-y-6">
          <Suspense fallback={<SubTabFallback />}>
            <DatabaseManagement />
          </Suspense>
        </TabsContent>
      )}
    </Tabs>
  );
};

export default ConfigurationTab;
