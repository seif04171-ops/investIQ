"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type RefreshStatus } from "@/lib/api-client";

/**
 * Asks the backend to fetch + analyse fresh news now, then polls until it's
 * done. `onDone` runs afterwards so the page can reload its data.
 */
export function useNewsRefresh(onDone: (info: { newEvents: number; error: string | null; status: RefreshStatus | null }) => void) {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const poll = useCallback((attempt: number) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const s = await api.getRefreshStatus();
        if (!s.running || attempt > 60) {
          setRunning(false);
          done.current({ newEvents: s.new_events, error: s.error, status: s });
          return;
        }
      } catch {
        setRunning(false);
        done.current({ newEvents: 0, error: "Can't reach the backend. Is the backend Terminal tab still running?", status: null });
        return;
      }
      poll(attempt + 1);
    }, 2500);
  }, []);

  const start = useCallback(
    async (force = true) => {
      setRunning(true);
      try {
        const s = await api.refreshNews(force);
        if (s.running) poll(0);
        else {
          setRunning(false);
          done.current({ newEvents: 0, error: s.error, status: s });
        }
      } catch (e) {
        setRunning(false);
        done.current({ newEvents: 0, error: e instanceof Error ? e.message : "Refresh failed", status: null });
      }
    },
    [poll]
  );

  return { running, start };
}
