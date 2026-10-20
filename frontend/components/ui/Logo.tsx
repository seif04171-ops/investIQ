import clsx from "clsx";

/** InvestIQ mark: a rising stroke inside a brass ring — "IQ" read as insight. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx("h-8 w-8", className)} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="iq-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE2A6" />
          <stop offset="0.5" stopColor="#F5B94A" />
          <stop offset="1" stopColor="#C98A1B" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#0E1015" stroke="url(#iq-g)" strokeWidth="1.5" />
      <path d="M9 21.5 14 15.5l3.6 3.4L23 11.5" stroke="url(#iq-g)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="11.5" r="2.1" fill="url(#iq-g)" />
    </svg>
  );
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && (
        <span className="font-display text-[19px] font-semibold tracking-tight">
          Invest<span className="text-gold-gradient">IQ</span>
        </span>
      )}
    </div>
  );
}
