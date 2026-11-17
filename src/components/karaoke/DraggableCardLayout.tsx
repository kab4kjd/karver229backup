import { useState, useCallback, useRef, ReactNode } from "react";
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
import { GripVertical, Maximize2 } from "lucide-react";
import { CardId } from "@/hooks/useCardLayout";

interface SortableCardProps {
  id: CardId;
  children: ReactNode;
  height: number | null;
  onHeightChange: (id: CardId, height: number | null) => void;
}

const SortableCard = ({ id, children, height, onHeightChange }: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const [isResizing, setIsResizing] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const naturalHeight = useRef<number | null>(null);

  // Capture natural height on first render
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node && naturalHeight.current === null) {
      naturalHeight.current = node.scrollHeight;
    }
  }, []);

  const scale = height && naturalHeight.current && naturalHeight.current > 0
    ? height / naturalHeight.current
    : 1;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: height ? `${height}px` : undefined,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
    overflow: "hidden" as const,
  };

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startY.current = clientY;
    startHeight.current = cardRef.current?.getBoundingClientRect().height || 200;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const delta = currentY - startY.current;
      const newHeight = Math.max(100, startHeight.current + delta);
      onHeightChange(id, Math.round(newHeight));
    };

    const handleEnd = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove);
    document.addEventListener("touchend", handleEnd);
  }, [id, onHeightChange]);

  const handleResetHeight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onHeightChange(id, null);
  }, [id, onHeightChange]);

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (cardRef as any).current = node;
        measureRef(node);
      }}
      style={style}
      className={`relative group ${isResizing ? "select-none" : ""}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Kéo để di chuyển"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Scaled content */}
      <div
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          width: scale !== 1 ? `${100 / scale}%` : undefined,
        }}
      >
        {children}
      </div>

      {/* Resize handle - bottom right */}
      <div
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        onDoubleClick={handleResetHeight}
        className="absolute bottom-1 right-1 z-10 cursor-nwse-resize p-1 rounded bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Kéo để thay đổi kích thước (double-click để reset)"
      >
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
};

interface DraggableCardLayoutProps {
  order: CardId[];
  heights: Record<CardId, number | null>;
  onOrderChange: (order: CardId[]) => void;
  onHeightChange: (id: CardId, height: number | null) => void;
  cardMap: Record<CardId, ReactNode>;
}

const DraggableCardLayout = ({
  order,
  heights,
  onOrderChange,
  onHeightChange,
  cardMap,
}: DraggableCardLayoutProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id as CardId);
    const newIndex = order.indexOf(over.id as CardId);
    const newOrder = [...order];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as CardId);
    onOrderChange(newOrder);
  }, [order, onOrderChange]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {order.map((cardId) => (
            <SortableCard
              key={cardId}
              id={cardId}
              height={heights[cardId]}
              onHeightChange={onHeightChange}
            >
              {cardMap[cardId]}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DraggableCardLayout;
