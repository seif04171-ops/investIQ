"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, ArrowUpRight, Check, CircleHelp, Minus, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import clsx from "clsx";
import { api, type EventDetail } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { useGlossary } from "@/lib/glossary-context";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GlossaryText } from "@/components/ui/GlossaryText";
import { CredibilityBadge, credibilityTone } from "@/components/news/CredibilityBadge";
import { EventDate, EventTypeChip } from "@/components/news/EventCard";
import { SentimentBadge } from "@/components/news/SentimentBadge";

const EFFECT: Record<string, BadgeVariant> = { positive: "positive", negative: "negative", mixed: "warning", unclear: "neutral" };
const GROUPS: Record<string, string> = { company: "Companies", sector: "Sectors", country: "Countries", economic_factor: "Economic factors" };

// How the credibility score is built (weights match the backend scorer).
const CRED_PARTS: Record<string, { label: string; max: number; hint: string }> = {
  source_reputation: { label: "Source reputation", max: 55, hint: "How trusted the outlet is." },
  independent_confirmations: { label: "Independent confirmations", max: 30, hint: "How many separate outlets report it." },
  official_confirmation: { label: "Official confirmation", max: 15, hint: "Whether a government, regulator or company confirmed it." },
};

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">{icon}<h2 className="eyebrow">{title}</h2></div>
      {children}
    </section>
  );
}

function Reasons({ title, items, tone }: { title: string; items: string[]; tone: "pos" | "neg" | "unk" }) {
  const Icon = tone === "pos" ? Check : tone === "neg" ? X : CircleHelp;
  const color = tone === "pos" ? "text-positive" : tone === "neg" ? "text-negative" : "text-muted";
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className={clsx("mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", color)}><Icon className="h-3.5 w-3.5" />{title}</div>
      {items.length === 0 ? <p className="text-sm text-dim">Nothing identified.</p> : (
        <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-muted">
          {items.map((r, i) => <li key={i} className="flex gap-2"><Minus className="mt-1 h-3 w-3 shrink-0 text-dim" /><GlossaryText text={r} /></li>)}
        </ul>
      )}
    </div>
  );
}

function useConceptsIn(event: EventDetail | null) {
  const { pattern, lookup } = useGlossary();
  return useMemo(() => {
    if (!event || !pattern) return [];
    const text = [event.summary, event.ai_analysis?.short_term_view, event.ai_analysis?.long_term_view, ...(event.ai_analysis?.reasoning_positive ?? []), ...(event.ai_analysis?.reasoning_negative ?? [])].filter(Boolean).join(" . ");
    const found = new Map<string, NonNullable<ReturnType<typeof lookup>>>();
    for (const m of text.matchAll(new RegExp(pattern.source, "gi"))) {
      const entry = lookup(m[0]);
      if (entry) found.set(entry.term, entry);
    }
    return [...found.values()].slice(0, 4);
  }, [event, pattern, lookup]);
}

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const { data: event, loading, error, reload } = useAsync(() => api.getEventDetail(params.eventId), [params.eventId]);
  const concepts = useConceptsIn(event);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <Skeleton className="h-4 w-24" /><Skeleton className="mt-8 h-10 w-3/4" /><Skeleton className="mt-4 h-24 w-full" /><Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      </main>
    );
  }
  if (error || !event) {
    return <main className="mx-auto max-w-2xl px-4 py-8"><ErrorState message={error ?? "Couldn't load this story. It may not exist, or the backend isn't reachable."} onRetry={reload} /></main>;
  }

  const ai = event.ai_analysis;
  const groups = Object.entries(GROUPS).map(([type, label]) => ({ label, items: event.entities.filter((e) => e.entity_type === type) })).filter((g) => g.items.length > 0);
  const companies = event.entities.filter((e) => e.entity_type === "company").map((e) => e.entity_value);
  const overall = (() => {
    const c: Record<string, number> = {};
    event.entities.forEach((e) => (c[e.predicted_effect] = (c[e.predicted_effect] ?? 0) + 1));
    return (Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unclear") as "positive" | "negative" | "mixed" | "unclear";
  })();
  const tutorQ = `Analyse this story: "${event.title}". Which stocks does it affect, how credible is it, and what would change the picture?`;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/news" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"><ArrowLeft className="h-4 w-4" /> All news</Link>

      <header className="animate-fade-up mb-8 max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-3"><EventTypeChip type={event.event_type} /><span className="text-dim">·</span><EventDate iso={event.last_updated_at} /></div>
        <h1 className="font-display text-[30px] font-semibold leading-[1.15] tracking-tight sm:text-[40px]">{event.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <CredibilityBadge score={event.credibility_score} label />
          <SentimentBadge sentiment={overall} />
          {event.sources.length > 0 && <span className="text-xs text-dim">{event.sources.length} source{event.sources.length > 1 ? "s" : ""}</span>}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Card className="border-primary/20 bg-primary/[0.035]">
            <div className="eyebrow mb-3 text-primary">In plain English</div>
            <p className="text-[17px] leading-[1.7]"><GlossaryText text={event.summary} /></p>
            <Link href={`/tutor?q=${encodeURIComponent(tutorQ)}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-[#1A1204] transition hover:bg-primaryHover">
              <Sparkles className="h-4 w-4" /> Ask the analyst about this
            </Link>
          </Card>

          {concepts.length > 0 && (
            <Section title="Concepts in this story" icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                {concepts.map((c) => (
                  <div key={c.term} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="font-display text-[15px] font-semibold">{c.term}</div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.simple_explanation}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {ai && (
            <Section title="Educational analysis" icon={<ShieldCheck className="h-3.5 w-3.5 text-primary" />}>
              <Card className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-8">
                  <div className="flex items-center gap-4">
                    <ProgressRing value={ai.opportunity_score} size={88} stroke={8}><span className="num font-display text-xl font-semibold">{ai.opportunity_score}</span></ProgressRing>
                    <div><div className="text-sm font-medium">Opportunity score</div><div className="text-xs text-dim">How interesting this looks to study — not a signal to act</div></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ProgressRing value={ai.confidence_score} size={88} stroke={8} tone="good"><span className="num font-display text-xl font-semibold">{ai.confidence_score}%</span></ProgressRing>
                    <div><div className="text-sm font-medium">AI confidence</div><div className="text-xs text-dim">How sure the model is of its own read</div></div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.035] p-4"><div className="eyebrow mb-2">Short term</div><p className="text-sm leading-relaxed"><GlossaryText text={ai.short_term_view} /></p></div>
                  <div className="rounded-2xl bg-white/[0.035] p-4"><div className="eyebrow mb-2">Long term</div><p className="text-sm leading-relaxed"><GlossaryText text={ai.long_term_view} /></p></div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Reasons title="Positive factors" items={ai.reasoning_positive} tone="pos" />
                  <Reasons title="Negative factors" items={ai.reasoning_negative} tone="neg" />
                  <Reasons title="Unknowns" items={ai.reasoning_unknown} tone="unk" />
                </div>
                {ai.risks.length > 0 && (
                  <div className="rounded-2xl border border-warning/20 bg-warning/[0.05] p-4">
                    <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning"><TriangleAlert className="h-3.5 w-3.5" />Risks to this analysis</div>
                    <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">{ai.risks.map((r, i) => <li key={i}>• {r}</li>)}</ul>
                  </div>
                )}
                <p className="border-t border-white/[0.06] pt-4 text-xs text-dim">AI-generated for learning. It can be wrong, and it is never a recommendation to buy, sell or hold anything.</p>
              </Card>
            </Section>
          )}

          {event.historical_analogues.length > 0 && (
            <Section title="Has this happened before?">
              <div className="flex flex-col gap-3">
                {event.historical_analogues.map((a, i) => (
                  <Card key={i} className="flex gap-5">
                    <div className="num font-display text-3xl font-semibold text-gold-gradient">{a.year}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{a.description}</div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{a.avg_market_reaction}</p>
                      {a.sectors_affected?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{a.sectors_affected.map((s) => <Badge key={s}>{s}</Badge>)}</div>}
                      <p className="mt-3 text-xs italic text-dim">{a.disclaimer || "Historical patterns do not guarantee future results."}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {event.credibility_score !== null && (
            <Card>
              <div className="eyebrow mb-4">Why this credibility score</div>
              <div className="mb-5 flex items-baseline gap-2">
                <span className={clsx("num font-display text-4xl font-semibold leading-none", credibilityTone(event.credibility_score).text)}>{event.credibility_score}</span>
                <span className="text-sm text-dim">/ 100 · {credibilityTone(event.credibility_score).label}</span>
              </div>
              {event.credibility_breakdown ? (
                <div className="flex flex-col gap-4">
                  {Object.entries(event.credibility_breakdown).map(([key, value]) => {
                    const part = CRED_PARTS[key];
                    const max = part?.max ?? 100;
                    return (
                      <div key={key}>
                        <div className="flex items-baseline justify-between text-[13px]"><span>{part?.label ?? key.replace(/_/g, " ")}</span><span className="num text-muted">{value}<span className="text-dim"> / {max}</span></span></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
                        {part && <div className="mt-1 text-[11px] text-dim">{part.hint}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted">Breakdown not available for this story.</p>}
            </Card>
          )}

          {event.sources.length > 0 && (
            <Card>
              <div className="eyebrow mb-3">Read the original</div>
              <div className="flex flex-col">
                {event.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-sm transition hover:bg-white/[0.05] hover:text-primary">
                    <span className="truncate">{s.source_name}</span><ArrowUpRight className="h-4 w-4 shrink-0 text-dim" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {event.related_stocks && event.related_stocks.length > 0 && (
            <Card className="border-primary/20">
              <div className="eyebrow mb-4 text-primary">Stocks in this story</div>
              <div className="flex flex-col gap-3">
                {event.related_stocks.map((s) => (
                  <div key={s.ticker} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/stock/${s.ticker}`} className="font-mono text-sm font-semibold hover:text-primary">{s.ticker}</Link>
                      <div className="truncate text-xs text-dim">{s.name}</div>
                    </div>
                    <Badge variant={EFFECT[s.effect] ?? "neutral"}>{s.effect}</Badge>
                    <Link href={`/portfolio?trade=buy&ticker=${s.ticker}`} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-[#1A1204] transition hover:bg-primaryHover">Trade</Link>
                  </div>
                ))}
              </div>
              <Link href="/ideas" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">See how these rank on the radar →</Link>
            </Card>
          )}

          {groups.length > 0 && (
            <Card>
              <div className="eyebrow mb-4">Who&apos;s affected</div>
              <div className="flex flex-col gap-5">
                {groups.map((g) => (
                  <div key={g.label}>
                    <div className="mb-2 text-xs text-dim">{g.label}</div>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((e, i) => (
                        <span key={i} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1 pl-2.5 pr-1.5 text-[13px]">
                          {e.entity_value}<Badge variant={EFFECT[e.predicted_effect] ?? "neutral"}>{e.predicted_effect}</Badge>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {companies.length > 0 && <Link href="/watchlist?focus=add" className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">Follow one of these companies →</Link>}
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
