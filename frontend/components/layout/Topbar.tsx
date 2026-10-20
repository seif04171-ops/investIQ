"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { titleForPath } from "@/lib/nav";
import { useCommandPalette } from "./CommandPalette";
import { AlertsBell } from "./AlertsBell";
import { MarketStatus } from "./MarketStatus";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { open } = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-background/70 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-white/[0.06] hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 sm:block">
        <div className="eyebrow">InvestIQ</div>
        <div className="truncate font-display text-[15px] font-semibold leading-tight">{titleForPath(pathname)}</div>
      </div>

      <button
        onClick={open}
        className="group mx-auto flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left text-sm text-dim transition hover:border-white/20 hover:bg-white/[0.05]"
        aria-label="Search or jump to…"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Search stocks, pages, or ask anything…</span>
        <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] sm:block">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <MarketStatus />
        <AlertsBell />
      </div>
    </header>
  );
}
