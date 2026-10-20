"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, GraduationCap, Heart, Newspaper, Radar, ShieldCheck, Sparkles, TriangleAlert, Wallet } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

const SECTIONS = [
  { icon: Radar, title: "Ideas (opportunity radar)", href: "/ideas", summary: "Stocks ranked by the evidence, with the reasons and the risks.", details: [
    "Each stock gets a 0–100 signal (50 is neutral). It blends News (55%): credible stories that name the company, fading by half every 24 hours; Momentum (30%): the 1-month and today's move; and Trend (15%): where the price sits in its 52-week range.",
    "Every card lists the facts behind the score, the stories it came from, the counter-evidence and a confidence level. Inputs that are missing are left out, never guessed.",
    "Research opens the stock page; Buy or Sell (paper) opens a trade ticket pre-filled with the ticker. Signals are not predictions or personal advice." ] },
  { icon: Newspaper, title: "News", href: "/news", summary: "Merged, credibility-scored stories tied to tickers.", details: [
    "Articles about the same event are merged. Each event shows its date, a credibility score out of 100 (up to 55 source reputation, 30 independent confirmations, 15 official confirmation) and the stocks it affects, which link to their pages.",
    "Press Refresh to fetch and analyse the latest stories now. The page also refreshes itself when you open it with old news.",
    "News is only collected while the backend is running. Keep its Terminal tab open, or deploy it to a server, for round-the-clock coverage." ] },
  { icon: Wallet, title: "Portfolio", href: "/portfolio", summary: "A $100,000 paper-trading book with real prices.", details: [
    "Trades execute at the live price, resolved on the server. If no live price exists, the app tells you before you confirm.",
    "The Health score checks diversification, position size, sector balance and cash with simple, explained rules. It measures how the book is built, not whether your picks are good.",
    "The decision journal stores your reason for each trade and shows how the price moved since, so you can judge your process rather than just the outcome." ] },
  { icon: Eye, title: "Stocks & watchlist", href: "/watchlist", summary: "Live charts, stats, news and your position in one place.", details: [
    "Charts default to today's session and refresh every minute; switch to 1W, 1M, 3M, 6M or 1Y. Intraday and history come from free public data, so they can occasionally be unavailable.",
    "Key stats appear only when the data provider supplies them. Nothing is estimated." ] },
  { icon: Sparkles, title: "AI Analyst", href: "/tutor", summary: "Ask about a stock, a story or your own exposure.", details: [
    "It answers from live data: your portfolio, the freshest headlines with credibility, the signal ranking and the prices and stats of any ticker you name (write it like $NVDA).",
    "Quick gives a short conclusion-first answer; Deep dive adds the bull case, bear case, catalysts and risks. It remembers the conversation, so you can follow up.",
    "It can be wrong and isn't personal financial advice. Check the numbers it quotes." ] },
  { icon: GraduationCap, title: "Academy", href: "/learn", summary: "Lessons on valuation, earnings, risk and rates.", details: [
    "Short lessons from fundamentals to position sizing and interest-rate sensitivity, a daily quiz and a glossary. Underlined terms anywhere in the app show a quick definition.",
    "Press ⌘K (or Ctrl+K) anywhere to jump to a page or look up a stock." ] },
];

export default function GuidePage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <main className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="How it works" title="A quick tour of InvestIQ" description="What each part does, where the numbers come from, and what it can't do." />

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card className="border-positive/20"><ShieldCheck className="mb-3 h-5 w-5 text-positive" /><div className="font-medium">What InvestIQ is</div><p className="mt-1.5 text-sm leading-relaxed text-muted">A research tool that ranks stocks by the evidence and lets you test ideas in a paper-trading book.</p></Card>
        <Card className="border-warning/25"><TriangleAlert className="mb-3 h-5 w-5 text-warning" /><div className="font-medium">What it isn&apos;t</div><p className="mt-1.5 text-sm leading-relaxed text-muted">Not personal financial advice. Signals describe the evidence; they can&apos;t predict prices or guarantee returns.</p></Card>
      </div>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s, i) => {
          const isOpen = open === i;
          return (
            <Card key={s.title} className="p-0">
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center gap-4 p-5 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-display text-base font-semibold">{s.title}</span><span className="block text-sm text-muted">{s.summary}</span></span>
                <ChevronDown className={clsx("h-4 w-4 shrink-0 text-dim transition", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="animate-fade-up border-t border-white/[0.07] px-5 pb-5 pt-4">
                  <ul className="flex flex-col gap-3 text-sm leading-relaxed text-muted">{s.details.map((d, k) => <li key={k} className="flex gap-3"><Heart className="mt-1 h-3 w-3 shrink-0 text-primary/60" />{d}</li>)}</ul>
                  <Link href={s.href} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Open {s.title} →</Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
