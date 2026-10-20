"use client";

import { api, type MarketIndex } from "@/lib/api-client";
import { useAsync } from "@/hooks/useAsync";
import { Change } from "@/components/ui/Change";
import { usd } from "@/lib/format";

/** Scrolling live index strip. Renders nothing if the backend isn't reachable. */
export function TickerTape() {
  const { data } = useAsync<MarketIndex[]>(() => api.getMarketOverview(), [], { refreshMs: 60_000 });
  if (!data || data.length === 0) return null;
  const items = [...data, ...data, ...data, ...data];
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-2.5" aria-label="Live market indices">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {items.map((m, i) => (
          <span key={i} className="flex items-center gap-2.5 text-[13px]">
            <span className="font-medium text-muted">{m.index_name}</span>
            <span className="num">{usd(m.price)}</span>
            <Change value={m.change_percent} />
          </span>
        ))}
      </div>
    </div>
  );
}
