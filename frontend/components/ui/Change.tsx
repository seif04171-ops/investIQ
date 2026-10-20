import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import clsx from "clsx";
import { directionOf, pct } from "@/lib/format";

/** A colour-coded % change. `pill` adds a tinted background. */
export function Change({
  value,
  variant = "text",
  digits = 2,
  className,
}: {
  value: number | null | undefined;
  variant?: "text" | "pill";
  digits?: number;
  className?: string;
}) {
  const dir = directionOf(value);
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={clsx(
        "num inline-flex items-center gap-0.5 font-medium",
        dir === "up" && "text-positive",
        dir === "down" && "text-negative",
        dir === "flat" && "text-muted",
        variant === "pill" &&
          clsx(
            "rounded-full px-2 py-0.5 text-xs",
            dir === "up" && "bg-positive/12",
            dir === "down" && "bg-negative/12",
            dir === "flat" && "bg-white/[0.06]"
          ),
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {pct(value, digits, false)}
    </span>
  );
}
