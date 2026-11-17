import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Box, Maximize2 } from "lucide-react";
import type { SectionMargin, SectionPadding, SectionBorder, TemplateSection } from "@/hooks/usePrintSettings";
import { DEFAULT_MARGIN, DEFAULT_PADDING, DEFAULT_BORDER } from "@/hooks/usePrintSettings";

export interface BoxModel {
  margin?: SectionMargin;
  padding?: SectionPadding;
  border?: SectionBorder;
  showBorder?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}

export const MarginPaddingControl = ({
  label, icon, values, onChange
}: {
  label: string;
  icon: React.ReactNode;
  values: { top: number; bottom: number; left: number; right: number };
  onChange: (v: { top: number; bottom: number; left: number; right: number }) => void;
}) => (
  <Collapsible>
    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full py-1">
      {icon}
      {label}
      <ChevronDown className="h-3 w-3 ml-auto" />
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-1.5 pt-1">
      {(["top", "bottom", "left", "right"] as const).map((side) => (
        <div key={side} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-10 capitalize">
            {side === "top" ? "Trên" : side === "bottom" ? "Dưới" : side === "left" ? "Trái" : "Phải"}
          </span>
          <Slider
            value={[values?.[side] ?? 0]}
            onValueChange={([v]) => onChange({ ...values, [side]: v })}
            min={0} max={30} step={1}
            className="flex-1"
          />
          <span className="text-[10px] w-6 text-right">{values?.[side] ?? 0}px</span>
        </div>
      ))}
    </CollapsibleContent>
  </Collapsible>
);

export const BorderControl = ({
  border, onChange
}: {
  border: SectionBorder;
  onChange: (b: SectionBorder) => void;
}) => {
  const currentBorder = border || DEFAULT_BORDER;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full py-1">
        <Box className="h-3 w-3" />
        Đường viền chi tiết
        <ChevronDown className="h-3 w-3 ml-auto" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1.5">
              <Switch
                checked={currentBorder[side] ?? false}
                onCheckedChange={(checked) => onChange({ ...currentBorder, [side]: checked })}
              />
              <span className="text-[10px]">
                {side === "top" ? "Trên" : side === "bottom" ? "Dưới" : side === "left" ? "Trái" : "Phải"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Kiểu</span>
          <Select value={currentBorder.style || 'solid'} onValueChange={(v: 'solid' | 'dashed' | 'dotted') => onChange({ ...currentBorder, style: v })}>
            <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid" className="text-xs">Liền</SelectItem>
              <SelectItem value="dashed" className="text-xs">Nét đứt</SelectItem>
              <SelectItem value="dotted" className="text-xs">Chấm</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">Dày</span>
          <Slider
            value={[currentBorder.width ?? 1]}
            onValueChange={([v]) => onChange({ ...currentBorder, width: v })}
            min={1} max={4} step={1}
            className="w-16"
          />
          <span className="text-[10px] w-4">{currentBorder.width ?? 1}</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const BoxControls = ({
  box,
  onUpdate,
  title = "Đường kẻ ngăn cách của phần"
}: {
  box: BoxModel;
  onUpdate: (updates: Partial<BoxModel>) => void;
  title?: string;
}) => {
  const margin = box?.margin || DEFAULT_MARGIN;
  const padding = box?.padding || DEFAULT_PADDING;
  const border = box?.border || DEFAULT_BORDER;

  return (
    <div className="border-t pt-2 mt-2 space-y-1">
      <div className="flex items-center gap-2 py-1">
        <Switch
          checked={box?.showBorder ?? false}
          onCheckedChange={(checked) => onUpdate({ showBorder: checked })}
        />
        <span className="text-[10px] flex-1">{title}</span>
        {box?.showBorder && (
          <Select value={box?.borderStyle || 'solid'} onValueChange={(v: 'solid' | 'dashed' | 'dotted') => onUpdate({ borderStyle: v })}>
            <SelectTrigger className="h-6 text-[10px] w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid" className="text-xs">Liền</SelectItem>
              <SelectItem value="dashed" className="text-xs">Nét đứt</SelectItem>
              <SelectItem value="dotted" className="text-xs">Chấm</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <MarginPaddingControl
        label="Margin (lề ngoài)"
        icon={<Maximize2 className="h-3 w-3" />}
        values={margin}
        onChange={(v) => onUpdate({ margin: v })}
      />
      <MarginPaddingControl
        label="Padding (lề trong)"
        icon={<Box className="h-3 w-3" />}
        values={padding}
        onChange={(v) => onUpdate({ padding: v })}
      />
      <BorderControl
        border={border}
        onChange={(b) => onUpdate({ border: b })}
      />
    </div>
  );
};

interface SectionBoxControlsProps {
  section: TemplateSection;
  onUpdate: (updates: Partial<TemplateSection>) => void;
}

const SectionBoxControls = ({ section, onUpdate }: SectionBoxControlsProps) => {
  return <BoxControls box={section} onUpdate={onUpdate} />;
};

export default SectionBoxControls;
