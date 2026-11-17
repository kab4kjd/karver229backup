import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { FileText, TrendingUp, Package, Clock, GripVertical } from "lucide-react";
import { Invoice } from "@/pages/Index";
import {
  useTimeSessions,
  RoomTimelineChart,
  OccupancyHeatmap,
  HourlyOccupancyChart,
  DurationHistogramChart,
} from "./TimeCharts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SortableChartCard = ({ id, children }: { id: string; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-muted/80 hover:bg-muted"
        title="Kéo để sắp xếp"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
};

interface ProductUsage {
  roomName: string;
  quantity: number;
  date: string;
  timeRange: string;
}

interface ProductItemStat {
  name: string;
  quantity: number;
  revenue: number;
  usages: ProductUsage[];
}

interface ReportsChartsGridProps {
  chartOrder: string[];
  onSaveOrder: (newOrder: string[]) => void;
  filteredInvoices: Invoice[];
  dayStartTime: string;
  dayEndTime: string;
  themePrimary: string;
  themeChart2: string;
  themeChart3: string;
  themePalette: string[];
  revenueReport: {
    totalInvoices: number;
    totalRevenue: number;
    totalDiscount: number;
    totalTax: number;
    roomRevenue: number;
    itemsRevenue: number;
  };
  productReportByCategory: {
    category: string;
    items: ProductItemStat[];
    totalQuantity: number;
    totalRevenue: number;
  }[];
  revenueBySourceData: { name: string; value: number }[];
  dailyRevenueData: { date: string; revenue: number }[];
  topProductsData: ProductItemStat[];
  roomUsageData: { room: string; count: number; revenue: number; totalHours: number }[];
  categoryRevenueData: { name: string; value: number }[];
  roomTimeStats: {
    totalHours: number;
    totalSessions: number;
    avgHours: number;
    mostUsedRoom: { room: string; count: number; revenue: number; totalHours: number } | null;
  };
  roomHoursData: { room: string; hours: number; count: number }[];
  onSelectProductForRooms: (product: ProductItemStat) => void;
}

const formatCurrency = (value: number) => `${(value / 1000).toFixed(0)}k`;

const ReportsChartsGrid = ({
  chartOrder,
  onSaveOrder,
  filteredInvoices,
  dayStartTime,
  dayEndTime,
  themePrimary,
  themeChart2,
  themeChart3,
  themePalette,
  revenueReport,
  productReportByCategory,
  revenueBySourceData,
  dailyRevenueData,
  topProductsData,
  roomUsageData,
  categoryRevenueData,
  roomTimeStats,
  roomHoursData,
  onSelectProductForRooms,
}: ReportsChartsGridProps) => {
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const timeSessions = useTimeSessions(filteredInvoices);

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      onDragEnd={(event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
          const oldIndex = chartOrder.indexOf(active.id as string);
          const newIndex = chartOrder.indexOf(over.id as string);
          onSaveOrder(arrayMove(chartOrder, oldIndex, newIndex));
        }
      }}
    >
      <SortableContext items={chartOrder} strategy={rectSortingStrategy}>
        <div className="grid md:grid-cols-2 gap-4">
          {chartOrder.map((chartId) => {
            const chartContent = (() => {
              switch (chartId) {
                case "products_sold":
                  return (
                    <Card className="p-6 h-full">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Sản Phẩm Bán Ra
                      </h2>
                      <div className="max-h-[400px] overflow-auto">
                        {productReportByCategory.length > 0 ? (
                          <div className="space-y-4">
                            {productReportByCategory.map((categoryData, catIndex) => (
                              <div key={catIndex} className="border rounded-lg overflow-hidden">
                                <div className="bg-muted px-3 py-2 flex justify-between items-center">
                                  <span className="font-semibold">{categoryData.category}</span>
                                  <div className="flex gap-4 text-sm">
                                    <span>SL: {categoryData.totalQuantity}</span>
                                    <span className="font-medium text-primary">
                                      {categoryData.totalRevenue.toLocaleString("vi-VN")}đ
                                    </span>
                                  </div>
                                </div>
                                <Table>
                                  <TableBody>
                                    {categoryData.items.map((product, index) => (
                                      <TableRow key={index}>
                                        <TableCell className="pl-6">{product.name}</TableCell>
                                        <TableCell className="text-right w-16">
                                          <button
                                            type="button"
                                            onClick={() => onSelectProductForRooms(product)}
                                            className="hover:underline text-primary font-medium cursor-pointer"
                                            title="Bấm để xem các phòng sử dụng"
                                          >
                                            {product.quantity}
                                          </button>
                                        </TableCell>
                                        <TableCell className="text-right w-32">
                                          {product.revenue.toLocaleString("vi-VN")}đ
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">Không có dữ liệu</div>
                        )}
                      </div>
                    </Card>
                  );
                case "revenue_source":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4">Cơ cấu doanh thu</h3>
                      {revenueBySourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={revenueBySourceData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {revenueBySourceData.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={themePalette[index % themePalette.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`${value.toLocaleString("vi-VN")}đ`]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                case "top_products":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Top 10 sản phẩm bán chạy (theo số lượng)
                      </h3>
                      {topProductsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={topProductsData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={120}
                              tick={{ fontSize: 10 }}
                              className="fill-muted-foreground"
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                if (name === "quantity") return [value, "Số lượng"];
                                return [value, name];
                              }}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="quantity" fill={themePrimary} radius={[0, 4, 4, 0]} name="quantity" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                case "room_revenue":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Doanh thu theo phòng
                      </h3>
                      {roomUsageData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={roomUsageData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="room" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                            <YAxis
                              tickFormatter={formatCurrency}
                              tick={{ fontSize: 11 }}
                              className="fill-muted-foreground"
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                if (name === "revenue") return [`${value.toLocaleString("vi-VN")}đ`, "Doanh thu"];
                                if (name === "count") return [value, "Số lượt"];
                                return [value, name];
                              }}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="revenue" fill={themeChart2} radius={[4, 4, 0, 0]} name="revenue" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                case "category_revenue":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Doanh thu theo danh mục sản phẩm
                      </h3>
                      {categoryRevenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={categoryRevenueData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="value"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              labelLine={true}
                            >
                              {categoryRevenueData.map((_, index) => (
                                <Cell
                                  key={`cat-cell-${index}`}
                                  fill={themePalette[index % themePalette.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`${value.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                case "room_time":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Thời gian sử dụng phòng
                      </h3>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Tổng giờ</p>
                          <p className="text-lg font-bold text-primary">
                            {(roomTimeStats.totalHours || 0).toFixed(1)}h
                          </p>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">TB/lượt</p>
                          <p className="text-lg font-bold">{(roomTimeStats.avgHours || 0).toFixed(1)}h</p>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Phòng nhiều nhất</p>
                          <p className="text-lg font-bold truncate">
                            {roomTimeStats.mostUsedRoom?.room || "-"}
                          </p>
                        </div>
                      </div>
                      {roomHoursData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={roomHoursData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 11 }}
                              className="fill-muted-foreground"
                              tickFormatter={(v) => `${v}h`}
                            />
                            <YAxis
                              type="category"
                              dataKey="room"
                              width={80}
                              tick={{ fontSize: 10 }}
                              className="fill-muted-foreground"
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                if (name === "hours") return [`${value}h`, "Tổng giờ"];
                                if (name === "count") return [value, "Số lượt"];
                                return [value, name];
                              }}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar dataKey="hours" fill={themeChart3} radius={[0, 4, 4, 0]} name="hours" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                case "room_timeline":
                  return <RoomTimelineChart sessions={timeSessions} />;
                case "occupancy_heatmap":
                  return (
                    <OccupancyHeatmap
                      sessions={timeSessions}
                      startTime={dayStartTime}
                      endTime={dayEndTime}
                    />
                  );
                case "hourly_occupancy":
                  return (
                    <HourlyOccupancyChart
                      sessions={timeSessions}
                      startTime={dayStartTime}
                      endTime={dayEndTime}
                    />
                  );
                case "duration_histogram":
                  return <DurationHistogramChart sessions={timeSessions} />;
                case "revenue_detail":
                  return (
                    <Card className="p-6 h-full">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Chi Tiết Doanh Thu
                      </h2>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Số hóa đơn:</span>
                          <span className="font-semibold">{revenueReport.totalInvoices}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Doanh thu phòng:</span>
                          <span className="font-semibold">
                            {revenueReport.roomRevenue.toLocaleString("vi-VN")} VNĐ
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Doanh thu sản phẩm:</span>
                          <span className="font-semibold">
                            {revenueReport.itemsRevenue.toLocaleString("vi-VN")} VNĐ
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Giảm giá:</span>
                          <span className="font-semibold text-destructive">
                            -{revenueReport.totalDiscount.toLocaleString("vi-VN")} VNĐ
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">Thuế/Phí:</span>
                          <span className="font-semibold">
                            {revenueReport.totalTax.toLocaleString("vi-VN")} VNĐ
                          </span>
                        </div>
                        <div className="flex justify-between py-3 bg-primary/10 rounded-md px-3 mt-4">
                          <span className="font-bold text-lg">Tổng doanh thu:</span>
                          <span className="font-bold text-lg text-primary">
                            {revenueReport.totalRevenue.toLocaleString("vi-VN")} VNĐ
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                case "revenue_trend":
                  return (
                    <Card className="p-4 h-full">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Xu hướng doanh thu
                      </h3>
                      {dailyRevenueData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={dailyRevenueData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                            <YAxis
                              tickFormatter={formatCurrency}
                              tick={{ fontSize: 11 }}
                              className="fill-muted-foreground"
                            />
                            <Tooltip
                              formatter={(value: number) => [`${value.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="revenue"
                              stroke={themePrimary}
                              strokeWidth={2.5}
                              dot={{ fill: themePrimary, r: 4 }}
                              activeDot={{ r: 6, fill: themePrimary }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          Không có dữ liệu
                        </div>
                      )}
                    </Card>
                  );
                default:
                  return null;
              }
            })();
            return (
              <SortableChartCard key={chartId} id={chartId}>
                {chartContent}
              </SortableChartCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default ReportsChartsGrid;
