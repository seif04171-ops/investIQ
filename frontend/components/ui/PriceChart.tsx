"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { AXIS_STROKE, DOWN, GRID_STROKE, tooltipStyle, UP } from "@/lib/chart-theme";
import { pct, usd } from "@/lib/format";
import { Skeleton } from "./Skeleton";
import { Tabs } from "./Tabs";

const RANGES = [
  { value: "1", label: "1D" },
  { value: "5", label: "1W" },
  { value: "30", label: "1M" },
  { value: "90", label: "3M" },
  { value: "180", label: "6M" },
  { value: "365", label: "1Y" },
];

/** Real price history with range tabs. Degrades to an honest message when the data plan doesn't allow it. */
export function PriceChart({
  ticker,
  height = 260,
  compact = false,
  defaultDays = 90,
}: {
  ticker: string;
  height?: number;
  compact?: boolean;
  defaultDays?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [days, setDays] = useState(String(defaultDays));
  const { data, error, loading } = useAsync(() => api.getHistory(ticker, Number(days)), [ticker, days], {
    refreshMs: Number(days) <= 5 ? 60_000 : undefined,
  });
  const intraday = Number(days) <= 1;
  const live = Number(days) <= 5;

  const points = useMemo(
    () => (data ?? []).map((d) => ({ t: d.date * 1000, close: d.close })),
    [data]
  );
  const first = points[0]?.close;
  const last = points[points.length - 1]?.close;
  const change = first && last ? ((last - first) / first) * 100 : null;
  const up = (change ?? 0) >= 0;
  const stroke = up ? UP : DOWN;

  return (
    <div>
      {!compact && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm">
            {change !== null && (
              <span className={up ? "text-positive" : "text-negative"}>
                {pct(change)} <span className="text-muted">{intraday ? "this session" : "over this period"}</span>
              </span>
            )}
            {live && points.length > 1 && (
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-dim"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-positive" />Updates every minute</span>
            )}
          </div>
          <Tabs options={RANGES} value={days} onChange={setDays} size="sm" />
        </div>
      )}

      {loading ? (
        <div style={{ height }}><Skeleton className="h-full w-full rounded-2xl" /></div>
      ) : (error || points.length < 2) && compact ? (
        <div className="flex items-center gap-2 text-xs text-dim" style={{ height: Math.min(height, 40) }}>
          <LineChartIcon className="h-3.5 w-3.5" /> Chart unavailable
        </div>
      ) : error || points.length < 2 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-6 text-center"
          style={{ height }}
        >
          <LineChartIcon className="h-5 w-5 text-dim" />
          <p className="max-w-xs text-sm text-muted">
            {error ?? "No price history available for this ticker."}
          </p>
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: compact ? 0 : -8 }}>
              <defs>
                <linearGradient id={`pc-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              {!compact && <CartesianGrid stroke={GRID_STROKE} vertical={false} />}
              <XAxis
                dataKey="t"
                hide={compact}
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) =>
                  live
                    ? new Date(t).toLocaleString("en-US", intraday ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric" })
                    : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                stroke={AXIS_STROKE}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={44}
              />
              <YAxis
                hide={compact}
                domain={["auto", "auto"]}
                stroke={AXIS_STROKE}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(t: number) =>
                  live
                    ? new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                    : new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                }
                formatter={(v: number) => [usd(v), live ? "Price" : "Close"]}
              />
              <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill={`url(#pc-${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: stroke }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
