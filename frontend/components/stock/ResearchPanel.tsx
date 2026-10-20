import clsx from "clsx";
import type { Research } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { fullDate } from "@/lib/format";

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 text-[13px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className={clsx("num font-medium", tone === "up" && "text-positive", tone === "down" && "text-negative")}>{value}</span>
    </div>
  );
}

const ret = (v?: number) => (v === undefined ? null : <>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</>);

export function ResearchPanel({ r }: { r: Research }) {
  const t = r.technicals ?? {};
  const c = r.consensus;
  const rsiNote = t.rsi14 === undefined ? null : t.rsi14 >= 70 ? "stretched" : t.rsi14 <= 30 ? "oversold" : "normal";
  const total = c ? c.analysts : 0;
  const seg = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  const hasTech = Object.keys(t).length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <div className="mb-2 font-display text-sm font-semibold">Price action &amp; trend</div>
        {hasTech ? (
          <>
            {t.trend && <Row label="Trend" value={t.trend} tone={t.trend === "uptrend" ? "up" : t.trend === "downtrend" ? "down" : undefined} />}
            {t.ret_1w !== undefined && <Row label="1 week" value={ret(t.ret_1w)} tone={t.ret_1w >= 0 ? "up" : "down"} />}
            {t.ret_1m !== undefined && <Row label="1 month" value={ret(t.ret_1m)} tone={t.ret_1m >= 0 ? "up" : "down"} />}
            {t.ret_3m !== undefined && <Row label="3 months" value={ret(t.ret_3m)} tone={t.ret_3m >= 0 ? "up" : "down"} />}
            {t.sma20 !== undefined && <Row label="20-day average" value={`$${t.sma20.toFixed(2)}`} />}
            {t.sma50 !== undefined && <Row label="50-day average" value={`$${t.sma50.toFixed(2)}`} />}
            {t.rsi14 !== undefined && <Row label="RSI (14)" value={`${t.rsi14.toFixed(0)} · ${rsiNote}`} tone={rsiNote === "stretched" ? "down" : rsiNote === "oversold" ? "up" : undefined} />}
          </>
        ) : (
          <p className="text-sm text-muted">Price history isn&apos;t available right now.</p>
        )}
      </Card>

      <Card>
        <div className="mb-2 font-display text-sm font-semibold">Wall Street view</div>
        {c ? (
          <>
            <div className="mb-1 text-[13px] text-muted">{c.analysts} analysts · {c.period}</div>
            <div className="mb-3 font-display text-lg font-semibold">{c.view}</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="bg-positive" style={{ width: seg(c.strong_buy + c.buy) }} />
              <div className="bg-white/25" style={{ width: seg(c.hold) }} />
              <div className="bg-negative" style={{ width: seg(c.sell + c.strong_sell) }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-dim">
              <span>{c.strong_buy + c.buy} buy</span><span>{c.hold} hold</span><span>{c.sell + c.strong_sell} sell</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">No analyst ratings available for this stock.</p>
        )}
        <div className="mt-3 border-t border-white/[0.05] pt-3">
          <Row label="Next earnings" value={r.next_earnings ? fullDate(r.next_earnings) : "Not scheduled / unknown"} />
        </div>
      </Card>
    </div>
  );
}
