import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Each entry: { data: unknown; expiresAt: number }
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Shared headers ───────────────────────────────────────────────────────────
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── NSE session cookie store ─────────────────────────────────────────────────
// NSE requires two sequential requests: first GET the homepage to set a valid
// session cookie, then use that cookie on the real API request.
// We cache the cookies for 5 minutes to avoid hammering the homepage.
let nseCookies: string = "";
let nseCookiesExpiry = 0;
const NSE_COOKIE_TTL_MS = 5 * 60_000;

async function getNseCookies(): Promise<string> {
  if (nseCookies && Date.now() < nseCookiesExpiry) return nseCookies;

  const res = await fetch("https://www.nseindia.com", {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    // Follow redirects and grab the Set-Cookie header
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });

  // Collect all Set-Cookie values and join them as a single Cookie header string.
  // The Headers API exposes multiple Set-Cookie values as comma-separated when
  // accessed via .get(), so we use .getSetCookie() when available (Node 18.14+).
  const raw: string[] =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

  // Extract only the name=value portion of each cookie (strip attributes).
  nseCookies = raw
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  nseCookiesExpiry = Date.now() + NSE_COOKIE_TTL_MS;
  return nseCookies;
}

// ─── NSE — live quote ─────────────────────────────────────────────────────────
// GET /api/proxy/nse/quote/:symbol
router.get("/nse/quote/:symbol", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbol = encodeURIComponent(req.params.symbol.toUpperCase());
    const cacheKey = `nse:quote:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const cookies = await getNseCookies();
    const apiRes = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`,
      {
        headers: {
          "User-Agent": UA,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.nseindia.com",
          "X-Requested-With": "XMLHttpRequest",
          "Cookie": cookies,
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!apiRes.ok) {
      // If NSE rejects the session cookie, invalidate it and surface the error
      if (apiRes.status === 401 || apiRes.status === 403) nseCookies = "";
      return res.status(apiRes.status).json({ error: `NSE returned ${apiRes.status}` });
    }

    const data = await apiRes.json();
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── NSE — historical chart data ──────────────────────────────────────────────
// GET /api/proxy/nse/chart/:symbol?series=EQ&from=DD-MM-YYYY&to=DD-MM-YYYY
router.get("/nse/chart/:symbol", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const symbol = encodeURIComponent(req.params.symbol.toUpperCase());
    const series = (req.query.series as string) || "EQ";
    const from   = (req.query.from   as string) || "";
    const to     = (req.query.to     as string) || "";

    const cacheKey = `nse:chart:${symbol}:${series}:${from}:${to}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const cookies = await getNseCookies();

    const params = new URLSearchParams({ symbol, series });
    if (from) params.set("from", from);
    if (to)   params.set("to",   to);

    const apiRes = await fetch(
      `https://www.nseindia.com/api/historical/cm/equity?${params}`,
      {
        headers: {
          "User-Agent": UA,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": `https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`,
          "X-Requested-With": "XMLHttpRequest",
          "Cookie": cookies,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!apiRes.ok) {
      if (apiRes.status === 401 || apiRes.status === 403) nseCookies = "";
      return res.status(apiRes.status).json({ error: `NSE returned ${apiRes.status}` });
    }

    const data = await apiRes.json();
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── BSE — live quote ─────────────────────────────────────────────────────────
// GET /api/proxy/bse/quote/:scripCode
router.get("/bse/quote/:scripCode", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scripCode = encodeURIComponent(req.params.scripCode);
    const cacheKey = `bse:quote:${scripCode}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const apiRes = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`,
      {
        headers: {
          "User-Agent": UA,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.bseindia.com",
          "Origin": "https://www.bseindia.com",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: `BSE returned ${apiRes.status}` });
    }

    const data = await apiRes.json();
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
