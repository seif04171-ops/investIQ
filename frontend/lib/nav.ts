import {
  Compass, Eye, Globe2, GraduationCap, LayoutDashboard, Newspaper, Radar, Sparkles, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  title: string;
  icon: LucideIcon;
  keywords?: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Markets",
    items: [
      { href: "/dashboard", label: "Dashboard", title: "Your day", icon: LayoutDashboard, keywords: "home briefing overview" },
      { href: "/ideas", label: "Ideas", title: "Opportunity radar", icon: Radar, keywords: "signals opportunities what to buy picks screener radar" },
      { href: "/explore", label: "Explore", title: "Explore stocks", icon: Globe2, keywords: "popular stocks trending gainers losers browse discover most known" },
      { href: "/news", label: "News", title: "News intelligence", icon: Newspaper, keywords: "events headlines articles" },
    ],
  },
  {
    label: "Invest",
    items: [
      { href: "/portfolio", label: "Portfolio", title: "Portfolio", icon: Wallet, keywords: "paper trading holdings journal buy sell" },
      { href: "/watchlist", label: "Watchlist", title: "Watchlist", icon: Eye, keywords: "track stocks favorites" },
      { href: "/tutor", label: "AI Analyst", title: "AI analyst", icon: Sparkles, keywords: "ask chat explain tutor analyst" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/learn", label: "Academy", title: "Academy", icon: GraduationCap, keywords: "lessons quiz glossary learn" },
      { href: "/guide", label: "How it works", title: "How InvestIQ works", icon: Compass, keywords: "help guide tutorial" },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function titleForPath(pathname: string | null): string {
  if (!pathname) return "InvestIQ";
  if (pathname.startsWith("/stock/")) return "Stock";
  if (pathname.startsWith("/news/")) return "News intelligence";
  return ALL_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.title ?? "InvestIQ";
}
