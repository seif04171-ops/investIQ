"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Eye, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { compactUsd, usd } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Change } from "@/components/ui/Change";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { PriceChart } from "@/components/ui/PriceChart";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TermLabel } from "@/components/ui/GlossaryText";
import { useToast } from "@/components/ui/Toast";
import { LiveNewsCard } from "@/components/news/LiveNewsCard";
import { ResearchPanel } from "@/components/stock/ResearchPanel";
import { TradeModal } from "@/components/portfolio/TradeModal";
import { SignalCard } from "@/components/ideas/SignalCard";

function Stat({ label, term, children }: { label: string; term?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="eyebrow">{term ? <TermLabel term={term}>{label}</TermLabel> : label}</div>
      <div className="num mt-2 font-display text-lg font-semibold leading-none">{children}</div>
    </div>
  );
}

function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
  const pos = high > low ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : 50;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:col-span-2">
      <div className="eyebrow">52-week range</div>
      <div className="relative mt-4 h-1.5 rounded-full bg-white/[0.08]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-negative/60 via-primary/60 to-positive/60" style={{ width: "100%" }} />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-background bg-ink shadow" style={{ left: `${pos}%` }} />
      </div>
      <div className="num mt-3 flex justify-between text-xs text-muted">
        <span>{usd(low)}</span>
        <span className="text-dim">{pos.toFixed(0)}% of the way up</span>
        <span>{usd(high)}</span>
      </div>
    </div>
  );
}

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = decodeURIComponent(params.ticker ?? "").toUpperCase();
  const { token } = useAuth();
  const toast = useToast();
  const enabled = !!token;
  const [trade, setTrade] = useState<"buy" | "sell" | null>(null);

  const stock = useAsync(() => api.getStock(ticker), [ticker], { refreshMs: 30_000 });
  const news = useAsync(() => api.getLiveNews({ ticker, sort: "smart", limit: 8 }).then((r) => r.items), [ticker], { refreshMs: 120_000 });
  const research = useAsync(() => api.getResearch(ticker), [ticker], { refreshMs: 120_000 });
  const watch = useAsync(() => api.listWatchlist(token!), [token], { enabled });
  const summary = useAsync(() => api.getPortfolioSummary(token!), [token], { enabled });
  const radar = useAsync(() => api.getOpportunities(token!), [token], { enabled });
  const signal = radar.data?.items.find((i) => i.ticker === ticker);

  const d = stock.data;
  const q = d?.quote;
  const profile = d?.profile;
  const onWatchlist = (watch.data ?? []).some((w) => w.ticker === ticker);
  const position = summary.data?.holdings.find((h) => h.ticker === ticker) ?? null;

  async function toggleWatch() {
    if (!token) return;
    try {
      if (onWatchlist) {
        watch.mutate((prev) => (prev ?? []).filter((w) => w.ticker !== ticker));
        await api.removeFromWatchlist(token, ticker);
        toast.push({ tone: "success", title: `${ticker} removed from watchlist` });
      } else {
        await api.addToWatchlist(token, ticker);
        toast.push({ tone: "success", title: `${ticker} added to your watchlist`, description: "News about it will now appear in your briefing." });
      }
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't update watchlist", description: e instanceof Error ? e.message : undefined });
    } finally {
      watch.reload();
    }
  }

  const questions = [
    `What's driving $${ticker} right now, and how credible is the news behind it?`,
    `Give me the bull case and the bear case for $${ticker}.`,
    `How would $${ticker} fit in my portfolio, and what does it overlap with?`,
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {stock.loading ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl" /><div><Skeleton className="h-7 w-56" /><Skeleton className="mt-3 h-4 w-32" /></div></div>
          <Skeleton className="h-[320px] rounded-2xl" />
        </div>
      ) : stock.error && !d ? (
        <ErrorState message={`We couldn't find market data for "${ticker}". ${stock.error}`} onRetry={stock.reload} />
      ) : d ? (
        <div className="flex flex-col gap-6">
          <header className="animate-fade-up flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <TickerAvatar ticker={ticker} logo={profile?.logo} size={64} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{profile?.name ?? ticker}</h1>
                  <span className="rounded-lg bg-white/[0.07] px-2 py-1 font-mono text-xs font-semibold">{ticker}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {profile?.industry && <Badge variant="neutral">{profile.industry}</Badge>}
                  {profile?.exchange && <span className="text-xs text-dim">{profile.exchange}</span>}
                  {profile?.country && <span className="text-xs text-dim">· {profile.country}</span>}
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              {q ? (
                <>
                  <AnimatedNumber value={q.price} format={(n) => usd(n)} className="num font-display text-[40px] font-semibold leading-none tracking-tight" />
                  <div className="mt-2 flex items-center gap-2 sm:justify-end">
                    <Change value={q.change_percent} variant="pill" />
                    <span className="num text-sm text-muted">{q.change >= 0 ? "+" : "−"}{usd(Math.abs(q.change))} today</span>
                  </div>
                </>
              ) : (
                <Badge variant="warning">No live price right now</Badge>
              )}
            </div>
          </header>

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => setTrade("buy")} disabled={!q}><Plus className="h-4 w-4" /> Buy (simulated)</Button>
            {position && <Button variant="secondary" onClick={() => setTrade("sell")}>Sell</Button>}
            <Button variant="secondary" onClick={toggleWatch} disabled={!token || watch.loading}>
              {onWatchlist ? <><Check className="h-4 w-4 text-positive" /> On watchlist</> : <><Eye className="h-4 w-4" /> Add to watchlist</>}
            </Button>
          </div>

          {position && (
            <Card className="flex flex-wrap items-center justify-between gap-4 border-primary/25 bg-primary/[0.04]">
              <div>
                <div className="eyebrow text-primary">You own this (simulated)</div>
                <div className="mt-1.5 text-sm text-muted"><span className="num font-medium text-ink">{position.shares}</span> shares · worth <span className="num font-medium text-ink">{usd(position.market_value)}</span> · {position.weight_pct.toFixed(1)}% of your portfolio</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-dim">Your gain / loss</div>
                <Change value={position.gain_loss_pct} variant="pill" />
              </div>
            </Card>
          )}

          <Card className="animate-fade-up">
            <PriceChart ticker={ticker} height={300} defaultDays={1} />
          </Card>

          {signal && (
            <section>
              <div className="eyebrow mb-3">Signal</div>
              <SignalCard item={signal} defaultOpen />
            </section>
          )}

          <section>
            <div className="eyebrow mb-3">Analysis</div>
            {research.loading ? <Skeleton className="h-40 rounded-2xl" /> : research.data ? <ResearchPanel r={research.data} /> : (
              <Card className="text-sm text-muted">Analysis data isn&apos;t available right now.</Card>
            )}
          </section>

          <section>
            <div className="eyebrow mb-3">Key numbers</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {profile?.market_cap_millions ? <Stat label="Market cap" term="Market capitalization">{compactUsd(profile.market_cap_millions * 1e6)}</Stat> : null}
              {d.stats.pe ? <Stat label="P/E ratio" term="P/E ratio">{d.stats.pe.toFixed(1)}</Stat> : null}
              {q && <Stat label="Day range">{usd(q.low)} – {usd(q.high)}</Stat>}
              {q?.prev_close ? <Stat label="Previous close">{usd(q.prev_close)}</Stat> : null}
              {d.stats.dividend_yield ? <Stat label="Dividend yield" term="Dividend">{d.stats.dividend_yield.toFixed(2)}%</Stat> : null}
              {d.stats.beta ? <Stat label="Beta (swinginess)" term="Volatility">{d.stats.beta.toFixed(2)}</Stat> : null}
              {d.stats.week52_high && d.stats.week52_low && q ? <RangeBar low={d.stats.week52_low} high={d.stats.week52_high} price={q.price} /> : null}
            </div>
            <p className="mt-3 text-xs text-dim">Numbers come from a live data feed; anything unavailable is simply left out, never estimated.</p>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><div className="eyebrow">Ask the analyst about {ticker}</div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {questions.map((qq) => (
                <Link key={qq} href={`/tutor?q=${encodeURIComponent(qq)}`} className="glass glass-hover rounded-2xl p-4 text-sm leading-relaxed">
                  {qq}
                  <span className="mt-3 block text-xs font-medium text-primary">Ask the analyst →</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="eyebrow mb-3">In the news</div>
            {news.loading ? <Skeleton className="h-40 rounded-2xl" /> : (news.data ?? []).length === 0 ? (
              <Card className="text-sm leading-relaxed text-muted">No recent headlines mention {profile?.name ?? ticker} right now. News is matched automatically as new stories arrive.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">{news.data!.map((n) => <LiveNewsCard key={n.id} item={n} />)}</div>
            )}
          </section>
        </div>
      ) : null}

      <TradeModal
        open={trade !== null}
        onClose={() => setTrade(null)}
        mode={trade ?? "buy"}
        holding={trade === "sell" ? position : null}
        initialTicker={ticker}
        summary={summary.data}
        onDone={() => { summary.reload(); }}
      />
    </main>
  );
}
