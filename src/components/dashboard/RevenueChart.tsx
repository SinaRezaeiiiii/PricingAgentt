import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { monthlyRevenueData } from "@/data/mockData";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-elevated">
        <p className="font-medium text-card-foreground">{label}</p>
        <div className="mt-2 space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">
                {entry.name === "Customer Pay Purchases Amount"
                  ? "Customer Pay"
                  : "Manufacturer Pay"}
                :
              </span>
              <span className="font-mono font-medium">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueChart() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Revenue by Payment Type</h3>
        <p className="text-sm text-muted-foreground">
          Customer Pay vs Manufacturer Pay (Warranty) - Last 12 Months
        </p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={monthlyRevenueData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={formatCurrency}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 20 }}
              formatter={(value) =>
                value === "Customer Pay Purchases Amount"
                  ? "Customer Pay"
                  : "Manufacturer Pay (Warranty)"
              }
            />
            <Bar
              dataKey="Customer Pay Purchases Amount"
              fill="hsl(var(--chart-customer))"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="Manufacturer Pay Purchases Amount"
              fill="hsl(var(--chart-manufacturer))"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
