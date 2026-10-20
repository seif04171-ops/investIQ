"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ExternalLink, Plus } from "lucide-react";
import clsx from "clsx";
import type { PortfolioHoldingOut } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Change } from "@/components/ui/Change";
import { TickerAvatar } from "@/components/ui/TickerAvatar";
import { PriceChart } from "@/components/ui/PriceChart";
import { shares as fmtShares, signedUsd, toneClass, usd } from "@/lib/format";

export function HoldingsTable({
  holdings,
  onBuyMore,
  onSell,
}: {
  holdings: PortfolioHoldingOut[];
  onBuyMore: (h: PortfolioHoldingOut) => void;
  onSell: (h: PortfolioHoldingOut) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card flush className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="eyebrow border-b border-white/[0.07] text-left">
              <th className="px-5 py-3.5 font-normal">Stock</th>
              <th className="px-3 py-3.5 text-right font-normal">Shares</th>
              <th className="px-3 py-3.5 text-right font-normal">Avg cost</th>
              <th className="px-3 py-3.5 text-right font-normal">Price</th>
              <th className="px-3 py-3.5 text-right font-normal">Today</th>
              <th className="px-3 py-3.5 text-right font-normal">Value</th>
              <th className="px-3 py-3.5 text-right font-normal">Total gain / loss</th>
              <th className="px-5 py-3.5 text-right font-normal">Weight</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const key = h.ticker ?? h.company;
              const isOpen = open === key;
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : key)}
                    className={clsx("cursor-pointer border-b border-white/[0.05] transition-colors hover:bg-white/[0.035]", isOpen && "bg-white/[0.03]")}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={clsx("h-4 w-4 shrink-0 text-dim transition-transform", isOpen && "rotate-180")} />
                        <TickerAvatar ticker={key} size={36} />
                        <div className="min-w-0">
                          <div className="font-mono text-[13px] font-semibold">{key}</div>
                          <div className="max-w-[170px] truncate text-xs text-dim">{h.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num px-3 py-4 text-right">{fmtShares(h.shares)}</td>
                    <td className="num px-3 py-4 text-right text-muted">{usd(h.avg_buy_price)}</td>
                    <td className="num px-3 py-4 text-right">
                      {usd(h.current_price)}
                      {!h.price_is_live && <span className="ml-1 text-[10px] text-warning" title="No live price — showing your purchase price">•</span>}
                    </td>
                    <td className="px-3 py-4 text-right">{h.price_is_live ? <Change value={h.day_change_pct} /> : <span className="text-dim">—</span>}</td>
                    <td className="num px-3 py-4 text-right font-medium">{usd(h.market_value)}</td>
                    <td className="px-3 py-4 text-right">
                      <div className={clsx("num font-medium", toneClass(h.gain_loss_value))}>{signedUsd(h.gain_loss_value)}</div>
                      <Change value={h.gain_loss_pct} className="text-xs" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="ml-auto flex w-24 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, h.weight_pct)}%` }} />
                        </div>
                        <span className="num w-9 text-right text-xs text-muted">{h.weight_pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                      <td colSpan={8} className="px-5 py-5">
                        <PriceChart ticker={key} compact={false} height={200} defaultDays={90} />
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); onBuyMore(h); }}><Plus className="h-3.5 w-3.5" /> Buy more</Button>
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onSell(h); }}>Sell</Button>
                          <Link href={`/stock/${key}`} className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                            Full stock page <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
