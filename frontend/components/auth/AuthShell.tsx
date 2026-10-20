import Link from "next/link";
import { Newspaper, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const POINTS = [
  { icon: Radar, text: "Stocks ranked by credible news, momentum and trend" },
  { icon: Newspaper, text: "News merged, credibility-scored and tied to tickers" },
  { icon: Sparkles, text: "An analyst grounded in live data and your portfolio" },
  { icon: ShieldCheck, text: "Paper trading — test ideas with zero real risk" },
];

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="grid-lines relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] p-12 lg:flex">
        <Link href="/"><Logo /></Link>
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">Invest on <span className="text-gold-gradient">evidence</span>, not noise.</h2>
          <ul className="mt-10 flex flex-col gap-5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-[15px] text-muted"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{text}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-dim">Simulated trading. Research only, not investment advice.</p>
      </aside>
      <section className="flex items-center justify-center p-6">
        <div className="animate-fade-up w-full max-w-sm">
          <Link href="/" className="mb-10 block lg:hidden"><Logo /></Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-muted">{subtitle}</p>
          {children}
          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </section>
    </main>
  );
}
