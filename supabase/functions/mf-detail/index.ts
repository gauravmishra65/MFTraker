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

// Compute point-in-time return from a sorted NAV series (oldest first)
function returnAt(navs: { date: string; nav: number }[], daysBack: number): number | null {
  if (navs.length < 2) return null;
  const latest = navs[navs.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - daysBack);
  // Find the closest NAV on or before the cutoff
  let past: { date: string; nav: number } | null = null;
  for (let i = navs.length - 2; i >= 0; i--) {
    if (new Date(navs[i].date) <= cutoff) { past = navs[i]; break; }
  }
  if (!past || past.nav <= 0) return null;
  return ((latest.nav - past.nav) / past.nav) * 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Invalid fund id" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const db = createClient(supabaseUrl, supabaseKey);

    // Fetch fund metadata from DB
    const { data: fund, error: dbErr } = await db
      .from("mutual_funds")
      .select("id,name,amc,category,sub_category,risk_level,expense_ratio,aum,min_sip,min_lumpsum,benchmark,fund_manager,inception_date,nav,scheme_code")
      .eq("id", id)
      .maybeSingle();

    if (dbErr || !fund) return json({ error: "Fund not found" }, 404);

    // Fetch real NAV history from MFAPI.in (free, no auth)
    let navHistory: { date: string; nav: number }[] = [];
    let returns: Record<string, number | null> = {};

    if (fund.scheme_code) {
      try {
        const res = await fetch(
          `https://api.mfapi.in/mf/${fund.scheme_code}`,
          { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (res.ok) {
          const mfData = await res.json();
          const raw: { date: string; nav: string }[] = mfData?.data ?? [];
          // MFAPI returns newest-first, reverse to oldest-first
          navHistory = raw
            .map((d) => ({ date: d.date, nav: parseFloat(d.nav) }))
            .filter((d) => Number.isFinite(d.nav) && d.nav > 0)
            .reverse();

          if (navHistory.length > 0) {
            returns = {
              "1M":  returnAt(navHistory, 30),
              "3M":  returnAt(navHistory, 91),
              "6M":  returnAt(navHistory, 182),
              "1Y":  returnAt(navHistory, 365),
              "3Y":  returnAt(navHistory, 3 * 365),
              "5Y":  returnAt(navHistory, 5 * 365),
              "SI":  returnAt(navHistory, Math.floor((Date.now() - new Date(navHistory[0].date).getTime()) / 86400000)),
            };
          }
        }
      } catch { /* NAV history optional */ }
    }

    // Build a light NAV chart series (last 1 year, weekly sampled to keep payload small)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const navChart = navHistory
      .filter((d) => new Date(d.date) >= oneYearAgo)
      .filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % 5 === 0); // ~weekly

    return json({ fund, returns, navChart });
  } catch {
    return json({ error: "Unexpected error" }, 500);
  }
});
