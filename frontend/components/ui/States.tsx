import { AlertCircle, Inbox, Loader2, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-negative/25 bg-negative/[0.07] p-4 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-negative" />
      <div className="flex-1 text-negative/95">{message}</div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="-my-1 text-negative hover:text-negative">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  title,
  icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="max-w-sm">
        {title && <div className="font-display text-base font-semibold">{title}</div>}
        <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
      </div>
      {action}
    </div>
  );
}
