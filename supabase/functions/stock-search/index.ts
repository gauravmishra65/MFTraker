import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Yahoo Finance search endpoint
const YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const SYMBOL_RE = /^[A-Z0-9.\-^&]{1,25}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Determine exchange and Yahoo suffix from a Yahoo Finance quote result
function parseExchange(quote: any): { exchange: string; yahooSymbol: string } {
  const exch = (quote.exchDisp ?? quote.exchange ?? "").toUpperCase();
  const sym: string = quote.symbol ?? "";
  if (sym.endsWith(".BO") || exch.includes("BSE") || exch.includes("BOMBAY")) {
    return { exchange: "BSE", yahooSymbol: sym.endsWith(".BO") ? sym : `${sym}.BO` };
  }
  if (sym.endsWith(".NS") || exch.includes("NSE") || exch.includes("NATIONAL")) {
    return { exchange: "NSE", yahooSymbol: sym.endsWith(".NS") ? sym : `${sym}.NS` };
  }
  // Filter to only Indian exchanges
  return { exchange: exch, yahooSymbol: sym };
}

// Infer cap category from Yahoo's market cap
function inferCapCategory(marketCap?: number | null): string | null {
  if (!marketCap) return null;
  const cr = marketCap / 1e7; // convert to INR Crore (approx)
  if (cr >= 20000) return "LARGE";
  if (cr >= 5000)  return "MID";
  return "SMALL";
}

// Infer sector from Yahoo's industry/sector string
function inferSector(sector?: string, industry?: string): string | null {
  const raw = (sector ?? industry ?? "").toLowerCase();
  if (!raw) return null;
  if (raw.includes("bank") || raw.includes("financ") || raw.includes("insurance") || raw.includes("nbfc")) return "Financials";
  if (raw.includes("tech") || raw.includes("software") || raw.includes("it service")) return "IT";
  if (raw.includes("pharma") || raw.includes("drug") || raw.includes("biotech")) return "Pharma";
  if (raw.includes("auto") || raw.includes("vehicle") || raw.includes("tyre")) return "Auto";
  if (raw.includes("fmcg") || raw.includes("consumer staple") || raw.includes("tobacco") || raw.includes("food")) return "FMCG";
  if (raw.includes("energy") || raw.includes("oil") || raw.includes("gas") || raw.includes("petro")) return "Energy";
  if (raw.includes("cement") || raw.includes("construction") || raw.includes("infra")) return "Construction";
  if (raw.includes("metal") || raw.includes("steel") || raw.includes("alumin") || raw.includes("copper")) return "Metals";
  if (raw.includes("power") || raw.includes("electric") || raw.includes("utility")) return "Power";
  if (raw.includes("telecom") || raw.includes("communication")) return "Telecom";
  if (raw.includes("realty") || raw.includes("real estate")) return "Realty";
  if (raw.includes("chemical")) return "Chemicals";
  if (raw.includes("healthcare") || raw.includes("hospital")) return "Healthcare";
  if (raw.includes("mining") || raw.includes("coal")) return "Mining";
  if (raw.includes("consumer discret") || raw.includes("jewel") || raw.includes("retail")) return "Consumer";
  if (raw.includes("defence") || raw.includes("aerospace")) return "Defence";
  if (raw.includes("logistic") || raw.includes("transport")) return "Logistics";
  if (raw.includes("diversified") || raw.includes("conglomerate")) return "Diversified";
  if (raw.includes("airline") || raw.includes("aviation")) return "Airlines";
  return sector ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const mode = req.method === "POST" ? "save" : (url.searchParams.get("mode") ?? "search");

    // ── SEARCH: GET ?q=RELIANCE&exchange=NSE ─────────────────────────────────
    if (mode === "search") {
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
      if (!q) return json({ error: "q is required" }, 400);

      const exchangeFilter = (url.searchParams.get("exchange") ?? "").toUpperCase();

      const searchUrl = new URL(YAHOO_SEARCH_URL);
      searchUrl.searchParams.set("q", q);
      searchUrl.searchParams.set("quotesCount", "20");
      searchUrl.searchParams.set("newsCount", "0");
      searchUrl.searchParams.set("listsCount", "0");

      const res = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return json({ error: "Yahoo Finance search unavailable" }, 502);

      const data = await res.json();
      const quotes: any[] = data?.finance?.result?.[0]?.quotes ?? [];

      const filtered = quotes
        .filter((q: any) => q.quoteType === "EQUITY")
        .map((q: any) => {
          const { exchange, yahooSymbol } = parseExchange(q);
          return {
            symbol: (q.symbol ?? "").replace(/\.(NS|BO)$/, ""),
            yahooSymbol,
            name: String(q.shortname ?? q.longname ?? q.symbol ?? "").slice(0, 200),
            exchange,
            sector: inferSector(q.sector, q.industry),
            industry: q.industry ?? null,
            isin: null,
            capCategory: inferCapCategory(q.marketCap),
          };
        })
        .filter((s) => {
          // Only include NSE/BSE stocks
          if (s.exchange !== "NSE" && s.exchange !== "BSE") return false;
          if (exchangeFilter && s.exchange !== exchangeFilter) return false;
          return SYMBOL_RE.test(s.yahooSymbol);
        });

      return json({ results: filtered });
    }

    // ── SAVE: POST body { stocks: [...] } ────────────────────────────────────
    if (mode === "save") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const sb = createClient(supabaseUrl, serviceKey);

      const body = await req.json().catch(() => ({}));
      const stocks: any[] = Array.isArray(body.stocks) ? body.stocks : [];
      if (!stocks.length) return json({ error: "stocks array is required" }, 400);

      // Validate each stock
      const valid = stocks
        .filter((s) => s.symbol && s.yahooSymbol && s.name && (s.exchange === "NSE" || s.exchange === "BSE"))
        .map((s) => ({
          symbol: String(s.symbol).toUpperCase().slice(0, 20),
          yahoo_symbol: String(s.yahooSymbol).slice(0, 30),
          name: String(s.name).slice(0, 200),
          exchange: s.exchange,
          sector: s.sector ?? null,
          industry: s.industry ?? null,
          cap_category: s.capCategory ?? null,
          isin: s.isin ?? null,
          description: s.description ?? null,
        }));

      if (!valid.length) return json({ error: "No valid stocks to save" }, 400);

      const { data, error } = await sb
        .from("stocks")
        .upsert(valid, { onConflict: "symbol", ignoreDuplicates: false })
        .select("id, symbol, name, exchange");

      if (error) return json({ error: error.message }, 500);
      return json({ saved: data?.length ?? 0, stocks: data });
    }

    return json({ error: "Invalid mode. Use GET ?q= for search or POST with {stocks:[]} to save" }, 400);
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
