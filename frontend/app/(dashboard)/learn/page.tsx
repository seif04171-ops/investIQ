"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, Check, CheckCircle2, Flame, GraduationCap, Lock, Search, Sparkles, Trophy } from "lucide-react";
import clsx from "clsx";
import { api, type GlossaryTermOut, type LessonOut } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GlossaryText } from "@/components/ui/GlossaryText";
import { useToast } from "@/components/ui/Toast";

// ---------- helpers ----------

const ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const QUIZ_KEY = "investiq.quiz.best";

function readBest(): { score: number; total: number; day: string } | null {
  try {
    const raw = localStorage.getItem(QUIZ_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeBest(v: { score: number; total: number; day: string }) {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable — progress just isn't remembered */
  }
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Question { prompt: string; options: string[]; answer: number; explain: string }

/** Same questions all day for everyone: seeded by the date. Built from the real glossary. */
function buildQuiz(terms: GlossaryTermOut[], day: string): Question[] {
  if (terms.length < 4) return [];
  const rnd = seeded(Number(day.replace(/-/g, "")));
  const picked = shuffle(terms, rnd).slice(0, 5);
  return picked.map((t) => {
    const wrong = shuffle(terms.filter((x) => x.term !== t.term), rnd).slice(0, 3);
    const options = shuffle([t, ...wrong], rnd);
    return {
      prompt: t.simple_explanation,
      options: options.map((o) => o.term),
      answer: options.findIndex((o) => o.term === t.term),
      explain: t.example,
    };
  });
}

// ---------- lesson reader ----------

function LessonCard({ lesson, index, onComplete, busy }: { lesson: LessonOut; index: number; onComplete: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const paras = lesson.content.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", lesson.completed ? "border-positive/40 bg-positive/15 text-positive" : "border-white/15 bg-white/[0.04] text-muted")}>
          {lesson.completed ? <Check className="h-4 w-4" /> : index + 1}
        </div>
        <div className="mt-2 w-px flex-1 bg-white/[0.07]" />
      </div>
      <Card className={clsx("mb-5 min-w-0 flex-1", lesson.completed && "border-positive/15")}>
        <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left" aria-expanded={open}>
          <div>
            <h3 className="font-display text-lg font-semibold">{lesson.title}</h3>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={lesson.difficulty === "beginner" ? "positive" : lesson.difficulty === "intermediate" ? "warning" : "iris"}>{lesson.difficulty}</Badge>
              {lesson.completed && <span className="text-xs text-positive">Completed</span>}
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">{open ? "Close" : lesson.completed ? "Review" : "Start"}</span>
        </button>
        {open && (
          <div className="animate-fade-up mt-5 border-t border-white/[0.07] pt-5">
            <div className="flex max-w-2xl flex-col gap-4 text-[15px] leading-[1.75] text-muted">
              {paras.map((p, i) => <p key={i}><GlossaryText text={p} /></p>)}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!lesson.completed && <Button onClick={onComplete} loading={busy}><CheckCircle2 className="h-4 w-4" /> Mark as complete</Button>}
              <Link href={`/tutor?q=${encodeURIComponent(`I just read the lesson "${lesson.title}". Can you quiz me or explain the hardest part again?`)}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted transition hover:border-white/20 hover:text-ink">
                <Sparkles className="h-4 w-4 text-primary" /> Ask the analyst about this
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- daily quiz ----------

function DailyQuiz({ terms, onFinish }: { terms: GlossaryTermOut[]; onFinish: (score: number, total: number) => void }) {
  const day = new Date().toISOString().slice(0, 10);
  const questions = useMemo(() => buildQuiz(terms, day), [terms, day]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState<ReturnType<typeof readBest>>(null);
  useEffect(() => setBest(readBest()), []);

  if (questions.length === 0) return <p className="text-sm text-muted">The quiz is built from the glossary, which is still loading.</p>;

  const q = questions[i];
  const answered = picked !== null;

  const choose = (idx: number) => {
    if (answered) return;
    setPicked(idx);
    if (idx === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= questions.length) {
      const final = score;
      setDone(true);
      const prev = readBest();
      if (!prev || final >= prev.score) writeBest({ score: final, total: questions.length, day });
      setBest(readBest());
      onFinish(final, questions.length);
    } else {
      setI(i + 1);
      setPicked(null);
    }
  };
  const restart = () => { setI(0); setPicked(null); setScore(0); setDone(false); };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <ProgressRing value={(score / questions.length) * 100} size={120} tone={score >= 4 ? "good" : "gold"}>
          <span className="num font-display text-3xl font-semibold">{score}/{questions.length}</span>
        </ProgressRing>
        <p className="max-w-sm text-sm text-muted">{score === questions.length ? "Perfect round." : score >= 3 ? "Solid. Review the ones you missed in the glossary below." : "Good start — the glossary below is the fastest way to improve."}</p>
        {best && <p className="text-xs text-dim">Best today: {best.score}/{best.total}</p>}
        <Button variant="secondary" onClick={restart}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-dim">
        <span>Question {i + 1} of {questions.length}</span>
        <div className="flex gap-1.5">{questions.map((_, k) => <span key={k} className={clsx("h-1.5 w-8 rounded-full", k < i ? "bg-primary" : k === i ? "bg-primary/50" : "bg-white/10")} />)}</div>
      </div>
      <p className="mb-1 text-xs uppercase tracking-wider text-dim">Which term is this?</p>
      <p className="mb-5 text-[17px] leading-relaxed">{q.prompt}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {q.options.map((o, idx) => {
          const correct = answered && idx === q.answer;
          const wrong = answered && idx === picked && idx !== q.answer;
          return (
            <button key={o} onClick={() => choose(idx)} disabled={answered} className={clsx("rounded-xl border px-4 py-3 text-left text-sm transition", correct ? "border-positive/50 bg-positive/10 text-positive" : wrong ? "border-negative/50 bg-negative/10 text-negative" : answered ? "border-white/[0.06] text-dim" : "border-white/10 bg-white/[0.03] hover:border-primary/40 hover:bg-white/[0.06]")}>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="animate-fade-up mt-5 rounded-xl bg-white/[0.04] p-4 text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink">{picked === q.answer ? "Correct. " : `It's ${q.options[q.answer]}. `}</span>
          Example: {q.explain}
          <div className="mt-4"><Button size="sm" onClick={next}>{i + 1 >= questions.length ? "See score" : "Next question"}</Button></div>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------

export default function LearnPage() {
  const { token } = useAuth();
  const toast = useToast();
  const lessonsQ = useAsync(() => api.listLessons(token!), [token], { enabled: !!token });
  const glossaryQ = useAsync(() => api.listGlossary(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quizDone, setQuizDone] = useState(false);
  const [best, setBest] = useState<ReturnType<typeof readBest>>(null);
  useEffect(() => setBest(readBest()), [quizDone]);

  const lessons = useMemo(() => [...(lessonsQ.data ?? [])].sort((a, b) => (ORDER[a.difficulty] ?? 3) - (ORDER[b.difficulty] ?? 3)), [lessonsQ.data]);
  const done = lessons.filter((l) => l.completed).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const nextLesson = lessons.find((l) => !l.completed);
  const terms = glossaryQ.data ?? [];
  const filtered = terms.filter((t) => !search.trim() || `${t.term} ${t.simple_explanation}`.toLowerCase().includes(search.trim().toLowerCase()));

  const complete = async (l: LessonOut) => {
    if (!token) return;
    setBusyId(l.id);
    lessonsQ.mutate((prev) => (prev ?? []).map((x) => (x.id === l.id ? { ...x, completed: true } : x)));
    try {
      await api.completeLesson(token, l.id);
      toast.push({ tone: "success", title: "Lesson complete", description: l.title });
    } catch {
      lessonsQ.mutate((prev) => (prev ?? []).map((x) => (x.id === l.id ? { ...x, completed: false } : x)));
      toast.push({ tone: "error", title: "Couldn't save progress", description: "Check that the backend is running and try again." });
    } finally {
      setBusyId(null);
    }
  };

  const achievements = [
    { icon: <BookOpen className="h-4 w-4" />, label: "First lesson", on: done >= 1 },
    { icon: <Flame className="h-4 w-4" />, label: "Halfway there", on: lessons.length > 0 && done >= Math.ceil(lessons.length / 2) },
    { icon: <GraduationCap className="h-4 w-4" />, label: "Graduate", on: lessons.length > 0 && done === lessons.length },
    { icon: <Trophy className="h-4 w-4" />, label: "Quiz 4/5+", on: !!best && best.score >= 4 },
    { icon: <Award className="h-4 w-4" />, label: "Perfect quiz", on: !!best && best.score === best.total },
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Academy" title="Sharpen your edge" description="Lessons from fundamentals to valuation and risk, a daily quiz and a glossary. Every underlined term in the app links back here." />

      <div className="mb-10 grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <Card className="flex items-center gap-6">
          {lessonsQ.loading ? <Skeleton className="h-28 w-28 rounded-full" /> : (
            <ProgressRing value={pct} size={112}><span className="num font-display text-2xl font-semibold">{pct}%</span></ProgressRing>
          )}
          <div className="min-w-0">
            <div className="eyebrow mb-1.5">Your progress</div>
            <div className="font-display text-xl font-semibold">{done} of {lessons.length} lessons</div>
            {nextLesson ? <p className="mt-1 text-sm text-muted">Up next: <span className="text-ink">{nextLesson.title}</span></p> : lessons.length > 0 ? <p className="mt-1 text-sm text-positive">You&apos;ve finished every lesson.</p> : null}
          </div>
        </Card>
        <Card>
          <div className="eyebrow mb-3">Achievements</div>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span key={a.label} title={a.on ? "Unlocked" : "Locked"} className={clsx("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium", a.on ? "border-primary/40 bg-primary/10 text-primary" : "border-white/[0.07] text-dim")}>
                {a.on ? a.icon : <Lock className="h-3.5 w-3.5" />}{a.label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <section className="mb-12">
        <h2 className="mb-5 font-display text-xl font-semibold">Lessons</h2>
        {lessonsQ.loading ? (
          <div className="flex flex-col gap-4">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-24 rounded-2xl" />)}</div>
        ) : lessonsQ.error && !lessonsQ.data ? (
          <ErrorState message={lessonsQ.error} onRetry={lessonsQ.reload} />
        ) : (
          <div>{lessons.map((l, idx) => <LessonCard key={l.id} lesson={l} index={idx} busy={busyId === l.id} onComplete={() => complete(l)} />)}</div>
        )}
      </section>

      <section id="quiz" className="mb-12 scroll-mt-24">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Daily quiz</h2>
          <span className="text-xs text-dim">New questions every day</span>
        </div>
        <Card><DailyQuiz terms={terms} onFinish={() => setQuizDone((v) => !v)} /></Card>
      </section>

      <section id="glossary" className="scroll-mt-24">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-xl font-semibold">Glossary <span className="text-sm font-normal text-dim">({terms.length} terms)</span></h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search terms…" className="h-10 pl-10" />
          </div>
        </div>
        {glossaryQ.loading ? <Skeleton className="h-40 rounded-2xl" /> : filtered.length === 0 ? <p className="text-sm text-muted">No terms match &ldquo;{search}&rdquo;.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((t) => (
              <Card key={t.term}>
                <h3 className="font-display text-base font-semibold">{t.term}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.simple_explanation}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-dim"><span className="font-medium text-muted">Example · </span>{t.example}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-dim"><span className="font-medium text-muted">Why investors care · </span>{t.why_it_matters}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
