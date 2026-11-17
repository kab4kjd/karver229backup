import { useState, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvoiceItem } from "@/pages/Index";
import type { ItemCategories } from "./ConfigurationTab";

interface ItemsSectionProps {
  items: InvoiceItem[];
  onItemsChange: (items: InvoiceItem[]) => void;
  categories: ItemCategories;
  readOnly?: boolean;
}

const ItemsSection = ({ items, onItemsChange, categories, readOnly = false }: ItemsSectionProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(Object.keys(categories)[0] || "");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQuantity, setCustomQuantity] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [perItemQty, setPerItemQty] = useState<Record<string, string>>({});

  const allItems = useMemo(() => {
    const result: {name: string;price: number;category: string;}[] = [];
    Object.entries(categories).forEach(([cat, catItems]) => {
      catItems.forEach((item) => {
        result.push({ name: item.name, price: item.price, category: cat });
      });
    });
    return result;
  }, [categories]);

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = normalize(searchQuery);
    return allItems.filter((item) => normalize(item.name).includes(q)).slice(0, 10);
  }, [searchQuery, allItems]);

  const handleSearchSelect = (itemName: string, itemPrice: number, category: string) => {
    const existingItem = items.find((i) => i.name === itemName);
    if (existingItem) {
      onItemsChange(
        items.map((i) =>
        i.name === itemName ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      onItemsChange([
      ...items,
      { id: Date.now().toString(), name: itemName, price: itemPrice, quantity: 1, category }]
      );
    }
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleAddCustomItem = () => {
    if (!customName.trim() || !customPrice) return;

    const price = Number(customPrice);
    const quantity = Math.max(1, Number(customQuantity) || 1);

    if (price <= 0) return;

    onItemsChange([
    ...items,
    {
      id: Date.now().toString(),
      name: customName.trim(),
      price: price,
      quantity: quantity,
      category: "Khác"
    }]
    );

    setCustomName("");
    setCustomPrice("");
    setCustomQuantity("1");
  };

  const handleAddItem = (itemName: string, itemPrice: number, qty: number = 1) => {
    const addQty = Math.max(1, qty);
    const existingItem = items.find((i) => i.name === itemName);
    if (existingItem) {
      onItemsChange(
        items.map((i) =>
        i.name === itemName ? { ...i, quantity: i.quantity + addQty } : i
        )
      );
    } else {
      onItemsChange([
      ...items,
      {
        id: Date.now().toString(),
        name: itemName,
        price: itemPrice,
        quantity: addQty,
        category: selectedCategory
      }]
      );
    }
  };

  const handleRemoveItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const categoryKeys = Object.keys(categories);

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {!readOnly && (
          <>
            {/* Category tabs and Quick search combined in one row */}
            <div className="flex flex-wrap items-center gap-2">
              {categoryKeys.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="text-sm"
                >
                  {cat}
                </Button>
              ))}

              {/* Quick search placed after category buttons */}
              <div className="relative flex-1 min-w-[160px]" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm nhanh món..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchResults(true);
                    }}
                    onFocus={() => searchQuery && setShowSearchResults(true)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    className="pl-9 h-9"
                  />
                </div>
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full min-w-[220px] mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {searchResults.map((item, idx) => (
                      <button
                        key={`${item.name}-${idx}`}
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm flex justify-between items-center"
                        onMouseDown={() => handleSearchSelect(item.name, item.price, item.category)}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          {item.price.toLocaleString("vi-VN")}đ
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showSearchResults && searchQuery && searchResults.length === 0 && (
                  <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground text-center">
                    Không tìm thấy món nào
                  </div>
                )}
              </div>
            </div>

            {/* Items grid */}
            {selectedCategory && categories[selectedCategory] && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {categories[selectedCategory].map((item) =>
                  item.customQuantity ? (
                    <button
                      key={item.name}
                      onClick={() => {
                        const q = Math.max(1, Number(perItemQty[item.name] ?? "1") || 1);
                        handleAddItem(item.name, item.price, q);
                        setPerItemQty((prev) => ({ ...prev, [item.name]: "1" }));
                      }}
                      className={cn(
                        "p-2 rounded-md border text-left transition-colors",
                        "bg-card hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "select-none cursor-pointer"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.price.toLocaleString("vi-VN")}đ
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={perItemQty[item.name] ?? "1"}
                          onChange={(e) => setPerItemQty((prev) => ({ ...prev, [item.name]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 w-12 text-center text-xs px-1 shrink-0"
                        />
                      </div>
                    </button>
                  ) : (
                    <button
                      key={item.name}
                      onClick={() => handleAddItem(item.name, item.price)}
                      className={cn(
                        "p-2 rounded-md border text-left transition-colors",
                        "bg-card hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-ring",
                        "select-none cursor-pointer"
                      )}
                    >
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.price.toLocaleString("vi-VN")}đ
                      </p>
                    </button>
                  )
                )}
              </div>
            )}

        {/* Custom item input as accordion */}
        <Accordion type="single" collapsible className="w-full border-t mt-3">
          <AccordionItem value="custom-item" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:text-foreground hover:no-underline font-normal">
              <span>Thêm món tùy ý</span>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pt-1">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Tên món"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 min-w-[120px]"
                />
                <Input
                  type="number"
                  placeholder="Giá"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-[180px]"
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="SL"
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                  className="w-16"
                  min="1"
                />
                <Button onClick={handleAddCustomItem} size="sm">
                  Thêm
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </>
        )}

        {items.length > 0 &&
        <div className="space-y-2 mt-4">
            <Label className="text-sm text-muted-foreground">Danh sách món đã chọn</Label>
            {items.map((item) =>
          <div
            key={item.id}
            className="flex items-center justify-between p-2 bg-muted rounded-md gap-2">
            
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.price.toLocaleString("vi-VN")}đ
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {readOnly ? (
                    <span className="w-16 text-center text-sm font-medium">x{item.quantity}</span>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQuantity = Math.max(1, Number(e.target.value));
                          onItemsChange(
                            items.map((i) =>
                            i.id === item.id ? { ...i, quantity: newQuantity } : i
                            )
                          );
                        }}
                        className="w-16 h-8 text-center" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
          )}
          </div>
        }
      </div>
    </Card>);

};

export default ItemsSection;