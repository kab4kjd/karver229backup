import { useCallback, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Layout, GripVertical, RotateCcw, Maximize2, Type } from "lucide-react";
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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardId, CARD_LABELS } from "@/hooks/useCardLayout";

interface LayoutSettingsProps {
  leftWidth: number;
  onLeftWidthChange: (value: number) => void;
  appTitle: string;
  onAppTitleChange: (value: string) => void;
  appSubtitle: string;
  onAppSubtitleChange: (value: string) => void;
  cardOrder: CardId[];
  cardHeights: Record<CardId, number | null>;
  onCardOrderChange: (order: CardId[]) => void;
  onCardHeightChange: (id: CardId, height: number | null) => void;
}

const BufferedInput = ({ value, onCommit, transform, ...props }: { value: string; onCommit: (v: string) => void; transform?: (v: string) => string } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'>) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      {...props}
      value={local}
      onChange={(e) => {
        const val = transform ? transform(e.target.value) : e.target.value;
        setLocal(val);
      }}
      onBlur={() => {
        if (local !== value) {
          onCommit(local);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
};

const SortablePreviewCard = ({ id }: { id: CardId }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-2 rounded border bg-muted/50 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm">{CARD_LABELS[id]}</span>
    </div>
  );
};

const LayoutSettings = ({
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
}: LayoutSettingsProps) => {
  const rightWidth = 100 - leftWidth;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = cardOrder.indexOf(active.id as CardId);
      const newIndex = cardOrder.indexOf(over.id as CardId);
      const newOrder = [...cardOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as CardId);
      onCardOrderChange(newOrder);
    },
    [cardOrder, onCardOrderChange]
  );

  const resetHeights = () => {
    (["rooms", "items", "time"] as CardId[]).forEach((id) => onCardHeightChange(id, null));
  };

  const resetOrder = () => {
    onCardOrderChange(["rooms", "items", "time"]);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Type className="h-5 w-5" />
          Tiêu Đề & Phụ Đề Giao Diện
        </h3>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tiêu đề chính (h1)</Label>
            <BufferedInput
              value={appTitle}
              onCommit={onAppTitleChange}
              className="mt-1 h-8 text-sm"
              placeholder="QUẢN LÝ PHÒNG HÁT"
            />
          </div>
          <div>
            <Label className="text-xs">Tiêu đề phụ / Mô tả (p)</Label>
            <BufferedInput
              value={appSubtitle}
              onCommit={onAppSubtitleChange}
              className="mt-1 h-8 text-sm"
              placeholder="Hệ thống quản lý phòng hát & hóa đơn"
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layout className="h-5 w-5" />
          Bố Cục Trang Hóa Đơn
        </h3>

        <div className="space-y-3">
          <Label>Tỷ lệ cột trái / cột phải</Label>
          <Slider
            value={[leftWidth]}
            onValueChange={([v]) => onLeftWidthChange(v)}
            min={30}
            max={70}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Cột trái: {leftWidth}%</span>
            <span>Cột phải: {rightWidth}%</span>
          </div>
        </div>

        <div className="border rounded-md p-3">
          <p className="text-xs text-muted-foreground mb-2">Xem trước:</p>
          <div className="flex gap-2 h-20">
            <div
              className="bg-primary/10 rounded flex items-center justify-center text-xs text-muted-foreground border border-dashed"
              style={{ width: `${leftWidth}%` }}
            >
              Phòng / Món / Thời gian
            </div>
            <div
              className="bg-primary/10 rounded flex items-center justify-center text-xs text-muted-foreground border border-dashed"
              style={{ width: `${rightWidth}%` }}
            >
              Hóa đơn
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GripVertical className="h-5 w-5" />
            Thứ Tự Các Thẻ
          </h3>
          <Button variant="ghost" size="sm" onClick={resetOrder} className="gap-1 text-xs">
            <RotateCcw className="h-3 w-3" />
            Mặc định
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">Kéo thả để sắp xếp thứ tự hiển thị các thẻ trong cột trái</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cardOrder.map((id) => (
                <SortablePreviewCard key={id} id={id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            Chiều Cao Các Thẻ
          </h3>
          {Object.values(cardHeights).some((h) => h !== null) && (
            <Button variant="ghost" size="sm" onClick={resetHeights} className="gap-1 text-xs">
              <RotateCcw className="h-3 w-3" />
              Mặc định
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">Điều chỉnh chiều cao từng thẻ. Nội dung bên trong sẽ phóng to/thu nhỏ theo.</p>

        {(["rooms", "items", "time"] as CardId[]).map((id) => (
          <div key={id} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{CARD_LABELS[id]}</Label>
              <span className="text-xs text-muted-foreground">
                {cardHeights[id] ? `${cardHeights[id]}px` : "Tự động"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[cardHeights[id] ?? 200]}
                onValueChange={([v]) => onCardHeightChange(id, v)}
                min={100}
                max={600}
                step={10}
                className="flex-1"
              />
              {cardHeights[id] !== null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onCardHeightChange(id, null)}
                  title="Đặt về tự động"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

export default LayoutSettings;
