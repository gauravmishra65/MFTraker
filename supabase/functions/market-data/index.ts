import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NSE_INDICES: { yahoo: string; display: string }[] = [
  { yahoo: "^NSEI", display: "NIFTY 50" },
  { yahoo: "^BSESN", display: "SENSEX" },
  { yahoo: "^NSEBANK", display: "BANK NIFTY" },
  { yahoo: "^CNXIT", display: "NIFTY IT" },
];

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

function toQuote(q: any) {
  return {
    symbol: q.symbol,
    name: q.shortName ?? q.longName ?? q.symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePct: q.regularMarketChangePercent ?? 0,
    open: q.regularMarketOpen,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    previousClose: q.regularMarketPreviousClose,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    currency: q.currency,
    exchange: q.fullExchangeName ?? q.exchange,
    updatedAt: Date.now(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols");
    const indices = url.searchParams.get("indices");
    const movers = url.searchParams.get("movers");
    const history = url.searchParams.get("history");
    const range = url.searchParams.get("range") ?? "1mo";
    const interval = url.searchParams.get("interval") ?? "1d";

    // Fetch quotes for given symbols
    if (symbolsParam && !indices && !movers && !history) {
      const symbols = symbolsParam.split(",").filter(Boolean);
      const results: Record<string, any> = {};

      // Use Yahoo Finance v8 API directly
      const fetchPromises = symbols.map(async (sym) => {
        try {
          const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m&includePrepost=false`;
          const res = await fetch(yUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!res.ok) return;
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return;
          results[sym] = {
            symbol: sym,
            name: meta.shortName ?? sym,
            price: meta.regularMarketPrice ?? 0,
            change: meta.regularMarketPrice && meta.previousClose
              ? meta.regularMarketPrice - meta.previousClose
              : 0,
            changePct: meta.previousClose
              ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
              : 0,
            open: meta.regularMarketPrice,
            high: meta.regularMarketPrice,
            low: meta.regularMarketPrice,
            previousClose: meta.previousClose,
            volume: meta.regularMarketVolume,
            marketCap: meta.marketCap,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
            currency: meta.currency,
            exchange: meta.exchangeName,
            updatedAt: Date.now(),
          };
        } catch {
          // Skip failed symbols
        }
      });

      await Promise.all(fetchPromises);
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch indices
    if (indices === "true") {
      const indexSymbols = NSE_INDICES.map((i) => i.yahoo);
      const indicesData: any[] = [];

      for (const idx of NSE_INDICES) {
        try {
          const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.yahoo)}?range=1d&interval=1m&includePrepost=false`;
          const res = await fetch(yUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!res.ok) continue;
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) continue;
          indicesData.push({
            symbol: idx.yahoo,
            displayName: idx.display,
            name: idx.display,
            price: meta.regularMarketPrice ?? 0,
            change: meta.regularMarketPrice && meta.previousClose
              ? meta.regularMarketPrice - meta.previousClose
              : 0,
            changePct: meta.previousClose
              ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
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

    // Fetch movers
    if (movers === "true") {
      // Return empty for now — Yahoo screener API is unreliable
      return new Response(JSON.stringify({ gainers: [], losers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch history
    if (history) {
      const args = rangeToChartArgs(range, interval);
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(history)}?period1=${args.period1}&period2=${args.period2}&interval=${args.interval}&includePrepost=false`;
        const res = await fetch(yUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
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
            o: quotes.open?.[i] ?? quotes.close?.[i] ?? 0,
            h: quotes.high?.[i] ?? quotes.close?.[i] ?? 0,
            l: quotes.low?.[i] ?? quotes.close?.[i] ?? 0,
            c: quotes.close?.[i] ?? 0,
            v: quotes.volume?.[i] ?? 0,
          }))
          .filter((c: any) => c.c != null && c.c > 0);

        return new Response(JSON.stringify({ candles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ candles: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "No action specified" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
