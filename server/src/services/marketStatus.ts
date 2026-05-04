/** Indian market hours helpers (NSE/BSE: 9:15 — 15:30 IST, Mon–Fri). */

export function getISTNow() {
  const now = new Date();
  // Convert to IST by adding offset; simple but reliable for hours/min only.
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 5.5 * 60 * 60_000);
}

export function isMarketOpen(now = getISTNow()): boolean {
  const day = now.getDay(); // 0=Sun..6=Sat
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export function nextMarketChange(now = getISTNow()): { state: "OPEN" | "CLOSED"; nextChangeAt: string } {
  const open = isMarketOpen(now);
  const target = new Date(now);
  if (open) {
    target.setHours(15, 30, 0, 0);
  } else {
    target.setDate(target.getDate() + (target.getHours() >= 16 ? 1 : 0));
    while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
    target.setHours(9, 15, 0, 0);
  }
  return { state: open ? "OPEN" : "CLOSED", nextChangeAt: target.toISOString() };
}
