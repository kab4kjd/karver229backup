export interface RoomTimeSlot {
  id: string;
  name?: string;       // e.g. "08:00 - 18:00", "18:00 - 08:00", "08:00 - 13:00"
  startTime?: string;  // "HH:mm" in 24h format, e.g. "08:00"
  endTime?: string;    // "HH:mm" in 24h format, e.g. "18:00" (or next day like "02:00")
  start?: string;      // alias for startTime
  end?: string;        // alias for endTime
  price?: number;      // VNĐ per hour
  pricePerHour?: number; // alias for price
  blockMinutes?: number; // block rounding in minutes for this slot (e.g. 1, 3, 5, 15, 30, 60 mins)
}

export interface RoomTimeSegment {
  id: string;
  slotName?: string;     // e.g. "08:00 - 18:00"
  startTime: string;     // Formatted display time in 24h, e.g. "14:00" or "27/08 14:00"
  endTime: string;       // Formatted display time in 24h, e.g. "18:00" or "27/08 18:00"
  hours: number;         // Billable hours (after slot block rounding)
  actualHours: number;   // Raw actual hours spent
  pricePerHour: number;  // Price applied in this segment
  amount: number;        // Total price for this segment
  blockMinutes?: number; // Block minutes applied for this segment
}

export interface RoomTimeCalculationResult {
  totalDuration: number;        // Total billable hours
  actualDuration: number;       // Raw duration in hours
  totalHours: number;           // Alias for totalDuration
  actualHours: number;          // Alias for actualDuration
  totalAmount: number;          // Total amount in VNĐ for room time
  averagePricePerHour: number;  // Weighted average hourly rate
  segments: RoomTimeSegment[];  // Breakdown by 24h time frames
  isTimeSlotPricing: boolean;   // Whether time slots were applied
  hasMultipleRates: boolean;    // Whether more than one rate was used
  hasMultipleSlots: boolean;    // Whether the room applies multiple different time slots
}

// Convert "HH:mm" to minutes from 00:00 (0 to 1439) in 24h clock
export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Convert minutes to "HH:mm" in 24h format
export const minutesToTimeString = (minutes: number): string => {
  const normalized = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// Check if a minute of the day (0..1439) falls inside a slot's [start, end)
export const isMinuteInSlot = (minuteOfDay: number, slotStartStr: string, slotEndStr: string): boolean => {
  const start = timeStringToMinutes(slotStartStr);
  const end = timeStringToMinutes(slotEndStr);

  if (start === end) return true; // full 24h

  if (start < end) {
    // Normal same-day slot (e.g. 08:00 to 18:00)
    return minuteOfDay >= start && minuteOfDay < end;
  } else {
    // Overnight slot (e.g. 18:00 to 08:00) -> [start, 1440) OR [0, end)
    return minuteOfDay >= start || minuteOfDay < end;
  }
};

interface CalculateParams {
  checkInDate: string;
  checkIn: string;
  checkOutDate: string;
  checkOut: string;
  defaultPrice: number;
  timeSlots?: RoomTimeSlot[];
  useTimeSlots?: boolean;
  blockMinutes?: number;
}

// Clean old legacy names like "Ban ngày", "Giờ tối", "Sáng", "Chiều", "Buổi tối & Đêm" to 24h format
export function sanitizeSlotName(name?: string, startTime?: string, endTime?: string): string {
  const s = startTime || "";
  const e = endTime || "";
  const fallback24h = s && e ? `${s} - ${e}` : (s || e || "");

  if (!name || !name.trim()) return fallback24h;

  const lower = name.trim().toLowerCase();
  if (
    lower.includes("ban ngày") ||
    lower.includes("giờ tối") ||
    lower.includes("buổi tối") ||
    lower.includes("sáng") ||
    lower.includes("chiều") ||
    lower.includes("tối") ||
    lower === "default" ||
    lower === "tiêu chuẩn"
  ) {
    return fallback24h || name.trim();
  }

  return name.trim();
}

/**
 * Calculates accurate room time charges across time frames with 24h format and block options.
 * Supports overnight sessions, multi-day spans, per-slot block rounding, and custom slot prices.
 */
export function calculateRoomTimeCharges({
  checkInDate,
  checkIn,
  checkOutDate,
  checkOut,
  defaultPrice,
  timeSlots = [],
  useTimeSlots = false,
  blockMinutes = 5,
}: CalculateParams): RoomTimeCalculationResult {
  const emptyResult: RoomTimeCalculationResult = {
    totalDuration: 0,
    actualDuration: 0,
    totalHours: 0,
    actualHours: 0,
    totalAmount: 0,
    averagePricePerHour: defaultPrice,
    segments: [],
    isTimeSlotPricing: false,
    hasMultipleRates: false,
    hasMultipleSlots: false,
  };

  if (!checkIn || !checkOut || !checkInDate || !checkOutDate) {
    return emptyResult;
  }

  const startMs = new Date(`${checkInDate}T${checkIn}:00`).getTime();
  const endMs = new Date(`${checkOutDate}T${checkOut}:00`).getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return emptyResult;
  }

  const actualMinutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
  const actualDuration = actualMinutes / 60;
  const defaultRoomBlock = blockMinutes && blockMinutes > 0 ? blockMinutes : 5;

  // Normalize slot fields: start vs startTime, end vs endTime, price vs pricePerHour, blockMinutes
  const rawCustomSlots = (timeSlots || [])
    .map((s) => {
      const startTime = s.startTime || s.start || "";
      const endTime = s.endTime || s.end || "";
      const rawPrice = typeof s.price === "number" ? s.price : (typeof s.pricePerHour === "number" ? s.pricePerHour : defaultPrice);
      const slotBlock = typeof s.blockMinutes === "number" && s.blockMinutes > 0 ? s.blockMinutes : defaultRoomBlock;
      return {
        id: s.id,
        name: sanitizeSlotName(s.name, startTime, endTime),
        startTime,
        endTime,
        price: rawPrice,
        blockMinutes: slotBlock,
      };
    })
    .filter(
      (s) => s.startTime && s.endTime && typeof s.price === "number" && s.price >= 0
    );

  // Active 24h slots
  const isCustomTimeSlots = useTimeSlots && rawCustomSlots.length > 0;
  const hasMultipleSlots = useTimeSlots && rawCustomSlots.length > 1;
  const activeSlots = isCustomTimeSlots
    ? rawCustomSlots
    : [
        {
          id: "default_24h",
          name: "",
          startTime: "00:00",
          endTime: "00:00",
          price: defaultPrice,
          blockMinutes: defaultRoomBlock,
        },
      ];

  // Map each minute to matching 24h slot
  const minuteSlots: {
    slotId: string;
    slotName: string;
    price: number;
    blockMinutes: number;
    timestamp: number;
  }[] = [];

  for (let m = 0; m < actualMinutes; m++) {
    const currentTimestamp = startMs + m * 60 * 1000;
    const currentDate = new Date(currentTimestamp);
    const minuteOfDay = currentDate.getHours() * 60 + currentDate.getMinutes();

    // Find matching slot (first match takes priority)
    const matchingSlot = activeSlots.find((s) => isMinuteInSlot(minuteOfDay, s.startTime, s.endTime));

    if (matchingSlot) {
      minuteSlots.push({
        slotId: matchingSlot.id,
        slotName: matchingSlot.name || "",
        price: matchingSlot.price,
        blockMinutes: matchingSlot.blockMinutes,
        timestamp: currentTimestamp,
      });
    } else {
      minuteSlots.push({
        slotId: "default",
        slotName: "",
        price: defaultPrice,
        blockMinutes: defaultRoomBlock,
        timestamp: currentTimestamp,
      });
    }
  }

  // Group adjacent minutes or segments with the same price into discrete segments
  const rawSegments: {
    slotId: string;
    slotName: string;
    price: number;
    blockMinutes: number;
    startTs: number;
    endTs: number;
    minutes: number;
  }[] = [];

  let currentGroup: {
    slotId: string;
    slotName: string;
    price: number;
    blockMinutes: number;
    startTs: number;
    endTs: number;
    minutes: number;
  } | null = null;

  for (let i = 0; i < minuteSlots.length; i++) {
    const item = minuteSlots[i];
    if (!currentGroup) {
      currentGroup = {
        slotId: item.slotId,
        slotName: item.slotName,
        price: item.price,
        blockMinutes: item.blockMinutes,
        startTs: item.timestamp,
        endTs: item.timestamp + 60 * 1000,
        minutes: 1,
      };
    } else if (currentGroup.price === item.price) {
      // If the price is the same, merge regardless of slotId so that identical rates are grouped automatically
      currentGroup.endTs = item.timestamp + 60 * 1000;
      currentGroup.minutes += 1;
      // If slot names differ, we can combine or keep the first / active one
      if (currentGroup.slotId !== item.slotId && !currentGroup.slotName.includes(item.slotName)) {
        currentGroup.slotName = `${currentGroup.slotName}, ${item.slotName}`;
      }
    } else {
      rawSegments.push(currentGroup);
      currentGroup = {
        slotId: item.slotId,
        slotName: item.slotName,
        price: item.price,
        blockMinutes: item.blockMinutes,
        startTs: item.timestamp,
        endTs: item.timestamp + 60 * 1000,
        minutes: 1,
      };
    }
  }
  if (currentGroup) {
    rawSegments.push(currentGroup);
  }

  // Group / aggregate rawSegments by slotId and price so that identical rates across the session are automatically grouped into a single row
  const aggregatedMap = new Map<string, {
    slotId: string;
    slotName: string;
    price: number;
    blockMinutes: number;
    minutes: number;
    startTs: number;
    endTs: number;
  }>();

  for (const seg of rawSegments) {
    const key = `${seg.slotId}_${seg.price}`;
    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        slotId: seg.slotId,
        slotName: seg.slotName,
        price: seg.price,
        blockMinutes: seg.blockMinutes,
        minutes: seg.minutes,
        startTs: seg.startTs,
        endTs: seg.endTs,
      });
    } else {
      const existing = aggregatedMap.get(key)!;
      existing.minutes += seg.minutes;
      if (seg.startTs < existing.startTs) existing.startTs = seg.startTs;
      if (seg.endTs > existing.endTs) existing.endTs = seg.endTs;
    }
  }

  const consolidatedSegments = Array.from(aggregatedMap.values());

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    return `${day}/${month} ${hours}:${mins}`;
  };

  const formatTimeOnly = (ts: number) => {
    const d = new Date(ts);
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    return `${hours}:${mins}`;
  };

  // Convert consolidatedSegments to RoomTimeSegments with block calculation per segment
  const isMultiDay = checkInDate !== checkOutDate;
  const segments: RoomTimeSegment[] = consolidatedSegments.map((seg, idx) => {
    const slotBlock = seg.blockMinutes > 0 ? seg.blockMinutes : defaultRoomBlock;
    // Billed minutes rounded by slot block
    const billedSegMinutes = Math.max(slotBlock, Math.ceil(seg.minutes / slotBlock) * slotBlock);
    const hours = billedSegMinutes / 60;
    const actualSegHours = seg.minutes / 60;
    const amount = Math.round(hours * seg.price);

    return {
      id: `${seg.slotId}_${idx}`,
      slotName: seg.slotName,
      startTime: isMultiDay ? formatTs(seg.startTs) : formatTimeOnly(seg.startTs),
      endTime: isMultiDay ? formatTs(seg.endTs) : formatTimeOnly(seg.endTs),
      hours,
      actualHours: actualSegHours,
      pricePerHour: seg.price,
      amount,
      blockMinutes: slotBlock,
    };
  });

  const totalDuration = segments.reduce((sum, s) => sum + s.hours, 0);
  const totalAmount = segments.reduce((sum, s) => sum + s.amount, 0);
  const averagePricePerHour = totalDuration > 0 ? Math.round(totalAmount / totalDuration) : defaultPrice;
  const distinctPrices = new Set(segments.map((s) => s.pricePerHour));
  const hasMultipleRates = distinctPrices.size > 1;

  return {
    totalDuration,
    actualDuration,
    totalHours: totalDuration,
    actualHours: actualDuration,
    totalAmount,
    averagePricePerHour,
    segments,
    isTimeSlotPricing: isCustomTimeSlots,
    hasMultipleRates,
    hasMultipleSlots,
  };
}
