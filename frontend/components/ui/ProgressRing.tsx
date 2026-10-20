"use client";

import { useEffect, useId, useState } from "react";

const TONES = {
  gold: ["#FFE2A6", "#F5B94A"],
  good: ["#9BF2C8", "#3DDC97"],
  watch: ["#FFD08A", "#FF9F43"],
  risk: ["#FFB1B1", "#FF6B6B"],
} as const;

/** Circular progress with an animated sweep and centred content. */
export function ProgressRing({
  value,
  size = 120,
  stroke = 9,
  tone = "gold",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof TONES;
  children?: React.ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [a, b] = TONES[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
