"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type PopularStock, type SearchHit } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { usd } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Change } from "@/components/ui/Change";
import { Skeleton } from "@/components/ui/Skeleton";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import clsx from "clsx";

export default function ExplorePage() {
  const { token } = useAuth();
  const toast = useToast();
  const popular = useAsync(() => api.getPopular(), [], { refreshMs: 45_000 });
  const watch = useAsync(() => api.listWatchlist(token!), [token], { enabled: !!token });
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => api.searchTicker(q).then((r) => setHits(r.slice(0, 6))).catch(() => setHits([])), 220);
    return () => clearTimeout(t);
  }, [query]);

  const followed = useMemo(() => new Set((watch.data ?? []).map((w) => w.ticker.toUpperCase())), [watch.data]);
  const groups = useMemo(() => popular.data?.groups ?? [], [popular.data]);
  const stocks = useMemo(
    () => (group === "all" ? groups.flatMap((g) => g.stocks) : groups.find((g) => g.key === group)?.stocks ?? []),
    [groups, group]
  );

  async function follow(ticker: string) {
    if (!token) return;
    setBusy(ticker);
    try {
      await api.addToWatchlist(token, ticker);
      toast.push({ tone: "success", title: `${ticker} added to your watchlist` });
      watch.reload();
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't add that", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  const Row = ({ s }: { s: PopularStock }) => (
    <div className="glass glass-hover flex items-center gap-3 rounded-xl px-3.5 py-3">
      <TickerAvatar ticker={s.ticker} size={36} />
      <Link href={`/stock/${s.ticker}`} className="min-w-0 flex-1">
        <div className="font-mono text-sm font-semibold">{s.ticker}</div>
        <div className="truncate text-[11px] text-dim">{s.name} · {s.sector}</div>
      </Link>
      <div className="text-right">
        <div className="num text-[13px] font-medium">{s.price !== null ? usd(s.price) : "—"}</div>
        {s.change_percent !== null ? <Change value={s.change_percent} className="text-[11px]" /> : <span className="text-[11px] text-dim">no live price</span>}
      </div>
      <Link href={`/portfolio?trade=buy&ticker=${s.ticker}`} className="hidden rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary sm:block">
        Buy
      </Link>
      <button
        onClick={() => !followed.has(s.ticker) && follow(s.ticker)}
        disabled={busy === s.ticker}
        className={clsx("rounded-lg p-2 transition", followed.has(s.ticker) ? "bg-positive/12 text-positive" : "bg-primary/12 text-primary hover:bg-primary/25")}
        aria-label={followed.has(s.ticker) ? `${s.ticker} is on your watchlist` : `Follow ${s.ticker}`}
      >
        {followed.has(s.ticker) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );

  const mover = (title: string, icon: React.ReactNode, list: PopularStock[]) => (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">{icon}{title}</div>
      {list.length === 0 ? <p className="text-xs text-dim">No live prices yet.</p> : list.map((s) => (
        <Link key={s.ticker} href={`/stock/${s.ticker}`} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 text-[13px] transition hover:bg-white/[0.04]">
          <span><span className="font-mono font-semibold">{s.ticker}</span> <span className="text-dim">{s.name}</span></span>
          <Change value={s.change_percent} className="text-xs" />
        </Link>
      ))}
    </Card>
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Discover" title="Explore stocks" description="The most widely followed US stocks and ETFs, grouped by theme with live prices. Tap a stock for its full analysis, follow it, or trade it on paper." />

      <Card className="relative z-20 mb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any US stock or ETF — try Palantir or ARM" className="pl-10" autoComplete="off" />
          {hits.length > 0 && (
            <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lift">
              {hits.map((h) => (
                <Link key={h.symbol} href={`/stock/${h.symbol}`} className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition hover:bg-white/[0.06]">
                  <span className="font-mono font-semibold">{h.symbol}</span>
                  <span className="truncate text-xs text-dim">{h.description}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {popular.loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}</div>
      ) : popular.error && !popular.data ? (
        <ErrorState message={popular.error} onRetry={popular.reload} />
      ) : (
        <>
          {popular.data && popular.data.live_count === 0 && (
            <Card className="mb-5 border-warning/25 bg-warning/[0.06] text-[13px] text-warning">Live prices aren&apos;t loading right now (check your Finnhub key or try again in a minute). The list below is still browsable.</Card>
          )}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {mover("Top gainers today", <TrendingUp className="h-4 w-4 text-positive" />, popular.data?.gainers ?? [])}
            {mover("Top losers today", <TrendingDown className="h-4 w-4 text-negative" />, popular.data?.losers ?? [])}
          </div>

          <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ key: "all", title: "All" }, ...groups].map((g) => (
              <button key={g.key} onClick={() => setGroup(g.key)} className={clsx("shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition", group === g.key ? "border-primary/50 bg-primary/12 text-primary" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink")}>
                {g.title}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">{stocks.map((s) => <Row key={s.ticker} s={s} />)}</div>
        </>
      )}
    </main>
  );
}
