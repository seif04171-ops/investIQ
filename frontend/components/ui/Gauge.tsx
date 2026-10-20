"use client";

import { useEffect, useId, useState } from "react";

/** Half-circle gauge, 0–100, red → amber → green. Used for market sentiment. */
export function Gauge({ score, label }: { score: number; label: string }) {
  const id = useId().replace(/:/g, "");
  const [shown, setShown] = useState(50);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, score))));
    return () => cancelAnimationFrame(t);
  }, [score]);

  const cx = 100, cy = 100, r = 78;
  const arc = Math.PI * r;
  const angle = Math.PI * (1 - shown / 100);
  const nx = cx + (r - 2) * Math.cos(angle);
  const ny = cy - (r - 2) * Math.sin(angle);

  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 200 116" className="w-full">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="50%" stopColor="#F5B94A" />
            <stop offset="100%" stopColor="#3DDC97" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={arc * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
        <circle cx={nx} cy={ny} r="6" fill="#F3F0E8" stroke="#07080B" strokeWidth="3" style={{ transition: "all 1.1s cubic-bezier(0.2,0.7,0.2,1)" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="num font-display text-3xl font-semibold leading-none">{Math.round(score)}</div>
        <div className="mt-1 text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}
