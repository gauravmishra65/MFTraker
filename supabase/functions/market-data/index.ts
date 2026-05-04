import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NSE_INDICES: { yahoo: string; display: string }[] = [
  { yahoo: "^NSEI", display: "NIFTY 50" },
  { yahoo: "^BSESN", display: "SENSEX" },
  { yahoo: "^NSEBANK", display: "BANK NIFTY" },
  { yahoo: "^CNXIT", display: "NIFTY IT" },
];

const VALID_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "max"]);
const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1d", "1wk", "1mo"]);
const SYMBOL_RE = /^[A-Z0-9.\-^]{1,20}$/;
const MAX_SYMBOLS = 20;

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
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 120_000);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip")
    ?? "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols");
    const indices = url.searchParams.get("indices");
    const movers = url.searchParams.get("movers");
    const history = url.searchParams.get("history");
    const range = url.searchParams.get("range") ?? "1mo";
    const interval = url.searchParams.get("interval") ?? "1d";

    // Validate range and interval
    if (!VALID_RANGES.has(range)) {
      return new Response(JSON.stringify({ error: "Invalid range parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_INTERVALS.has(interval)) {
      return new Response(JSON.stringify({ error: "Invalid interval parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quotes for given symbols
    if (symbolsParam && !indices && !movers && !history) {
      const rawSymbols = symbolsParam.split(",").filter(Boolean);
      if (rawSymbols.length === 0 || rawSymbols.length > MAX_SYMBOLS) {
        return new Response(JSON.stringify({ error: `Provide 1-${MAX_SYMBOLS} symbols` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const symbols = rawSymbols.map(sanitizeSymbol).filter((s): s is string => s !== null);
      if (symbols.length === 0) {
        return new Response(JSON.stringify({ error: "No valid symbols provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
              ? meta.regularMarketPrice - meta.previousClose
              : 0,
            changePct: (typeof meta.previousClose === "number" && meta.previousClose !== 0)
              ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100
              : 0,
            previousClose: typeof meta.previousClose === "number" ? meta.previousClose : null,
            volume: typeof meta.regularMarketVolume === "number" ? meta.regularMarketVolume : null,
            marketCap: typeof meta.marketCap === "number" ? meta.marketCap : null,
            fiftyTwoWeekHigh: typeof meta.fiftyTwoWeekHigh === "number" ? meta.fiftyTwoWeekHigh : null,
            fiftyTwoWeekLow: typeof meta.fiftyTwoWeekLow === "number" ? meta.fiftyTwoWeekLow : null,
            currency: String(meta.currency ?? "INR").slice(0, 10),
            exchange: String(meta.exchangeName ?? "").slice(0, 50),
            updatedAt: Date.now(),
          };
        } catch {
          // Skip failed symbols silently
        }
      });

      await Promise.all(fetchPromises);
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            symbol: idx.yahoo,
            displayName: idx.display,
            name: idx.display,
            price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : 0,
            change: (typeof meta.regularMarketPrice === "number" && typeof meta.previousClose === "number")
              ? meta.regularMarketPrice - meta.previousClose
              : 0,
            changePct: (typeof meta.previousClose === "number" && meta.previousClose !== 0)
              ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100
              : 0,
          });
        } catch {
          // Skip failed indices
        }
      }

      return new Response(JSON.stringify({ indices: indicesData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch movers (returns empty for now)
    if (movers === "true") {
      return new Response(JSON.stringify({ gainers: [], losers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch history
    if (history) {
      const sanitizedHistory = sanitizeSymbol(history);
      if (!sanitizedHistory) {
        return new Response(JSON.stringify({ error: "Invalid symbol format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const args = rangeToChartArgs(range, interval);
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sanitizedHistory)}?period1=${args.period1}&period2=${args.period2}&interval=${encodeURIComponent(interval)}&includePrepost=false`;
        const res = await fetch(yUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          return new Response(JSON.stringify({ candles: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

        return new Response(JSON.stringify({ candles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ candles: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "No action specified. Use ?symbols=, ?indices=true, ?movers=true, or ?history=" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
