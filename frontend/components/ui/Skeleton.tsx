import clsx from "clsx";

/** Shimmering placeholder block. Compose into shapes that mirror the real layout. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-lg bg-white/[0.05]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent",
        className
      )}
    />
  );
}
