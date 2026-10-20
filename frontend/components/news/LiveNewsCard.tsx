import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { LiveNews } from "@/lib/api-client";
import { fullDate, timeAgo } from "@/lib/format";

const EFFECT = {
  positive: { label: "Good for shareholders", cls: "bg-positive/12 text-positive ring-positive/25", mark: "▲" },
  negative: { label: "Bad for shareholders", cls: "bg-negative/12 text-negative ring-negative/25", mark: "▼" },
  neutral: { label: "No clear direction", cls: "bg-white/[0.06] text-muted ring-white/15", mark: "•" },
} as const;

const IMPACT = { high: "High impact", medium: "Medium impact", low: "Low impact" } as const;

export function LiveNewsCard({ item, compact = false, highlight }: { item: LiveNews; compact?: boolean; highlight?: string[] }) {
  const e = EFFECT[item.effect] ?? EFFECT.neutral;
  const stale = item.age_hours > 48;
  return (
    <article className="glass glass-hover group relative flex h-full flex-col rounded-2xl p-5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-2">
          <span className="font-medium text-muted">{item.source}</span>
          <span title={`Source reliability ${item.credibility}/100`} className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold", item.credibility >= 75 ? "bg-positive/12 text-positive" : item.credibility >= 55 ? "bg-primary/12 text-primary" : "bg-white/[0.06] text-muted")}>
            {item.credibility}/100
          </span>
        </span>
        <time dateTime={item.published_at} className={stale ? "text-warning" : undefined}>
          {fullDate(item.published_at, true)} · {timeAgo(item.published_at)}
        </time>
      </div>

      <h3 className="font-display text-[16px] font-semibold leading-snug tracking-tight">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="outline-none after:absolute after:inset-0 after:rounded-2xl">
          {item.title}
          <ArrowUpRight className="ml-1 inline h-3.5 w-3.5 text-dim transition group-hover:text-primary" />
        </a>
      </h3>

      {!compact && item.why && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink/80">Why it matters: </span>
          {item.why}
        </p>
      )}

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
        <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", e.cls)}>
          {e.mark} {e.label}
        </span>
        {item.impact !== "low" && <span className="text-[11px] text-dim">{IMPACT[item.impact]}</span>}
      </div>

      <div className="relative z-10 mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {item.tickers.slice(0, 5).map((t) => (
          <Link
            key={t}
            href={`/stock/${t}`}
            title={item.names?.[t] ?? t}
            className={clsx(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset transition hover:brightness-125",
              highlight?.includes(t) ? "bg-primary/15 text-primary ring-primary/40" : "bg-white/[0.05] text-ink ring-white/15"
            )}
          >
            {t}
          </Link>
        ))}
        {item.tickers.length === 0 && <span className="text-[11px] text-dim">Market-wide</span>}
        {!compact && (
          <Link
            href={`/tutor?q=${encodeURIComponent(`${item.title} — what does this mean for ${item.tickers.length ? item.tickers.slice(0, 3).map((t) => "$" + t).join(", ") : "the market"}, and is there an opportunity or a risk?`)}`}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" /> Analyse
          </Link>
        )}
      </div>
    </article>
  );
}
