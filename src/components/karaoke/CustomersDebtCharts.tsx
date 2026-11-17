import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export interface DebtAgeBucket {
  key: string;
  label: string;
  count: number;
  amount: number;
}

const AGE_COLORS = [
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--destructive))",
];

const formatPrice = (n: number) => (n || 0).toLocaleString("vi-VN") + "đ";

const CustomersDebtCharts = ({ ageBuckets }: { ageBuckets: DebtAgeBucket[] }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">
          Phân loại nợ theo tuổi (tổng nợ)
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ageBuckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(v) => v / 1000 + "k"} />
            <Tooltip formatter={(v: number) => formatPrice(v)} />
            <Legend />
            <Bar
              dataKey="amount"
              name="Số tiền nợ"
              fill="hsl(var(--destructive))"
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Số hoá đơn theo tuổi nợ</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={ageBuckets}
              dataKey="count"
              nameKey="label"
              outerRadius={90}
              label
            >
              {ageBuckets.map((_, i) => (
                <Cell key={i} fill={AGE_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default CustomersDebtCharts;
