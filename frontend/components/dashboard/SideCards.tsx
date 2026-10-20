"use client";

import Link from "next/link";
import { ArrowRight, Eye, Plus, Radar } from "lucide-react";
import type { BulkQuote, Opportunity, WatchlistEntry } from "@/lib/api-client";
import { ScoreDial } from "@/components/ideas/SignalCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Change } from "@/components/ui/Change";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { usd } from "@/lib/format";

export function WatchlistMovers({
  items,
  quotes,
}: {
  items: WatchlistEntry[];
  quotes: Record<string, BulkQuote>;
}) {
  const rows = items
    .map((w) => ({ w, q: quotes[w.ticker.toUpperCase()] }))
    .sort((a, b) => Math.abs(b.q?.change_percent ?? 0) - Math.abs(a.q?.change_percent ?? 0))
    .slice(0, 5);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4 text-primary" /> Watchlist
        </div>
        <Link href="/watchlist" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Manage <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm leading-relaxed text-muted">Follow companies you&apos;re curious about without spending a cent of practice money.</p>
          <Link href="/watchlist?focus=add"><Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Add a stock</Button></Link>
        </div>
      ) : (
        <div className="flex flex-col">
          {rows.map(({ w, q }) => (
            <Link key={w.ticker} href={`/stock/${w.ticker}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.04]">
              <TickerAvatar ticker={w.ticker} size={34} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-semibold">{w.ticker}</div>
                <div className="truncate text-xs text-dim">{w.name}</div>
              </div>
              {q ? (
                <div className="text-right">
                  <div className="num text-sm font-medium">{usd(q.price)}</div>
                  <Change value={q.change_percent} className="text-xs" />
                </div>
              ) : (
                <span className="text-xs text-dim">no live price</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TopSignals({ items }: { items: Opportunity[] }) {
  const top = items.filter((i) => i.direction === "bullish").slice(0, 3);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Radar className="h-4 w-4 text-primary" /> Top signals
        </div>
        <Link href="/ideas" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          All ideas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">No strong bullish signals right now. Open Ideas to see everything on the radar.</p>
      ) : (
        <div className="flex flex-col">
          {top.map((i) => (
            <Link key={i.ticker} href="/ideas" className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.04]">
              <ScoreDial score={i.score} direction={i.direction} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-semibold">{i.ticker}</div>
                <div className="truncate text-xs text-dim">{i.label} · {i.confidence} confidence</div>
              </div>
              <div className="text-right">
                <div className="num text-sm font-medium">{usd(i.price)}</div>
                <Change value={i.change_percent} className="text-xs" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
