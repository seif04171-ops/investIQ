"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Newspaper, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { useNewsRefresh } from "@/hooks/useNewsRefresh";
import { useToast } from "@/components/ui/Toast";
import { fullDate, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { LiveNewsCard } from "@/components/news/LiveNewsCard";

type Chip = "all" | "mine" | "positive" | "negative" | string;

const CATEGORIES = [
  ["megacap", "Mega-cap tech"], ["ai", "AI & chips"], ["financials", "Financials"], ["healthcare", "Healthcare"],
  ["energy", "Energy"], ["consumer", "Consumer"], ["industrials", "Industrials"], ["growth", "Growth"],
] as const;

export default function NewsFeedPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [chip, setChip] = useState<Chip>("all");
  const [sort, setSort] = useState<"smart" | "latest">("smart");
  const [text, setText] = useState("");

  const effect = chip === "positive" || chip === "negative" ? chip : undefined;
  const category = CATEGORIES.some(([id]) => id === chip) ? chip : undefined;
  const feed = useAsync(() => api.getLiveNews({ sort, effect, category, limit: 90 }), [sort, effect, category], { refreshMs: 90_000 });
  const briefing = useAsync(() => api.getBriefing(token!), [token], { enabled: !!token });

  const refresh = useNewsRefresh(({ newEvents, error, status }) => {
    feed.reload();
    const failed = status ? Object.entries(status.sources ?? {}).filter(([, v]) => v.failed > 0 && v.ok === 0) : [];
    if (error) toast.push({ tone: "error", title: "Couldn't fetch news", description: error });
    else if (failed.length) toast.push({ tone: "error", title: `${failed.map(([k]) => k).join(", ")} unavailable`, description: failed[0][1].error ?? undefined });
    else toast.push({ tone: "success", title: newEvents > 0 ? `${newEvents} new ${newEvents === 1 ? "story" : "stories"}` : "Already up to date — no newer stories yet" });
  });

  const status = feed.data?.status;
  const all = useMemo(() => feed.data?.items ?? [], [feed.data]);
  const mineTickers = useMemo(() => new Set((briefing.data?.moves ?? []).map((m) => m.ticker)), [briefing.data]);
  const mineList = useMemo(() => Array.from(mineTickers), [mineTickers]);

  const autoRan = useRef(false);
  const newestMs = status?.newest_at ? new Date(status.newest_at).getTime() : null;
  useEffect(() => {
    if (feed.loading || autoRan.current) return;
    autoRan.current = true;
    if (newestMs === null || Date.now() - newestMs > 15 * 60_000) refresh.start(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.loading, newestMs]);

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return all.filter((n) => {
      if (chip === "mine" && !n.tickers.some((t) => mineTickers.has(t))) return false;
      if (q && !`${n.title} ${n.summary} ${n.tickers.join(" ")} ${Object.values(n.names ?? {}).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, chip, mineTickers, text]);

  const ageH = status?.newest_at ? (Date.now() - new Date(status.newest_at).getTime()) / 3.6e6 : null;
  const failedSources = Object.entries(status?.sources ?? {}).filter(([, v]) => v.failed > 0 && v.ok === 0);

  const chips: { id: Chip; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mine", label: `My stocks${mineTickers.size ? ` (${mineTickers.size})` : ""}` },
    { id: "positive", label: "Bullish stories" },
    { id: "negative", label: "Bearish stories" },
    ...CATEGORIES.map(([id, label]) => ({ id, label })),
  ];

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Live market news"
        title="News that moves stocks"
        description="Fresh headlines from Finnhub and Yahoo Finance, tagged with the stocks they affect, rated by source reliability, and read for whether they help or hurt shareholders."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh.start(true)} loading={refresh.running}>
            <RefreshCw className="h-3.5 w-3.5" /> {refresh.running ? "Fetching latest…" : "Refresh now"}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        {status?.newest_at ? (
          <span className="flex items-center gap-1.5">
            <span className={clsx("h-1.5 w-1.5 rounded-full", ageH !== null && ageH < 6 ? "animate-pulse-dot bg-positive" : "bg-warning")} />
            Newest story: <span className="text-muted">{fullDate(status.newest_at, true)}</span> ({timeAgo(status.newest_at)})
          </span>
        ) : (
          <span>No stories loaded yet</span>
        )}
        {status?.finished_at && <span>Last checked {timeAgo(new Date(status.finished_at * 1000).toISOString())}</span>}
        {status?.annotated_by && (
          <span>{status.annotated_by === "heuristic" ? "Reading: keyword-based (AI reading unavailable)" : "Reading: AI-analysed"}</span>
        )}
        <span>{refresh.running ? "Fetching…" : "Updates automatically every few minutes"}</span>
      </div>

      {(status?.error || failedSources.length > 0) && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-negative/25 bg-negative/[0.06] p-4 text-[13px] leading-relaxed text-negative">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{status?.error ? "The last refresh had a problem" : "Some news sources are unreachable"}</div>
            <div className="mt-0.5 text-negative/80">
              {status?.error ?? failedSources.map(([k, v]) => `${k}: ${v.error ?? "failed"}`).join(" · ")}
            </div>
          </div>
        </div>
      )}

      {!status?.error && ageH !== null && ageH > 24 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4 text-[13px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>The newest story is {Math.round(ageH)}h old. Press <b>Refresh now</b>; markets may also simply be quiet (weekend or holiday).</div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setChip(c.id)}
              className={clsx(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                chip === c.id ? "border-primary/50 bg-primary/12 text-primary" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Filter by stock or word…" className="h-10 pl-10" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as "smart" | "latest")} className="h-10 rounded-xl border border-white/10 bg-surface px-3 text-sm text-ink outline-none" aria-label="Sort stories">
            <option value="smart">Most important</option>
            <option value="latest">Newest first</option>
          </select>
        </div>
      </div>

      {feed.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[210px] rounded-2xl" />)}</div>
      ) : feed.error && !feed.data ? (
        <ErrorState message={feed.error} onRetry={feed.reload} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Newspaper className="h-5 w-5" />}
            title={all.length === 0 ? (refresh.running ? "Fetching the latest news…" : "No stories yet") : chip === "mine" ? "Nothing about your stocks right now" : "No stories match that filter"}
            message={all.length === 0 ? "Press “Refresh now”. The first fetch pulls about 40 stocks' worth of headlines and takes 10–30 seconds." : chip === "mine" ? "Add stocks to your watchlist or portfolio — stories that mention them appear here." : "Try a different filter or clear the search box."}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((n, i) => (
            <div key={n.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <LiveNewsCard item={n} highlight={mineList} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
