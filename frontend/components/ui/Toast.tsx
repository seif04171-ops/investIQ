"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import clsx from "clsx";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "error";
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id">) => void }>({ push: () => undefined });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), 4800);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex animate-pop-in items-start gap-3 rounded-2xl border border-white/10 bg-surface/95 p-4 shadow-lift backdrop-blur-xl"
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-positive" />
            ) : (
              <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-negative" />
            )}
            <div className="min-w-0 flex-1">
              <div className={clsx("text-sm font-medium")}>{t.title}</div>
              {t.description && <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-dim transition hover:text-ink" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
