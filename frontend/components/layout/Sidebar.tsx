"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { NAV_GROUPS } from "@/lib/nav";
import { Logo } from "@/components/ui/Logo";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed && <div className="eyebrow mb-1 px-3">{group.label}</div>}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-white/[0.07] font-medium text-ink"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_rgba(245,185,74,0.8)]" />
                )}
                <Icon className={clsx("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-primary" : "group-hover:text-ink")} />
                {!collapsed && label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const initial = (user?.display_name || user?.email || "?").trim().charAt(0).toUpperCase();

  const footer = (isCollapsed: boolean) => (
    <div className="border-t border-white/[0.06] p-3">
      <div className={clsx("flex items-center gap-3 rounded-xl px-2 py-2", isCollapsed && "justify-center px-0")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primaryDeep/20 font-display text-sm font-semibold text-primary ring-1 ring-inset ring-primary/30">
          {initial}
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.display_name || "Investor"}</div>
            <div className="truncate text-xs text-dim">{user?.email}</div>
          </div>
        )}
        {!isCollapsed && (
          <button onClick={logout} className="rounded-lg p-2 text-muted transition hover:bg-white/[0.06] hover:text-ink" aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={clsx(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/[0.06] bg-background/60 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] lg:flex",
          collapsed ? "w-[76px]" : "w-[252px]"
        )}
      >
        <div className={clsx("flex h-16 items-center border-b border-white/[0.06]", collapsed ? "justify-center" : "justify-between px-5")}>
          <Link href="/dashboard" aria-label="InvestIQ home">
            <Logo collapsed={collapsed} />
          </Link>
        </div>
        <NavList collapsed={collapsed} />
        <div className="px-3 pb-2">
          <button
            onClick={onToggle}
            className={clsx(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-dim transition hover:bg-white/[0.04] hover:text-muted",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
        {footer(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative flex h-full w-72 animate-fade-in flex-col border-r border-white/10 bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
              <Logo />
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:text-ink" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList collapsed={false} onNavigate={onClose} />
            {footer(false)}
          </aside>
        </div>
      )}
    </>
  );
}
