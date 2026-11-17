import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface CategoryProfitRow {
  category: string;
  revenue: number;
  expense: number;
  profit: number;
}

export interface ProductProfitRow {
  category: string;
  product: string;
  revenue: number;
  expense: number;
  quantity: number;
  profit: number;
}

interface ExpensesProfitChartsProps {
  profitByCategory: CategoryProfitRow[];
  availableGroups: string[];
  effectiveDrillGroup: string;
  onSelectDrillGroup: (group: string) => void;
  drillProductData: ProductProfitRow[];
}

const formatPrice = (n: number) => n.toLocaleString("vi-VN") + "đ";

const ExpensesProfitCharts = ({
  profitByCategory,
  availableGroups,
  effectiveDrillGroup,
  onSelectDrillGroup,
  drillProductData,
}: ExpensesProfitChartsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">
          Doanh thu - Chi phí - Lợi nhuận theo nhóm
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={profitByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis tickFormatter={(v) => v / 1000 + "k"} />
            <Tooltip formatter={(v: number) => formatPrice(v)} />
            <Legend />
            <Bar dataKey="revenue" fill="hsl(var(--chart-2))" name="Doanh thu" />
            <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Chi phí" />
            <Bar dataKey="profit" fill="hsl(var(--primary))" name="Lợi nhuận" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">
            Doanh thu - Chi phí - Lợi nhuận theo sản phẩm trong nhóm
          </h3>
          <Select
            value={effectiveDrillGroup || "__none__"}
            onValueChange={(v) => onSelectDrillGroup(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Chọn nhóm" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {availableGroups.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  — Không có dữ liệu —
                </SelectItem>
              ) : (
                availableGroups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {drillProductData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={drillProductData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="product"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis tickFormatter={(v) => v / 1000 + "k"} />
              <Tooltip formatter={(v: number) => formatPrice(v)} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--chart-2))" name="Doanh thu" />
              <Bar dataKey="expense" fill="hsl(var(--destructive))" name="Chi phí" />
              <Bar dataKey="profit" fill="hsl(var(--primary))" name="Lợi nhuận" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            Chưa có dữ liệu cho nhóm này
          </div>
        )}
      </Card>
    </div>
  );
};

export default ExpensesProfitCharts;
