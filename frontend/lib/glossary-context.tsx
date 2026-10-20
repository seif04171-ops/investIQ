"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type GlossaryTermOut } from "./api-client";

/**
 * Loads the glossary once and builds a matcher, so any text in the app can
 * turn jargon into hover-cards (see GlossaryText). Silent on failure — the
 * app works fine without it.
 */

// Extra phrasings that should resolve to a canonical glossary term.
const ALIASES: Record<string, string> = {
  "p/e": "P/E ratio",
  "price-to-earnings": "P/E ratio",
  "market cap": "Market capitalization",
  "interest rate": "Interest rates",
  etf: "ETFs",
  "exchange-traded fund": "ETFs",
  diversified: "Diversification",
  "supply chain": "Supply chains",
  bond: "Bonds",
  "gross domestic product": "GDP",
};

interface GlossaryValue {
  terms: GlossaryTermOut[];
  /** Case-insensitive phrase → entry. */
  lookup: (phrase: string) => GlossaryTermOut | undefined;
  /** Regex that matches any known phrase (null until loaded). */
  pattern: RegExp | null;
}

const Ctx = createContext<GlossaryValue>({ terms: [], lookup: () => undefined, pattern: null });

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [terms, setTerms] = useState<GlossaryTermOut[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listGlossary()
      .then((t) => !cancelled && setTerms(t))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<GlossaryValue>(() => {
    const map = new Map<string, GlossaryTermOut>();
    for (const t of terms) {
      const key = t.term.toLowerCase();
      map.set(key, t);
      if (key.endsWith("s")) map.set(key.slice(0, -1), t); // "ETFs" → "etf"
    }
    for (const [alias, canonical] of Object.entries(ALIASES)) {
      const hit = terms.find((t) => t.term === canonical);
      if (hit) map.set(alias, hit);
    }
    const phrases = [...map.keys()].sort((a, b) => b.length - a.length);
    const pattern = phrases.length
      ? new RegExp(`(?<![\\w])(${phrases.map(escape).join("|")})(?![\\w])`, "gi")
      : null;
    return { terms, lookup: (p) => map.get(p.toLowerCase()), pattern };
  }, [terms]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlossary() {
  return useContext(Ctx);
}
