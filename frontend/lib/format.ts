const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function usd(n: number | null | undefined, digits: 0 | 2 = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (digits === 0 ? USD0 : USD).format(n);
}

/** $1.2K / $3.4M / $5.6B — for market caps and big totals. */
export function compactUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return usd(n);
}

export function pct(n: number | null | undefined, digits = 2, sign = true): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = sign && n > 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}%`;
}

export function signedUsd(n: number | null | undefined, digits: 0 | 2 = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${usd(Math.abs(n), digits)}`;
}

export function shares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return fullDate(iso);
}

/** Always an explicit date — news must never be ambiguous about "when". */
export function fullDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function directionOf(n: number | null | undefined): "up" | "down" | "flat" {
  if (n === null || n === undefined || Math.abs(n) < 0.005) return "flat";
  return n > 0 ? "up" : "down";
}

export function toneClass(n: number | null | undefined): string {
  const d = directionOf(n);
  return d === "up" ? "text-positive" : d === "down" ? "text-negative" : "text-muted";
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
