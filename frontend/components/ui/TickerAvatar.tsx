"use client";

import { useState } from "react";
import clsx from "clsx";

const TINTS = [
  "from-amber-400/30 to-amber-600/10 text-amber-200",
  "from-sky-400/30 to-sky-600/10 text-sky-200",
  "from-emerald-400/30 to-emerald-600/10 text-emerald-200",
  "from-violet-400/30 to-violet-600/10 text-violet-200",
  "from-rose-400/30 to-rose-600/10 text-rose-200",
  "from-teal-400/30 to-teal-600/10 text-teal-200",
];

function tintFor(ticker: string) {
  let h = 0;
  for (const ch of ticker) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Company logo when we have one, otherwise a tinted monogram. */
export function TickerAvatar({
  ticker,
  logo,
  size = 40,
  className,
}: {
  ticker: string;
  logo?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={clsx("shrink-0 rounded-xl bg-white object-contain p-1.5", className)}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.34 }}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-mono font-semibold ring-1 ring-inset ring-white/10",
        tintFor(ticker),
        className
      )}
    >
      {ticker.slice(0, 2)}
    </div>
  );
}
