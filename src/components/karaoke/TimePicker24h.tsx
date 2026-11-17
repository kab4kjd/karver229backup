import React from "react";
import { cn } from "@/lib/utils";

interface TimePicker24hProps {
  value?: string; // "HH:mm" e.g. "08:00", "18:00"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export const TimePicker24h: React.FC<TimePicker24hProps> = ({
  value = "08:00",
  onChange,
  className,
  disabled = false,
}) => {
  const [hour, minute] = React.useMemo(() => {
    if (!value || !value.includes(":")) return ["08", "00"];
    const parts = value.split(":");
    const h = String(Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0))).padStart(2, "0");
    const m = String(Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0))).padStart(2, "0");
    return [h, m];
  }, [value]);

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newH = e.target.value;
    onChange(`${newH}:${minute}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newM = e.target.value;
    onChange(`${hour}:${newM}`);
  };

  // Ensure current minute exists in option list
  const minuteOptions = React.useMemo(() => {
    if (MINUTES_OPTIONS.includes(minute)) {
      return MINUTES_OPTIONS;
    }
    const all = [...MINUTES_OPTIONS, minute].sort((a, b) => Number(a) - Number(b));
    return Array.from(new Set(all));
  }, [minute]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-input bg-background px-1.5 py-1 text-sm font-sans shadow-xs focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <select
        value={hour}
        onChange={handleHourChange}
        disabled={disabled}
        className="bg-transparent text-center font-medium text-foreground focus:outline-hidden cursor-pointer h-7 px-1 rounded hover:bg-muted"
        title="Giờ chuẩn 24h (00 - 23h)"
      >
        {HOURS_24.map((h) => (
          <option key={h} value={h} className="bg-popover text-popover-foreground">
            {h}h
          </option>
        ))}
      </select>
      <span className="text-muted-foreground font-bold select-none">:</span>
      <select
        value={minute}
        onChange={handleMinuteChange}
        disabled={disabled}
        className="bg-transparent text-center font-medium text-foreground focus:outline-hidden cursor-pointer h-7 px-1 rounded hover:bg-muted"
        title="Phút (00 - 59p)"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m} className="bg-popover text-popover-foreground">
            {m}p
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimePicker24h;
