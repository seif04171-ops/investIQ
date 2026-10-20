"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/** US equity market hours (9:30–16:00 ET, Mon–Fri). Holidays aren't modelled — labelled "typically". */
function usMarketOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  if (day === "Sat" || day === "Sun") return false;
  const mins = (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10);
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function MarketStatus() {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOpen(usMarketOpen(new Date()));
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, []);
  if (open === null) return null;
  return (
    <div
      className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted md:flex"
      title="US stock market, regular hours (holidays not shown)"
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", open ? "animate-pulse-dot bg-positive" : "bg-dim")} />
      {open ? "US market open" : "US market closed"}
    </div>
  );
}
