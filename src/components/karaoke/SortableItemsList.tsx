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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Item } from "@/hooks/useCategories";

interface SortableItemProps {
  item: Item;
  onEdit: (id: string, categoryId: string, name: string, price: number, customQty?: boolean) => void;
  onDelete: (id: string) => void;
}

const SortableItem = ({ item, onEdit, onDelete }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-muted rounded-md"
    >
      <button
        className="cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {item.price.toLocaleString("vi-VN")}đ
          {item.custom_quantity && (
            <span className="ml-2 inline-block px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary">
              SL tùy chỉnh
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item.id, item.category_id, item.name, item.price, item.custom_quantity)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface SortableItemsListProps {
  items: Item[];
  onReorder: (items: { id: string; sort_order: number }[]) => void;
  onEdit: (id: string, categoryId: string, name: string, price: number, customQty?: boolean) => void;
  onDelete: (id: string) => void;
}

const SortableItemsList = ({ items, onReorder, onEdit, onDelete }: SortableItemsListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index + 1,
      }));

      onReorder(updates);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortableItemsList;