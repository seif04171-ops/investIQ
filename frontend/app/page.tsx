import Link from "next/link";
import { ArrowRight, BookOpen, Newspaper, NotebookPen, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Reveal } from "@/components/ui/Reveal";
import { TickerTape } from "@/components/marketing/TickerTape";

const FEATURES = [
  { icon: Radar, title: "An opportunity radar, not a news feed", body: "Every few minutes InvestIQ ties credible news to the stocks it affects, adds price momentum and trend, and ranks what the evidence favours — bullish and bearish — with the exact reasons and the risks against each." },
  { icon: ShieldCheck, title: "Credibility you can inspect", body: "Duplicate stories are merged into one event and scored out of 100 for source reputation, independent confirmation and official confirmation. Open any score to see how it was built." },
  { icon: Sparkles, title: "An analyst that sees your book", body: "Ask about any ticker or your own exposure. Answers are built from live prices, today's headlines, the signal ranking and your portfolio — not generic text." },
  { icon: NotebookPen, title: "Act, then learn from it", body: "Go from signal to a paper trade in one tap, log why you did it, and see how each decision played out. Your Portfolio Health score flags concentration before it bites." },
];

const STEPS = [
  { n: "01", title: "News is fetched and scored", body: "Stories are merged, matched to companies and rated for credibility, around the clock." },
  { n: "02", title: "Stocks are ranked by evidence", body: "News, momentum and trend combine into a 0–100 signal with every reason shown." },
  { n: "03", title: "Research, then trade", body: "Open the stock, read the case for and against, and place a paper trade — or ask the analyst." },
];

export default function Home() {
  return (
    <div className="relative">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/sign-in" className="rounded-xl px-4 py-2 text-muted transition hover:text-ink">Sign in</Link>
          <Link href="/sign-up" className="rounded-xl bg-primary px-4 py-2 font-medium text-[#1A1204] transition hover:bg-primaryHover">Get started</Link>
        </nav>
      </header>

      <TickerTape />

      <main>
        <section className="grid-lines relative mx-auto max-w-[1180px] px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
          <div className="animate-fade-up mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-positive" /> Live signals · Paper trading · Evidence, not hype
          </div>
          <h1 className="animate-fade-up font-display mx-auto max-w-4xl text-[44px] font-semibold leading-[1.04] tracking-tight sm:text-[72px]">
            Know what moved. <span className="text-gold-gradient">Know what to watch.</span>
          </h1>
          <p className="animate-fade-up mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted">
            InvestIQ reads the news, scores how credible it is, ties it to the stocks it affects and ranks what the evidence favours — then lets you act on it in a paper-trading book, risk-free.
          </p>
          <div className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-[#1A1204] shadow-glow transition hover:bg-primaryHover">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/sign-in" className="rounded-2xl border border-white/12 px-7 py-3.5 text-[15px] font-medium text-muted transition hover:border-white/25 hover:text-ink">I have an account</Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
          <Reveal><div className="eyebrow mb-3">Why it isn&apos;t a Google search</div>
            <h2 className="font-display max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A search gives you headlines. InvestIQ gives you <span className="text-gold-gradient">ranked, explained ideas for your own decisions.</span></h2></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="glass glass-hover h-full rounded-3xl p-7">
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
                  <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
          <Reveal><div className="eyebrow mb-3">How it works</div><h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">From headline to decision.</h2></Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="num font-display text-5xl font-semibold text-white/[0.12]">{s.n}</div>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
          <Reveal>
            <div className="glass rounded-3xl border-primary/20 p-8 sm:p-12">
              <div className="flex flex-col gap-8 md:flex-row md:items-center">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-positive/10 text-positive"><ShieldCheck className="h-7 w-7" /></span>
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Evidence, not hype.</h2>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">Signals summarise news and price action — they are not predictions, guarantees or personal investment advice, and AI can be wrong. Every score shows its inputs and its risks, and when data isn&apos;t live the app says so instead of guessing. Trading here is simulated with no real money.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-28 pt-8 text-center sm:px-8">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 text-primary"><Newspaper className="h-4 w-4" /><BookOpen className="h-4 w-4" /><Sparkles className="h-4 w-4" /></div>
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Find the setup. Test it for free.</h2>
            <Link href="/sign-up" className="mt-9 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-[#1A1204] shadow-glow transition hover:bg-primaryHover">Create your free account <ArrowRight className="h-4 w-4" /></Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-dim">
        © {new Date().getFullYear()} InvestIQ · Research tool only. Not investment advice. Simulated trading with no real money.
      </footer>
    </div>
  );
}
