"use client";

import { useMemo, useState } from "react";
import { Info, RefreshCw, Radar } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { useNewsRefresh } from "@/hooks/useNewsRefresh";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { SignalCard } from "@/components/ideas/SignalCard";
import { fullDate, timeAgo } from "@/lib/format";

type Filter = "all" | "bullish" | "bearish" | "mine" | string;
const CATS = [["megacap", "Mega-cap tech"], ["ai", "AI & chips"], ["financials", "Financials"], ["healthcare", "Healthcare"], ["energy", "Energy"], ["consumer", "Consumer"], ["industrials", "Industrials"], ["growth", "Growth"]] as const;

export default function IdeasPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [how, setHow] = useState(false);
  const q = useAsync(() => api.getOpportunities(token!), [token], { enabled: !!token, refreshMs: 120_000 });
  const refresh = useNewsRefresh(({ newEvents, error }) => {
    q.reload();
    if (error) toast.push({ tone: "error", title: "Couldn't fetch news", description: error });
    else toast.push({ tone: "success", title: newEvents > 0 ? `${newEvents} new ${newEvents === 1 ? "story" : "stories"} — signals updated` : "Signals refreshed — no newer stories yet" });
  });

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const shown = useMemo(
    () =>
      items.filter((i) =>
        filter === "all" ? true : filter === "mine" ? !!i.relation : filter === "bullish" ? i.direction === "bullish" : filter === "bearish" ? i.direction === "bearish" : i.category === filter
      ),
    [items, filter]
  );
  const counts = {
    bullish: items.filter((i) => i.direction === "bullish").length,
    bearish: items.filter((i) => i.direction === "bearish").length,
    mine: items.filter((i) => i.relation).length,
  };
  const chips: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${items.length})` },
    { id: "bullish", label: `Bullish (${counts.bullish})` },
    { id: "bearish", label: `Bearish (${counts.bearish})` },
    { id: "mine", label: `My stocks (${counts.mine})` },
    ...CATS.filter(([id]) => items.some((i) => i.category === id)).map(([id, label]) => ({ id, label })),
  ];

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Opportunity radar"
        title="What the evidence favours right now"
        description="The most widely followed US stocks, scanned and ranked by live news, momentum and technicals — each with the facts behind it, the risks against it, and a one-tap path to trade it."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh.start(true)} loading={refresh.running}>
            <RefreshCw className="h-3.5 w-3.5" /> {refresh.running ? "Fetching news…" : "Refresh news"}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        {q.data?.newest_story_at ? (
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-positive" />Newest story: <span className="text-muted">{fullDate(q.data.newest_story_at, true)}</span> ({timeAgo(q.data.newest_story_at)})</span>
        ) : (
          <span>No stories yet — press Refresh news</span>
        )}
        {q.data?.scanned ? <span>Scanned {q.data.scanned} stocks</span> : null}
        <button onClick={() => setHow((v) => !v)} className="flex items-center gap-1 text-primary hover:underline"><Info className="h-3 w-3" /> How scores work</button>
      </div>

      {how && (
        <Card className="animate-fade-up mb-6 text-[13px] leading-relaxed text-muted">
          <p>Each score runs 0–100 (50 is neutral). It blends <b className="text-ink">News (45%)</b> — stories that name the company, weighted by their credibility score and how recent they are (they lose half their weight every 24h) and whether they&apos;re expected to help or hurt it; <b className="text-ink">Momentum (25%)</b> — the 1-month move and today&apos;s move; <b className="text-ink">Technicals (20%)</b> — price versus its 50-day average and RSI; and <b className="text-ink">Range (10%)</b> — where the price sits in its 52-week range. Missing inputs are left out, not guessed, and the card shows how confident the data is.</p>
          <p className="mt-2 text-dim">{q.data?.disclaimer}</p>
        </Card>
      )}

      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {chips.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)} className={clsx("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition", filter === c.id ? "border-primary/50 bg-primary/12 text-primary" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink")}>
            {c.label}
          </button>
        ))}
      </div>

      {q.loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[280px] rounded-2xl" />)}</div>
      ) : q.error && !q.data ? (
        <ErrorState message={q.error} onRetry={q.reload} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Radar className="h-5 w-5" />}
            title={items.length === 0 ? "No signals yet" : "Nothing matches that filter"}
            message={items.length === 0 ? "Press “Refresh news”. The first fetch scans headlines for ~40 stocks and takes 10–30 seconds. If it keeps failing, check that the backend Terminal tab is running." : "Try another filter."}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {shown.map((i, idx) => (
            <div key={i.ticker} className="animate-fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
              <SignalCard item={i} />
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-dim">{q.data?.disclaimer ?? "Signals are not predictions or personal investment advice."}</p>
    </main>
  );
}
