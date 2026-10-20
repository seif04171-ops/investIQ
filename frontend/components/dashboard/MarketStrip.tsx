"use client";

import { Activity, Info } from "lucide-react";
import type { MarketIndex, MarketSentiment } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Change } from "@/components/ui/Change";
import { Gauge } from "@/components/ui/Gauge";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { usd } from "@/lib/format";

export function IndexCard({ index }: { index: MarketIndex }) {
  return (
    <Card className="flex flex-col justify-between gap-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">{index.index_name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-dim">
            {index.is_proxy ? `via ${index.display_symbol} fund` : index.display_symbol}
          </div>
        </div>
        <Change value={index.change_percent} variant="pill" />
      </div>
      <div>
        <AnimatedNumber
          value={index.price}
          format={(n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          className="num font-display text-[28px] font-semibold leading-none tracking-tight"
        />
        <div className="num mt-2 text-xs text-muted">
          {index.change >= 0 ? "+" : "−"}
          {usd(Math.abs(index.change))} today
        </div>
      </div>
    </Card>
  );
}

export function SentimentCard({ sentiment }: { sentiment: MarketSentiment }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" /> Market mood
        </div>
        <span
          className={
            sentiment.label === "Bullish" ? "text-xs font-semibold text-positive" : sentiment.label === "Bearish" ? "text-xs font-semibold text-negative" : "text-xs font-semibold text-muted"
          }
        >
          {sentiment.label}
        </span>
      </div>
      <Gauge score={sentiment.score} label={`avg move ${sentiment.avg_change_percent >= 0 ? "+" : ""}${sentiment.avg_change_percent}%`} />
    </Card>
  );
}

export function MarketStripSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-[148px]">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-8 h-8 w-36" />
        </Card>
      ))}
    </div>
  );
}

export function MarketUnavailable({ message }: { message: string }) {
  return (
    <Card className="flex items-start gap-3 border-warning/25 bg-warning/[0.05]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="text-sm">
        <div className="font-medium text-warning">Live market data isn&apos;t available right now</div>
        <p className="mt-1 text-muted">
          {message} InvestIQ never fills the gap with made-up numbers — index levels appear here as soon as the data feed responds.
        </p>
      </div>
    </Card>
  );
}
