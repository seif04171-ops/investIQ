"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, RotateCcw, TriangleAlert, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type PortfolioHoldingOut } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { AXIS_STROKE, DOWN, GRID_STROKE, tooltipStyle, UP } from "@/lib/chart-theme";
import { pct, signedUsd, toneClass, usd } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { HealthCard } from "@/components/portfolio/HealthCard";
import { AllocationDonut } from "@/components/portfolio/AllocationDonut";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { Journal } from "@/components/portfolio/Journal";
import { TradeModal } from "@/components/portfolio/TradeModal";

type Tab = "overview" | "holdings" | "journal";

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="!p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-[22px] font-semibold leading-none tracking-tight">{children}</div>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export default function PortfolioPage() {
  const { token } = useAuth();
  const toast = useToast();
  const enabled = !!token;
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30");
  const [trade, setTrade] = useState<{ mode: "buy" | "sell"; holding: PortfolioHoldingOut | null; ticker?: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const summary = useAsync(() => api.getPortfolioSummary(token!), [token], { enabled, refreshMs: 45_000 });
  const performance = useAsync(() => api.getPerformance(token!, Number(range)), [token, range], { enabled });
  const transactions = useAsync(() => api.getTransactions(token!), [token], { enabled });

  // deep links: /portfolio?trade=buy&ticker=AAPL  and  #health / #journal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("trade") === "buy") setTrade({ mode: "buy", holding: null, ticker: params.get("ticker") ?? undefined });
    if (window.location.hash === "#journal") setTab("journal");
    if (window.location.hash === "#health") setTab("overview");
  }, []);

  // /portfolio?trade=sell&ticker=XYZ opens the sell ticket once holdings are known
  const sellLink = useRef(false);
  useEffect(() => {
    if (sellLink.current || !summary.data) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("trade") !== "sell") return;
    sellLink.current = true;
    const t = (params.get("ticker") ?? "").toUpperCase();
    const holding = summary.data.holdings.find((h) => (h.ticker ?? "").toUpperCase() === t);
    if (holding) setTrade({ mode: "sell", holding });
    else toast.push({ tone: "error", title: `You don't hold ${t || "that stock"}`, description: "Buy it first to be able to sell it." });
  }, [summary.data, toast]);

  function refreshAll() {
    summary.reload();
    performance.reload();
    transactions.reload();
  }

  async function doReset() {
    if (!token) return;
    setResetting(true);
    try {
      await api.resetPortfolio(token);
      toast.push({ tone: "success", title: "Portfolio reset", description: "Fresh $100,000 of simulated cash." });
      setResetOpen(false);
      refreshAll();
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't reset", description: e instanceof Error ? e.message : undefined });
    } finally {
      setResetting(false);
    }
  }

  const s = summary.data;
  const points = (performance.data?.points ?? []).map((p) => ({ t: p.date * 1000, value: p.value }));
  const up = points.length > 1 ? points[points.length - 1].value >= points[0].value : true;
  const stroke = up ? UP : DOWN;
  const investedPct = s && s.total_value > 0 ? (s.invested_value / s.total_value) * 100 : 0;

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Paper trading · simulated money"
        title="Portfolio simulator"
        description="Practice with $100,000 of pretend money. Trade, write down why, and watch how your decisions age."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            <Button onClick={() => setTrade({ mode: "buy", holding: null })}><Plus className="h-4 w-4" /> Buy</Button>
          </>
        }
      />

      {summary.loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}</div>
      )}
      {summary.error && !s && <ErrorState message={summary.error} onRetry={summary.reload} />}

      {s && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Stat label="Total value"><AnimatedNumber value={s.total_value} format={(n) => usd(n)} className="num" /></Stat>
            <Stat label="Cash">{<span className="num">{usd(s.cash_balance)}</span>}</Stat>
            <Stat label="Invested"><span className="num">{usd(s.invested_value)}</span></Stat>
            <Stat label="Total return" sub={pct(s.total_return_pct)}>
              <span className={`num ${toneClass(s.total_return_value)}`}>{signedUsd(s.total_return_value)}</span>
            </Stat>
            <Stat label="Today" sub={pct(s.day_change_pct)}>
              <span className={`num ${toneClass(s.day_change_value)}`}>{signedUsd(s.day_change_value)}</span>
            </Stat>
          </div>

          {!s.prices_live && s.holdings.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-[13px] text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>No live price for {s.stale_tickers.join(", ")} — shown at your purchase price, so their gain/loss reads 0% until a quote comes through.</span>
            </div>
          )}

          <Tabs
            value={tab}
            onChange={(t) => { setTab(t); history.replaceState(null, "", t === "overview" ? "#" : `#${t}`); }}
            options={[
              { value: "overview", label: "Overview" },
              { value: "holdings", label: `Holdings${s.holdings.length ? ` (${s.holdings.length})` : ""}` },
              { value: "journal", label: "Decision journal" },
            ]}
          />

          {tab === "overview" && (
            s.holdings.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Wallet className="h-5 w-5" />}
                  title="Nothing invested yet"
                  message="You have $100,000 of practice cash. Buy your first stock and this page comes alive: value over time, allocation, a health score and a journal."
                  action={<Button onClick={() => setTrade({ mode: "buy", holding: null })}><Plus className="h-4 w-4" /> Make your first trade</Button>}
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-7">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-semibold">Your holdings over time</div>
                      <div className="text-xs text-dim">Today&apos;s positions priced on each past day — not your actual past balance</div>
                    </div>
                    <Tabs size="sm" value={range} onChange={setRange} options={[{ value: "30", label: "1M" }, { value: "90", label: "3M" }, { value: "180", label: "6M" }]} />
                  </div>
                  {performance.loading ? (
                    <Skeleton className="h-[240px] rounded-2xl" />
                  ) : points.length > 1 ? (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={points} margin={{ top: 6, right: 4, left: -4, bottom: 0 }}>
                          <defs>
                            <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} minTickGap={44}
                            tickFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                          <YAxis domain={["auto", "auto"]} stroke={AXIS_STROKE} fontSize={11} tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
                          <Tooltip {...tooltipStyle}
                            labelFormatter={(t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            formatter={(v: number) => [usd(v), "Holdings value"]} />
                          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} fill="url(#perf)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: stroke }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-8 text-center text-sm text-muted">
                      {performance.data?.reason ?? performance.error ?? "Price history isn't available for these holdings right now."}
                    </div>
                  )}
                </Card>

                <Card className="lg:col-span-5">
                  <div className="mb-4 font-display text-base font-semibold">Where your money sits</div>
                  <AllocationDonut slices={s.allocation} investedPct={investedPct} />
                </Card>

                <div className="lg:col-span-12"><HealthCard health={s.health} /></div>
              </div>
            )
          )}

          {tab === "holdings" && (
            s.holdings.length === 0 ? (
              <Card><EmptyState icon={<Wallet className="h-5 w-5" />} title="No holdings yet" message="Buy a stock to see it here with a live price, daily move and chart." action={<Button onClick={() => setTrade({ mode: "buy", holding: null })}><Plus className="h-4 w-4" /> Buy a stock</Button>} /></Card>
            ) : (
              <HoldingsTable
                holdings={s.holdings}
                onBuyMore={(h) => setTrade({ mode: "buy", holding: null, ticker: h.ticker ?? undefined })}
                onSell={(h) => setTrade({ mode: "sell", holding: h })}
              />
            )
          )}

          {tab === "journal" && (
            transactions.loading ? <Skeleton className="h-64 rounded-2xl" /> :
            transactions.error ? <ErrorState message={transactions.error} onRetry={transactions.reload} /> :
            <Journal transactions={transactions.data ?? []} />
          )}
        </div>
      )}

      <TradeModal
        open={!!trade}
        onClose={() => setTrade(null)}
        mode={trade?.mode ?? "buy"}
        holding={trade?.holding}
        initialTicker={trade?.ticker}
        summary={s}
        onDone={refreshAll}
      />

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset your portfolio?" description="This clears every holding and your whole journal, and gives you a fresh $100,000. It can't be undone.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={resetting} onClick={doReset}>Yes, start over</Button>
        </div>
      </Modal>
    </main>
  );
}
