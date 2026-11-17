import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import DraggableCardLayout from "./DraggableCardLayout";
import RoomSelection from "./RoomSelection";
import ItemsSection from "./ItemsSection";
import TimeInput from "./TimeInput";
import type { Room } from "@/hooks/useRooms";
import type { CardId } from "@/hooks/useCardLayout";
import type { InvoiceItem } from "@/pages/Index";
import type { ItemCategories } from "./ConfigurationTab";

interface InvoiceFormPanelProps {
  variant?: "classic" | "modern";
  categoriesLoading?: boolean;
  cardOrder: CardId[];
  cardHeights: Record<CardId, number | null>;
  onCardOrderChange: (order: CardId[]) => void;
  onCardHeightChange: (id: CardId, height: number | null) => void;
  rooms: Room[];
  selectedRoom: string;
  activeRoom: string | null;
  onSelectRoom: (roomName: string) => void;
  onRoomPriceChange: (price: number) => void;
  onOpenRoom: (roomName: string, roomPrice: number) => void;
  onCloseRoom: (roomName: string) => void;
  roomHasItems: (roomName: string) => boolean;
  getDisplayRoomTotal: (roomName: string) => number;
  editingInvoiceId: string | null;
  items: InvoiceItem[];
  itemCategories: ItemCategories;
  onItemsChange: (items: InvoiceItem[]) => void;
  isReadOnlyEdit: boolean;
  checkIn: string;
  checkOut: string;
  checkInDate: string;
  checkOutDate: string;
  duration: number;
  actualDuration: number;
  onCheckInChange: (value: string) => void;
  onCheckOutChange: (value: string) => void;
  onCheckInDateChange: (value: string) => void;
  onCheckOutDateChange: (value: string) => void;
  isRealTime: boolean;
  onToggleRealTime?: (value: boolean) => void;
  discountType: "percentage" | "fixed";
  onDiscountTypeChange: (value: "percentage" | "fixed") => void;
  discountValue: number;
  onDiscountValueChange: (value: number) => void;
  taxRate: number;
  onTaxRateChange: (value: number) => void;
}

const InvoiceFormPanel = ({
  variant = "classic",
  categoriesLoading = false,
  cardOrder,
  cardHeights,
  onCardOrderChange,
  onCardHeightChange,
  rooms,
  selectedRoom,
  activeRoom,
  onSelectRoom,
  onRoomPriceChange,
  onOpenRoom,
  onCloseRoom,
  roomHasItems,
  getDisplayRoomTotal,
  editingInvoiceId,
  items,
  itemCategories,
  onItemsChange,
  isReadOnlyEdit,
  checkIn,
  checkOut,
  checkInDate,
  checkOutDate,
  duration,
  actualDuration,
  onCheckInChange,
  onCheckOutChange,
  onCheckInDateChange,
  onCheckOutDateChange,
  isRealTime,
  onToggleRealTime,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  taxRate,
  onTaxRateChange,
}: InvoiceFormPanelProps) => {
  if (categoriesLoading) {
    return (
      <Card className="border shadow-sm p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <div className="p-4 space-y-4">
        <DraggableCardLayout
          order={cardOrder}
          heights={cardHeights}
          onOrderChange={onCardOrderChange}
          onHeightChange={onCardHeightChange}
          cardMap={{
            rooms: (
              <RoomSelection
                rooms={rooms}
                selectedRoom={selectedRoom}
                activeRoom={activeRoom}
                onSelectRoom={onSelectRoom}
                onRoomPriceChange={onRoomPriceChange}
                onOpenRoom={onOpenRoom}
                onCloseRoom={onCloseRoom}
                hasItems={roomHasItems}
                getRoomTotal={getDisplayRoomTotal}
                disabled={!!editingInvoiceId}
              />
            ),
            items: (
              <ItemsSection
                items={items}
                categories={itemCategories}
                onItemsChange={onItemsChange}
                readOnly={isReadOnlyEdit}
              />
            ),
            time: (
              <TimeInput
                checkIn={checkIn}
                checkOut={checkOut}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                duration={duration}
                actualDuration={actualDuration}
                onCheckInChange={isReadOnlyEdit ? () => {} : onCheckInChange}
                onCheckOutChange={isReadOnlyEdit ? () => {} : onCheckOutChange}
                onCheckInDateChange={isReadOnlyEdit ? () => {} : onCheckInDateChange}
                onCheckOutDateChange={isReadOnlyEdit ? () => {} : onCheckOutDateChange}
                isEditing={!!editingInvoiceId}
                isRealTime={isRealTime}
                onToggleRealTime={isReadOnlyEdit ? undefined : onToggleRealTime}
              />
            ),
          }}
        />

        <div
          className={
            variant === "modern"
              ? "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20"
              : "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
          }
        >
          <div>
            <Label>Loại giảm giá</Label>
            <Select
              value={discountType}
              onValueChange={(value: "percentage" | "fixed") =>
                onDiscountTypeChange(value)
              }
              disabled={isReadOnlyEdit}
            >
              <SelectTrigger className={variant === "modern" ? "mt-1" : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                <SelectItem value="fixed">Số tiền cố định (VNĐ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Giá trị giảm</Label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => onDiscountValueChange(Number(e.target.value))}
              placeholder={discountType === "percentage" ? "%" : "VNĐ"}
              disabled={isReadOnlyEdit}
              className={variant === "modern" ? "mt-1" : undefined}
            />
          </div>
          <div>
            <Label>Thuế/Phí (%)</Label>
            <Input
              type="number"
              value={taxRate}
              onChange={(e) => onTaxRateChange(Number(e.target.value))}
              placeholder="%"
              min={0}
              max={100}
              disabled={isReadOnlyEdit}
              className={variant === "modern" ? "mt-1" : undefined}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InvoiceFormPanel;
