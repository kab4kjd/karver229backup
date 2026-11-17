import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Tag, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRoomGroups } from "@/hooks/useRoomGroups";
import { useCategories, type Category, type Item } from "@/hooks/useCategories";
import { Room } from "@/hooks/useRooms";

interface PriceListManagementProps {
  rooms: Room[];
  onUpdateRoom: (id: string, name: string, price: number, groupId?: string) => void;
}

const PriceListManagement = ({ rooms, onUpdateRoom }: PriceListManagementProps) => {
  const { roomGroups, priceListItems, addGroup, updateGroup, deleteGroup, setPriceOverride, removePriceOverride } = useRoomGroups();
  const { categories, items } = useCategories();
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên nhóm phòng", variant: "destructive" });
      return;
    }
    if (roomGroups.some(g => g.name === newGroupName.trim())) {
      toast({ title: "Lỗi", description: "Nhóm phòng này đã tồn tại", variant: "destructive" });
      return;
    }
    await addGroup.mutateAsync(newGroupName.trim());
    setNewGroupName("");
  };

  const handleDeleteGroup = async (id: string) => {
    // Remove group assignment from rooms
    rooms.forEach(room => {
      if ((room as any).groupId === id) {
        onUpdateRoom(room.id, room.name, room.price, undefined);
      }
    });
    await deleteGroup.mutateAsync(id);
    if (selectedGroupId === id) setSelectedGroupId("");
  };

  const handleSaveGroupName = async () => {
    if (!editingGroupId || !editingGroupName.trim()) return;
    await updateGroup.mutateAsync({ id: editingGroupId, name: editingGroupName.trim() });
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  const handlePriceChange = async (itemId: string, value: string) => {
    if (!selectedGroupId) return;
    const price = Number(value);
    if (!value.trim() || isNaN(price)) {
      await removePriceOverride.mutateAsync({ roomGroupId: selectedGroupId, itemId });
      return;
    }
    if (price < 0) return;
    await setPriceOverride.mutateAsync({ roomGroupId: selectedGroupId, itemId, customPrice: price });
  };

  const handleAssignRoom = (roomId: string, groupId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    onUpdateRoom(room.id, room.name, room.price, groupId || undefined);
  };

  const groupPriceOverrides = selectedGroupId
    ? Object.fromEntries(
        priceListItems
          .filter(p => p.room_group_id === selectedGroupId)
          .map(p => [p.item_id, p.custom_price])
      )
    : {};

  const filteredItems = selectedCategoryId
    ? items.filter(item => item.category_id === selectedCategoryId)
    : items;

  return (
    <div className="space-y-6">
      {/* Room Groups Management */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Quản Lý Nhóm Phòng
        </h3>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Tên nhóm phòng (VD: VIP, Thường...)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddGroup()}
          />
          <Button onClick={handleAddGroup} className="gap-2">
            <Plus className="h-4 w-4" />
            Thêm
          </Button>
        </div>

        {roomGroups.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên nhóm</TableHead>
                <TableHead>Số phòng</TableHead>
                <TableHead>Block (phút)</TableHead>
                <TableHead className="w-[100px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomGroups.map((group) => {
                const groupRoomCount = rooms.filter(r => (r as any).groupId === group.id).length;
                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      {editingGroupId === group.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSaveGroupName()}
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleSaveGroupName}>Lưu</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingGroupId(null)}>Hủy</Button>
                        </div>
                      ) : (
                        group.name
                      )}
                    </TableCell>
                    <TableCell>{groupRoomCount}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={group.block_minutes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) {
                            updateGroup.mutate({ id: group.id, block_minutes: val });
                          }
                        }}
                        className="h-8 w-[80px]"
                        min={1}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setEditingGroupName(group.name);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Assign rooms to groups */}
      {roomGroups.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Gán Phòng Vào Nhóm</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room) => (
              <div key={room.id} className="flex items-center gap-2 p-2 border rounded-md">
                <span className="font-medium min-w-[60px]">{room.name}</span>
                <Select
                  value={(room as any).groupId || "none"}
                  onValueChange={(val) => handleAssignRoom(room.id, val === "none" ? "" : val)}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Chọn nhóm" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="none">-- Không có nhóm --</SelectItem>
                    {roomGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Price list per group */}
      {roomGroups.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Bảng Giá Theo Nhóm
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Đặt giá riêng cho từng nhóm phòng. Để trống để sử dụng giá mặc định.
          </p>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <Label>Chọn nhóm phòng</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn nhóm phòng" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {roomGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Lọc theo loại món</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tất cả loại món" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Tất cả</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedGroupId && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên món</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Giá mặc định</TableHead>
                  <TableHead>Giá nhóm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const category = categories.find(c => c.id === item.category_id);
                  const overridePrice = groupPriceOverrides[item.id];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{category?.name || "-"}</TableCell>
                      <TableCell>{item.price.toLocaleString()}đ</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder={item.price.toLocaleString()}
                          value={overridePrice !== undefined ? overridePrice : ""}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className="h-8 w-[120px]"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
};

export default PriceListManagement;
