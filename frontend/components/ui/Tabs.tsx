"use client";

import clsx from "clsx";

export interface TabOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

/** Segmented control — pill-style tabs. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx("inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-lg font-medium transition-all duration-200",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? "bg-white/[0.10] text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
