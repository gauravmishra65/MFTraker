import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function getCorsHeaders(_req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
  };
}

const NSE_INDICES: { yahoo: string; display: string }[] = [
  { yahoo: "^NSEI", display: "NIFTY 50" },
  { yahoo: "^BSESN", display: "SENSEX" },
  { yahoo: "^NSEBANK", display: "BANK NIFTY" },
  { yahoo: "^CNXIT", display: "NIFTY IT" },
];

// Representative NIFTY 50 constituents for movers
const NIFTY50_SYMBOLS = [
  "RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS",
  "HINDUNILVR.NS","SBIN.NS","BHARTIARTL.NS","KOTAKBANK.NS","ITC.NS",
  "LT.NS","AXISBANK.NS","ASIANPAINT.NS","MARUTI.NS","TITAN.NS",
  "WIPRO.NS","HCLTECH.NS","BAJFINANCE.NS","SUNPHARMA.NS","ULTRACEMCO.NS",
  "TATAMOTORS.NS","ADANIENT.NS","ONGC.NS","NTPC.NS","POWERGRID.NS",
];

const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "max"]);
const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1d", "1wk", "1mo"]);
const SYMBOL_RE = /^[A-Z0-9.\-^]{1,20}$/;
const MAX_SYMBOLS = 10;

function sanitizeSymbol(raw: string): string | null {
  const trimmed = raw.trim();
  if (!SYMBOL_RE.test(trimmed)) return null;
  return trimmed;
}

function rangeToChartArgs(range: string, interval: string) {
  const now = new Date();
  const periodStart = new Date();
  switch (range) {
    case "1d": periodStart.setDate(now.getDate() - 1); break;
    case "5d": periodStart.setDate(now.getDate() - 7); break;
    case "1mo": periodStart.setMonth(now.getMonth() - 1); break;
    case "3mo": periodStart.setMonth(now.getMonth() - 3); break;
    case "6mo": periodStart.setMonth(now.getMonth() - 6); break;
    case "1y": periodStart.setFullYear(now.getFullYear() - 1); break;
    case "5y": periodStart.setFullYear(now.getFullYear() - 5); break;
    case "max": periodStart.setFullYear(now.getFullYear() - 25); break;
  }
  return { period1: Math.floor(periodStart.getTime() / 1000), period2: Math.floor(now.getTime() / 1000), interval };
}

// Simple in-memory rate limiter (per-IP, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 120_000);

function jsonRes(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "GET") {
    return jsonRes(req, { error: "Method not allowed" }, 405);
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip")
    ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return jsonRes(req, { error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });
  }

  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols");
    const indices = url.searchParams.get("indices");
    const movers = url.searchParams.get("movers");
    const history = url.searchParams.get("history");
    const range = url.searchParams.get("range") ?? "1mo";
    const interval = url.searchParams.get("interval") ?? "1d";

    if (!VALID_RANGES.has(range)) {
      return jsonRes(req, { error: "Invalid range parameter" }, 400);
    }
    if (!VALID_INTERVALS.has(interval)) {
      return jsonRes(req, { error: "Invalid interval parameter" }, 400);
    }

    // Fetch quotes for given symbols
    if (symbolsParam && !indices && !movers && !history) {
      const rawSymbols = symbolsParam.split(",").filter(Boolean);
      if (rawSymbols.length === 0 || rawSymbols.length > MAX_SYMBOLS) {
        return jsonRes(req, { error: `Provide 1-${MAX_SYMBOLS} symbols` }, 400);
      }

      const symbols = rawSymbols.map(sanitizeSymbol).filter((s): s is string => s !== null);
      if (symbols.length === 0) {
        return jsonRes(req, { error: "No valid symbols provided" }, 400);
      }

      const results: Record<string, any> = {};
      const fetchPromises = symbols.map(async (sym) => {
        try {
          const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m&includePrepost=false`;
          const res = await fetch(yUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) return;
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return;
          results[sym] = {
            symbol: sym,
            name: String(meta.shortName ?? sym).slice(0, 200),
            price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : 0,
            change: (typeof meta.regularMarketPrice === "number" && typeof meta.previousClose === "number")
              ? meta.regularMarketPrice - meta.previousClose : 0,
            changePct: (typeof meta.previousClose === "number" && meta.previousClose !== 0)
              ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100 : 0,
            previousClose: typeof meta.previousClose === "number" ? meta.previousClose : null,
            volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : null,
            marketCap: typeof meta.marketCap === "number" ? meta.marketCap : null,
            fiftyTwoWeekHigh: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null,
            fiftyTwoWeekLow: typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null,
            currency: String(meta.currency ?? "INR").slice(0, 10),
            exchange: String(meta.exchangeName ?? "").slice(0, 50),
            updatedAt: Date.now(),
          };
        } catch { /* skip */ }
      });

      await Promise.all(fetchPromises);
      return jsonRes(req, results);
    }

    // Fetch indices
    if (indices === "true") {
      const indicesData: any[] = [];
      for (const idx of NSE_INDICES) {
        try {
          const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.yahoo)}?range=1d&interval=1m&includePrepost=false`;
          const res = await fetch(yUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) continue;
          indicesData.push({
            symbol: idx.yahoo, displayName: idx.display, name: idx.display,
            price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : 0,
            change: (typeof meta.regularMarketPrice === "number" && typeof meta.previousClose === "number")
              ? meta.regularMarketPrice - meta.previousClose : 0,
            changePct: (typeof meta.previousClose === "number" && meta.previousClose !== 0)
              ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100 : 0,
          });
        } catch { /* skip */ }
      }
      return jsonRes(req, { indices: indicesData });
    }

    if (movers === "true") {
      const moverResults: { symbol: string; name: string; price: number; changePct: number }[] = [];
      const batchSize = 5;
      for (let i = 0; i < NIFTY50_SYMBOLS.length; i += batchSize) {
        const batch = NIFTY50_SYMBOLS.slice(i, i + batchSize);
        await Promise.all(batch.map(async (sym) => {
          try {
            const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m&includePrepost=false`;
            const res = await fetch(yUrl, {
              headers: { "User-Agent": "Mozilla/5.0" },
              signal: AbortSignal.timeout(6_000),
            });
            if (!res.ok) return;
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (!meta || typeof meta.regularMarketPrice !== "number" || typeof meta.previousClose !== "number" || meta.previousClose === 0) return;
            const changePct = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100;
            moverResults.push({
              symbol: sym.replace(".NS", ""),
              name: String(meta.shortName ?? sym).slice(0, 100),
              price: meta.regularMarketPrice,
              changePct,
            });
          } catch { /* skip */ }
        }));
      }
      moverResults.sort((a, b) => b.changePct - a.changePct);
      const gainers = moverResults.filter((m) => m.changePct > 0).slice(0, 6);
      const losers = moverResults.filter((m) => m.changePct < 0).slice(-6).reverse();
      return jsonRes(req, { gainers, losers });
    }

    // Fetch history
    if (history) {
      const sanitizedHistory = sanitizeSymbol(history);
      if (!sanitizedHistory) {
        return jsonRes(req, { error: "Invalid symbol format" }, 400);
      }
      const args = rangeToChartArgs(range, interval);
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sanitizedHistory)}?period1=${args.period1}&period2=${args.period2}&interval=${encodeURIComponent(interval)}&includePrepost=false`;
        const res = await fetch(yUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return jsonRes(req, { candles: [] });
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp ?? [];
        const quotes = result?.indicators?.quote?.[0] ?? {};
        const candles = timestamps
          .map((t: number, i: number) => ({
            t,
            o: typeof quotes.open?.[i] === "number" ? quotes.open[i] : (quotes.close?.[i] ?? 0),
            h: typeof quotes.high?.[i] === "number" ? quotes.high[i] : (quotes.close?.[i] ?? 0),
            l: typeof quotes.low?.[i] === "number" ? quotes.low[i] : (quotes.close?.[i] ?? 0),
            c: typeof quotes.close?.[i] === "number" ? quotes.close[i] : 0,
            v: typeof quotes.volume?.[i] === "number" ? quotes.volume[i] : 0,
          }))
          .filter((c: any) => typeof c.c === "number" && c.c > 0);
        return jsonRes(req, { candles });
      } catch {
        return jsonRes(req, { candles: [] });
      }
    }

    return jsonRes(req, { error: "No action specified. Use ?symbols=, ?indices=true, ?movers=true, or ?history=" }, 400);
  } catch {
    return jsonRes(req, { error: "An unexpected error occurred" }, 500);
  }
});
