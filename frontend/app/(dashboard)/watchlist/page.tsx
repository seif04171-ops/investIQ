"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, Newspaper, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type BulkQuote, type SearchHit, type WatchlistEntry } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { usd } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Change } from "@/components/ui/Change";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { PriceChart } from "@/components/ui/PriceChart";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type SortKey = "move" | "price" | "name" | "added";
type Filter = "all" | "up" | "down";

const NO_ITEMS: Awaited<ReturnType<typeof api.listWatchlist>> = [];
const NO_QUOTES: Record<string, BulkQuote> = {};

export default function WatchlistPage() {
  const { token } = useAuth();
  const toast = useToast();
  const enabled = !!token;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<SortKey>("move");
  const [filter, setFilter] = useState<Filter>("all");

  const list = useAsync(async () => {
    const items = await api.listWatchlist(token!);
    const quotes: Record<string, BulkQuote> = items.length ? await api.getQuotes(items.map((i) => i.ticker)) : {};
    return { items, quotes };
  }, [token], { enabled, refreshMs: 30_000 });
  const briefing = useAsync(() => api.getBriefing(token!), [token], { enabled });
  const popular = useAsync(() => api.getPopular(), [], { refreshMs: 60_000 });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") === "add") inputRef.current?.focus();
  }, []);

  // search-as-you-type suggestions
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => api.searchTicker(q).then((r) => setHits(r.slice(0, 5))).catch(() => setHits([])), 220);
    return () => clearTimeout(t);
  }, [query]);

  const newsCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of briefing.data?.news ?? []) for (const t of e.matched_tickers ?? []) m[t] = (m[t] ?? 0) + 1;
    return m;
  }, [briefing.data]);

  async function add(symbol: string) {
    if (!token || !symbol.trim()) return;
    setAdding(true);
    try {
      await api.addToWatchlist(token, symbol.trim().toUpperCase());
      toast.push({ tone: "success", title: `${symbol.toUpperCase()} added`, description: "Headlines about it will now show up in your briefing." });
      setQuery("");
      setHits([]);
      list.reload();
      briefing.reload();
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't add that", description: e instanceof Error ? e.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  async function remove(item: WatchlistEntry) {
    if (!token) return;
    list.mutate((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.ticker !== item.ticker) } : prev));
    try {
      await api.removeFromWatchlist(token, item.ticker);
      toast.push({ tone: "success", title: `${item.ticker} removed` });
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't remove it", description: e instanceof Error ? e.message : undefined });
      list.reload();
    }
  }

  const items = list.data?.items ?? NO_ITEMS;
  const suggestions = useMemo(() => {
    const have = new Set(items.map((i) => i.ticker.toUpperCase()));
    const pool = (popular.data?.groups ?? []).filter((g) => g.key !== "etf").flatMap((g) => g.stocks);
    // interleave themes so suggestions are varied, not 12 tech names
    const byGroup = (popular.data?.groups ?? []).filter((g) => g.key !== "etf").map((g) => g.stocks.filter((s) => !have.has(s.ticker)));
    const out: typeof pool = [];
    for (let i = 0; out.length < 12 && i < 10; i++) for (const g of byGroup) if (g[i] && out.length < 12) out.push(g[i]);
    return out;
  }, [popular.data, items]);
  const quotes = list.data?.quotes ?? NO_QUOTES;
  const shown = useMemo(() => {
    const move = (t: string) => quotes[t.toUpperCase()]?.change_percent ?? 0;
    const price = (t: string) => quotes[t.toUpperCase()]?.price ?? 0;
    return items
      .filter((i) => filter === "all" || (filter === "up" ? move(i.ticker) > 0 : move(i.ticker) < 0))
      .sort((a, b) => {
        if (sort === "move") return Math.abs(move(b.ticker)) - Math.abs(move(a.ticker));
        if (sort === "price") return price(b.ticker) - price(a.ticker);
        if (sort === "name") return a.ticker.localeCompare(b.ticker);
        return (b.added_at ?? "").localeCompare(a.added_at ?? "");
      });
  }, [items, quotes, sort, filter]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add(hits[0]?.symbol && hits[0].symbol.toUpperCase() === query.trim().toUpperCase() ? hits[0].symbol : query);
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Follow without committing" title="Watchlist" description="Track companies you're curious about. Prices refresh automatically, and news that mentions them lands in your briefing." />

      <Card className="relative z-20 mb-6">
        <form onSubmit={onSubmit} className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a company or ticker — try Apple or NVDA" className="pl-10" autoComplete="off" />
            {hits.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lift">
                {hits.map((h) => (
                  <button type="button" key={h.symbol} onClick={() => add(h.symbol)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-white/[0.06]">
                    <span className="font-mono font-semibold">{h.symbol}</span>
                    <span className="truncate text-xs text-dim">{h.description}</span>
                    <Plus className="ml-auto h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" loading={adding} disabled={!query.trim()} className="h-11">Add</Button>
        </form>
      </Card>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="eyebrow mb-1">Suggestions</div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Popular stocks — one tap to follow</h2>
          </div>
          <Link href="/explore" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Browse all <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {popular.loading ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}</div>
        ) : suggestions.length === 0 ? (
          <Card className="text-sm text-muted">{popular.error ? "Couldn't load suggestions — is the backend running?" : "You're following all the popular stocks. Use Explore to find more."}</Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => (
              <div key={s.ticker} className="glass glass-hover flex items-center gap-3 rounded-xl px-3.5 py-3">
                <TickerAvatar ticker={s.ticker} size={34} />
                <Link href={`/stock/${s.ticker}`} className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold">{s.ticker}</div>
                  <div className="truncate text-[11px] text-dim">{s.name}</div>
                </Link>
                <div className="text-right">
                  <div className="num text-[13px] font-medium">{s.price !== null ? usd(s.price) : "—"}</div>
                  {s.change_percent !== null && <Change value={s.change_percent} className="text-[11px]" />}
                </div>
                <button onClick={() => add(s.ticker)} disabled={adding} className="rounded-lg bg-primary/12 p-2 text-primary transition hover:bg-primary/25" aria-label={`Follow ${s.ticker}`}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {list.loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}</div>
      ) : list.error && !list.data ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Eye className="h-5 w-5" />} title="Your watchlist is empty" message="Tap + on any suggestion above, or search a company. Following costs nothing — no practice money is spent." /></Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onChange={setFilter} size="sm" options={[{ value: "all", label: `All (${items.length})` }, { value: "up", label: "Up today" }, { value: "down", label: "Down today" }]} />
            <label className="flex items-center gap-2 text-xs text-dim">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-xs text-ink outline-none">
                <option value="move">Biggest move</option>
                <option value="price">Price</option>
                <option value="name">Ticker A–Z</option>
                <option value="added">Recently added</option>
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <Card className="text-sm text-muted">Nothing matches that filter right now.</Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {shown.map((item) => {
                const q = quotes[item.ticker.toUpperCase()];
                const n = newsCount[item.ticker.toUpperCase()] ?? 0;
                return (
                  <article key={item.ticker} className="glass glass-hover group relative rounded-2xl p-5">
                    <div className="flex items-start gap-3.5">
                      <TickerAvatar ticker={item.ticker} size={44} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/stock/${item.ticker}`} className="font-mono text-base font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl">{item.ticker}</Link>
                        <div className="truncate text-xs text-dim">{item.name}</div>
                      </div>
                      {q ? (
                        <div className="text-right">
                          <div className="num font-display text-xl font-semibold leading-none">{usd(q.price)}</div>
                          <Change value={q.change_percent} variant="pill" className="mt-1.5" />
                        </div>
                      ) : (
                        <Badge variant="warning">No live price</Badge>
                      )}
                    </div>
                    <div className="mt-4"><PriceChart ticker={item.ticker} compact height={72} defaultDays={1} /></div>
                    <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                      <div className="flex items-center gap-2">
                        {item.sector && <Badge variant="neutral">{item.sector}</Badge>}
                        {n > 0 && <Link href="/news" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Newspaper className="h-3 w-3" />{n} in the news</Link>}
                      </div>
                      <button onClick={() => remove(item)} className="rounded-lg p-2 text-dim transition hover:bg-negative/10 hover:text-negative" aria-label={`Remove ${item.ticker}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
