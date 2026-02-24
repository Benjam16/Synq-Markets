"use client";

"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface EquityChartProps {
  data: Array<{ date: string; equity: number; balance: number }>;
}

export default function EquityChart({ data }: EquityChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 bg-[#0F172A] border border-[#1E293B] rounded-lg">
        No equity data available
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString(),
    equity: point.equity,
    balance: point.balance,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4FFFC8" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#4FFFC8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" opacity={0.05} />
          <XAxis
            dataKey="date"
            stroke="transparent"
            fontSize={9}
            tick={{ fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="transparent"
            fontSize={9}
            tick={{ fill: "#64748b" }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#000000",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: "#ffffff",
              fontFamily: "monospace",
              fontSize: "11px",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "10px" }}
            formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Equity"]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#4FFFC8"
            strokeWidth={1.5}
            fill="url(#equityGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "#4FFFC8" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

