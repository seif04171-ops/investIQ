"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUp, MessageSquarePlus, Sparkles, History } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { Tabs } from "@/components/ui/Tabs";
import { GlossaryText } from "@/components/ui/GlossaryText";
import { Skeleton } from "@/components/ui/Skeleton";
import { timeAgo } from "@/lib/format";

interface Msg { role: "user" | "assistant"; content: string; fresh?: boolean }

/** $AAPL → a link to that stock's page; everything else gets glossary hover-cards. */
function Plain({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\$[A-Za-z]{1,5}\b)/g).map((part, i) =>
        /^\$[A-Za-z]{1,5}$/.test(part) ? (
          <Link key={i} href={`/stock/${part.slice(1).toUpperCase()}`} className="rounded-md bg-primary/10 px-1 py-0.5 font-mono text-[0.9em] font-semibold text-primary transition hover:bg-primary/20">
            {part.toUpperCase()}
          </Link>
        ) : (
          <GlossaryText key={i} text={part} />
        )
      )}
    </>
  );
}

/** Tiny markdown subset the analyst uses: **bold**, "-" bullets, paragraphs, $TICKER links. */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink"><Plain text={part.slice(2, -2)} /></strong> : <Plain key={i} text={part} />
    );
  return (
    <div className="flex flex-col gap-3.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return <ul key={i} className="flex flex-col gap-1.5 pl-1">{lines.map((l, k) => <li key={k} className="flex gap-2.5"><span className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-primary" /><span>{inline(l.replace(/^\s*[-•*]\s+/, ""))}</span></li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, k) => <span key={k}>{k > 0 && <br />}{inline(l)}</span>)}</p>;
      })}
    </div>
  );
}

/** Reveals new answers word-by-word so they feel conversational. */
function Typed({ text, onDone }: { text: string; onDone: () => void }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= words.length) { onDone(); return; }
    const t = setTimeout(() => setN((v) => Math.min(words.length, v + 3)), 22);
    return () => clearTimeout(t);
  }, [n, words.length, onDone]);
  return <Rich text={words.slice(0, n).join("")} />;
}

function Typing() {
  return <div className="flex items-center gap-1.5 py-2" aria-label="Analyst is thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${i * 140}ms` }} />)}</div>;
}

function TutorInner() {
  const { token } = useAuth();
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [convoId, setConvoId] = useState<string | undefined>();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  const history = useAsync(() => api.listConversations(token!), [token], { enabled: !!token });
  const portfolio = useAsync(() => api.getPortfolioSummary(token!), [token], { enabled: !!token });

  const suggestions = useMemo(() => {
    const top = portfolio.data?.holdings?.[0];
    const base = ["What are the strongest signals on the radar today, and what's the catch with each?", "Which stocks look most exposed to the next Fed decision?", "What moved the market today and why?", "Compare $NVDA and $AMD: bull and bear case"];
    return top
      ? [`What's driving $${top.ticker ?? top.company} right now, and what are the risks?`, "Where is my portfolio most exposed, and what overlaps?", ...base.slice(0, 2)]
      : base;
  }, [portfolio.data]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);

  const send = useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || !token || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setSending(true);
    try {
      const res = await api.askTutor(token, question, mode, convoId);
      setConvoId(res.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, fresh: true }]);
      history.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The tutor couldn't answer.");
    } finally {
      setSending(false);
    }
  }, [token, sending, mode, convoId, history]);

  // Deep link from other pages: /tutor?q=...
  useEffect(() => {
    const q = params.get("q");
    if (q && token && !autoAsked.current) { autoAsked.current = true; send(q); }
  }, [params, token, send]);

  const open = async (id: string) => {
    if (!token) return;
    setShowHistory(false);
    setError(null);
    try {
      const msgs = await api.getConversation(token, id);
      setMessages(msgs);
      setConvoId(id);
    } catch {
      setError("Couldn't open that conversation.");
    }
  };
  const fresh = () => { setMessages([]); setConvoId(undefined); setError(null); setShowHistory(false); };
  const markDone = useCallback((idx: number) => setMessages((m) => m.map((x, i) => (i === idx ? { ...x, fresh: false } : x))), []);

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-[1100px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <aside className={clsx("w-64 shrink-0 flex-col gap-2 lg:flex", showHistory ? "fixed inset-x-4 top-20 z-30 flex rounded-2xl border border-white/10 bg-surface p-3 shadow-2xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none" : "hidden")}>
        <button onClick={fresh} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium transition hover:border-primary/40"><MessageSquarePlus className="h-4 w-4 text-primary" /> New chat</button>
        <div className="eyebrow mt-3 px-1">Recent</div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {history.loading ? <Skeleton className="h-10 rounded-xl" /> : (history.data ?? []).length === 0 ? <p className="px-2 py-3 text-xs text-dim">Your conversations are saved here.</p> : (
            history.data!.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className={clsx("mb-1 w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]", convoId === c.id && "bg-white/[0.07]")}>
                <div className="line-clamp-2 text-[13px] leading-snug">{c.title}</div>
                {c.created_at && <div className="mt-1 text-[11px] text-dim">{timeAgo(c.created_at)}</div>}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">AI Analyst</h1>
            <p className="text-sm text-dim">Answers from live prices, fresh news, your portfolio and the signal radar.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory((v) => !v)} className="rounded-xl border border-white/10 p-2.5 text-muted lg:hidden" aria-label="Conversation history"><History className="h-4 w-4" /></button>
            <Tabs size="sm" value={mode} onChange={setMode} options={[{ value: "simple", label: "Quick" }, { value: "advanced", label: "Deep dive" }]} />
          </div>
        </div>

        <div className="glass flex-1 overflow-y-auto rounded-2xl p-4 sm:p-6">
          {messages.length === 0 && !sending ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Sparkles className="h-6 w-6" /></div>
              <div><div className="font-display text-xl font-semibold">What do you want to dig into?</div><p className="mt-1.5 text-sm text-muted">Name a stock like $AAPL, or ask about your portfolio, a story or the market.</p></div>
              <div className="grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
                {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[13px] leading-snug text-muted transition hover:border-primary/40 hover:text-ink">{s}</button>)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/15 px-4 py-3 text-[15px] leading-relaxed">{m.content}</div></div>
              ) : (
                <div key={i} className="flex gap-3">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Sparkles className="h-3.5 w-3.5" /></div>
                  <div className="min-w-0 max-w-[92%] text-[15px] leading-[1.75] text-muted">{m.fresh ? <Typed text={m.content} onDone={() => markDone(i)} /> : <Rich text={m.content} />}</div>
                </div>
              ))}
              {sending && <div className="flex gap-3"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><Sparkles className="h-3.5 w-3.5" /></div><Typing /></div>}
              {error && <div className="rounded-xl border border-negative/25 bg-negative/[0.06] px-4 py-3 text-sm text-negative">{error}</div>}
              <div ref={bottom} />
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-4">
          <div className="glass flex items-end gap-2 rounded-2xl p-2 pl-4 focus-within:border-primary/40">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} placeholder="e.g. Is $NVDA a good setup right now? What's the risk?" className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent py-3 text-[15px] outline-none placeholder:text-dim" aria-label="Your question" style={{ outline: "none", boxShadow: "none" }} />
            <button type="submit" disabled={!input.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-[#1A1204] transition enabled:hover:bg-primaryHover disabled:opacity-40" aria-label="Send"><ArrowUp className="h-5 w-5" /></button>
          </div>
          <p className="mt-2 text-center text-[11px] text-dim">AI analysis can be wrong and isn&apos;t personal financial advice. Check the numbers and never risk money you can&apos;t afford to lose.</p>
        </form>
      </section>
    </div>
  );
}

export default function TutorPage() {
  return <Suspense fallback={null}><TutorInner /></Suspense>;
}
