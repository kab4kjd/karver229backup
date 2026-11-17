import { useState, useEffect, useRef, useCallback } from "react"; // time input
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  checkIn: string;
  checkOut: string;
  checkInDate: string;
  checkOutDate: string;
  duration: number;
  actualDuration?: number;
  onCheckInChange: (time: string) => void;
  onCheckOutChange: (time: string) => void;
  onCheckInDateChange: (date: string) => void;
  onCheckOutDateChange: (date: string) => void;
  isEditing?: boolean;
  isRealTime?: boolean;
  onToggleRealTime?: (val: boolean) => void;
}

const formatDateTimeDisplay = (date: string, time: string) => {
  if (!date) {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year} ${time}`;
  }
  const [y, m, d] = date.split('-').map(Number);
  const day = d.toString().padStart(2, '0');
  const month = m.toString().padStart(2, '0');
  return `${day}/${month}/${y} ${time}`;
};

const parseInputValue = (value: string) => {
  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})$/;
  const match = value.trim().match(regex);

  if (match) {
    const [, day, month, year, hour, minute] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const h = parseInt(hour, 10);
    const min = parseInt(minute, 10);

    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2099 && h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      const newDate = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const newTime = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      return { date: newDate, time: newTime };
    }
  }
  return null;
};

const parseDate = (date: string) => {
  if (!date) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A single date-time text field with calendar popover */
const DateTimeField = ({
  date,
  time,
  disabled = false,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  disabled?: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) => {
  const [localValue, setLocalValue] = useState(() => formatDateTimeDisplay(date, time));
  const [isCalOpen, setIsCalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);

  // Sync from parent when NOT focused (avoids overwriting user typing)
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(formatDateTimeDisplay(date, time));
    }
  }, [date, time]);

  const commitValue = useCallback((val: string) => {
    const parsed = parseInputValue(val);
    if (parsed) {
      onDateChange(parsed.date);
      onTimeChange(parsed.time);
    } else {
      // Reset to last valid value
      setLocalValue(formatDateTimeDisplay(date, time));
    }
  }, [date, time, onDateChange, onTimeChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    // Live-sync if valid
    const parsed = parseInputValue(v);
    if (parsed) {
      onDateChange(parsed.date);
      onTimeChange(parsed.time);
    }
  };

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleBlur = () => {
    isFocused.current = false;
    commitValue(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(localValue);
      inputRef.current?.blur();
    }
  };

  const handleCalSelect = (d: Date | undefined) => {
    if (!d) return;
    const newDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    onDateChange(newDate);
    setLocalValue(formatDateTimeDisplay(newDate, time));
    setIsCalOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="DD/MM/YYYY HH:MM"
        className="h-8 text-xs sm:text-sm w-[135px] sm:w-[150px] px-2"
        disabled={disabled}
      />
      <Popover open={isCalOpen} onOpenChange={setIsCalOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 flex items-center justify-center p-0 rounded border border-input bg-background hover:bg-accent shrink-0",
              disabled && "opacity-50 pointer-events-none"
            )}
            disabled={disabled}
            title="Chọn ngày"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={parseDate(date)}
            onSelect={handleCalSelect}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

const TimeInput = ({
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
  isEditing = false,
  isRealTime = true,
  onToggleRealTime,
}: TimeInputProps) => {
  const [internalRealTime, setInternalRealTime] = useState(!isEditing);

  const effectiveRealTime = onToggleRealTime !== undefined ? isRealTime : internalRealTime;

  useEffect(() => {
    if (isEditing) {
      if (onToggleRealTime) {
        onToggleRealTime(false);
      } else {
        setInternalRealTime(false);
      }
    }
  }, [isEditing, onToggleRealTime]);

  const handleCheckOutTimeChange = useCallback((time: string) => {
    if (onToggleRealTime) {
      onToggleRealTime(false);
    } else {
      setInternalRealTime(false);
    }
    onCheckOutChange(time);
  }, [onCheckOutChange, onToggleRealTime]);

  const handleCheckOutDateChange = useCallback((date: string) => {
    if (onToggleRealTime) {
      onToggleRealTime(false);
    } else {
      setInternalRealTime(false);
    }
    onCheckOutDateChange(date);
  }, [onCheckOutDateChange, onToggleRealTime]);

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h} giờ ${m} phút`;
  };

  // Update check-out to current time initially if not set
  useEffect(() => {
    if (effectiveRealTime && !checkOut) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      onCheckOutChange(currentTime);
      onCheckOutDateChange(currentDate);
    }
  }, [effectiveRealTime, checkOut, onCheckOutChange, onCheckOutDateChange]);

  // Auto-update current time when running in real-time mode
  useEffect(() => {
    if (effectiveRealTime && !isEditing) {
      const interval = setInterval(() => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        onCheckOutChange(currentTime);
        onCheckOutDateChange(currentDate);
      }, 5000); // Check every 5 seconds for crisp minute transitions
      return () => clearInterval(interval);
    }
  }, [effectiveRealTime, isEditing, onCheckOutChange, onCheckOutDateChange]);

  return (
    <Card className="p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Check-in */}
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">Vào:</Label>
          <DateTimeField
            date={checkInDate}
            time={checkIn}
            onDateChange={onCheckInDateChange}
            onTimeChange={onCheckInChange}
          />
        </div>

        {/* Check-out */}
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">Ra:</Label>
          <DateTimeField
            date={checkOutDate}
            time={checkOut}
            onDateChange={handleCheckOutDateChange}
            onTimeChange={handleCheckOutTimeChange}
          />
        </div>

        {/* Span thể hiện thời lượng nằm thẳng hàng phía sau */}
        {(actualDuration ?? duration) > 0 && (
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1.5 rounded whitespace-nowrap shrink-0">
            {formatDuration(actualDuration ?? duration)}
          </span>
        )}
      </div>
    </Card>
  );
};

export default TimeInput;
