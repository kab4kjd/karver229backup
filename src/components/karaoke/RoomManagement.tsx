import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, GripVertical, Ban, Clock, Layers, Sparkles, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Room, type RoomTimeSlot, getDefaultMinPrintMinutes, setDefaultMinPrintMinutes } from "@/hooks/useRooms";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import ExcelImportExportButtons from "./ExcelImportExportButtons";
import { exportRoomsToExcel, importRoomsFromExcel } from "@/lib/excelConfig";
import { useQueryClient } from "@tanstack/react-query";
import { TimePicker24h } from "./TimePicker24h";

interface RoomManagementProps {
  rooms: Room[];
  onAddRoom: (name: string, price: number, blockMinutes?: number, timeSlots?: RoomTimeSlot[], useTimeSlots?: boolean, minPrintMinutes?: number) => void;
  onUpdateRoom: (id: string, name: string, price: number, groupId?: string, blockMinutes?: number, timeSlots?: RoomTimeSlot[], useTimeSlots?: boolean, minPrintMinutes?: number) => void;
  onDeleteRoom: (id: string) => void;
  onReorderRooms: (rooms: Room[]) => void;
  defaultMinPrintMinutes?: number;
  onUpdateDefaultMinPrintMinutes?: (minutes: number) => void;
}

const SortableRoomCard = ({
  room,
  effectiveDefaultMin,
  onEdit,
  onDelete,
}: {
  room: Room;
  effectiveDefaultMin: number;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-muted rounded-lg p-3 flex flex-col items-center gap-1 relative group"
    >
      <button
        className="absolute top-1 left-1 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="font-bold text-sm">{room.name}</span>
      {room.price === 0 ? (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Ban className="h-3 w-3" /> Không tính giờ
        </span>
      ) : room.useTimeSlots && (room.timeSlots?.length ?? 0) > 0 ? (
        <>
          <span className="text-[11px] text-primary font-medium flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded">
            <Clock className="h-3 w-3" /> {room.timeSlots?.length} khung giờ
          </span>
          <span className="text-[11px] text-muted-foreground text-center">
            In: {room.min_print_minutes !== undefined ? `${room.min_print_minutes}p` : `${effectiveDefaultMin}p`}
          </span>
        </>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">
            {room.price.toLocaleString("vi-VN")}đ/h
          </span>
          <span className="text-xs text-muted-foreground text-center">
            Block: {room.block_minutes ?? 5}p • In: {room.min_print_minutes !== undefined ? `${room.min_print_minutes}p` : `${effectiveDefaultMin}p`}
          </span>
        </>
      )}
      <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(room)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onDelete(room)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

const RoomManagement = ({
  rooms,
  onAddRoom,
  onUpdateRoom,
  onDeleteRoom,
  onReorderRooms,
  defaultMinPrintMinutes,
  onUpdateDefaultMinPrintMinutes,
}: RoomManagementProps) => {
  const queryClient = useQueryClient();
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrice, setNewRoomPrice] = useState("");
  const [newBlockMinutes, setNewBlockMinutes] = useState("60");
  const [newMinPrintMinutes, setNewMinPrintMinutes] = useState<string>("");
  const [noTimeCharge, setNoTimeCharge] = useState(false);
  const [useTimeSlots, setUseTimeSlots] = useState(false);
  const [timeSlots, setTimeSlots] = useState<RoomTimeSlot[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const effectiveDefaultMin = defaultMinPrintMinutes !== undefined ? defaultMinPrintMinutes : getDefaultMinPrintMinutes();
  const [globalMinInput, setGlobalMinInput] = useState<string>(effectiveDefaultMin.toString());

  useEffect(() => {
    setGlobalMinInput(effectiveDefaultMin.toString());
  }, [effectiveDefaultMin]);

  const handleSaveGlobalMin = () => {
    const val = Math.max(0, Math.round(Number(globalMinInput) || 0));
    if (onUpdateDefaultMinPrintMinutes) {
      onUpdateDefaultMinPrintMinutes(val);
    } else {
      setDefaultMinPrintMinutes(val);
    }
    toast({
      title: "Đã lưu cấu hình",
      description: `Thời gian tối thiểu khi in hóa đơn chung toàn quán: ${val} phút (nhập 0 để cho phép in tự do).`,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rooms.findIndex((r) => r.id === active.id);
      const newIndex = rooms.findIndex((r) => r.id === over.id);
      const reordered = arrayMove(rooms, oldIndex, newIndex);
      onReorderRooms(reordered);
    }
  };

  const handleAddTimeSlot = () => {
    const p = Number(newRoomPrice) || 200000;
    const roomBlock = Number(newBlockMinutes) || 60;
    const newSlot: RoomTimeSlot = {
      id: Math.random().toString(36).substring(2, 9),
      name: "08:00 - 17:00",
      start: "08:00",
      end: "17:00",
      startTime: "08:00",
      endTime: "17:00",
      price: p,
      pricePerHour: p,
      blockMinutes: roomBlock,
    };
    setTimeSlots([...timeSlots, newSlot]);
  };

  const handleUpdateTimeSlot = (id: string, field: keyof RoomTimeSlot, value: any) => {
    setTimeSlots(
      timeSlots.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        if (field === 'start') {
          updated.startTime = value;
          if (!s.name || s.name === `${s.start} - ${s.end}`) {
            updated.name = `${value} - ${s.end || '17:00'}`;
          }
        }
        if (field === 'startTime') {
          updated.start = value;
          if (!s.name || s.name === `${s.startTime} - ${s.endTime}`) {
            updated.name = `${value} - ${s.endTime || '17:00'}`;
          }
        }
        if (field === 'end') {
          updated.endTime = value;
          if (!s.name || s.name === `${s.start} - ${s.end}`) {
            updated.name = `${s.start || '08:00'} - ${value}`;
          }
        }
        if (field === 'endTime') {
          updated.end = value;
          if (!s.name || s.name === `${s.startTime} - ${s.endTime}`) {
            updated.name = `${s.startTime || '08:00'} - ${value}`;
          }
        }
        if (field === 'pricePerHour') updated.price = typeof value === 'number' ? value : Number(value);
        if (field === 'price') updated.pricePerHour = typeof value === 'number' ? value : Number(value);
        if (field === 'blockMinutes') updated.blockMinutes = typeof value === 'number' ? value : Number(value);
        return updated;
      })
    );
  };

  const handleRemoveTimeSlot = (id: string) => {
    setTimeSlots(timeSlots.filter((s) => s.id !== id));
  };

  const handleApplyPresetSlots = (type: 'day-night' | '3-shifts') => {
    const baseP = Number(newRoomPrice) || 200000;
    const roomBlock = Number(newBlockMinutes) || 60;
    if (type === 'day-night') {
      const dayP = Math.round(baseP * 0.8);
      setTimeSlots([
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "08:00 - 18:00",
          start: "08:00",
          end: "18:00",
          startTime: "08:00",
          endTime: "18:00",
          price: dayP,
          pricePerHour: dayP,
          blockMinutes: roomBlock,
        },
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "18:00 - 08:00",
          start: "18:00",
          end: "08:00",
          startTime: "18:00",
          endTime: "08:00",
          price: baseP,
          pricePerHour: baseP,
          blockMinutes: roomBlock,
        },
      ]);
    } else {
      const morningP = Math.round(baseP * 0.75);
      const afternoonP = Math.round(baseP * 0.9);
      setTimeSlots([
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "08:00 - 13:00",
          start: "08:00",
          end: "13:00",
          startTime: "08:00",
          endTime: "13:00",
          price: morningP,
          pricePerHour: morningP,
          blockMinutes: roomBlock,
        },
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "13:00 - 18:00",
          start: "13:00",
          end: "18:00",
          startTime: "13:00",
          endTime: "18:00",
          price: afternoonP,
          pricePerHour: afternoonP,
          blockMinutes: roomBlock,
        },
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "18:00 - 08:00",
          start: "18:00",
          end: "08:00",
          startTime: "18:00",
          endTime: "08:00",
          price: baseP,
          pricePerHour: baseP,
          blockMinutes: roomBlock,
        },
      ]);
    }
  };

  const handleAddRoom = () => {
    if (!newRoomName.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên phòng", variant: "destructive" });
      return;
    }
    const price = noTimeCharge ? 0 : Number(newRoomPrice);
    if (!noTimeCharge && (!newRoomPrice || price <= 0)) {
      toast({ title: "Lỗi", description: "Giá phòng phải lớn hơn 0", variant: "destructive" });
      return;
    }
    if (rooms.some((room) => room.name === newRoomName.trim())) {
      toast({ title: "Lỗi", description: "Phòng này đã tồn tại", variant: "destructive" });
      return;
    }
    const blockMins = Number(newBlockMinutes) || 60;
    const minPrintMins = newMinPrintMinutes.trim() !== "" ? Math.max(0, Number(newMinPrintMinutes)) : undefined;
    onAddRoom(newRoomName.trim(), price, blockMins, timeSlots, useTimeSlots, minPrintMins);
    setNewRoomName("");
    setNewRoomPrice("");
    setNewBlockMinutes("60");
    setNewMinPrintMinutes("");
    setNoTimeCharge(false);
    setUseTimeSlots(false);
    setTimeSlots([]);
    toast({ title: "Thành công", description: "Đã thêm phòng mới" });
  };

  const handleUpdateRoom = () => {
    if (!editingRoom) return;
    if (!newRoomName.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập tên phòng", variant: "destructive" });
      return;
    }
    const price = noTimeCharge ? 0 : Number(newRoomPrice);
    if (!noTimeCharge && (!newRoomPrice || price <= 0)) {
      toast({ title: "Lỗi", description: "Giá phòng phải lớn hơn 0", variant: "destructive" });
      return;
    }
    if (rooms.some((room) => room.name === newRoomName.trim() && room.id !== editingRoom.id)) {
      toast({ title: "Lỗi", description: "Tên phòng này đã tồn tại", variant: "destructive" });
      return;
    }
    const blockMins = Number(newBlockMinutes) || 60;
    const minPrintMins = newMinPrintMinutes.trim() !== "" ? Math.max(0, Number(newMinPrintMinutes)) : undefined;
    onUpdateRoom(
      editingRoom.id,
      newRoomName.trim(),
      price,
      editingRoom.groupId,
      blockMins,
      timeSlots,
      useTimeSlots,
      minPrintMins
    );
    setEditingRoom(null);
    setNewRoomName("");
    setNewRoomPrice("");
    setNewBlockMinutes("60");
    setNewMinPrintMinutes("");
    setNoTimeCharge(false);
    setUseTimeSlots(false);
    setTimeSlots([]);
    toast({ title: "Thành công", description: "Đã cập nhật thông tin phòng" });
  };

  const startEditRoom = (room: Room) => {
    const roomBlock = room.block_minutes ?? 5;
    setEditingRoom(room);
    setNewRoomName(room.name);
    setNewRoomPrice(room.price.toString());
    setNewBlockMinutes(roomBlock.toString());
    setNewMinPrintMinutes(room.min_print_minutes !== undefined ? room.min_print_minutes.toString() : "");
    setNoTimeCharge(room.price === 0);
    setUseTimeSlots(!!room.useTimeSlots);
    setTimeSlots((room.timeSlots || []).map((s) => {
      const startTime = s.startTime || s.start || "08:00";
      const endTime = s.endTime || s.end || "17:00";
      const p = typeof s.price === "number" ? s.price : (typeof s.pricePerHour === "number" ? s.pricePerHour : room.price);
      const slotBlock = typeof s.blockMinutes === "number" && s.blockMinutes > 0 ? s.blockMinutes : roomBlock;
      return {
        ...s,
        id: s.id || Math.random().toString(36).substring(2, 9),
        name: s.name || `${startTime} - ${endTime}`,
        start: startTime,
        startTime,
        end: endTime,
        endTime,
        price: p,
        pricePerHour: p,
        blockMinutes: slotBlock,
      };
    }));
  };

  const cancelEdit = () => {
    setEditingRoom(null);
    setNewRoomName("");
    setNewRoomPrice("");
    setNewBlockMinutes("60");
    setNewMinPrintMinutes("");
    setNoTimeCharge(false);
    setUseTimeSlots(false);
    setTimeSlots([]);
  };

  const handleDeleteRoom = (room: Room) => {
    onDeleteRoom(room.id);
    toast({ title: "Thành công", description: `Đã xóa phòng ${room.name}` });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Danh sách phòng</h3>
        <ExcelImportExportButtons
          onExport={() => exportRoomsToExcel(rooms)}
          onImport={async (file) => {
            const res = await importRoomsFromExcel(file, rooms);
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            return `Thêm mới ${res.inserted} • Cập nhật ${res.updated}`;
          }}
        />
      </div>

      {/* Cấu hình thời gian tối thiểu in hóa đơn toàn quán */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 mb-4 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              Quy định số phút tối thiểu khi in hóa đơn (toàn quán)
            </div>
            <p className="text-xs text-muted-foreground">
              Hệ thống sẽ chặn in hóa đơn nếu thời gian tiền giờ chưa đạt số phút này (tránh in nhầm, thất thoát). Đặt = 0 nếu không muốn chặn in. Từng phòng có thể ghi đè quy định riêng bên dưới.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Thời gian chung:</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                value={globalMinInput}
                onChange={(e) => setGlobalMinInput(e.target.value)}
                onBlur={handleSaveGlobalMin}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveGlobalMin(); }}
                className="w-20 h-8 text-center text-sm font-semibold bg-background"
              />
              <span className="text-xs font-medium text-muted-foreground">phút</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-2.5"
                onClick={handleSaveGlobalMin}
              >
                Lưu
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-4 border border-border p-3.5 rounded-lg bg-card/50">
        <div>
          <Label className="font-semibold">Tên phòng</Label>
          <Input
            placeholder="VD: VIP1, VIP2..."
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={noTimeCharge}
            onCheckedChange={(v) => setNoTimeCharge(!!v)}
          />
          <span className="flex items-center gap-1 font-medium">
            <Ban className="h-3.5 w-3.5 text-destructive" /> Không tính tiền giờ
          </span>
          <span className="text-xs text-muted-foreground">(chỉ in hóa đơn sản phẩm)</span>
        </label>

        {!noTimeCharge && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="font-semibold">Giá giờ tiêu chuẩn (VNĐ)</Label>
                <Input
                  type="number"
                  placeholder="VD: 250000"
                  value={newRoomPrice}
                  onChange={(e) => setNewRoomPrice(e.target.value)}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Giá mặc định khi không có khung giờ
                </p>
              </div>

              <div>
                <Label className="font-semibold">Block tính tiền (phút)</Label>
                <Input
                  type="number"
                  placeholder="VD: 60"
                  value={newBlockMinutes}
                  onChange={(e) => setNewBlockMinutes(e.target.value)}
                  className="mt-1.5"
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Làm tròn bội số block (VD: 60p, 15p, 3p)
                </p>
              </div>

              <div>
                <Label className="font-semibold">Tối thiểu in HĐ (phút)</Label>
                <Input
                  type="number"
                  placeholder={`Mặc định (${effectiveDefaultMin}p)`}
                  value={newMinPrintMinutes}
                  onChange={(e) => setNewMinPrintMinutes(e.target.value)}
                  className="mt-1.5"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Trống = dùng mặc định ({effectiveDefaultMin}p); 0 = cho in tự do
                </p>
              </div>
            </div>

            {/* Time Slot Options Section */}
            <div className="border border-border/80 rounded-lg p-3 bg-muted/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={useTimeSlots}
                    onCheckedChange={(v) => setUseTimeSlots(!!v)}
                  />
                  <span className="font-medium text-sm flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    Áp dụng giá theo khung giờ 24h (Time Slots)
                  </span>
                </label>

                {useTimeSlots && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleApplyPresetSlots('day-night')}
                    >
                      <Sparkles className="h-3 w-3" /> Mẫu 2 Ca 24h
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleApplyPresetSlots('3-shifts')}
                    >
                      <Sparkles className="h-3 w-3" /> Mẫu 3 Ca 24h
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleAddTimeSlot}
                    >
                      <Plus className="h-3 w-3" /> Thêm khung giờ
                    </Button>
                  </div>
                )}
              </div>

              {useTimeSlots && (
                <div className="space-y-2 pt-1">
                  {timeSlots.length === 0 ? (
                    <div className="text-center p-3 text-xs text-muted-foreground border border-dashed rounded-md bg-background/50">
                      Chưa có khung giờ nào. Bấm "Thêm khung giờ" hoặc chọn mẫu 24h có sẵn để tạo.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header guide */}
                      <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 text-[11px] font-medium text-muted-foreground">
                        <div className="col-span-3">Tên / Khung 24h</div>
                        <div className="col-span-4 text-center">Khung giờ 24h (Từ - Đến)</div>
                        <div className="col-span-3">Đơn giá (VNĐ/h)</div>
                        <div className="col-span-2 text-right">Block (phút)</div>
                      </div>

                      {timeSlots.map((slot, index) => (
                        <div
                          key={slot.id}
                          className="flex flex-col sm:grid sm:grid-cols-12 gap-2 p-2 bg-background rounded-md border border-border text-xs items-center"
                        >
                          <div className="w-full sm:col-span-3">
                            <Input
                              value={slot.name}
                              onChange={(e) => handleUpdateTimeSlot(slot.id, 'name', e.target.value)}
                              placeholder={`08:00 - 18:00`}
                              className="h-8 text-xs"
                              title="Tên hoặc khung giờ hiển thị trên hóa đơn (định dạng 24h)"
                            />
                          </div>

                          <div className="w-full sm:col-span-4 flex items-center justify-center gap-1">
                            <TimePicker24h
                              value={slot.start || slot.startTime || "08:00"}
                              onChange={(val) => handleUpdateTimeSlot(slot.id, 'start', val)}
                              className="h-8"
                            />
                            <span className="text-muted-foreground">-</span>
                            <TimePicker24h
                              value={slot.end || slot.endTime || "18:00"}
                              onChange={(val) => handleUpdateTimeSlot(slot.id, 'end', val)}
                              className="h-8"
                            />
                          </div>

                          <div className="w-full sm:col-span-3">
                            <Input
                              type="number"
                              value={slot.pricePerHour || slot.price || ''}
                              onChange={(e) => handleUpdateTimeSlot(slot.id, 'pricePerHour', Number(e.target.value))}
                              placeholder="Giá VNĐ/giờ"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="w-full sm:col-span-2 flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="1"
                              value={slot.blockMinutes ?? (Number(newBlockMinutes) || 60)}
                              onChange={(e) => handleUpdateTimeSlot(slot.id, 'blockMinutes', Math.max(1, Number(e.target.value)))}
                              placeholder="Block (p)"
                              title="Block làm tròn số phút cho khung giờ này (VD: 60, 15, 30, 5, 3, 1 phút)"
                              className="h-8 text-xs w-full"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 shrink-0 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveTimeSlot(slot.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    * Khung giờ hiển thị theo định dạng chuẩn 24h (ví dụ 08:00 - 18:00, 18:00 - 08:00). Khi khách hát qua nhiều khung giờ, hệ thống sẽ tự động tính đúng số phút và làm tròn theo block của từng khung giờ.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          {editingRoom ? (
            <>
              <Button onClick={handleUpdateRoom} className="flex-1 gap-2">
                <Pencil className="h-4 w-4" />
                Cập Nhật Phòng
              </Button>
              <Button onClick={cancelEdit} variant="outline" className="flex-1">
                Hủy
              </Button>
            </>
          ) : (
            <Button onClick={handleAddRoom} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Thêm Phòng
            </Button>
          )}
        </div>
      </div>

      {rooms.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rooms.map((r) => r.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {rooms.map((room) => (
                <SortableRoomCard
                  key={room.id}
                  room={room}
                  effectiveDefaultMin={effectiveDefaultMin}
                  onEdit={startEditRoom}
                  onDelete={handleDeleteRoom}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  );
};

export default RoomManagement;
