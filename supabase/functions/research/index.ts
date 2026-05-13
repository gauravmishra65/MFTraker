import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function annualisedReturn(closes: number[], years: number): number | null {
  if (closes.length < 2 || years <= 0) return null;
  const start = closes[0];
  const end   = closes[closes.length - 1];
  if (start <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

function monthlyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function maxDrawdown(closes: number[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// Returns closes from the last N months of data
function lastNMonths(closes: number[], n: number): number[] {
  if (closes.length <= n) return closes;
  return closes.slice(closes.length - n - 1);
}

// ── Stock research ─────────────────────────────────────────────────────────────

async function fetchStockResearch(yahooSymbol: string): Promise<any> {
  const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
  const signal  = AbortSignal.timeout(15_000);

  const [summaryRes, chartRes] = await Promise.allSettled([
    fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=financialData,summaryDetail,defaultKeyStatistics,recommendationTrend`,
      { headers, signal }
    ),
    fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5y&interval=1mo`,
      { headers, signal }
    ),
  ]);

  // ── Parse summary modules ──
  let financialData: any = {};
  let summaryDetail: any = {};
  let keyStats: any     = {};
  let recTrend: any[]   = [];

  if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
    const d = await summaryRes.value.json();
    const r = d?.quoteSummary?.result?.[0];
    if (r) {
      financialData = r.financialData ?? {};
      summaryDetail = r.summaryDetail   ?? {};
      keyStats      = r.defaultKeyStatistics ?? {};
      recTrend      = r.recommendationTrend?.trend ?? [];
    }
  }

  // ── Parse chart / monthly closes ──
  let closes5Y: number[] = [];

  if (chartRes.status === "fulfilled" && chartRes.value.ok) {
    const d  = await chartRes.value.json();
    const result = d?.chart?.result?.[0];
    const q  = result?.indicators?.quote?.[0];
    const rawCloses: (number | null)[] = q?.close ?? [];
    closes5Y = rawCloses.filter((c): c is number => c != null && c > 0);
  }

  // ── History metrics ──
  const closes1Y = lastNMonths(closes5Y, 12);
  const closes3Y = lastNMonths(closes5Y, 36);

  const mRet5Y = monthlyReturns(closes5Y);
  const annVol = stddev(mRet5Y) * Math.sqrt(12);

  const cagr1Y = closes1Y.length >= 2 ? annualisedReturn(closes1Y, 1)   : null;
  const cagr3Y = closes3Y.length >= 2 ? annualisedReturn(closes3Y, 3)   : null;
  const cagr5Y = closes5Y.length >= 2 ? annualisedReturn(closes5Y, 5)   : null;
  const maxDD  = closes5Y.length >= 2 ? maxDrawdown(closes5Y)           : null;

  // ── Projections ──
  const baseRate = cagr5Y ?? cagr3Y ?? cagr1Y ?? 0;
  // σ in annual terms capped at 1 so extreme vols don't blow up bear
  const sigma = Math.min(annVol, 1);
  const currentPrice = (financialData.currentPrice?.raw as number | undefined)
    ?? closes5Y[closes5Y.length - 1]
    ?? 0;

  const BEAR_CAP_PER_YEAR = -0.50;
  const projections = [1, 2, 3, 5].map((years) => {
    const base = currentPrice * Math.pow(1 + baseRate, years);
    const bull = currentPrice * Math.pow(1 + baseRate + sigma, years);
    const bearRate = Math.max(baseRate - sigma, BEAR_CAP_PER_YEAR);
    const bear = currentPrice * Math.pow(1 + bearRate, years);
    return { years, bear: Math.round(bear * 100) / 100, base: Math.round(base * 100) / 100, bull: Math.round(bull * 100) / 100 };
  });

  // ── Latest recommendation (most recent trend entry) ──
  const latestRec = recTrend[0] ?? {};
  const targetMean  = financialData.targetMeanPrice?.raw  as number | undefined;
  const targetHigh  = financialData.targetHighPrice?.raw  as number | undefined;
  const targetLow   = financialData.targetLowPrice?.raw   as number | undefined;
  const numAnalysts = financialData.numberOfAnalystOpinions?.raw as number | undefined;
  const recKey      = financialData.recommendationKey    as string | undefined;
  const upsidePct   = targetMean && currentPrice > 0
    ? ((targetMean - currentPrice) / currentPrice) * 100
    : null;

  return {
    fundamentals: {
      pe:               (keyStats.trailingPE?.raw       as number | undefined) ?? (summaryDetail.trailingPE?.raw as number | undefined) ?? null,
      pb:               keyStats.priceToBook?.raw        as number | undefined ?? null,
      roe:              (financialData.returnOnEquity?.raw as number | undefined) != null
                          ? (financialData.returnOnEquity.raw as number) * 100
                          : null,
      dividendYieldPct: (summaryDetail.dividendYield?.raw as number | undefined) != null
                          ? (summaryDetail.dividendYield.raw as number) * 100
                          : null,
      marketCap:        summaryDetail.marketCap?.raw     as number | undefined ?? null,
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw as number | undefined ?? null,
      fiftyTwoWeekLow:  summaryDetail.fiftyTwoWeekLow?.raw  as number | undefined ?? null,
    },
    analyst: {
      targetMean:        targetMean        ?? null,
      targetHigh:        targetHigh        ?? null,
      targetLow:         targetLow         ?? null,
      numberOfAnalysts:  numAnalysts        ?? null,
      recommendationKey: recKey             ?? null,
      upsidePct:         upsidePct != null ? Math.round(upsidePct * 10) / 10 : null,
      strongBuy:   latestRec.strongBuy   ?? null,
      buy:         latestRec.buy         ?? null,
      hold:        latestRec.hold        ?? null,
      sell:        latestRec.sell        ?? null,
      strongSell:  latestRec.strongSell  ?? null,
    },
    history: {
      cagr1Y:             cagr1Y != null ? Math.round(cagr1Y * 10000) / 100 : null,
      cagr3Y:             cagr3Y != null ? Math.round(cagr3Y * 10000) / 100 : null,
      cagr5Y:             cagr5Y != null ? Math.round(cagr5Y * 10000) / 100 : null,
      volatilityAnnualPct: annVol  > 0   ? Math.round(annVol * 10000) / 100 : null,
      maxDrawdownPct:      maxDD   != null ? Math.round(maxDD * 10000) / 100 : null,
    },
    projections,
    currentPrice,
  };
}

// ── MF research ───────────────────────────────────────────────────────────────

async function fetchMfResearch(mfId: string, userId: string, db: ReturnType<typeof createClient>): Promise<any> {
  // Fetch fund metadata
  const { data: fund } = await db
    .from("mutual_funds")
    .select("id, name, scheme_code, category, sub_category, nav")
    .eq("id", mfId)
    .maybeSingle();

  if (!fund) return null;

  // Fetch user's transactions for this fund to compute holding-period CAGR
  const { data: txns } = await db
    .from("portfolio_transactions")
    .select("date, quantity, price, type")
    .eq("user_id", userId)
    .eq("mf_id", mfId)
    .order("date", { ascending: true });

  const currentNav = fund.nav as number | null ?? 0;

  // Compute weighted average cost and earliest BUY date for CAGR
  let totalUnits = 0;
  let totalCost  = 0;
  let earliestDate: Date | null = null;

  for (const tx of txns ?? []) {
    const isBuy = ["SIP", "LUMPSUM", "BUY"].includes(tx.type);
    const isSell = ["REDEEM", "SELL"].includes(tx.type);
    if (isBuy) {
      totalUnits += tx.quantity;
      totalCost  += tx.quantity * tx.price;
      const d = new Date(tx.date);
      if (!earliestDate || d < earliestDate) earliestDate = d;
    } else if (isSell) {
      totalUnits -= tx.quantity;
    }
  }

  const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
  const currentValue = totalUnits * currentNav;
  const invested = totalUnits * avgCost;
  const pnl = currentValue - invested;

  // Holding period in years (minimum 1/12 to avoid division issues)
  const holdingYears = earliestDate
    ? Math.max((Date.now() - earliestDate.getTime()) / (365.25 * 24 * 3600 * 1000), 1 / 12)
    : 1;

  const holdingCagr = avgCost > 0 && currentNav > 0
    ? Math.pow(currentNav / avgCost, 1 / holdingYears) - 1
    : null;

  // Fetch NAV history from mfapi.in for CAGR validation
  let cagr1Y: number | null = null;
  let cagr3Y: number | null = null;
  let cagr5Y: number | null = null;

  if (fund.scheme_code) {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${fund.scheme_code}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const d = await res.json();
        const navs: number[] = (d?.data ?? [])
          .map((x: any) => parseFloat(x.nav))
          .filter((n: number) => Number.isFinite(n) && n > 0)
          .reverse(); // oldest first

        if (navs.length >= 2) {
          const c1 = lastNMonths(navs, 12);
          const c3 = lastNMonths(navs, 36);
          const c5 = lastNMonths(navs, 60);
          cagr1Y = c1.length >= 2 ? annualisedReturn(c1, Math.min(1, c1.length / 12))  : null;
          cagr3Y = c3.length >= 2 ? annualisedReturn(c3, Math.min(3, c3.length / 12))  : null;
          cagr5Y = c5.length >= 2 ? annualisedReturn(c5, Math.min(5, c5.length / 12))  : null;
        }
      }
    } catch { /* optional */ }
  }

  // Projections: use history CAGR if available, else holding-period CAGR
  const baseRate = cagr5Y ?? cagr3Y ?? cagr1Y ?? holdingCagr ?? 0;
  const BAND = 0.04; // ±4% band for MFs
  const navBase = currentNav > 0 ? currentNav : avgCost;

  const projections = [1, 2, 3, 5].map((years) => {
    const base = navBase * Math.pow(1 + baseRate, years);
    const bull = navBase * Math.pow(1 + baseRate + BAND, years);
    const bear = navBase * Math.pow(1 + Math.max(baseRate - BAND, -0.30), years);
    return { years, bear: Math.round(bear * 100) / 100, base: Math.round(base * 100) / 100, bull: Math.round(bull * 100) / 100 };
  });

  return {
    fundamentals: {
      category:    fund.category    ?? null,
      subCategory: fund.sub_category ?? null,
      currentNav,
      avgCostNav: avgCost > 0 ? Math.round(avgCost * 100) / 100 : null,
      units: Math.round(totalUnits * 1000) / 1000,
      invested: Math.round(invested * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      holdingYears: Math.round(holdingYears * 10) / 10,
    },
    analyst: null,
    history: {
      cagr1Y: cagr1Y != null ? Math.round(cagr1Y * 10000) / 100 : null,
      cagr3Y: cagr3Y != null ? Math.round(cagr3Y * 10000) / 100 : null,
      cagr5Y: cagr5Y != null ? Math.round(cagr5Y * 10000) / 100 : null,
      holdingCagrPct: holdingCagr != null ? Math.round(holdingCagr * 10000) / 100 : null,
      volatilityAnnualPct: null,
      maxDrawdownPct: null,
    },
    projections,
    currentPrice: currentNav,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const url  = new URL(req.url);
    const type = url.searchParams.get("type"); // "stock" | "mf"
    const id   = url.searchParams.get("id");   // instrument uuid

    if (!type || !["stock", "mf"].includes(type)) return json({ error: "type must be stock or mf" }, 400);
    if (!id || !/^[0-9a-f-]{36}$/.test(id))       return json({ error: "Invalid id" }, 400);

    // Authenticate user from JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Use anon client with the user's JWT to validate auth
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const db = createClient(supabaseUrl, serviceKey);

    if (type === "stock") {
      // Look up yahoo_symbol for the stock uuid
      const { data: stock } = await db
        .from("stocks")
        .select("yahoo_symbol, symbol, name")
        .eq("id", id)
        .maybeSingle();
      if (!stock) return json({ error: "Stock not found" }, 404);
      const result = await fetchStockResearch(stock.yahoo_symbol ?? stock.symbol);
      return json({ type: "stock", name: stock.name, symbol: stock.symbol, ...result });
    } else {
      const result = await fetchMfResearch(id, user.id, db);
      if (!result) return json({ error: "Fund not found" }, 404);
      const { data: fund } = await db.from("mutual_funds").select("name").eq("id", id).maybeSingle();
      return json({ type: "mf", name: fund?.name ?? "", ...result });
    }
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected error" }, 500);
  }
});
