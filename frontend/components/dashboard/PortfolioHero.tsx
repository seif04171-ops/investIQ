"use client";

import Link from "next/link";
import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { ArrowRight, Plus, TriangleAlert, Wallet } from "lucide-react";
import type { PerformanceOut, PortfolioSummaryOut } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Change } from "@/components/ui/Change";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DOWN, GOLD, tooltipStyle, UP } from "@/lib/chart-theme";
import { pct, signedUsd, toneClass, usd } from "@/lib/format";

const QUICK_PICKS = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];

export function PortfolioHero({
  summary,
  performance,
}: {
  summary: PortfolioSummaryOut;
  performance: PerformanceOut | null;
}) {
  const id = useId().replace(/:/g, "");
  const empty = summary.holdings.length === 0;

  if (empty) {
    return (
      <Card className="relative flex h-full flex-col justify-between gap-8 overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" /> Your practice account
          </div>
          <div className="num font-display text-5xl font-semibold tracking-tight">{usd(summary.cash_balance, 0)}</div>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            It&apos;s simulated money, so mistakes are free. Make a trade, write down <em>why</em>, and InvestIQ will show you how
            the decision aged.
          </p>
        </div>
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Link href="/portfolio?trade=buy">
              <Button size="lg"><Plus className="h-4 w-4" /> Make your first trade</Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
            Or look something up first:
            {QUICK_PICKS.map((t) => (
              <Link key={t} href={`/stock/${t}`} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono font-semibold text-muted transition hover:border-primary/40 hover:text-primary">
                {t}
              </Link>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const points = (performance?.points ?? []).map((p) => ({ t: p.date * 1000, value: p.value }));
  const up = points.length > 1 ? points[points.length - 1].value >= points[0].value : summary.total_return_value >= 0;
  const stroke = up ? UP : DOWN;

  return (
    <Card className="relative flex h-full flex-col gap-6 overflow-hidden">
      <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-3">Simulated portfolio · paper money</div>
          <AnimatedNumber
            value={summary.total_value}
            format={(n) => usd(n)}
            className="num font-display text-[44px] font-semibold leading-none tracking-tight sm:text-[52px]"
          />
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Change value={summary.day_change_pct} variant="pill" />
              <span className={`num ${toneClass(summary.day_change_value)}`}>{signedUsd(summary.day_change_value)}</span>
              <span className="text-dim">today</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`num font-medium ${toneClass(summary.total_return_value)}`}>
                {signedUsd(summary.total_return_value)} ({pct(summary.total_return_pct)})
              </span>
              <span className="text-dim">since you started</span>
            </div>
          </div>
        </div>
        <Link href="/portfolio">
          <Button variant="secondary" size="sm">Open portfolio <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </div>

      <div className="relative -mx-1 mt-auto">
        {points.length > 1 ? (
          <>
            <div className="h-[132px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`ph-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    formatter={(v: number) => [usd(v), "Holdings value"]}
                  />
                  <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} fill={`url(#ph-${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: stroke }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 px-1 text-[11px] text-dim">Your current holdings over the last 30 days — not your actual past balance.</p>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-3.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />
            {performance?.reason
              ? `Value-over-time chart isn't available: ${performance.reason}`
              : "Value-over-time chart will appear once price history loads."}
          </div>
        )}
      </div>

      {!summary.prices_live && (
        <div className="relative flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-3 text-xs text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No live price for {summary.stale_tickers.join(", ")} right now — those holdings are shown at your purchase price, so gain/loss
            for them reads 0%.
          </span>
        </div>
      )}
    </Card>
  );
}
