/** Compact INR formatter — 1.2L, 5.4Cr etc. */
export function formatINR(n: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}) {
  if (n == null || isNaN(n)) return "—";
  const decimals = opts.decimals ?? 2;
  if (opts.compact && Math.abs(n) >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (opts.compact && Math.abs(n) >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: decimals });
}

export function formatPct(n: number | null | undefined, decimals = 2) {
  if (n == null || isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function changeColor(n: number | null | undefined) {
  if (n == null) return "text-slate-500";
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-slate-500";
}
