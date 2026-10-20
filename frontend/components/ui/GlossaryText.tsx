"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useGlossary } from "@/lib/glossary-context";
import type { GlossaryTermOut } from "@/lib/api-client";

const WIDTH = 300;

function TermHint({ entry, children }: { entry: GlossaryTermOut; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>({ left: 0, top: 0, above: true });
  const ref = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    clearTimeout(closeTimer.current);
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.max(12, Math.min(window.innerWidth - WIDTH - 12, rect.left + rect.width / 2 - WIDTH / 2));
      const above = rect.top > 230;
      setPos({ left, top: above ? rect.top - 10 : rect.bottom + 10, above });
    }
    setOpen(true);
  }
  function hideSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={() => (open ? setOpen(false) : show())}
        className="cursor-help rounded-sm underline decoration-primary/70 decoration-dotted decoration-2 underline-offset-[3px] transition hover:text-primary"
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={() => clearTimeout(closeTimer.current)}
            onMouseLeave={hideSoon}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: WIDTH,
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
            className="z-[80] animate-pop-in rounded-2xl border border-white/10 bg-surface p-4 text-left shadow-lift"
          >
            <div className="eyebrow mb-1.5 text-primary">Plain-English</div>
            <div className="font-display text-base font-semibold text-ink">{entry.term}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{entry.simple_explanation}</p>
            {entry.example && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                <span className="font-medium text-ink">Example: </span>
                {entry.example}
              </p>
            )}
            <Link
              href={`/tutor?q=${encodeURIComponent(`Explain ${entry.term} briefly and why it matters when analysing a stock`)}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" /> Ask the analyst more
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Renders text with finance jargon turned into hover-cards. The first
 * occurrence of each term is highlighted (repeating underlines is noisy).
 */
export function GlossaryText({ text, className }: { text: string; className?: string }) {
  const { pattern, lookup } = useGlossary();

  const nodes = useMemo(() => {
    if (!pattern) return null;
    const parts = text.split(pattern);
    const seen = new Set<string>();
    return parts.map((part, i) => {
      if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
      const entry = lookup(part);
      if (!entry || seen.has(entry.term)) return <Fragment key={i}>{part}</Fragment>;
      seen.add(entry.term);
      return (
        <TermHint key={i} entry={entry}>
          {part}
        </TermHint>
      );
    });
  }, [text, pattern, lookup]);

  return <span className={className}>{nodes ?? text}</span>;
}

/** A single known term, e.g. for health-factor labels. Falls back to plain text. */
export function TermLabel({ term, children }: { term: string; children?: React.ReactNode }) {
  const { lookup } = useGlossary();
  const entry = lookup(term);
  if (!entry) return <>{children ?? term}</>;
  return <TermHint entry={entry}>{children ?? term}</TermHint>;
}
