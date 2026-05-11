import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
};

const NSE_INDICES: { yahoo: string; display: string }[] = [
  { yahoo: "^NSEI",    display: "NIFTY 50"   },
  { yahoo: "^BSESN",  display: "SENSEX"      },
  { yahoo: "^NSEBANK",display: "BANK NIFTY"  },
  { yahoo: "^CNXIT",  display: "NIFTY IT"    },
  { yahoo: "^NSMIDCP",display: "NIFTY MIDCAP"},
];

// Broad Nifty 500-ish universe for movers (50 symbols)
const MOVERS_SYMBOLS = [
  "RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS",
  "HINDUNILVR.NS","SBIN.NS","BHARTIARTL.NS","KOTAKBANK.NS","ITC.NS",
  "LT.NS","AXISBANK.NS","ASIANPAINT.NS","MARUTI.NS","TITAN.NS",
  "WIPRO.NS","HCLTECH.NS","BAJFINANCE.NS","SUNPHARMA.NS","ULTRACEMCO.NS",
  "TATAMOTORS.NS","ADANIENT.NS","ONGC.NS","NTPC.NS","POWERGRID.NS",
  "NESTLEIND.NS","BAJAJFINSV.NS","TATASTEEL.NS","JSWSTEEL.NS","HINDALCO.NS",
  "TECHM.NS","DRREDDY.NS","CIPLA.NS","DIVISLAB.NS","BRITANNIA.NS",
  "GRASIM.NS","COALINDIA.NS","EICHERMOT.NS","HEROMOTOCO.NS","INDUSINDBK.NS",
  "ZOMATO.NS","IRCTC.NS","DMART.NS","TATAPOWER.NS","ADANIGREEN.NS",
  "DLF.NS","GODREJCP.NS","MARICO.NS","DABUR.NS","TVSMOTOR.NS",
];

const VALID_RANGES = new Set(["1d","5d","1mo","3mo","6mo","1y","5y","max"]);
const VALID_INTERVALS = new Set(["1m","5m","15m","1d","1wk","1mo"]);
const SYMBOL_RE = /^[A-Z0-9.\-^&]{1,25}$/;
const MAX_SYMBOLS = 20;

function sanitizeSymbol(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return SYMBOL_RE.test(t) ? t : null;
}

function rangeToChartArgs(range: string, interval: string) {
  const now = new Date();
  const p = new Date();
  switch (range) {
    case "1d":  p.setDate(now.getDate() - 1); break;
    case "5d":  p.setDate(now.getDate() - 7); break;
    case "1mo": p.setMonth(now.getMonth() - 1); break;
    case "3mo": p.setMonth(now.getMonth() - 3); break;
    case "6mo": p.setMonth(now.getMonth() - 6); break;
    case "1y":  p.setFullYear(now.getFullYear() - 1); break;
    case "5y":  p.setFullYear(now.getFullYear() - 5); break;
    case "max": p.setFullYear(now.getFullYear() - 25); break;
  }
  return { period1: Math.floor(p.getTime() / 1000), period2: Math.floor(now.getTime() / 1000), interval };
}

// In-memory caches
const MOVERS_TTL  = 5 * 60_000;
const QUOTES_TTL  = 15_000;
const INDICES_TTL = 15_000;
const QUOTES_CACHE_MAX = 500;

let moversCache: { data: { gainers: any[]; losers: any[] }; exp: number } | null = null;
let indicesCache: { data: any[]; exp: number } | null = null;
const quotesCache = new Map<string, { data: any; exp: number }>();

function putQuoteCache(sym: string, entry: { data: any; exp: number }) {
  // Evict oldest entries when at capacity
  if (quotesCache.size >= QUOTES_CACHE_MAX) {
    quotesCache.delete(quotesCache.keys().next().value!);
  }
  quotesCache.set(sym, entry);
}

// Rate limiter — cleaned up on each request to avoid setInterval keeping the function alive
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Inline cleanup: remove expired entries on every request (amortized O(1) typical)
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
  const e = rateLimitMap.get(ip);
  if (!e || now > e.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  return ++e.count <= 60;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchYahooQuote(sym: string): Promise<any | null> {
  const cached = quotesCache.get(sym);
  if (cached && Date.now() < cached.exp) return cached.data;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m&includePrepost=false`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
    const price = meta.regularMarketPrice ?? 0;
    const data = {
      symbol: sym,
      name: String(meta.shortName ?? meta.longName ?? sym).slice(0, 200),
      price,
      change: prevClose ? price - prevClose : 0,
      changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      previousClose: prevClose || null,
      open: meta.regularMarketOpen ?? null,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      marketCap: meta.marketCap ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      currency: String(meta.currency ?? "INR").slice(0, 10),
      exchange: String(meta.exchangeName ?? "").slice(0, 50),
      updatedAt: Date.now(),
    };
    putQuoteCache(sym, { data, exp: Date.now() + QUOTES_TTL });
    return data;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json(req, { error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) return json(req, { error: "Rate limit exceeded" }, 429);

  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols");
    const indicesFlag  = url.searchParams.get("indices");
    const moversFlag   = url.searchParams.get("movers");
    const historyParam = url.searchParams.get("history");
    const range    = url.searchParams.get("range") ?? "1mo";
    const interval = url.searchParams.get("interval") ?? "1d";

    if (!VALID_RANGES.has(range))    return json(req, { error: "Invalid range" }, 400);
    if (!VALID_INTERVALS.has(interval)) return json(req, { error: "Invalid interval" }, 400);

    // ── Quote batch ──────────────────────────────────────────────────────────
    if (symbolsParam) {
      const raw = symbolsParam.split(",").filter(Boolean).slice(0, MAX_SYMBOLS);
      const symbols = raw.map(sanitizeSymbol).filter((s): s is string => s !== null);
      if (!symbols.length) return json(req, { error: "No valid symbols" }, 400);

      const results: Record<string, any> = {};
      await Promise.all(symbols.map(async (sym) => {
        const q = await fetchYahooQuote(sym);
        if (q) results[sym] = q;
      }));
      return json(req, results);
    }

    // ── Indices ──────────────────────────────────────────────────────────────
    if (indicesFlag === "true") {
      if (indicesCache && Date.now() < indicesCache.exp) {
        return json(req, { indices: indicesCache.data });
      }
      const data: any[] = [];
      await Promise.all(NSE_INDICES.map(async (idx) => {
        const q = await fetchYahooQuote(idx.yahoo);
        if (q) data.push({ ...q, symbol: idx.yahoo, displayName: idx.display, name: idx.display });
      }));
      indicesCache = { data, exp: Date.now() + INDICES_TTL };
      return json(req, { indices: data });
    }

    // ── Movers ───────────────────────────────────────────────────────────────
    if (moversFlag === "true") {
      if (moversCache && Date.now() < moversCache.exp) return json(req, moversCache.data);

      const settled = await Promise.allSettled(MOVERS_SYMBOLS.map(async (sym) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d&includePrepost=false`,
          { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8_000) }
        );
        if (!res.ok) throw new Error("bad status");
        const d = await res.json();
        const meta = d?.chart?.result?.[0]?.meta;
        const prev = meta?.chartPreviousClose ?? meta?.previousClose;
        if (!meta || typeof meta.regularMarketPrice !== "number" || !prev) throw new Error("no meta");
        return {
          symbol: sym.replace(/\.(NS|BO)$/, ""),
          name: String(meta.shortName ?? sym).slice(0, 100),
          price: meta.regularMarketPrice,
          changePct: ((meta.regularMarketPrice - prev) / prev) * 100,
        };
      }));

      const all = settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value)
        .sort((a, b) => b.changePct - a.changePct);

      const result = {
        gainers: all.filter((m) => m.changePct > 0).slice(0, 8),
        losers:  [...all].reverse().filter((m) => m.changePct < 0).slice(0, 8),
      };
      moversCache = { data: result, exp: Date.now() + MOVERS_TTL };
      return json(req, result);
    }

    // ── History ──────────────────────────────────────────────────────────────
    if (historyParam) {
      const sym = sanitizeSymbol(historyParam);
      if (!sym) return json(req, { error: "Invalid symbol" }, 400);
      const args = rangeToChartArgs(range, interval);
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${args.period1}&period2=${args.period2}&interval=${interval}&includePrepost=false`,
          { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) }
        );
        if (!res.ok) return json(req, { candles: [] });
        const d = await res.json();
        const result = d?.chart?.result?.[0];
        const ts = result?.timestamp ?? [];
        const q = result?.indicators?.quote?.[0] ?? {};
        const candles = ts
          .map((t: number, i: number) => ({
            t, o: q.open?.[i] ?? q.close?.[i] ?? 0,
            h: q.high?.[i] ?? q.close?.[i] ?? 0,
            l: q.low?.[i]  ?? q.close?.[i] ?? 0,
            c: q.close?.[i] ?? 0, v: q.volume?.[i] ?? 0,
          }))
          .filter((c: any) => c.c > 0);
        return json(req, { candles });
      } catch { return json(req, { candles: [] }); }
    }

    return json(req, { error: "Use ?symbols=, ?indices=true, ?movers=true, or ?history=" }, 400);
  } catch {
    return json(req, { error: "Unexpected error" }, 500);
  }
});
