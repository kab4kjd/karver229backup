import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Invoice } from "@/pages/Index";
import { CalendarClock, Flame, BarChart3, Timer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface Session {
  room: string;
  roomType: string;
  start: Date;
  end: Date;
  hours: number;
}

/** Chuẩn hoá tên phòng thành "loại phòng" (bỏ số thứ tự cuối, giữ nguyên dấu chấm) */
const roomTypeOf = (name: string) => name.replace(/\s*\d+\s*$/, "").trim() || name;

export const useTimeSessions = (invoices: Invoice[]): Session[] =>
  useMemo(() => {
    return invoices
      .map((inv) => {
        const start = inv.checkInRaw ? new Date(inv.checkInRaw) : null;
        if (!start || Number.isNaN(start.getTime())) return null;
        const end = inv.checkOutRaw
          ? new Date(inv.checkOutRaw)
          : new Date(start.getTime() + (inv.duration || 0) * 3600 * 1000);
        if (Number.isNaN(end.getTime()) || end < start) return null;
        return {
          room: inv.roomName,
          roomType: roomTypeOf(inv.roomName),
          start,
          end,
          hours: (end.getTime() - start.getTime()) / 3600000,
        } as Session;
      })
      .filter(Boolean) as Session[];
  }, [invoices]);

const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const fmtDay = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const Empty = ({ h = 260 }: { h?: number }) => (
  <div style={{ height: h }} className="flex items-center justify-center text-muted-foreground">
    Không có dữ liệu
  </div>
);

/* ---------------- 1. Gantt / Timeline ---------------- */
export const RoomTimelineChart = ({ sessions }: { sessions: Session[] }) => {
  const data = useMemo(() => {
    if (sessions.length === 0) return null;
    const min = Math.min(...sessions.map((s) => s.start.getTime()));
    const max = Math.max(...sessions.map((s) => s.end.getTime()));
    const startMs = new Date(min).setMinutes(0, 0, 0);
    const endMs = new Date(max + 3599999).setMinutes(0, 0, 0);
    const span = Math.max(endMs - startMs, 3600000);
    const rooms = Array.from(new Set(sessions.map((s) => s.room))).sort((a, b) =>
      a.localeCompare(b, "vi")
    );
    const hourCount = Math.round(span / 3600000);
    const step = Math.max(1, Math.ceil(hourCount / 12));
    const ticks: { label: string; left: number }[] = [];
    for (let i = 0; i <= hourCount; i += step) {
      const t = new Date(startMs + i * 3600000);
      ticks.push({ label: fmtTime(t), left: (i * 3600000 * 100) / span });
    }
    return { startMs, span, rooms, ticks };
  }, [sessions]);

  return (
    <Card className="p-4 h-full">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4" />
        Lịch hoạt động từng phòng (Gantt)
      </h3>
      {!data ? (
        <Empty />
      ) : (
        <div className="overflow-auto max-h-[360px] pr-1">
          <div className="relative pl-24">
            <div className="relative h-5 mb-1">
              {data.ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                  style={{ left: `${t.left}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            {data.rooms.map((room) => (
              <div key={room} className="relative h-7 mb-1">
                <span className="absolute -left-24 top-1 w-[88px] text-xs truncate text-muted-foreground">
                  {room}
                </span>
                <div className="absolute inset-0 rounded bg-muted/50" />
                {sessions
                  .filter((s) => s.room === room)
                  .map((s, i) => {
                    const left = ((s.start.getTime() - data.startMs) * 100) / data.span;
                    const width = Math.max(
                      0.6,
                      ((s.end.getTime() - s.start.getTime()) * 100) / data.span
                    );
                    return (
                      <div
                        key={i}
                        title={`${room}: ${fmtDay(s.start)} ${fmtTime(s.start)} → ${fmtTime(s.end)} (${s.hours.toFixed(1)}h)`}
                        className="absolute top-0.5 bottom-0.5 rounded bg-primary/80 hover:bg-primary transition-colors"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ---------------- 2. Heatmap ---------------- */
const WEEKDAYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

function heatmapColor(value: number) {
  if (value === 0) return "hsl(var(--muted))";
  if (value === 1) return "hsl(142 76% 45%)"; // xanh lá - 1 phòng
  if (value === 2) return "hsl(48 96% 53%)"; // vàng - 2 phòng
  if (value <= 4) return "hsl(27 96% 55%)"; // cam - 3-4 phòng
  return "hsl(0 84% 60%)"; // đỏ - 5+ phòng
}

const HEATMAP_BUCKETS = [
  { max: 0, label: "0 phòng", color: "hsl(var(--muted))" },
  { max: 1, label: "1 phòng", color: "hsl(142 76% 45%)" },
  { max: 2, label: "2 phòng", color: "hsl(48 96% 53%)" },
  { max: 4, label: "3-4 phòng", color: "hsl(27 96% 55%)" },
  { max: Infinity, label: "5+ phòng", color: "hsl(0 84% 60%)" },
];

/** Tạo danh sách các khung giờ hoạt động dựa theo giờ bắt đầu và giờ kết thúc */
const getOperatingHoursRange = (startTime = "08:00", endTime = "02:00"): number[] => {
  const [startH] = (startTime || "08:00").split(":").map(Number);
  const [endH, endM] = (endTime || "02:00").split(":").map(Number);

  const hours: number[] = [];

  // Nếu cùng giờ và phút kết thúc = 0 (ví dụ 08:00 -> 08:00): cả ngày 24h
  if (startH === endH && (!endM || endM === 0)) {
    for (let i = 0; i < 24; i++) {
      hours.push((startH + i) % 24);
    }
  } else if (startH <= endH) {
    // Trong cùng ngày (ví dụ 08:00 -> 23:00)
    for (let h = startH; h <= endH; h++) {
      hours.push(h);
    }
  } else {
    // Qua đêm (ví dụ 08:00 -> 02:00 ngày hôm sau)
    for (let h = startH; h <= 23; h++) {
      hours.push(h);
    }
    for (let h = 0; h <= endH; h++) {
      hours.push(h);
    }
  }

  return hours.length > 0 ? hours : Array.from({ length: 24 }, (_, i) => i);
};

export const OccupancyHeatmap = ({
  sessions,
  startTime = "08:00",
  endTime = "02:00",
}: {
  sessions: Session[];
  startTime?: string;
  endTime?: string;
}) => {
  const hoursRange = useMemo(() => getOperatingHoursRange(startTime, endTime), [startTime, endTime]);
  const [startH, startM] = (startTime || "08:00").split(":").map(Number);
  const [endH, endM] = (endTime || "02:00").split(":").map(Number);
  const isOvernight = endH < startH || (endH === startH && (endM || 0) < (startM || 0));
  const startMinutes = (startH || 0) * 60 + (startM || 0);

  const { grid, breakdown, max, types } = useMemo(() => {
    const colCount = hoursRange.length;
    const hourColMap = new Map<number, number>();
    hoursRange.forEach((h, idx) => {
      hourColMap.set(h, idx);
    });

    const g: number[][] = Array.from({ length: 7 }, () => Array(colCount).fill(0));
    const b: Record<string, number>[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: colCount }, () => ({}))
    );

    sessions.forEach((s) => {
      let cur = new Date(s.start);
      cur.setMinutes(0, 0, 0);
      while (cur.getTime() < s.end.getTime()) {
        const curMinutes = cur.getHours() * 60 + cur.getMinutes();
        const opDate = new Date(cur);
        if (isOvernight && curMinutes < startMinutes) {
          opDate.setDate(opDate.getDate() - 1);
        }
        const row = (opDate.getDay() + 6) % 7;
        const col = hourColMap.get(cur.getHours());

        if (col !== undefined && col >= 0 && col < colCount) {
          g[row][col] += 1;
          b[row][col][s.roomType] = (b[row][col][s.roomType] || 0) + 1;
        }

        cur = new Date(cur.getTime() + 3600000);
      }
    });

    const allTypes = Array.from(new Set(sessions.map((s) => s.roomType))).sort();
    return { grid: g, breakdown: b, max: Math.max(0, ...g.flat()), types: allTypes };
  }, [sessions, hoursRange, isOvernight, startMinutes]);

  const buildTooltip = (row: number, col: number, total: number) => {
    const hour = hoursRange[col];
    const lines = [`${WEEKDAYS[row]} ${hour}h — ${total} phòng đang hoạt động`];
    if (total > 0) {
      lines.push("");
      types.forEach((type) => {
        const count = breakdown[row][col][type] || 0;
        if (count > 0) lines.push(`• ${type}: ${count}`);
      });
    }
    return lines.join("\n");
  };

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Flame className="h-4 w-4" />
          Bản đồ nhiệt giờ cao điểm
        </h3>
        <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-sm">
          {startTime} - {endTime}
        </span>
      </div>
      {sessions.length === 0 ? (
        <Empty h={220} />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="flex pl-14 mb-1">
              {hoursRange.map((h, idx) => (
                <div key={idx} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {h}
                </div>
              ))}
            </div>
            {grid.map((row, r) => (
              <div key={r} className="flex items-center mb-0.5">
                <span className="w-14 text-[11px] text-muted-foreground">{WEEKDAYS[r]}</span>
                {row.map((v, c) => (
                  <div
                    key={c}
                    title={buildTooltip(r, c, v)}
                    className="flex-1 h-6 mx-[1px] rounded-sm border border-border/40 flex items-center justify-center text-[9px] font-medium text-white"
                    style={{
                      backgroundColor: heatmapColor(v),
                      textShadow: v > 0 ? "0 1px 2px rgba(0,0,0,0.35)" : undefined,
                      color: v === 0 ? "hsl(var(--muted-foreground))" : "#ffffff",
                    }}
                  >
                    {v > 0 ? v : ""}
                  </div>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-muted-foreground">
              <span>Ít</span>
              {HEATMAP_BUCKETS.map((b) => (
                <span
                  key={b.label}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="h-3 w-5 rounded-sm border border-border/40"
                    style={{ backgroundColor: b.color }}
                  />
                  {b.label}
                </span>
              ))}
              <span>Nhiều (tối đa {max} phòng)</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

/* ---------------- 3. Hourly occupancy stacked bar ---------------- */
export const HourlyOccupancyChart = ({
  sessions,
  startTime = "08:00",
  endTime = "02:00",
}: {
  sessions: Session[];
  startTime?: string;
  endTime?: string;
}) => {
  const hoursRange = useMemo(() => getOperatingHoursRange(startTime, endTime), [startTime, endTime]);

  const { data, types } = useMemo(() => {
    const typeSet = Array.from(new Set(sessions.map((s) => s.roomType))).sort();
    const hourMap = new Map<number, Record<string, any>>();
    const rows = hoursRange.map((h) => {
      const row: Record<string, any> = { hour: `${String(h).padStart(2, "0")}h` };
      typeSet.forEach((t) => (row[t] = 0));
      hourMap.set(h, row);
      return row;
    });

    sessions.forEach((s) => {
      let cur = new Date(s.start);
      cur.setMinutes(0, 0, 0);
      while (cur.getTime() < s.end.getTime()) {
        const targetRow = hourMap.get(cur.getHours());
        if (targetRow) {
          targetRow[s.roomType] = (targetRow[s.roomType] || 0) + 1;
        }
        cur = new Date(cur.getTime() + 3600000);
      }
    });

    return { data: rows, types: typeSet };
  }, [sessions, hoursRange]);

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    return (
      <div className="bg-card border border-border rounded-lg p-2 shadow-sm text-sm">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-muted-foreground mb-1">Tổng: {total} phòng</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: p.color || "#ccc" }}
            />
            <span className="flex-1">{p.name}:</span>
            <span className="font-medium">{p.value} phòng</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Phân bố phòng mở theo giờ
        </h3>
        <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-sm">
          {startTime} - {endTime}
        </span>
      </div>
      {sessions.length === 0 ? (
        <Empty />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9 }}
              interval={hoursRange.length > 20 ? 1 : 0}
              className="fill-muted-foreground"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {types.map((t, i) => (
              <Bar
                key={t}
                dataKey={t}
                stackId="a"
                name={t}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={i === types.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

/* ---------------- 4. Duration histogram ---------------- */
export const DurationHistogramChart = ({ sessions }: { sessions: Session[] }) => {
  const { data, stats, types } = useMemo(() => {
    const typeSet = Array.from(new Set(sessions.map((s) => s.roomType))).sort();
    const buckets = [
      { range: "Dưới 1h", test: (h: number) => h < 1 },
      { range: "1–2h", test: (h: number) => h >= 1 && h < 2 },
      { range: "2–3h", test: (h: number) => h >= 2 && h < 3 },
      { range: "Trên 3h", test: (h: number) => h >= 3 },
    ];

    const rows = buckets.map((b) => {
      const row: Record<string, any> = { range: b.range };
      typeSet.forEach((t) => (row[t] = 0));
      return row;
    });

    sessions.forEach((s) => {
      const bucket = buckets.find((b) => b.test(s.hours));
      if (bucket) {
        const idx = buckets.indexOf(bucket);
        rows[idx][s.roomType] += 1;
      }
    });

    const hrs = sessions.map((s) => s.hours).sort((a, b) => a - b);
    const q = (p: number) =>
      hrs.length ? hrs[Math.min(hrs.length - 1, Math.floor(p * hrs.length))] : 0;

    return {
      data: rows,
      stats: {
        min: hrs[0] || 0,
        median: q(0.5),
        max: hrs[hrs.length - 1] || 0,
        avg: hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0,
      },
      types: typeSet,
    };
  }, [sessions]);

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    return (
      <div className="bg-card border border-border rounded-lg p-2 shadow-sm text-sm">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-muted-foreground mb-1">Tổng: {total} lượt</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: p.color || "#ccc" }}
            />
            <span className="flex-1">{p.name}:</span>
            <span className="font-medium">{p.value} lượt</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="p-4 h-full">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Timer className="h-4 w-4" />
        Phân bố thời lượng hát
      </h3>
      {sessions.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Ngắn nhất", value: stats.min },
              { label: "Trung vị", value: stats.median },
              { label: "TB", value: stats.avg },
              { label: "Dài nhất", value: stats.max },
            ].map((s) => (
              <div key={s.label} className="bg-muted rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold">{s.value.toFixed(1)}h</p>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {types.map((t, i) => (
                <Bar
                  key={t}
                  dataKey={t}
                  stackId="a"
                  name={t}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={i === types.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </Card>
  );
};
