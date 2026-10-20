"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import type { HealthFactor, PortfolioHealth } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TermLabel } from "@/components/ui/GlossaryText";

const STATUS = {
  good: { ring: "good", text: "text-positive", bar: "bg-positive", label: "Looks healthy" },
  watch: { ring: "watch", text: "text-warning", bar: "bg-warning", label: "Worth watching" },
  risk: { ring: "risk", text: "text-negative", bar: "bg-negative", label: "Stands out" },
} as const;

function ringTone(score: number) {
  return score >= 75 ? "good" : score >= 50 ? "watch" : "risk";
}

function FactorRow({ factor }: { factor: HealthFactor }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[factor.status];
  return (
    <div className="border-t border-white/[0.06] first:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 py-3.5 text-left" aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              <TermLabel term={factor.term}>{factor.label}</TermLabel>
            </span>
            <span className={clsx("text-xs font-medium", s.text)}>{s.label}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className={clsx("h-full rounded-full transition-all duration-1000", s.bar)} style={{ width: `${factor.score}%` }} />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{factor.detail}</p>
        </div>
        <ChevronDown className={clsx("h-4 w-4 shrink-0 text-dim transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mb-3.5 animate-fade-in rounded-xl bg-white/[0.04] p-3.5 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink">Why this matters: </span>
          {factor.why}
        </div>
      )}
    </div>
  );
}

export function HealthCard({
  health,
  variant = "full",
}: {
  health: PortfolioHealth | null;
  variant?: "compact" | "full";
}) {
  if (!health) {
    return (
      <Card className="flex h-full flex-col justify-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" /> Portfolio health
        </div>
        <p className="text-sm leading-relaxed text-muted">
          After your first simulated trade, InvestIQ reads how your portfolio is built — diversification, concentration, cash —
          and explains <em>why</em> each one matters. It never tells you what to buy.
        </p>
      </Card>
    );
  }

  const weakest = [...health.factors].sort((a, b) => a.score - b.score)[0];
  const tone = ringTone(health.score);

  if (variant === "compact") {
    return (
      <Card className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" /> Portfolio health
        </div>
        <div className="flex items-center gap-5">
          <ProgressRing value={health.score} size={96} stroke={8} tone={tone}>
            <span className="num font-display text-2xl font-semibold leading-none">{health.score}</span>
            <span className="mt-0.5 text-[10px] text-dim">/ 100</span>
          </ProgressRing>
          <div className="min-w-0">
            <div className="font-display text-base font-semibold leading-tight">{health.grade}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{weakest.detail}</p>
          </div>
        </div>
        <Link href="/portfolio#health" className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          See the full breakdown <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
    );
  }

  return (
    <Card id="health">
      <div className="mb-2 flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProgressRing value={health.score} size={132} stroke={10} tone={tone}>
          <span className="num font-display text-4xl font-semibold leading-none">{health.score}</span>
          <span className="mt-1 text-[11px] text-dim">out of 100</span>
        </ProgressRing>
        <div>
          <div className="eyebrow mb-1.5">Portfolio health</div>
          <div className="font-display text-2xl font-semibold tracking-tight">{health.grade}</div>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            A plain-English read of how your portfolio is <em>built</em>, not where prices will go. Tap any row to learn why it matters.
          </p>
        </div>
      </div>
      <div className="mt-3">
        {health.factors.map((f) => (
          <FactorRow key={f.key} factor={f} />
        ))}
      </div>
      <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-dim">{health.disclaimer}</p>
    </Card>
  );
}
