import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Room } from "@/hooks/useRooms";

interface RoomSelectionProps {
  rooms: Room[];
  selectedRoom: string;
  activeRoom: string | null;
  onSelectRoom: (room: string) => void;
  onRoomPriceChange: (price: number) => void;
  onOpenRoom: (roomName: string, roomPrice: number) => void;
  onCloseRoom: (roomName: string) => void;
  hasItems: (roomName: string) => boolean;
  getRoomTotal: (roomName: string) => number;
  disabled?: boolean;
}

const RoomSelection = ({ 
  rooms,
  selectedRoom, 
  activeRoom,
  onSelectRoom, 
  onRoomPriceChange,
  onOpenRoom,
  onCloseRoom,
  hasItems,
  getRoomTotal,
  disabled = false,
}: RoomSelectionProps) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("roomSelection.collapsed") === "1";
  });
  const [autoCollapse, setAutoCollapse] = useState<boolean>(() => {
    return localStorage.getItem("roomSelection.autoCollapse") === "1";
  });
  const prevActiveRoom = useRef<string | null>(activeRoom);

  useEffect(() => {
    localStorage.setItem("roomSelection.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem("roomSelection.autoCollapse", autoCollapse ? "1" : "0");
  }, [autoCollapse]);

  // Auto collapse/expand based on activeRoom transitions
  useEffect(() => {
    if (!autoCollapse) {
      prevActiveRoom.current = activeRoom;
      return;
    }
    const prev = prevActiveRoom.current;
    if (!prev && activeRoom) {
      // Room just opened → collapse
      setCollapsed(true);
    } else if (prev && !activeRoom) {
      // Room closed/printed → expand
      setCollapsed(false);
    }
    prevActiveRoom.current = activeRoom;
  }, [activeRoom, autoCollapse]);

  // Periodic refresh so open room cards update real-time totals
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleRoomChange = (roomName: string) => {
    if (disabled) return;
    onSelectRoom(roomName);
    const room = rooms.find((r) => r.name === roomName);
    if (room) {
      onRoomPriceChange(room.price);
    }
  };

  const handleDoubleClick = (roomName: string) => {
    if (disabled) return;
    const room = rooms.find((r) => r.name === roomName);
    if (room) {
      onOpenRoom(roomName, room.price);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`;
    }
    return `${(price / 1000).toFixed(0)}k`;
  };

  return (
    <Card className={`p-4 relative ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
        {!autoCollapse && !collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCollapsed(true)}
            title="Thu nhỏ"
            aria-label="Thu nhỏ"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        )}
        {!autoCollapse && collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCollapsed(false)}
            title="Phóng to"
            aria-label="Phóng to"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer ml-1 select-none">
          <Checkbox
            checked={autoCollapse}
            onCheckedChange={(v) => setAutoCollapse(!!v)}
            className="h-3.5 w-3.5"
          />
          auto
        </label>
      </div>
      <div className="flex items-center justify-between mb-2 pl-24">
        <div>
          {disabled ? (
            <p className="text-xs text-destructive">Đang chỉnh sửa — không thể đổi phòng</p>
          ) : (
             <p className="text-xs text-muted-foreground">​</p>
          )}
        </div>
        {activeRoom && !disabled && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onCloseRoom(activeRoom)}
          >
            Đóng phòng {activeRoom}
          </Button>
        )}
      </div>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          collapsed
            ? "grid-rows-[0fr] opacity-0 mt-0"
            : "grid-rows-[1fr] opacity-100 mt-2"
        }`}
      >
        <div className="overflow-hidden">
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-2">
        {rooms.map((room) => {
          const isActive = activeRoom === room.name;
          const roomHasItems = hasItems(room.name);
          const roomTotal = getRoomTotal(room.name);
          return (
            <Button
              key={room.name}
              variant={selectedRoom === room.name ? "default" : isActive ? "secondary" : "outline"}
              onClick={() => handleRoomChange(room.name)}
              onDoubleClick={() => handleDoubleClick(room.name)}
              className={`h-auto min-h-[58px] sm:min-h-[52px] py-2.5 sm:py-2 px-2 flex flex-col items-center justify-center gap-0.5 relative active:scale-[0.98] transition-transform ${
                isActive ? "ring-1 ring-primary" : ""
              }`}
            >
              {roomHasItems && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full" />
              )}
              <span className="font-medium text-sm leading-tight truncate max-w-full">{room.name}</span>
              <span className={`font-medium text-xs sm:text-sm ${roomTotal > 0 ? "text-success" : "invisible"}`}>
                {roomTotal > 0 ? formatPrice(roomTotal) : "0k"}
              </span>
            </Button>
          );
        })}
        </div>
        </div>
      </div>
    </Card>
  );
};

export default RoomSelection;
