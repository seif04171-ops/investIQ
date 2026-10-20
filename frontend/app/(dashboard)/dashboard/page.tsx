"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { fullDate, greeting } from "@/lib/format";
import { IndexCard, MarketStripSkeleton, MarketUnavailable, SentimentCard } from "@/components/dashboard/MarketStrip";
import { PortfolioHero } from "@/components/dashboard/PortfolioHero";
import { BriefingFeed } from "@/components/dashboard/BriefingFeed";
import { TopSignals, WatchlistMovers } from "@/components/dashboard/SideCards";
import { HealthCard } from "@/components/portfolio/HealthCard";
import { LiveNewsCard } from "@/components/news/LiveNewsCard";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";

const LIVE = 60_000;

export default function DashboardPage() {
  const { user, token } = useAuth();
  const enabled = !!token;

  const summary = useAsync(() => api.getPortfolioSummary(token!), [token], { enabled, refreshMs: LIVE });
  const performance = useAsync(() => api.getPerformance(token!, 30), [token], { enabled });
  const briefing = useAsync(() => api.getBriefing(token!), [token], { enabled, refreshMs: 120_000 });
  const market = useAsync(() => Promise.all([api.getMarketOverview(), api.getMarketSentiment()]), [], { refreshMs: LIVE });
  const watchlist = useAsync(async () => {
    const items = await api.listWatchlist(token!);
    const quotes = items.length ? await api.getQuotes(items.map((i) => i.ticker)) : {};
    return { items, quotes };
  }, [token], { enabled, refreshMs: LIVE });
  const signals = useAsync(() => api.getOpportunities(token!), [token], { enabled, refreshMs: 180_000 });
  const headlines = useAsync(() => api.getLiveNews({ limit: 4 }).then((r) => r.items), [], { refreshMs: 120_000 });

  const name = user?.display_name?.split(" ")[0];
  const [indices, sentiment] = market.data ?? [[], null];

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 animate-fade-up">
        <div className="eyebrow mb-2">{fullDate(new Date().toISOString())}</div>
        <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
        <p className="mt-2 text-[15px] text-muted">Here&apos;s what&apos;s happening — and what it means for you.</p>
      </header>

      <div className="flex flex-col gap-6">
        {/* Hero row: your money + how it's built */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="animate-fade-up lg:col-span-8" style={{ animationDelay: "60ms" }}>
            {summary.loading ? (
              <Card className="h-[340px]"><Skeleton className="h-3 w-40" /><Skeleton className="mt-6 h-12 w-72" /><Skeleton className="mt-6 h-4 w-64" /><Skeleton className="mt-12 h-24 w-full" /></Card>
            ) : summary.error || !summary.data ? (
              <ErrorState message={summary.error ?? "Couldn't load your portfolio."} onRetry={summary.reload} />
            ) : (
              <PortfolioHero summary={summary.data} performance={performance.data} />
            )}
          </div>
          <div className="animate-fade-up lg:col-span-4" style={{ animationDelay: "120ms" }}>
            {summary.loading ? <Card className="h-[340px]"><Skeleton className="h-full w-full" /></Card> : <HealthCard health={summary.data?.health ?? null} variant="compact" />}
          </div>
        </section>

        {/* Market strip */}
        <section className="animate-fade-up" style={{ animationDelay: "180ms" }}>
          {market.loading ? (
            <MarketStripSkeleton />
          ) : market.error || indices.length === 0 ? (
            <MarketUnavailable message={market.error ?? "No index quotes came back."} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {indices.map((i) => <IndexCard key={i.index_name} index={i} />)}
              {sentiment && <SentimentCard sentiment={sentiment} />}
            </div>
          )}
        </section>

        {/* Personalised news + side rail */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="animate-fade-up lg:col-span-8" style={{ animationDelay: "240ms" }}>
            {briefing.loading ? (
              <Card className="h-[360px]"><Skeleton className="h-4 w-40" /><Skeleton className="mt-6 h-6 w-3/4" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-8 h-6 w-2/3" /></Card>
            ) : briefing.error || !briefing.data ? (
              <ErrorState message={briefing.error ?? "Couldn't load your briefing."} onRetry={briefing.reload} />
            ) : (
              <BriefingFeed briefing={briefing.data} />
            )}
          </div>
          <div className="flex flex-col gap-6 animate-fade-up lg:col-span-4" style={{ animationDelay: "300ms" }}>
            {watchlist.loading ? <Card className="h-[260px]"><Skeleton className="h-full w-full" /></Card> : <WatchlistMovers items={watchlist.data?.items ?? []} quotes={watchlist.data?.quotes ?? {}} />}
            <TopSignals items={signals.data?.items ?? []} />
          </div>
        </section>

        {/* Latest headlines */}
        <section className="animate-fade-up" style={{ animationDelay: "360ms" }}>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="eyebrow mb-1.5">Across the market</div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Latest headlines, explained</h2>
            </div>
            <Link href="/news" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {headlines.loading ? (
            <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
          ) : headlines.error ? (
            <ErrorState message={headlines.error} onRetry={headlines.reload} />
          ) : (headlines.data ?? []).length === 0 ? (
            <Card className="text-sm text-muted">No headlines yet. Open the News page and press Refresh now to fetch the latest.</Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {headlines.data!.map((n) => <LiveNewsCard key={n.id} item={n} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
