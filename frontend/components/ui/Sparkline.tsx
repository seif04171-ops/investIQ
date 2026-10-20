"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { DOWN, GOLD, UP } from "@/lib/chart-theme";

/** Tiny area chart. Colour follows direction (first → last) unless overridden. */
export function Sparkline({
  data,
  height = 40,
  color,
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (data.length < 2) return <div style={{ height }} />;
  const stroke = color ?? (data[data.length - 1] >= data[0] ? UP : data[data.length - 1] < data[0] ? DOWN : GOLD);
  const chartData = data.map((value, i) => ({ i, value }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={1.75}
          fill={`url(#sp-${id})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
