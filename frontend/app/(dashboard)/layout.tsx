"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { LogoMark } from "@/components/ui/Logo";

const COLLAPSE_KEY = "investiq_sidebar_collapsed";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // storage unavailable — default expanded
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });
  }

  useEffect(() => {
    if (!loading && !token) router.push("/sign-in");
  }, [loading, token, router]);

  if (loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoMark className="h-12 w-12 animate-pulse-dot" />
      </div>
    );
  }

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="min-w-0 flex-1">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <div className="pb-28 lg:pb-12">{children}</div>
        </div>
      </div>
      <MobileNav />
    </CommandPaletteProvider>
  );
}
