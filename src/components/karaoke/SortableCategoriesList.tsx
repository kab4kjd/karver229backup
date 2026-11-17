import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { GripVertical, Trash2, Pencil, Check, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface SortableCategoryItemProps {
  category: Category;
  itemCount: number;
  onDelete: (id: string, name: string) => void;
  onRename: (id: string, newName: string) => void;
}

const SortableCategoryItem = ({ category, itemCount, onDelete, onRename }: SortableCategoryItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(category.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
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
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <p className="font-medium">{category.name}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setEditName(category.name);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {itemCount} món
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(category.id, category.name)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

interface SortableCategoriesListProps {
  categories: Category[];
  itemCounts: Record<string, number>;
  onReorder: (updates: { id: string; sort_order: number }[]) => void;
  onDelete: (id: string, name: string) => void;
  onRename: (id: string, newName: string) => void;
}

const SortableCategoriesList = ({ categories, itemCounts, onReorder, onDelete, onRename }: SortableCategoriesListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      const updates = newCategories.map((cat, index) => ({
        id: cat.id,
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
      <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {categories.map((category) => (
            <SortableCategoryItem
              key={category.id}
              category={category}
              itemCount={itemCounts[category.id] || 0}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortableCategoriesList;
