"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import clsx from "clsx";
import { api, type PortfolioHoldingOut, type PortfolioSummaryOut, type Quote, type SearchHit } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Field } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Change } from "@/components/ui/Change";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { shares as fmtShares, signedUsd, usd } from "@/lib/format";

const NOTE_PROMPTS = [
  "I believe in this company long-term",
  "Reacting to a news story",
  "Spreading my money around",
  "Just practicing",
];

export function TradeModal({
  open,
  onClose,
  mode,
  holding,
  initialTicker,
  summary,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  mode: "buy" | "sell";
  /** Required for sell: the position being sold. */
  holding?: PortfolioHoldingOut | null;
  initialTicker?: string;
  summary: PortfolioSummaryOut | null;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const toast = useToast();
  const [ticker, setTicker] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [unit, setUnit] = useState<"shares" | "dollars">("shares");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pickedRef = useRef(false);

  const selling = mode === "sell";
  const activeTicker = selling ? holding?.ticker ?? "" : ticker;

  // reset when opened
  useEffect(() => {
    if (!open) return;
    setTicker(selling ? holding?.ticker ?? "" : initialTicker ?? "");
    setHits([]);
    setQuote(null);
    setQuoteError(null);
    setAmount("");
    setNote("");
    setError(null);
    setUnit("shares");
    pickedRef.current = !!initialTicker || selling;
  }, [open, selling, holding, initialTicker]);

  // autocomplete (buy only)
  useEffect(() => {
    if (!open || selling || pickedRef.current) return;
    const q = ticker.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchTicker(q).then((r) => setHits(r.slice(0, 5))).catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(t);
  }, [ticker, open, selling]);

  // live quote for the chosen ticker
  useEffect(() => {
    if (!open || !activeTicker || !pickedRef.current) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);
    api
      .getQuote(activeTicker)
      .then((q) => !cancelled && setQuote(q))
      .catch((e) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "No live price");
      })
      .finally(() => !cancelled && setQuoteLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeTicker, open]);

  function pick(symbol: string) {
    pickedRef.current = true;
    setTicker(symbol);
    setHits([]);
  }

  const price = quote?.price ?? null;
  const numeric = parseFloat(amount);
  const sharesNum = useMemo(() => {
    if (!price || !Number.isFinite(numeric) || numeric <= 0) return 0;
    return unit === "shares" ? numeric : Math.floor((numeric / price) * 10000) / 10000;
  }, [numeric, unit, price]);
  const total = price ? sharesNum * price : 0;

  const cash = summary?.cash_balance ?? 0;
  const owned = holding?.shares ?? 0;
  const overspend = !selling && total > cash + 0.005;
  const oversell = selling && sharesNum > owned + 1e-9;

  // educational preview: how big would this position be?
  const existingValue = summary?.holdings.find((h) => h.ticker === activeTicker)?.market_value ?? 0;
  const portfolioTotal = summary?.total_value ?? 0;
  const weightAfter = portfolioTotal > 0 && !selling ? ((existingValue + total) / portfolioTotal) * 100 : null;
  const realized = selling && holding && price ? sharesNum * (price - holding.avg_buy_price) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token || !activeTicker || sharesNum <= 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const fn = selling ? api.sellStock : api.buyStock;
      const res = await fn(token, activeTicker, sharesNum, note.trim() || undefined);
      toast.push({
        tone: "success",
        title: `${selling ? "Sold" : "Bought"} ${fmtShares(sharesNum)} ${activeTicker}`,
        description: `Filled at ${usd(res.price)} · ${usd(sharesNum * res.price)} total (simulated)`,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!price && sharesNum > 0 && !overspend && !oversell && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={selling ? `Sell ${holding?.ticker ?? ""}` : "Buy shares"}
      description="Simulated trade — no real money. The price is the live market price at the moment you confirm."
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {!selling && (
          <div className="relative">
            <Field label="Company or ticker">
              <Input
                value={ticker}
                onChange={(e) => {
                  pickedRef.current = false;
                  setQuote(null);
                  setTicker(e.target.value.toUpperCase());
                }}
                placeholder="Search e.g. AAPL or Apple"
                autoFocus={!initialTicker}
                autoComplete="off"
                required
              />
            </Field>
            {hits.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lift">
                {hits.map((h) => (
                  <button
                    type="button"
                    key={h.symbol}
                    onClick={() => pick(h.symbol)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
                  >
                    <span className="font-mono font-semibold">{h.symbol}</span>
                    <span className="truncate text-xs text-dim">{h.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* live price strip */}
        {activeTicker && pickedRef.current && (
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
            <div>
              <div className="font-mono text-sm font-semibold">{activeTicker}</div>
              <div className="mt-0.5 text-xs text-dim">Live price</div>
            </div>
            {quoteLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : quote ? (
              <div className="text-right">
                <div className="num font-display text-2xl font-semibold leading-none">{usd(quote.price)}</div>
                <Change value={quote.change_percent} className="mt-1 text-xs" />
              </div>
            ) : (
              <span className="text-xs text-warning">{quoteError ?? "No live price"}</span>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted">{selling ? "How many shares?" : "How much?"}</span>
            {!selling && <Tabs size="sm" value={unit} onChange={setUnit} options={[{ value: "shares", label: "Shares" }, { value: "dollars", label: "Dollars" }]} />}
          </div>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={unit === "dollars" && !selling ? "1000" : "10"}
              required
            />
            {selling && holding && (
              <button
                type="button"
                onClick={() => setAmount(String(holding.shares))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink"
              >
                Sell all ({fmtShares(holding.shares)})
              </button>
            )}
          </div>
          {!selling && summary && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1000, 5000, 10000].map((d) => (
                <button type="button" key={d} onClick={() => { setUnit("dollars"); setAmount(String(d)); }} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-muted transition hover:border-primary/40 hover:text-primary">
                  {usd(d, 0)}
                </button>
              ))}
              <span className="ml-auto self-center text-xs text-dim">Cash: {usd(cash)}</span>
            </div>
          )}
        </div>

        {/* order preview */}
        {price && sharesNum > 0 && (
          <div className="animate-fade-in rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">{selling ? "You receive" : "You pay"}</span><span className="num font-semibold">{usd(total)}</span></div>
            <div className="mt-2 flex justify-between"><span className="text-muted">Shares</span><span className="num">{fmtShares(sharesNum)}</span></div>
            {!selling && <div className="mt-2 flex justify-between"><span className="text-muted">Cash after</span><span className={clsx("num", overspend && "text-negative")}>{usd(cash - total)}</span></div>}
            {weightAfter !== null && (
              <div className="mt-2 flex justify-between"><span className="text-muted">Position size after</span><span className="num">{weightAfter.toFixed(1)}% of portfolio</span></div>
            )}
            {realized !== null && (
              <div className="mt-2 flex justify-between"><span className="text-muted">Gain/loss on these shares</span><span className={clsx("num font-medium", realized >= 0 ? "text-positive" : "text-negative")}>{signedUsd(realized)}</span></div>
            )}
            {weightAfter !== null && weightAfter > 30 && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This would make {activeTicker} {weightAfter.toFixed(0)}% of your portfolio. A big single position means one company drives most of your results.
              </p>
            )}
            {selling && holding && sharesNum === holding.shares && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted"><ArrowDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />This closes your whole {holding.ticker} position.</p>
            )}
          </div>
        )}
        {overspend && <ErrorState message={`That's ${usd(total)} but you only have ${usd(cash)} in cash.`} />}
        {oversell && <ErrorState message={`You only own ${fmtShares(owned)} shares.`} />}

        <div>
          <Field label="Decision journal (optional)" hint="Writing down your reasoning is the fastest way to learn. You'll see how it aged in your Journal.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder={selling ? "Why are you selling?" : "Why are you buying this?"} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NOTE_PROMPTS.map((p) => (
              <button type="button" key={p} onClick={() => setNote(p)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted transition hover:border-primary/40 hover:text-primary">
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorState message={error} />}

        <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit} className="w-full">
          {selling ? "Confirm sale" : "Confirm purchase"}
          {price && sharesNum > 0 ? ` · ${usd(total)}` : ""}
        </Button>
      </form>
    </Modal>
  );
}
