"use client";

import Link from "next/link";
import { BookOpen, Brain, Quote } from "lucide-react";
import clsx from "clsx";
import type { TransactionOut } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { TermLabel } from "@/components/ui/GlossaryText";
import { fullDate, pct, shares as fmtShares, usd } from "@/lib/format";

function Outcome({ t }: { t: TransactionOut }) {
  if (t.since_pct === null || t.current_price === null) {
    return <span className="text-xs text-dim">No live price to compare with right now.</span>;
  }
  const up = t.since_pct >= 0;
  const tone = up ? "text-positive" : "text-negative";
  if (t.action === "buy") {
    return (
      <div className="text-sm">
        <span className="text-muted">Since you bought: </span>
        <span className={clsx("num font-semibold", tone)}>{pct(t.since_pct)}</span>
        <span className="text-muted"> ({usd(t.price)} → {usd(t.current_price)})</span>
      </div>
    );
  }
  return (
    <div className="text-sm">
      <span className="text-muted">Price since you sold: </span>
      <span className={clsx("num font-semibold", tone)}>{pct(t.since_pct)}</span>
      <span className="text-muted"> ({usd(t.price)} → {usd(t.current_price)})</span>
    </div>
  );
}

export function Journal({ transactions }: { transactions: TransactionOut[] }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Your decision journal is empty"
          message="Every trade you make lands here with the reasoning you wrote down and how it looks today. It's the fastest way to learn."
        />
      </Card>
    );
  }

  const buys = transactions.filter((t) => t.action === "buy" && t.since_pct !== null);
  const buysUp = buys.filter((t) => (t.since_pct ?? 0) >= 0).length;
  const withNotes = transactions.filter((t) => t.note).length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-iris/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-iris/12 text-iris ring-1 ring-inset ring-iris/25">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Judge the reasoning, not just the result</div>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              A good decision can have a bad outcome, and a lucky one can have a bad reason. This is called{" "}
              <TermLabel term="Outcome bias">outcome bias</TermLabel> — and the journal helps you catch it. Read your notes first, then look at what happened.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="neutral">{transactions.length} trades</Badge>
              <Badge variant="primary">{withNotes} with notes</Badge>
              {buys.length > 0 && <Badge variant="neutral">{buysUp} of {buys.length} buys currently above your price</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-white/[0.08]">
        {transactions.map((t) => (
          <li key={t.id} className="relative pl-12">
            <span
              className={clsx(
                "absolute left-0 top-4 flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-bold uppercase tracking-wider",
                t.action === "buy" ? "border-positive/30 bg-[#0b1a14] text-positive" : "border-negative/30 bg-[#1a0d0d] text-negative"
              )}
            >
              {t.action}
            </span>
            <Card className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {t.ticker ? (
                    <Link href={`/stock/${t.ticker}`} className="font-mono text-sm font-semibold transition hover:text-primary">{t.ticker}</Link>
                  ) : (
                    <span className="font-mono text-sm font-semibold">{t.company}</span>
                  )}
                  <span className="num text-sm text-muted">{fmtShares(t.shares)} × {usd(t.price)}</span>
                </div>
                <time className="text-xs text-dim">{fullDate(t.executed_at, true)}</time>
              </div>

              {t.note ? (
                <blockquote className="mt-3 flex gap-2.5 rounded-xl bg-white/[0.04] p-3 text-[13px] leading-relaxed">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>{t.note}</span>
                </blockquote>
              ) : (
                <p className="mt-3 text-xs italic text-dim">No reasoning written down for this trade. Add one next time to learn from it.</p>
              )}
              <div className="mt-3 border-t border-white/[0.06] pt-3"><Outcome t={t} /></div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
