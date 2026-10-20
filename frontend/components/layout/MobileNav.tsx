"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ALL_NAV } from "@/lib/nav";

const MOBILE_ITEMS = ["/dashboard", "/news", "/portfolio", "/learn", "/tutor"];

/** App-style bottom tab bar for phones. */
export function MobileNav() {
  const pathname = usePathname();
  const items = ALL_NAV.filter((n) => MOBILE_ITEMS.includes(n.href));
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-white/10 bg-surface/90 p-1.5 shadow-lift backdrop-blur-xl lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition",
              active ? "bg-white/[0.08] text-primary" : "text-muted"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
