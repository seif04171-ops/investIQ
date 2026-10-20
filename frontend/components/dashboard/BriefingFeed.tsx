"use client";

import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import type { Briefing } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Change } from "@/components/ui/Change";
import { LiveNewsCard } from "@/components/news/LiveNewsCard";
import { usd } from "@/lib/format";

/**
 * "What moved your money": today's moves for the stocks you hold/watch, and
 * the headlines that actually mention them. The heart of InvestIQ.
 */
export function BriefingFeed({ briefing }: { briefing: Briefing }) {
  if (briefing.tracked_count === 0) {
    return (
      <Card className="flex h-full flex-col items-start justify-center gap-4">
        <div className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> What moved your money</div>
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight">
          Generic news is everywhere. <span className="text-gold-gradient">Yours</span> is here.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Add a stock to your portfolio or watchlist and InvestIQ will match news to it, explain why it matters, and show how
          credible it is.
        </p>
        <div className="flex gap-2">
          <Link href="/watchlist?focus=add"><Button size="sm"><Plus className="h-3.5 w-3.5" /> Add to watchlist</Button></Link>
          <Link href="/portfolio?trade=buy"><Button size="sm" variant="secondary">Make a trade</Button></Link>
        </div>
      </Card>
    );
  }

  const movers = briefing.moves.filter((m) => m.change_percent !== null).slice(0, 6);

  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-1.5 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> Personalised for you</div>
          <h2 className="font-display text-xl font-semibold tracking-tight">What moved your money</h2>
        </div>
        <Link href="/news" className="flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline">
          All news <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {movers.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {movers.map((m) => (
            <Link
              key={m.ticker}
              href={`/stock/${m.ticker}`}
              className="flex shrink-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 transition hover:border-primary/40"
            >
              <span className="font-mono text-xs font-semibold">{m.ticker}</span>
              <span className="num text-xs text-muted">{usd(m.price)}</span>
              <Change value={m.change_percent} className="text-xs" />
            </Link>
          ))}
        </div>
      )}

      {briefing.news.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <p className="text-sm font-medium">No fresh headlines mention your stocks right now</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
            That&apos;s normal — most days most companies aren&apos;t in the news. Press Refresh on the News page to check now.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {briefing.news.slice(0, 4).map((n) => (
            <LiveNewsCard key={n.id} item={n} compact highlight={n.matched_tickers} />
          ))}
        </div>
      )}
    </Card>
  );
}
