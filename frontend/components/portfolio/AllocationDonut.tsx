"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationSlice } from "@/lib/api-client";
import { CASH_COLOR, CHART_COLORS, tooltipStyle } from "@/lib/chart-theme";
import { usd } from "@/lib/format";

function colorFor(label: string, i: number) {
  return label === "Cash" ? CASH_COLOR : CHART_COLORS[i % CHART_COLORS.length];
}

/** Sector + cash allocation as a donut with a readable legend. */
export function AllocationDonut({ slices, investedPct }: { slices: AllocationSlice[]; investedPct: number }) {
  const sectors = slices.filter((s) => s.label !== "Cash");
  const ordered = [...sectors, ...slices.filter((s) => s.label === "Cash")];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ordered} dataKey="value" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {ordered.map((s, i) => (
                <Cell key={s.label} fill={colorFor(s.label, i)} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [usd(v), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="num font-display text-2xl font-semibold leading-none">{investedPct.toFixed(0)}%</div>
          <div className="mt-1 text-[11px] text-dim">invested</div>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
        {ordered.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(s.label, i) }} />
            <span className="min-w-0 flex-1 truncate">{s.label === "Unknown" ? "Sector not available" : s.label}</span>
            <span className="num text-muted">{usd(s.value, 0)}</span>
            <span className="num w-11 text-right font-medium">{s.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
