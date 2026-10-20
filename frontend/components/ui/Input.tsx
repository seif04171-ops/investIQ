import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-ink " +
  "placeholder:text-dim outline-none transition " +
  "focus:border-primary/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-primary/10";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={clsx(FIELD, "h-11", className)} {...props} />;
});

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(FIELD, "min-h-[88px] resize-none py-3 leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-dim">{hint}</span>}
    </label>
  );
}
