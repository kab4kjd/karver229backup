import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { TextFormat, TextAlign, FontWeight } from "@/hooks/usePrintSettings";

interface PrintFormatToolbarProps {
  format: TextFormat;
  onChange: (format: Partial<TextFormat>) => void;
}

const FONT_WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: 100, label: "Thin" },
  { value: 200, label: "ExtraLight" },
  { value: 300, label: "Light" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Medium" },
  { value: 600, label: "SemiBold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "ExtraBold" },
  { value: 900, label: "Black" },
];

const PrintFormatToolbar = ({ format, onChange }: PrintFormatToolbarProps) => {
  const alignOptions: { value: TextAlign; icon: typeof AlignLeft }[] = [
    { value: "left", icon: AlignLeft },
    { value: "center", icon: AlignCenter },
    { value: "right", icon: AlignRight },
  ];

  const currentWeight = format.fontWeight ?? (format.bold ? 700 : 400);

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      <Button
        type="button"
        variant={format.bold ? "default" : "outline"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange({ bold: !format.bold })}
        title="In đậm"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant={format.italic ? "default" : "outline"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange({ italic: !format.italic })}
        title="In nghiêng"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant={format.underline ? "default" : "outline"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange({ underline: !format.underline })}
        title="Gạch chân"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {alignOptions.map(({ value, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant={format.align === value ? "default" : "outline"}
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange({ align: value })}
          title={`Căn ${value === "left" ? "trái" : value === "center" ? "giữa" : "phải"}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      <Select
        value={String(currentWeight)}
        onValueChange={(v) => onChange({ fontWeight: Number(v) as FontWeight })}
      >
        <SelectTrigger className="h-7 w-[100px] text-xs">
          <SelectValue placeholder="Weight" />
        </SelectTrigger>
        <SelectContent>
          {FONT_WEIGHTS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)} className="text-xs">
              {value} - {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PrintFormatToolbar;
