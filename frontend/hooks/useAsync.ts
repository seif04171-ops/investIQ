"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Re-fetch on this interval (ms) while the tab is visible — gives the UI a live feel. */
  refreshMs?: number;
  /** Skip fetching until true (e.g. waiting for an auth token). */
  enabled?: boolean;
}

/**
 * Small stale-while-revalidate data hook. Keeps showing the previous data
 * while a refresh is in flight, ignores out-of-order responses, and pauses
 * polling in background tabs.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], options: Options = {}) {
  const { refreshMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const reqId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent: boolean) => {
    const id = ++reqId.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fnRef.current();
      if (id !== reqId.current) return;
      setData(result);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    if (!enabled || !refreshMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") run(true);
    };
    const t = setInterval(tick, refreshMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refreshMs, run]);

  const reload = useCallback(() => run(data !== null), [run, data]);
  /** Replace local data immediately (optimistic updates). */
  const mutate = useCallback((next: T | ((prev: T | null) => T | null)) => {
    setData((prev) => (typeof next === "function" ? (next as (p: T | null) => T | null)(prev) : next));
  }, []);

  return { data, error, loading, refreshing, updatedAt, reload, mutate };
}
