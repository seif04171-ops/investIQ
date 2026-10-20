import { type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        size === "sm" && "h-8 rounded-lg px-3 text-xs",
        size === "md" && "h-10 rounded-xl px-4 text-sm",
        size === "lg" && "h-12 rounded-2xl px-6 text-[15px]",
        variant === "primary" &&
          "bg-primary text-[#1A1204] shadow-[0_8px_28px_-10px_rgba(245,185,74,0.7)] hover:bg-primaryHover hover:shadow-[0_10px_34px_-8px_rgba(245,185,74,0.85)]",
        variant === "secondary" &&
          "border border-white/10 bg-white/[0.04] text-ink hover:border-white/20 hover:bg-white/[0.08]",
        variant === "ghost" && "text-muted hover:bg-white/[0.06] hover:text-ink",
        variant === "danger" &&
          "border border-negative/30 bg-negative/10 text-negative hover:bg-negative/20",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
