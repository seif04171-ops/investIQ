import { type HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Clickable cards lift and glow gold on hover. */
  interactive?: boolean;
  /** Remove default padding (for tables / full-bleed content). */
  flush?: boolean;
}

export function Card({ className, interactive = false, flush = false, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "glass rounded-2xl",
        !flush && "p-5",
        interactive ? "glass-hover cursor-pointer" : "transition-colors",
        className
      )}
      {...props}
    />
  );
}
