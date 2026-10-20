"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, LogOut, Plus, Search, Sparkles, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { api, type SearchHit } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { ALL_NAV } from "@/lib/nav";

interface PaletteCtx {
  open: () => void;
}
const Ctx = createContext<PaletteCtx>({ open: () => undefined });
export const useCommandPalette = () => useContext(Ctx);

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && <Palette onClose={() => setIsOpen(false)} />}
    </Ctx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Live ticker search, debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .searchTicker(q)
        .then((r) => setHits(r.slice(0, 5)))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);

    const pages: Item[] = ALL_NAV.filter((n) => match(`${n.label} ${n.keywords ?? ""}`)).map((n) => ({
      id: `page-${n.href}`,
      group: "Go to",
      label: n.label,
      icon: n.icon,
      run: () => go(n.href),
    }));

    const actions: Item[] = [
      { id: "a-buy", group: "Actions", label: "Buy a stock (simulated)", icon: Plus, run: () => go("/portfolio?trade=buy") },
      { id: "a-watch", group: "Actions", label: "Add a stock to your watchlist", icon: Plus, run: () => go("/watchlist?focus=add") },
      { id: "a-quiz", group: "Actions", label: "Take today's quiz", icon: Sparkles, run: () => go("/learn#quiz") },
      { id: "a-out", group: "Actions", label: "Log out", icon: LogOut, run: () => { onClose(); logout(); } },
    ].filter((a) => match(a.label));

    const stocks: Item[] = hits.map((h) => ({
      id: `s-${h.symbol}`,
      group: "Stocks",
      label: h.symbol,
      hint: h.description,
      icon: TrendingUp,
      run: () => go(`/stock/${h.symbol}`),
    }));

    const ask: Item[] =
      query.trim().length >= 3
        ? [{
            id: "ask",
            group: "Ask",
            label: `Ask the analyst: "${query.trim()}"`,
            icon: Sparkles,
            run: () => go(`/tutor?q=${encodeURIComponent(query.trim())}`),
          }]
        : [];

    return [...stocks, ...pages, ...actions, ...ask];
  }, [query, hits, go, logout, onClose]);

  useEffect(() => setActive(0), [query, hits]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  }

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-lift" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5">
          <Search className="h-[18px] w-[18px] shrink-0 text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a stock, jump to a page, or ask a question…"
            className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-dim"
            aria-label="Search"
          />
          <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-dim sm:block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted">
              {searching ? "Searching…" : "Nothing matches. Try a ticker like AAPL, or ask the analyst."}
            </div>
          )}
          {items.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {showGroup && <div className="eyebrow px-3 pb-1 pt-3">{item.group}</div>}
                <button
                  data-idx={idx}
                  onMouseMove={() => setActive(idx)}
                  onClick={item.run}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    idx === active ? "bg-white/[0.07] text-ink" : "text-muted"
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0", idx === active ? "text-primary" : "text-dim")} />
                  <span className={clsx("truncate", item.group === "Stocks" && "font-mono font-semibold")}>{item.label}</span>
                  {item.hint && <span className="truncate text-xs text-dim">{item.hint}</span>}
                  {idx === active && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-dim" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-2.5 text-[11px] text-dim">
          <span className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3" /> Jump anywhere in InvestIQ
          </span>
          <span className="font-mono">↑↓ navigate · ↵ select</span>
        </div>
      </div>
    </div>
  );
}
