import clsx from "clsx";

export type BadgeVariant = "positive" | "negative" | "neutral" | "warning" | "primary" | "iris";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  positive: "bg-positive/12 text-positive ring-positive/20",
  negative: "bg-negative/12 text-negative ring-negative/20",
  neutral: "bg-white/[0.06] text-muted ring-white/10",
  warning: "bg-warning/12 text-warning ring-warning/20",
  primary: "bg-primary/12 text-primary ring-primary/25",
  iris: "bg-iris/12 text-iris ring-iris/25",
};

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
