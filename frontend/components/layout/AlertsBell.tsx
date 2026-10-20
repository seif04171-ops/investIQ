"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { timeAgo } from "@/lib/format";

const SEEN_KEY = "investiq_alerts_seen";

/** News that mentions the user's holdings/watchlist, as a notification dropdown. */
export function AlertsBell() {
  const { token } = useAuth();
  const { data } = useAsync(() => api.getBriefing(token!), [token], { enabled: !!token, refreshMs: 120000 });
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeenAt(Number(localStorage.getItem(SEEN_KEY) ?? 0));
    } catch {
      // storage unavailable — treat everything as unseen
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const events = data?.news ?? [];
  const unseen = events.filter((e) => new Date(e.published_at).getTime() > seenAt).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      try {
        localStorage.setItem(SEEN_KEY, String(now));
      } catch {
        // ignore
      }
      // keep the dot until the panel closes so the user sees what was new
      setTimeout(() => setSeenAt(now), 400);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted transition hover:border-white/20 hover:text-ink"
        aria-label="Alerts about your stocks"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-[#1A1204]">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-lift">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="font-display text-sm font-semibold">News about your stocks</div>
            <div className="text-xs text-dim">Matched to your holdings and watchlist</div>
          </div>
          {events.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              {data && data.tracked_count === 0
                ? "Add a stock to your portfolio or watchlist and news about it will show up here."
                : "No new headlines mention your stocks right now."}
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {events.slice(0, 6).map((e) => (
                <a
                  key={e.id}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/[0.04] px-4 py-3 transition last:border-0 hover:bg-white/[0.04]"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    {(e.matched_tickers ?? []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                        {t}
                      </span>
                    ))}
                    <span className="text-[11px] text-dim">{timeAgo(e.published_at)}</span>
                  </div>
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug">{e.title}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
