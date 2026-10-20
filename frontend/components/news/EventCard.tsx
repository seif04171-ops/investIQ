import Link from "next/link";
import { ArrowUpRight, BarChart3, Building2, Globe2, Landmark, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { EventSummary } from "@/lib/api-client";
import { fullDate, timeAgo } from "@/lib/format";
import { CredibilityBadge } from "./CredibilityBadge";
import { SentimentBadge } from "./SentimentBadge";
import { GlossaryText } from "@/components/ui/GlossaryText";

export const EVENT_TYPES: Record<string, { label: string; icon: LucideIcon }> = {
  central_bank: { label: "Central bank", icon: Landmark },
  economic: { label: "Economy", icon: BarChart3 },
  company: { label: "Company", icon: Building2 },
  geopolitical: { label: "Geopolitics", icon: Globe2 },
};

export function EventTypeChip({ type }: { type: string }) {
  const meta = EVENT_TYPES[type] ?? { label: type.replace(/_/g, " "), icon: BarChart3 };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {meta.label}
    </span>
  );
}

/** Explicit date + relative time — a headline is never ambiguous about "when". */
export function EventDate({ iso, className }: { iso: string | null; className?: string }) {
  if (!iso) return null;
  return (
    <time dateTime={iso} className={clsx("text-xs text-dim", className)}>
      {fullDate(iso, true)} <span className="text-dim/70">· {timeAgo(iso)}</span>
    </time>
  );
}

export function EventCard({
  event,
  highlight,
  compact = false,
}: {
  event: EventSummary;
  /** Tickers to emphasise (the user's own holdings). */
  highlight?: string[];
  compact?: boolean;
}) {
  return (
    <article className="glass glass-hover group relative flex flex-col rounded-2xl p-5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <EventTypeChip type={event.event_type} />
        <EventDate iso={event.last_updated_at} />
      </div>

      <h3 className="font-display text-[17px] font-semibold leading-snug tracking-tight">
        <Link href={`/news/${event.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl">
          {event.title}
        </Link>
      </h3>

      {!compact && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
          <GlossaryText text={event.summary} />
        </p>
      )}

      {event.tickers && event.tickers.length > 0 && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-1.5">
          {event.tickers.slice(0, 4).map((t) => (
            <Link
              key={t.ticker}
              href={`/stock/${t.ticker}`}
              title={`${t.name} — expected effect: ${t.effect}`}
              className={clsx(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-inset transition hover:brightness-125",
                t.effect === "positive" ? "bg-positive/12 text-positive ring-positive/25" : t.effect === "negative" ? "bg-negative/12 text-negative ring-negative/25" : "bg-white/[0.06] text-muted ring-white/15"
              )}
            >
              {t.effect === "positive" ? "▲" : t.effect === "negative" ? "▼" : "•"} {t.ticker}
            </Link>
          ))}
        </div>
      )}

      {!(event.tickers && event.tickers.length > 0) && (highlight?.length || event.companies.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {highlight?.map((t) => (
            <span key={t} className="rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/25">
              {t}
            </span>
          ))}
          {event.companies.slice(0, 3).map((c) => (
            <span key={c} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-muted">
              {c}
            </span>
          ))}
          {event.companies.length > 3 && <span className="text-[11px] text-dim">+{event.companies.length - 3}</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <CredibilityBadge score={event.credibility_score} />
          <SentimentBadge sentiment={event.sentiment} />
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
          Read analysis <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      {event.source_url && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 mt-3 inline-flex w-fit items-center gap-1.5 text-xs text-dim transition hover:text-primary"
        >
          <ArrowUpRight className="h-3 w-3" />
          Original report{event.source_name ? ` · ${event.source_name}` : ""}
        </a>
      )}
    </article>
  );
}
