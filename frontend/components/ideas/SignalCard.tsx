"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";
import clsx from "clsx";
import type { Opportunity } from "@/lib/api-client";
import { Change } from "@/components/ui/Change";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { timeAgo, usd } from "@/lib/format";

const TONE = {
  bullish: { ring: "#3DDC97", text: "text-positive", chip: "bg-positive/12 text-positive ring-positive/25" },
  bearish: { ring: "#FF6B6B", text: "text-negative", chip: "bg-negative/12 text-negative ring-negative/25" },
  neutral: { ring: "#9AA3B2", text: "text-muted", chip: "bg-white/[0.06] text-muted ring-white/15" },
} as const;

export function ScoreDial({ score, direction, size = 64 }: { score: number; direction: Opportunity["direction"]; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = TONE[direction];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Signal score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone.ring} strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num font-display text-lg font-semibold">{score}</span>
      </div>
    </div>
  );
}

export function SignalCard({ item, defaultOpen = false }: { item: Opportunity; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = TONE[item.direction];
  const holding = item.relation === "holding";
  const trade =
    item.direction === "bearish" && holding
      ? { href: `/portfolio?trade=sell&ticker=${item.ticker}`, label: "Sell (paper)", primary: false }
      : item.direction === "bearish"
        ? null
        : { href: `/portfolio?trade=buy&ticker=${item.ticker}`, label: "Buy (paper)", primary: true };

  return (
    <article className="glass glass-hover flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <ScoreDial score={item.score} direction={item.direction} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <TickerAvatar ticker={item.ticker} size={28} />
            <Link href={`/stock/${item.ticker}`} className="font-mono text-base font-semibold hover:text-primary">{item.ticker}</Link>
            {item.relation && (
              <span className="whitespace-nowrap rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {item.relation === "holding" ? "You own" : "Watching"}
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm text-muted">{item.name}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={clsx("whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tone.chip)}>{item.label}</span>
            <span className="text-[11px] text-dim">{item.confidence} confidence</span>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-lg font-semibold">{usd(item.price)}</div>
          <Change value={item.change_percent} className="text-xs" />
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
        {item.reasons.slice(0, open ? undefined : 2).map((r, i) => (
          <li key={i} className="flex gap-2"><span className={clsx("mt-[0.65em] h-1 w-1 shrink-0 rounded-full", item.direction === "bearish" ? "bg-negative" : item.direction === "bullish" ? "bg-positive" : "bg-dim")} />{r}</li>
        ))}
      </ul>

      {open && (
        <div className="animate-fade-up flex flex-col gap-4">
          {item.stories.length > 0 && (
            <div>
              <div className="eyebrow mb-2">Stories behind it</div>
              <div className="flex flex-col">
                {item.stories.map((s) => (
                  <Link key={s.id} href={`/news/${s.id}`} className="-mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-2 text-[13px] transition hover:bg-white/[0.05]">
                    <span className="min-w-0 flex-1">{s.title}</span>
                    <span className="shrink-0 text-right text-[11px] text-dim">
                      <span className={clsx(s.effect === "positive" ? "text-positive" : s.effect === "negative" ? "text-negative" : "text-muted")}>{s.effect}</span>
                      {s.credibility != null && <> · cred {s.credibility}</>} · {timeAgo(s.when)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-warning/20 bg-warning/[0.05] p-3.5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-warning"><ShieldAlert className="h-3.5 w-3.5" />What could go wrong</div>
            <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">{item.risks.map((r, i) => <li key={i}>• {r}</li>)}</ul>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <Link href={`/stock/${item.ticker}`} className="rounded-xl border border-white/10 px-3.5 py-2 text-[13px] font-medium text-muted transition hover:border-white/25 hover:text-ink">Research</Link>
        {trade && (
          <Link href={trade.href} className={clsx("rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", trade.primary ? "bg-primary text-[#1A1204] hover:bg-primaryHover" : "border border-negative/40 text-negative hover:bg-negative/10")}>
            {trade.label}
          </Link>
        )}
        <Link href={`/tutor?q=${encodeURIComponent(`Give me the bull and bear case for $${item.ticker} given the current signals and news.`)}`} className="rounded-xl px-3 py-2 text-[13px] font-medium text-primary transition hover:bg-primary/10">Ask the analyst</Link>
        <button onClick={() => setOpen((v) => !v)} className="ml-auto flex items-center gap-1 text-xs text-dim transition hover:text-ink" aria-expanded={open}>
          {open ? "Less" : "Full breakdown"}<ChevronDown className={clsx("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
      </div>
    </article>
  );
}
