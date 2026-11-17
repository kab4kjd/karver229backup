import { useState, useEffect, useRef, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  GripVertical, Eye, EyeOff, ChevronDown, ChevronRight,
  Store, FileText, Info, ShoppingCart, Calculator, Heart,
  Minus, Type, Plus, Save, RotateCcw, Trash2, Settings2,
  Undo2, Redo2, ZoomIn, ZoomOut, Sun, Moon, Layout,
  Tag, Download, Upload, Image, Copy, Star, StarOff, QrCode,
  ArrowUp, ArrowDown, Bold, AlignLeft, AlignCenter, AlignRight, Clock
} from "lucide-react";
import PrintFormatToolbar from "@/components/karaoke/PrintFormatToolbar";
import SectionBoxControls, { BoxControls } from "@/components/karaoke/SectionBoxControls";
import {
  usePrintSettings,
  type TemplateSection, type TextFormatKey, type TextFormat,
  type SectionBorder, type SectionMargin, type SectionPadding, type FontFamily, type QrCodeSettings, type InfoRow,
  type DividerId,
  DEFAULT_MARGIN, DEFAULT_PADDING, DEFAULT_BORDER, DEFAULT_INFO_ROWS, INFO_ROW_NAMES,
  DEFAULT_DIVIDERS, DIVIDER_NAMES,
} from "@/hooks/usePrintSettings";
import { usePrintSettingsHistory } from "@/hooks/usePrintSettingsHistory";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const SECTION_ICONS: Record<string, React.ElementType> = {
  logo: Image, header: Store, title: FileText, info: Info, items: ShoppingCart,
  totals: Calculator, footer: Heart, separator: Minus, 'custom-text': Type, 'qr-code': QrCode,
};

const FONT_SIZE_MAP: Record<string, { key: TextFormatKey; label: string; min: number; max: number }[]> = {
  header: [
    { key: "storeName", label: "Tên cửa hàng", min: 12, max: 28 },
    { key: "storeAddress", label: "Địa chỉ / SĐT", min: 8, max: 18 },
  ],
  title: [{ key: "invoiceTitle", label: "Tiêu đề", min: 12, max: 24 }],
  info: [{ key: "infoText", label: "Thông tin", min: 8, max: 18 }],
  items: [
    { key: "tableHeader", label: "Tiêu đề bảng (Tên món, SL, Đ.Giá)", min: 8, max: 18 },
    { key: "tableBody", label: "Dòng món ăn / uống", min: 8, max: 18 },
    { key: "roomTime", label: "Dòng tiền giờ phòng", min: 8, max: 18 },
  ],
  totals: [
    { key: "totalSection", label: "Dòng tổng", min: 8, max: 18 },
    { key: "grandTotal", label: "Tổng cộng", min: 10, max: 24 },
  ],
  footer: [{ key: "footerText", label: "Lời cảm ơn", min: 8, max: 20 }],
};

const SPACING_MAP: Record<string, { key: string; label: string }> = {
  header: { key: "headerBottom", label: "Khoảng cách dưới" },
  title: { key: "titleBottom", label: "Khoảng cách dưới" },
  info: { key: "infoBottom", label: "Khoảng cách dưới" },
  items: { key: "tableBottom", label: "Khoảng cách dưới" },
  totals: { key: "totalTop", label: "Khoảng cách trên" },
  footer: { key: "footerTop", label: "Khoảng cách trên" },
};

const getFormatStyle = (format: TextFormat) => ({
  ...(format.fontWeight ? { fontWeight: format.fontWeight } : format.bold ? { fontWeight: 700 } : {}),
  fontStyle: format.italic ? "italic" : "normal",
  textDecoration: format.underline ? "underline" : "none",
  textAlign: format.align as React.CSSProperties["textAlign"],
});

// Helper to get section border CSS
const getSectionBoxStyle = (section: {
  margin?: SectionMargin;
  padding?: SectionPadding;
  border?: SectionBorder;
  showBorder?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}): React.CSSProperties => {
  const m = section.margin || DEFAULT_MARGIN;
  const p = section.padding || DEFAULT_PADDING;
  const b = section.border || DEFAULT_BORDER;
  const showBorder = section.showBorder;
  const borderStyle = section.borderStyle || 'solid';

  return {
    marginTop: `${m.top}px`, marginBottom: `${m.bottom}px`,
    marginLeft: `${m.left}px`, marginRight: `${m.right}px`,
    paddingTop: `${p.top}px`, paddingBottom: `${p.bottom}px`,
    paddingLeft: `${p.left}px`, paddingRight: `${p.right}px`,
    borderTopWidth: b.top ? `${b.width}px` : (showBorder ? '1px' : '0'),
    borderBottomWidth: b.bottom ? `${b.width}px` : (showBorder ? '1px' : '0'),
    borderLeftWidth: b.left ? `${b.width}px` : '0',
    borderRightWidth: b.right ? `${b.width}px` : '0',
    borderStyle: showBorder ? borderStyle : b.style,
    borderColor: (b.top || b.bottom || b.left || b.right || showBorder) ? 'currentColor' : 'transparent',
  };
};

// ─── Sortable Section Item ───────────────────────────────────────────
interface SortableSectionProps {
  section: TemplateSection;
  isExpanded: boolean;
  isActive: boolean;
  onToggleExpand: () => void;
  onToggleVisibility: () => void;
  onUpdateSection: (updates: Partial<TemplateSection>) => void;
  onRemove?: () => void;
  children?: React.ReactNode;
}

const SortableSectionItem = ({
  section, isExpanded, isActive, onToggleExpand, onToggleVisibility, onUpdateSection, onRemove, children
}: SortableSectionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };
  const Icon = SECTION_ICONS[section.type] || Type;
  const isCustom = section.type === 'separator' || section.type === 'custom-text' || section.type === 'qr-code';

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className={`border rounded-lg overflow-hidden transition-all ${isDragging ? 'shadow-lg ring-2 ring-primary/30' : 'shadow-sm'} ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''} ${!section.visible ? 'opacity-60' : ''} bg-card`}>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 border-b">
          <button className="cursor-grab touch-none text-muted-foreground hover:text-foreground transition-colors" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
          <Icon className="h-4 w-4 text-primary" />
          <button onClick={onToggleExpand} className="flex-1 flex items-center gap-1 text-left text-sm font-medium hover:text-primary transition-colors">
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {section.label}
          </button>
          <div className="flex items-center gap-1.5">
            <button onClick={onToggleVisibility} className="p-1 rounded hover:bg-muted transition-colors" title={section.visible ? "Ẩn" : "Hiện"}>
              {section.visible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {isCustom && onRemove && (
              <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Xóa">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {isExpanded && section.visible && (
          <div className="p-3 space-y-3 bg-card">{children}</div>
        )}
      </div>
    </div>
  );
};

// ─── Buffered Input (prevents cursor jumping) ────────────────────────
const BufferedInput = ({ value, onCommit, transform, ...props }: { value: string; onCommit: (v: string) => void; transform?: (v: string) => string } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'>) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return <Input {...props} value={local} onChange={(e) => { const v = transform ? transform(e.target.value) : e.target.value; setLocal(v); }} onBlur={() => onCommit(local)} />;
};

const BufferedTextarea = ({ value, onCommit, ...props }: { value: string; onCommit: (v: string) => void } & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur'>) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return <Textarea {...props} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onCommit(local)} />;
};

// ─── Section Settings Panels ─────────────────────────────────────────
const HeaderSettings = ({ settings, updateSettings, updateFontSizes, updateTextFormat, updateSpacing }: any) => (
  <div className="space-y-3">
    <div><Label className="text-xs">Tên cửa hàng</Label><BufferedInput value={settings.storeName} onCommit={(v) => updateSettings({ storeName: v })} className="mt-1 h-8 text-sm" /></div>
    <div><Label className="text-xs">Địa chỉ</Label><BufferedInput value={settings.storeAddress} onCommit={(v) => updateSettings({ storeAddress: v })} className="mt-1 h-8 text-sm" /></div>
    <div><Label className="text-xs">Số điện thoại</Label><BufferedInput value={settings.storePhone} onCommit={(v) => updateSettings({ storePhone: v })} className="mt-1 h-8 text-sm" /></div>
    <FontSizeControls keys={FONT_SIZE_MAP.header} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
    <SpacingControl sectionType="header" settings={settings} updateSpacing={updateSpacing} />
  </div>
);

const TitleSettings = ({ settings, updateSettings, updateFontSizes, updateTextFormat, updateSpacing, updateCustomLabels }: any) => (
  <div className="space-y-3">
    <div><Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" />Tiêu đề hóa đơn</Label><BufferedInput value={settings.customLabels.invoiceTitle} onCommit={(v) => updateCustomLabels({ invoiceTitle: v })} className="mt-1 h-8 text-sm" /></div>
    <FontSizeControls keys={FONT_SIZE_MAP.title} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
    <SpacingControl sectionType="title" settings={settings} updateSpacing={updateSpacing} />
  </div>
);

const InfoSettings = ({ settings, updateCustomLabels, updateFontSizes, updateTextFormat, updateSpacing, updateInfoRows }: any) => {
  const rows: InfoRow[] = settings.infoRows?.length ? settings.infoRows : DEFAULT_INFO_ROWS;
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    updateInfoRows(next);
  };
  const patch = (id: string, updates: Partial<InfoRow>) =>
    updateInfoRows(rows.map(r => (r.id === id ? { ...r, ...updates } : r)));

  const labelKeyMap: Record<string, string> = { date: 'dateLabel', room: 'roomLabel', staff: 'staffLabel' };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center gap-1">
          <Tag className="h-3 w-3" /> Nhãn & vị trí thông tin
        </Label>
        <p className="text-[10px] text-muted-foreground">Dùng mũi tên để đổi vị trí, B để in đậm, mắt để ẩn/hiện</p>
        {rows.map((row, index) => (
          <div key={row.id} className="border rounded p-2 bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground flex-1">{INFO_ROW_NAMES[row.id]}</span>
              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => move(index, -1)} disabled={index === 0} title="Lên">
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => move(index, 1)} disabled={index === rows.length - 1} title="Xuống">
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button type="button" variant={row.bold ? "default" : "outline"} size="icon" className="h-6 w-6" onClick={() => patch(row.id, { bold: !row.bold })} title="In đậm">
                <Bold className="h-3 w-3" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => patch(row.id, { visible: !row.visible })} title={row.visible ? "Ẩn" : "Hiện"}>
                {row.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
              </Button>
            </div>
            <BufferedInput
              value={settings.customLabels[labelKeyMap[row.id]] || ''}
              onCommit={(v) => updateCustomLabels({ [labelKeyMap[row.id]]: v })}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>
      <FontSizeControls keys={FONT_SIZE_MAP.info} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
      <SpacingControl sectionType="info" settings={settings} updateSpacing={updateSpacing} />
    </div>
  );
};

const ItemsSettings = ({ settings, updateCustomLabels, updateFontSizes, updateTextFormat, updateColumnWidths, updateSpacing, updateSettings }: any) => {
  const totalWidth = settings.columnWidths.itemName + settings.columnWidths.quantity + settings.columnWidths.unitPrice + settings.columnWidths.total;

  return (
    <div className="space-y-3">
      {/* Room Time Configuration Box */}
      <div className="border rounded-md p-3 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <Clock className="h-4 w-4 text-primary" /> Cài đặt Tiền Giờ
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {settings.showRoomTime !== false ? 'Đang hiện' : 'Đã ẩn'}
            </span>
            <Switch
              checked={settings.showRoomTime !== false}
              onCheckedChange={(v) => updateSettings({ showRoomTime: v })}
            />
          </div>
        </div>

        {settings.showRoomTime !== false && (
          <>
            {/* Time Slot Display Mode */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Cách hiển thị tiền giờ trên hóa đơn
              </Label>
              <Select
                value={settings.roomTimeDisplayMode || 'detailed'}
                onValueChange={(v) => updateSettings({ roomTimeDisplayMode: v })}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="detailed" className="text-xs">
                    <span className="font-medium">Chi tiết theo từng khung giờ</span>
                    <span className="block text-[10px] text-muted-foreground">Tách từng dòng thời gian & đơn giá tương ứng</span>
                  </SelectItem>
                  <SelectItem value="merged" className="text-xs">
                    <span className="font-medium">Gộp chung & tính giá trung bình</span>
                    <span className="block text-[10px] text-muted-foreground">Hiển thị 1 dòng tổng thời gian với đơn giá trung bình</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Khi phòng có cài đặt giá theo nhiều khung giờ, hệ thống sẽ áp dụng cách in này.
              </p>
            </div>
          </>
        )}
      </div>

      <Collapsible>
        <CollapsibleTrigger className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground w-full py-1">
          <Tag className="h-3 w-3" /> Nhãn cột & tiền giờ <ChevronDown className="h-3 w-3 ml-auto" />
        </CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-2 gap-2 pt-1">
          <div><Label className="text-[10px]">Tên món</Label><BufferedInput value={settings.customLabels.colItemName} onCommit={(v) => updateCustomLabels({ colItemName: v })} className="h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Số lượng</Label><BufferedInput value={settings.customLabels.colQuantity} onCommit={(v) => updateCustomLabels({ colQuantity: v })} className="h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Đơn giá</Label><BufferedInput value={settings.customLabels.colUnitPrice} onCommit={(v) => updateCustomLabels({ colUnitPrice: v })} className="h-7 text-xs" /></div>
          <div><Label className="text-[10px]">Thành tiền</Label><BufferedInput value={settings.customLabels.colTotal} onCommit={(v) => updateCustomLabels({ colTotal: v })} className="h-7 text-xs" /></div>
          <div className="col-span-2"><Label className="text-[10px]">Nhãn tiền giờ</Label><BufferedInput value={settings.customLabels.roomTimeLabel} onCommit={(v) => updateCustomLabels({ roomTimeLabel: v })} className="h-7 text-xs" /></div>
        </CollapsibleContent>
      </Collapsible>
      <FontSizeControls keys={FONT_SIZE_MAP.items} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
      <div className="border-t pt-3">
        <Label className="text-xs font-medium flex items-center gap-1">
          <Settings2 className="h-3 w-3" /> Độ rộng cột
          <span className={`ml-auto ${totalWidth !== 100 ? 'text-destructive' : 'text-muted-foreground'}`}>({totalWidth}%)</span>
        </Label>
        <div className="space-y-2 mt-2">
          {[
            { key: 'itemName', label: 'Tên món', min: 20, max: 60 },
            { key: 'quantity', label: 'SL', min: 5, max: 25 },
            { key: 'unitPrice', label: 'Đ.Giá', min: 10, max: 35 },
            { key: 'total', label: 'T.Tiền', min: 10, max: 35 },
          ].map(col => (
            <div key={col.key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">{col.label}</span>
              <Slider value={[settings.columnWidths[col.key]]} onValueChange={([v]) => updateColumnWidths({ [col.key]: v })} min={col.min} max={col.max} step={1} className="flex-1" />
              <span className="text-xs w-8 text-right">{settings.columnWidths[col.key]}%</span>
            </div>
          ))}
        </div>
      </div>
      <SpacingControl sectionType="items" settings={settings} updateSpacing={updateSpacing} />
    </div>
  );
};

const TotalsSettings = ({ settings, updateCustomLabels, updateFontSizes, updateTextFormat, updateSpacing }: any) => (
  <div className="space-y-3">
    <Collapsible>
      <CollapsibleTrigger className="text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground w-full py-1">
        <Tag className="h-3 w-3" /> Nhãn tổng tiền <ChevronDown className="h-3 w-3 ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-1">
        <div><Label className="text-[10px]">Tổng tiền món</Label><BufferedInput value={settings.customLabels.subtotalLabel} onCommit={(v) => updateCustomLabels({ subtotalLabel: v })} className="h-7 text-xs" /></div>
        <div><Label className="text-[10px]">Giảm bill</Label><BufferedInput value={settings.customLabels.discountLabel} onCommit={(v) => updateCustomLabels({ discountLabel: v })} className="h-7 text-xs" /></div>
        <div><Label className="text-[10px]">Thuế/Phí</Label><BufferedInput value={settings.customLabels.taxLabel} onCommit={(v) => updateCustomLabels({ taxLabel: v })} className="h-7 text-xs" /></div>
        <div><Label className="text-[10px]">Tổng cộng</Label><BufferedInput value={settings.customLabels.grandTotalLabel} onCommit={(v) => updateCustomLabels({ grandTotalLabel: v })} className="h-7 text-xs" /></div>
      </CollapsibleContent>
    </Collapsible>
    <FontSizeControls keys={FONT_SIZE_MAP.totals} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
    <SpacingControl sectionType="totals" settings={settings} updateSpacing={updateSpacing} />
  </div>
);

const FooterSettings = ({ settings, updateSettings, updateFontSizes, updateTextFormat, updateSpacing }: any) => (
  <div className="space-y-3">
    <div><Label className="text-xs">Lời cảm ơn</Label><BufferedInput value={settings.footerText} onCommit={(v) => updateSettings({ footerText: v })} className="mt-1 h-8 text-sm" /></div>
    <FontSizeControls keys={FONT_SIZE_MAP.footer} settings={settings} updateFontSizes={updateFontSizes} updateTextFormat={updateTextFormat} />
    <SpacingControl sectionType="footer" settings={settings} updateSpacing={updateSpacing} />
  </div>
);

const CustomTextSettings = ({ section, onUpdate }: { section: TemplateSection; onUpdate: (updates: Partial<TemplateSection>) => void }) => {
  const aligns: { value: 'left' | 'center' | 'right'; icon: typeof AlignLeft; title: string }[] = [
    { value: 'left', icon: AlignLeft, title: 'Căn trái' },
    { value: 'center', icon: AlignCenter, title: 'Căn giữa' },
    { value: 'right', icon: AlignRight, title: 'Căn phải' },
  ];
  const align = section.textAlign || 'center';
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" /> Nhãn (tùy chọn)</Label>
        <div className="flex items-center gap-1 mt-1">
          <BufferedInput value={section.textLabel || ''} onCommit={(v) => onUpdate({ textLabel: v })} className="h-8 text-sm flex-1" placeholder="VD: Ghi chú:" />
          <Button type="button" variant={section.labelBold ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => onUpdate({ labelBold: !section.labelBold })} title="In đậm nhãn">
            <Bold className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Nội dung</Label>
        <BufferedTextarea value={section.content || ''} onCommit={(v) => onUpdate({ content: v })} className="mt-1 text-sm min-h-[60px]" placeholder="Nhập nội dung tùy chỉnh..." />
        <div className="flex items-center gap-1 mt-1.5">
          <Button type="button" variant={section.contentBold ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => onUpdate({ contentBold: !section.contentBold })} title="In đậm nội dung">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          {aligns.map(({ value, icon: Icon, title }) => (
            <Button key={value} type="button" variant={align === value ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => onUpdate({ textAlign: value })} title={title}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

const QrCodeSectionSettings = ({ section, onUpdate, bankSettings, onUpdateBank }: { section: TemplateSection; onUpdate: (updates: Partial<TemplateSection>) => void; bankSettings: any; onUpdateBank: (b: any) => void }) => {
  const qr = section.qrSettings || { content: '', size: 80, align: 'center' as const, mode: 'custom' as const, amountMode: 'auto' as const };
  const mode = qr.mode || 'custom';
  const amountMode = qr.amountMode || 'auto';
  const updateQr = (updates: Partial<QrCodeSettings>) => onUpdate({ qrSettings: { ...qr, ...updates } });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Loại mã QR</Label>
        <Select value={mode} onValueChange={(v) => updateQr({ mode: v as 'custom' | 'vietqr' })}>
          <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="custom">Tùy chỉnh (URL/văn bản)</SelectItem>
            <SelectItem value="vietqr">QR Thanh toán VietQR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'custom' && (
        <div><Label className="text-xs">Nội dung QR (URL hoặc văn bản)</Label><BufferedInput value={qr.content || ''} onCommit={(v) => updateQr({ content: v })} className="mt-1 h-8 text-sm" placeholder="https://facebook.com/..." /></div>
      )}
      {mode === 'vietqr' && (
        <div className="space-y-2 border rounded-md p-2 bg-muted/20">
          <p className="text-xs text-muted-foreground">Cấu hình tài khoản ngân hàng (dùng chung cho tất cả hóa đơn)</p>
          <div><Label className="text-[10px]">Mã ngân hàng (VD: MB, VCB, TCB...)</Label><BufferedInput value={bankSettings?.bankId || ''} onCommit={(v) => onUpdateBank({ bankId: v })} transform={(v) => v.toUpperCase()} className="h-7 text-xs" placeholder="MB" /></div>
          <div><Label className="text-[10px]">Số tài khoản</Label><BufferedInput value={bankSettings?.accountNo || ''} onCommit={(v) => onUpdateBank({ accountNo: v })} className="h-7 text-xs" placeholder="0123456789" /></div>
          <div><Label className="text-[10px]">Tên chủ tài khoản</Label><BufferedInput value={bankSettings?.accountName || ''} onCommit={(v) => onUpdateBank({ accountName: v })} className="h-7 text-xs" placeholder="NGUYEN VAN A" /></div>
          <div>
            <Label className="text-[10px]">Nội dung chuyển khoản (addInfo)</Label>
            <BufferedInput value={qr.addInfo ?? 'Thanh toan {room}'} onCommit={(v) => updateQr({ addInfo: v })} className="h-7 text-xs" placeholder="Thanh toan {room}" />
            <p className="text-[9px] text-muted-foreground mt-0.5">Hỗ trợ biến: {'{room}'} (tên phòng)</p>
          </div>
          <div className="border-t pt-2 mt-2">
            <Label className="text-[10px]">Số tiền trên mã QR</Label>
            <Select value={amountMode} onValueChange={(v) => updateQr({ amountMode: v as 'auto' | 'manual' })}>
              <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="auto">Tự động (= tổng tiền hóa đơn)</SelectItem>
                <SelectItem value="manual">Để trống (người quét tự nhập)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div><Label className="text-xs">Nhãn hiển thị (tùy chọn)</Label><BufferedInput value={qr.label || ''} onCommit={(v) => updateQr({ label: v })} className="mt-1 h-8 text-sm" placeholder={mode === 'vietqr' ? "Quét QR để thanh toán" : "Quét QR để xem..."} /></div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">Kích thước</span>
        <Slider value={[qr.size]} onValueChange={([v]) => updateQr({ size: v })} min={40} max={200} step={5} className="flex-1" />
        <span className="text-xs w-10 text-right">{qr.size}px</span>
      </div>
      <div>
        <Label className="text-[10px]">Căn lề</Label>
        <Select value={qr.align} onValueChange={(v) => updateQr({ align: v as any })}>
          <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="left">Trái</SelectItem>
            <SelectItem value="center">Giữa</SelectItem>
            <SelectItem value="right">Phải</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'custom' && qr.content && (
        <div className="border rounded p-2 bg-muted/20" style={{ textAlign: qr.align }}>
          <QRCodeSVG value={qr.content} size={Math.min(qr.size, 100)} />
        </div>
      )}
      {mode === 'vietqr' && bankSettings?.bankId && bankSettings?.accountNo && (
        <div className="border rounded p-2 bg-muted/20" style={{ textAlign: qr.align }}>
          <p className="text-[10px] text-muted-foreground mb-1">Xem trước {amountMode === 'auto' ? '(số tiền mẫu: 100,000đ)' : '(không có số tiền)'}</p>
          {(() => {
            const rawAddInfo = qr.addInfo || "Thanh toan {room}";
            const formattedAddInfo = rawAddInfo.replace("{room}", "Phòng mẫu");
            const desc = encodeURIComponent(formattedAddInfo);
            const accName = encodeURIComponent(bankSettings.accountName || '');
            const amountParam = amountMode === 'auto' ? 'amount=100000&' : '';
            const previewUrl = `https://img.vietqr.io/image/${bankSettings.bankId}-${bankSettings.accountNo}-compact2.png?${amountParam}addInfo=${desc}&accountName=${accName}`;
            return <img src={previewUrl} alt="VietQR" style={{ width: `${Math.min(qr.size, 100)}px`, display: 'inline-block' }} />;
          })()}
        </div>
      )}
    </div>
  );
};

const LogoSettingsPanel = ({
  settings,
  updateLogo,
  onUploadClick,
  isUploading,
}: {
  settings: any;
  updateLogo: (logo: any) => void;
  onUploadClick: () => void;
  isUploading: boolean;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-xs font-medium flex items-center gap-1"><Image className="h-3 w-3" /> Logo cửa hàng</Label>
      <div className="flex items-center gap-2">
        <Switch checked={settings.logo?.enabled || false} onCheckedChange={(v) => updateLogo({ enabled: v })} />
        <span className="text-xs text-muted-foreground">{settings.logo?.enabled ? 'Hiện' : 'Ẩn'} logo</span>
      </div>
    </div>
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" className="gap-1 text-xs" onClick={onUploadClick} disabled={isUploading}>
        <Upload className="h-3 w-3" />{isUploading ? 'Đang tải...' : 'Tải ảnh lên'}
      </Button>
      {settings.logo?.url && (
        <Button type="button" size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive gap-1" onClick={() => updateLogo({ url: '' })}>
          <Trash2 className="h-3 w-3" /> Xóa ảnh
        </Button>
      )}
    </div>
    {settings.logo?.url ? (
      <>
        <div className="border rounded p-2 bg-muted/20 text-center">
          <img
            src={settings.logo.url}
            alt="Logo preview"
            className="max-h-16 mx-auto"
            style={{
              borderRadius: settings.logo.borderRadius ? `${settings.logo.borderRadius}px` : undefined,
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16">Rộng</span>
          <Slider value={[settings.logo.width || 60]} onValueChange={([v]) => updateLogo({ width: v })} min={20} max={200} step={5} className="flex-1" />
          <span className="text-xs w-10 text-right">{settings.logo.width || 60}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16">Bo góc</span>
          <Slider value={[settings.logo.borderRadius || 0]} onValueChange={([v]) => updateLogo({ borderRadius: v })} min={0} max={30} step={1} className="flex-1" />
          <span className="text-xs w-10 text-right">{settings.logo.borderRadius || 0}px</span>
        </div>
        <div>
          <Label className="text-[10px]">Căn lề</Label>
          <Select value={settings.logo.align || 'center'} onValueChange={(v) => updateLogo({ align: v as any })}>
            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="left">Trái</SelectItem>
              <SelectItem value="center">Giữa</SelectItem>
              <SelectItem value="right">Phải</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    ) : (
      <div className="text-[11px] text-muted-foreground border border-dashed rounded p-2 text-center">
        Chưa có file ảnh logo. Bấm "Tải ảnh lên" để chọn hình logo từ máy tính.
      </div>
    )}
  </div>
);

// ─── Reusable Controls ───────────────────────────────────────────────
const FontSizeControls = ({ keys, settings, updateFontSizes, updateTextFormat }: {
  keys: { key: TextFormatKey; label: string; min: number; max: number }[];
  settings: any; updateFontSizes: (sizes: any) => void; updateTextFormat: (key: TextFormatKey, fmt: Partial<TextFormat>) => void;
}) => (
  <div className="space-y-2">
    {keys.map(({ key, label, min, max }) => (
      <div key={key} className="border rounded p-2 bg-muted/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{settings.fontSizes[key]}px</span>
        </div>
        <Slider value={[settings.fontSizes[key]]} onValueChange={([v]) => updateFontSizes({ [key]: v })} min={min} max={max} step={1} />
        <div className="mt-1.5"><PrintFormatToolbar format={settings.textFormats[key]} onChange={(fmt) => updateTextFormat(key, fmt)} /></div>
      </div>
    ))}
  </div>
);

const SpacingControl = ({ sectionType, settings, updateSpacing }: { sectionType: string; settings: any; updateSpacing: (s: any) => void; }) => {
  const spacingInfo = SPACING_MAP[sectionType];
  if (!spacingInfo) return null;
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs text-muted-foreground">{spacingInfo.label}</span>
      <Slider value={[settings.spacing[spacingInfo.key]]} onValueChange={([v]) => updateSpacing({ [spacingInfo.key]: v })} min={0} max={20} step={1} className="flex-1" />
      <span className="text-xs w-8 text-right">{settings.spacing[spacingInfo.key]}px</span>
    </div>
  );
};

// ─── Live Preview ────────────────────────────────────────────────────
const LivePreview = ({ settings, activeSection, zoom, darkBg }: {
  settings: any; activeSection: string | null; zoom: number; darkBg: boolean;
}) => {
  const fs = settings.fontSizes;
  const tf = settings.textFormats;
  const sp = settings.spacing;
  const cl = settings.customLabels;
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSection && previewRef.current) {
      const el = previewRef.current.querySelector(`[data-section-id="${activeSection}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSection]);

  const sectionWrapper = (section: TemplateSection, children: React.ReactNode) => (
    <div
      key={section.id}
      data-section-id={section.id}
      style={getSectionBoxStyle(section)}
      className={`transition-all duration-300 ${activeSection === section.id ? 'ring-2 ring-primary/60 ring-offset-1 rounded-sm bg-primary/5' : ''}`}
    >
      {children}
    </div>
  );

  const dividers = settings.dividers || DEFAULT_DIVIDERS;
  const previewDividerStyle = (id: DividerId, side: 'top' | 'bottom' = 'bottom'): React.CSSProperties => {
    const d = dividers[id] || DEFAULT_DIVIDERS[id];
    if (!d?.enabled) return {};
    const color = d.color === 'muted' ? 'hsl(var(--muted))' : 'hsl(var(--foreground))';
    const value = `${d.width}px ${d.style} ${color}`;
    return side === 'top' ? { borderTop: value } : { borderBottom: value };
  };

  const renderSection = (section: TemplateSection) => {
    if (!section.visible) return null;
    const borderClass = section.showBorder
      ? `border-b ${section.borderStyle === 'dashed' ? 'border-dashed' : section.borderStyle === 'dotted' ? 'border-dotted' : 'border-solid'} border-foreground`
      : '';

    switch (section.type) {
      case 'logo':
        if (!settings.logo?.url) {
          return sectionWrapper(section,
            <div className={`py-2 text-center text-xs text-muted-foreground border border-dashed rounded p-2 bg-muted/10 ${borderClass}`}>
              <Image className="h-4 w-4 mx-auto mb-1 opacity-50" />
              Chưa có Logo (Bấm vào phần Logo để tải ảnh lên)
            </div>
          );
        }
        return sectionWrapper(section,
          <div className={borderClass} style={{ textAlign: settings.logo.align || 'center' }}>
            <img
              src={settings.logo.url}
              alt="Logo"
              style={{
                width: `${settings.logo.width || 60}px`,
                display: 'inline-block',
                borderRadius: settings.logo.borderRadius ? `${settings.logo.borderRadius}px` : undefined,
              }}
            />
          </div>
        );
      case 'header':
        return sectionWrapper(section,
          <div className={`text-center ${borderClass}`} style={{ paddingBottom: `${sp.headerBottom}px` }}>
            <p style={{ fontSize: `${fs.storeName}px`, ...getPreviewFormatStyle(tf.storeName) }}>{settings.storeName}</p>
            <p style={{ fontSize: `${fs.storeAddress}px`, ...getPreviewFormatStyle(tf.storeAddress) }}>{settings.storeAddress}</p>
            <p style={{ fontSize: `${fs.storeAddress}px`, ...getPreviewFormatStyle(tf.storeAddress) }}>ĐT: {settings.storePhone}</p>
          </div>
        );
      case 'title':
        return sectionWrapper(section,
          <div className={`text-center ${borderClass}`} style={{ paddingBottom: `${sp.titleBottom}px` }}>
            <p style={{ fontSize: `${fs.invoiceTitle}px`, ...getPreviewFormatStyle(tf.invoiceTitle) }} className="my-2">{cl.invoiceTitle}</p>
          </div>
        );
      case 'info':
        return sectionWrapper(section,
          <div className={borderClass} style={{ marginBottom: `${sp.infoBottom}px`, paddingBottom: `${sp.lineSpacing}px` }}>
            {(settings.infoRows?.length ? settings.infoRows : DEFAULT_INFO_ROWS).filter((r: InfoRow) => r.visible).map((r: InfoRow) => {
              const sample: Record<string, { label: string; value: string }> = {
                date: { label: cl.dateLabel, value: '06/03/2026' },
                room: { label: cl.roomLabel, value: 'Phòng VIP 1' },
                staff: { label: cl.staffLabel, value: 'Kaba' },
              };
              const c = sample[r.id];
              return (
                <p key={r.id} style={{ fontSize: `${fs.infoText}px`, ...getPreviewFormatStyle(tf.infoText), ...(r.bold ? { fontWeight: 700 } : {}) }}>
                  {c.label} {c.value}
                </p>
              );
            })}
          </div>
        );
      case 'items': {
        const roomTimeFs = fs.roomTime ?? fs.tableBody;
        const roomTimeTf = tf.roomTime ?? tf.tableBody;
        const isRoomTimeBold = roomTimeTf.bold !== undefined ? roomTimeTf.bold : (settings.roomTimeBold !== undefined ? settings.roomTimeBold : true);
        const roomTimeWeight = roomTimeTf.fontWeight || (isRoomTimeBold ? 700 : 400);
        const roomTimeFormatStyle = {
          ...getPreviewFormatStyle(roomTimeTf),
          fontWeight: roomTimeWeight,
        };

        return sectionWrapper(section,
          <div style={{ marginBottom: `${sp.tableBottom}px` }}>
            <table className="w-full">
              <thead style={previewDividerStyle('tableHeader')}>
                <tr>
                  <th style={{ width: `${settings.columnWidths.itemName}%`, fontSize: `${fs.tableHeader}px`, ...getPreviewFormatStyle(tf.tableHeader) }} className="text-left py-0.5">{cl.colItemName}</th>
                  <th style={{ width: `${settings.columnWidths.quantity}%`, fontSize: `${fs.tableHeader}px`, ...getPreviewFormatStyle(tf.tableHeader) }} className="text-center py-0.5">{cl.colQuantity}</th>
                  <th style={{ width: `${settings.columnWidths.unitPrice}%`, fontSize: `${fs.tableHeader}px`, ...getPreviewFormatStyle(tf.tableHeader) }} className="text-right py-0.5">{cl.colUnitPrice}</th>
                  <th style={{ width: `${settings.columnWidths.total}%`, fontSize: `${fs.tableHeader}px`, ...getPreviewFormatStyle(tf.tableHeader) }} className="text-right py-0.5">{cl.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {settings.showRoomTime !== false && (
                  settings.roomTimeDisplayMode === 'merged' ? (
                    <tr style={previewDividerStyle('tableRow')}>
                      <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="py-0.5">
                        <div style={{ fontWeight: roomTimeWeight }}>{cl.roomTimeLabel}</div>
                        <div className="text-[9px] text-muted-foreground font-normal">14:00 =&gt; 18:00 (4h 00m)</div>
                      </td>
                      <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-center py-0.5">4.00</td>
                      <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">125,000</td>
                      <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">500,000</td>
                    </tr>
                  ) : (
                    <>
                      <tr style={previewDividerStyle('tableRow')}>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="py-0.5">
                          <div style={{ fontWeight: roomTimeWeight }}>{cl.roomTimeLabel} (08:00 - 17:00)</div>
                          <div className="text-[9px] text-muted-foreground font-normal">14:00 =&gt; 17:00 (3h 00m)</div>
                        </td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-center py-0.5">3.00</td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">100,000</td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">300,000</td>
                      </tr>
                      <tr style={previewDividerStyle('tableRow')}>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="py-0.5">
                          <div style={{ fontWeight: roomTimeWeight }}>{cl.roomTimeLabel} (17:00 - 08:00)</div>
                          <div className="text-[9px] text-muted-foreground font-normal">17:00 =&gt; 18:00 (1h 00m)</div>
                        </td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-center py-0.5">1.00</td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">200,000</td>
                        <td style={{ fontSize: `${roomTimeFs}px`, ...roomTimeFormatStyle }} className="text-right py-0.5">200,000</td>
                      </tr>
                    </>
                  )
                )}
                <tr style={previewDividerStyle('tableRow')}>
                  <td style={{ fontSize: `${fs.tableBody}px`, ...getPreviewFormatStyle(tf.tableBody) }} className="py-0.5">BIA TIGER</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-center py-0.5">2</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-right py-0.5">25,000</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-right py-0.5">50,000</td>
                </tr>
                <tr style={previewDividerStyle('tableRow')}>
                  <td style={{ fontSize: `${fs.tableBody}px`, ...getPreviewFormatStyle(tf.tableBody) }} className="py-0.5">NƯỚC NGỌT</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-center py-0.5">3</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-right py-0.5">15,000</td>
                  <td style={{ fontSize: `${fs.tableBody}px` }} className="text-right py-0.5">45,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      case 'totals':
        return sectionWrapper(section,
          <div className={borderClass ? 'border-t border-foreground' : ''} style={{ paddingTop: `${sp.totalTop}px` }}>
            <div className="flex items-start justify-between" style={{ fontSize: `${fs.totalSection}px`, ...getPreviewFormatStyle(tf.totalSection) }}>
              <span>{cl.subtotalLabel}</span><span>95,000</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: `${fs.totalSection}px`, ...getPreviewFormatStyle(tf.totalSection) }}>
              <span>{cl.discountLabel}</span><span>0</span>
            </div>
            <div className="flex justify-between pt-1 mt-1" style={{ fontSize: `${fs.grandTotal}px`, ...getPreviewFormatStyle(tf.grandTotal), ...previewDividerStyle('grandTotal', 'top') }}>
              <span>{cl.grandTotalLabel}</span><span>95,000</span>
            </div>
          </div>
        );
      case 'footer':
        return sectionWrapper(section,
          <div className={`text-center ${borderClass ? 'border-t border-foreground' : ''}`} style={{ marginTop: `${sp.footerTop}px`, paddingTop: `${sp.lineSpacing}px` }}>
            <p style={{ fontSize: `${fs.footerText}px`, ...getPreviewFormatStyle(tf.footerText) }}>{settings.footerText}</p>
          </div>
        );
      case 'separator':
        return dividers.separator?.enabled === false ? null : sectionWrapper(section, <hr className="my-1" style={{ border: 0, ...previewDividerStyle('separator') }} />);
      case 'custom-text':
        return sectionWrapper(section,
          <div className="py-1" style={{ textAlign: section.textAlign || 'center' }}>
            {section.textLabel && (
              <span style={{ fontSize: `${fs.infoText}px`, fontWeight: section.labelBold ? 700 : undefined, marginRight: '4px' }}>{section.textLabel}</span>
            )}
            <span style={{ fontSize: `${fs.infoText}px`, fontWeight: section.contentBold ? 700 : undefined, whiteSpace: 'pre-wrap' }}>{section.content || '...'}</span>
          </div>
        );
      case 'qr-code': {
        const qr = section.qrSettings || { content: '', size: 80, align: 'center' as const };
        return sectionWrapper(section,
          <div style={{ textAlign: qr.align }} className="py-1">
            {qr.content ? <QRCodeSVG value={qr.content} size={qr.size} /> : <div className="text-xs text-muted-foreground">Chưa có nội dung QR</div>}
            {qr.label && <p style={{ fontSize: `${fs.infoText}px` }} className="mt-1">{qr.label}</p>}
          </div>
        );
      }
      default: return null;
    }
  };

  const getPrintWeightProfile = () => {
    const pw = settings.printWeight || 'normal';
    if (pw === 'light') return { baseWeight: 500, boldWeight: 700 };
    if (pw === 'bold') return { baseWeight: 700, boldWeight: 900 };
    return { baseWeight: 600, boldWeight: 800 };
  };

  const getPreviewFormatStyle = (format: TextFormat): React.CSSProperties => {
    const { baseWeight, boldWeight } = getPrintWeightProfile();
    const requestedWeight = format.fontWeight ?? (format.bold ? 700 : undefined);
    const normalizedWeight = requestedWeight === undefined
      ? baseWeight
      : Number(requestedWeight) >= 700
        ? boldWeight
        : requestedWeight;

    return {
      ...getFormatStyle(format),
      fontWeight: normalizedWeight,
    };
  };

  const getPrintWeightStyle = (): React.CSSProperties => {
    const { baseWeight } = getPrintWeightProfile();
    return { fontWeight: baseWeight };
  };

  return (
    <div ref={previewRef} className={`border rounded-lg p-3 max-w-[80mm] mx-auto shadow-inner transition-colors ${darkBg ? 'bg-gray-800 text-white' : 'bg-white text-foreground'}`}
      style={{ fontFamily: settings.fontFamily || 'monospace', transform: `scale(${zoom})`, transformOrigin: 'top center', ...getPrintWeightStyle() }}>
      {!settings.sections.some((s: TemplateSection) => s.type === 'logo') && settings.logo?.enabled && settings.logo?.url && (
        <div style={{ textAlign: settings.logo.align, ...getSectionBoxStyle(settings.logo) }}>
          <img
            src={settings.logo.url}
            alt="Logo"
            style={{
              width: `${settings.logo.width}px`,
              display: 'inline-block',
              borderRadius: settings.logo.borderRadius ? `${settings.logo.borderRadius}px` : undefined,
            }}
          />
        </div>
      )}
      <div className="space-y-0">
        {settings.sections.map((section: TemplateSection) => renderSection(section))}
      </div>
    </div>
  );
};

// ─── Main Editor Component ───────────────────────────────────────────
const PrintTemplateDragEditor = () => {
  const printSettings = usePrintSettings();
  const {
    settings, updateSettings, updateColumnWidths, updateFontSizes,
    updateTextFormat, updateSpacing, updateCustomLabels, updateInfoRows, updateSections,
    toggleSectionVisibility, updateSection, addCustomSection, removeSection,
    resetToDefaults, saveToDatabase, isSaving,
    updateLogo, updateBankSettings, updateDivider, updateFontFamily, updatePrintWeight, exportSettings, importSettings,
    templateName, setTemplateName, templates, loadTemplate, deleteTemplate, setDefaultTemplate,
  } = printSettings;

  const prevSettingsRef = useRef(settings);
  const { undo, redo, canUndo, canRedo, pushHistory } = usePrintSettingsHistory(
    settings,
    (newSettings) => {
      updateSettings({
        storeName: newSettings.storeName, storeAddress: newSettings.storeAddress,
        storePhone: newSettings.storePhone, footerText: newSettings.footerText,
        customLabels: newSettings.customLabels,
        infoRows: newSettings.infoRows,
      });
      updateFontSizes(newSettings.fontSizes);
      updateSpacing(newSettings.spacing);
      updateSections(newSettings.sections);
      updateColumnWidths(newSettings.columnWidths);
    }
  );

  useEffect(() => {
    if (JSON.stringify(prevSettingsRef.current) !== JSON.stringify(settings)) {
      pushHistory(prevSettingsRef.current);
      prevSettingsRef.current = settings;
    }
  }, [settings, pushHistory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [darkBg, setDarkBg] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = settings.sections.findIndex(s => s.id === active.id);
      const newIndex = settings.sections.findIndex(s => s.id === over.id);
      updateSections(arrayMove(settings.sections, oldIndex, newIndex));
    }
  };

  const handleSave = async () => { await saveToDatabase(); };
  const handleReset = () => { resetToDefaults(); toast({ title: "Đã khôi phục", description: "Cài đặt mẫu in đã được khôi phục về mặc định" }); };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED_TYPES: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    if (!ALLOWED_TYPES[file.type]) {
      toast({ title: "Lỗi", description: "Chỉ chấp nhận PNG, JPEG, GIF, WEBP", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({ title: "Lỗi", description: "Kích thước file tối đa 2MB", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = ALLOWED_TYPES[file.type];
      const path = `${user.id}/logo.${ext}`;
      await supabase.storage.from('store-logos').upload(path, file, { upsert: true, contentType: file.type });
      const { data: { publicUrl } } = supabase.storage.from('store-logos').getPublicUrl(path);
      updateLogo({ url: `${publicUrl}?t=${Date.now()}`, enabled: true });
      toast({ title: "Đã tải lên", description: "Logo đã được cập nhật" });
    } catch (err) {
      console.error(err);
      toast({ title: "Lỗi", description: "Không thể tải logo lên", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderSectionSettings = (section: TemplateSection) => {
    const commonProps = { settings, updateSettings, updateFontSizes, updateTextFormat, updateSpacing, updateColumnWidths, updateCustomLabels, updateInfoRows };
    switch (section.type) {
      case 'header': return <HeaderSettings {...commonProps} />;
      case 'title': return <TitleSettings {...commonProps} />;
      case 'info': return <InfoSettings {...commonProps} />;
      case 'items': return <ItemsSettings {...commonProps} />;
      case 'totals': return <TotalsSettings {...commonProps} />;
      case 'footer': return <FooterSettings {...commonProps} />;
      case 'logo':
        return (
          <LogoSettingsPanel
            settings={settings}
            updateLogo={updateLogo}
            onUploadClick={() => fileInputRef.current?.click()}
            isUploading={isUploading}
          />
        );
      case 'custom-text': return <CustomTextSettings section={section} onUpdate={(u) => updateSection(section.id, u)} />;
      case 'separator': return <p className="text-xs text-muted-foreground">Đường kẻ phân cách giữa các phần</p>;
      case 'qr-code': return <QrCodeSectionSettings section={section} onUpdate={(u) => updateSection(section.id, u)} bankSettings={settings.bankSettings} onUpdateBank={updateBankSettings} />;
      default: return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />Thiết kế mẫu in</h3>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" className="h-8 w-8" onClick={undo} disabled={!canUndo}><Undo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Hoàn tác (Ctrl+Z)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" className="h-8 w-8" onClick={redo} disabled={!canRedo}><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Làm lại (Ctrl+Shift+Z)</TooltipContent></Tooltip>
              <div className="w-px h-6 bg-border mx-1" />
              <Button onClick={handleSave} size="sm" className="gap-1" disabled={isSaving}><Save className="h-3.5 w-3.5" />{isSaving ? "Lưu..." : "Lưu"}</Button>
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-1"><RotateCcw className="h-3.5 w-3.5" />Mặc định</Button>
            </div>
          </div>
          <Tabs defaultValue="layout" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="layout" className="gap-1 text-xs"><Layout className="h-3.5 w-3.5" />Bố cục</TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1 text-xs"><Settings2 className="h-3.5 w-3.5" />Nâng cao</TabsTrigger>
            </TabsList>
            
            <TabsContent value="layout">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Kéo thả để sắp xếp • Bấm vào để chỉnh sửa • Tùy chỉnh margin/padding/border cho từng phần</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={settings.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {settings.sections.map((section) => (
                        <SortableSectionItem
                          key={section.id} section={section}
                          isExpanded={expandedSection === section.id}
                          isActive={expandedSection === section.id}
                          onToggleExpand={() => setExpandedSection(prev => prev === section.id ? null : section.id)}
                          onToggleVisibility={() => toggleSectionVisibility(section.id)}
                          onUpdateSection={(updates) => updateSection(section.id, updates)}
                          onRemove={(section.type === 'separator' || section.type === 'custom-text' || section.type === 'qr-code' || section.type === 'logo') ? () => removeSection(section.id) : undefined}
                        >
                          {renderSectionSettings(section)}
                          <SectionBoxControls section={section} onUpdate={(updates) => updateSection(section.id, updates)} />
                        </SortableSectionItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-1 flex-wrap">
                  {!settings.sections.some(s => s.type === 'logo' || s.id === 'logo') && (
                    <Button size="sm" variant="outline" onClick={() => addCustomSection('logo')} className="gap-1 text-xs"><Image className="h-3 w-3" /> Logo</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => addCustomSection('separator')} className="gap-1 text-xs"><Minus className="h-3 w-3" /> Đường kẻ</Button>
                  <Button size="sm" variant="outline" onClick={() => addCustomSection('custom-text', 'Nội dung tùy chỉnh')} className="gap-1 text-xs"><Type className="h-3 w-3" /> Văn bản</Button>
                  <Button size="sm" variant="outline" onClick={() => addCustomSection('qr-code')} className="gap-1 text-xs"><QrCode className="h-3 w-3" /> Mã QR</Button>
                </div>

                <Card className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Giữa các dòng cùng mục</span>
                    <Slider value={[settings.spacing.lineSpacing]} onValueChange={([v]) => updateSpacing({ lineSpacing: v })} min={0} max={10} step={1} className="flex-1" />
                    <span className="text-xs w-8 text-right">{settings.spacing.lineSpacing}px</span>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="advanced">
              <div className="space-y-4">
                {/* Font Family */}
                <Card className="p-3 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1"><Type className="h-3 w-3" /> Font chữ</Label>
                  <Select value={settings.fontFamily || 'monospace'} onValueChange={(v) => updateFontFamily(v as FontFamily)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="monospace">Monospace (mặc định)</SelectItem>
                      <SelectItem value="sans-serif">Sans-serif</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Verdana">Verdana</SelectItem>
                      <SelectItem value="Tahoma">Tahoma</SelectItem>
                      <SelectItem value="Trebuchet MS">Trebuchet MS</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                      <SelectItem value="Consolas">Consolas</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Font chữ áp dụng cho toàn bộ hóa đơn</p>
                </Card>

                {/* Print Weight */}
                <Card className="p-3 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1"><Type className="h-3 w-3" /> Độ đậm bản in</Label>
                  <Select value={settings.printWeight || 'normal'} onValueChange={(v) => updatePrintWeight(v as any)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="light">Nhẹ</SelectItem>
                      <SelectItem value="normal">Vừa (mặc định)</SelectItem>
                      <SelectItem value="bold">Đậm</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Điều chỉnh độ đậm nét chữ khi in trên máy in nhiệt</p>
                </Card>

                {/* Logo */}
                <Card className="p-3 space-y-3">
                  <LogoSettingsPanel
                    settings={settings}
                    updateLogo={updateLogo}
                    onUploadClick={() => fileInputRef.current?.click()}
                    isUploading={isUploading}
                  />
                  {settings.logo?.url && (
                    <BoxControls
                      box={settings.logo}
                      onUpdate={(updates) => updateLogo(updates)}
                      title="Đường kẻ ngăn cách của logo"
                    />
                  )}
                </Card>

                {/* Đường kẻ ngang */}
                <Card className="p-3 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1"><Layout className="h-3 w-3" /> Đường kẻ ngang</Label>
                  {(Object.keys(DIVIDER_NAMES) as DividerId[]).map((id) => {
                    const d = (settings.dividers || DEFAULT_DIVIDERS)[id] || DEFAULT_DIVIDERS[id];
                    return (
                      <div key={id} className="border rounded p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs">{DIVIDER_NAMES[id]}</span>
                          <Switch checked={d.enabled} onCheckedChange={(v) => updateDivider(id, { enabled: v })} />
                        </div>
                        {d.enabled && (
                          <div className="flex items-center gap-2">
                            <Select value={d.style} onValueChange={(v: 'solid' | 'dashed' | 'dotted') => updateDivider(id, { style: v })}>
                              <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid" className="text-xs">Liền</SelectItem>
                                <SelectItem value="dashed" className="text-xs">Nét đứt</SelectItem>
                                <SelectItem value="dotted" className="text-xs">Chấm</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={d.color} onValueChange={(v: 'foreground' | 'muted') => updateDivider(id, { color: v })}>
                              <SelectTrigger className="h-7 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="foreground" className="text-xs">Đậm</SelectItem>
                                <SelectItem value="muted" className="text-xs">Nhạt</SelectItem>
                              </SelectContent>
                            </Select>
                            <Slider value={[d.width]} onValueChange={([v]) => updateDivider(id, { width: v })} min={1} max={4} step={1} className="w-16" />
                            <span className="text-[10px] w-6 text-right">{d.width}px</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>

                {/* Export/Import */}
                <Card className="p-3 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1"><Download className="h-3 w-3" /> Xuất / Nhập cấu hình</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs flex-1" onClick={exportSettings}><Download className="h-3 w-3" />Xuất JSON</Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs flex-1" onClick={() => importInputRef.current?.click()}><Upload className="h-3 w-3" />Nhập JSON</Button>
                    <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importSettings(f); if (importInputRef.current) importInputRef.current.value = ''; }} />
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleLogoUpload} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Xuất file JSON để backup hoặc chia sẻ cấu hình giữa các thiết bị</p>
                </Card>

                {/* Multi-template */}
                <Card className="p-3 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-1"><Copy className="h-3 w-3" /> Quản lý mẫu in</Label>
                  <p className="text-xs text-muted-foreground">Mẫu hiện tại: <span className="font-medium text-foreground">{templateName}</span></p>
                  {templates.length > 0 && (
                    <div className="space-y-1">
                      {templates.map((t) => (
                        <div key={t.template_name} className="flex items-center gap-1 border rounded px-2 py-1.5 text-xs">
                          <button onClick={() => loadTemplate(t.template_name)} className="flex-1 text-left hover:text-primary truncate">{t.template_name}</button>
                          <button onClick={() => setDefaultTemplate(t.template_name)} title={t.is_default ? 'Mẫu mặc định' : 'Đặt làm mặc định'}>
                            {t.is_default ? <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-3 w-3 text-muted-foreground hover:text-yellow-500" />}
                          </button>
                          {templates.length > 1 && (
                            <button onClick={() => deleteTemplate(t.template_name)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTemplateName.trim()) {
                          e.preventDefault();
                          saveToDatabase(newTemplateName.trim());
                          setNewTemplateName('');
                        }
                      }}
                      placeholder="Tên mẫu mới..."
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs shrink-0"
                      disabled={!newTemplateName.trim()}
                      onClick={() => {
                        saveToDatabase(newTemplateName.trim());
                        setNewTemplateName('');
                      }}
                    >
                      <Plus className="h-3 w-3" />Lưu mới
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-center flex-1">Xem trước mẫu in</h3>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Thu nhỏ</TooltipContent></Tooltip>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Phóng to</TooltipContent></Tooltip>
              <div className="w-px h-6 bg-border mx-1" />
              <Tooltip><TooltipTrigger asChild><Button size="icon" variant={darkBg ? "default" : "outline"} className="h-8 w-8" onClick={() => setDarkBg(!darkBg)}>{darkBg ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent>{darkBg ? "Nền sáng" : "Nền tối (test in nhiệt)"}</TooltipContent></Tooltip>
            </div>
          </div>
          <div className="sticky top-4 overflow-auto max-h-[80vh]">
            <div className="max-w-[80mm] mx-auto mb-1"><div className="h-2 bg-muted rounded-full relative"><div className="absolute inset-0 flex justify-between px-1 items-center"><span className="text-[8px] text-muted-foreground">0</span><span className="text-[8px] text-muted-foreground">80mm</span></div></div></div>
            <LivePreview settings={settings} activeSection={expandedSection} zoom={zoom} darkBg={darkBg} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PrintTemplateDragEditor;
