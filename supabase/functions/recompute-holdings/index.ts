import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
  };
}

const BUY_TYPES = new Set(["BUY", "SIP", "LUMPSUM"]);
const SELL_TYPES = new Set(["SELL", "REDEEM"]);
const VALID_TYPES = new Set([...BUY_TYPES, ...SELL_TYPES]);

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
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

  if (req.method !== "POST") {
    return jsonRes(req, { error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseKey) {
      return jsonRes(req, { error: "Server configuration error" }, 500);
    }

    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes(req, { error: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token || token.length < 10) {
      return jsonRes(req, { error: "Invalid token" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return jsonRes(req, { error: "Unauthorized" }, 401);
    }

    const userId = user.id;

    if (!checkRateLimit(userId)) {
      return jsonRes(req, { error: "Rate limit exceeded. Try again in a minute." }, 429, { "Retry-After": "60" });
    }

    // Fetch all transactions for the user
    const { data: txs, error: txError } = await supabaseClient
      .from("portfolio_transactions")
      .select("id, stock_id, mf_id, type, date, quantity, price, brokerage, stock:stocks(id, symbol, yahoo_symbol, name), mf:mutual_funds(id, scheme_code, name)")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (txError) {
      return jsonRes(req, { error: "Failed to fetch transactions" }, 500);
    }

    // Validate and accumulate holdings
    const acc = new Map<string, {
      instrumentType: string;
      instrumentId: string;
      symbol: string;
      name: string;
      quantity: number;
      invested: number;
    }>();

    for (const t of txs ?? []) {
      if (!VALID_TYPES.has(t.type)) continue;

      const qty = Number(t.quantity);
      const price = Number(t.price);
      const brokerage = Number(t.brokerage ?? 0);
      if (!Number.isFinite(qty) || !Number.isFinite(price) || !Number.isFinite(brokerage)) continue;
      if (qty <= 0 || price < 0 || brokerage < 0) continue;

      const isStock = !!t.stock_id;
      const id = isStock ? t.stock_id : t.mf_id;
      if (!id) continue;

      const key = `${isStock ? "STOCK" : "MF"}:${id}`;
      const sym = isStock ? (t.stock?.symbol ?? "") : (t.mf?.scheme_code ?? "");
      const name = isStock ? (t.stock?.name ?? "") : (t.mf?.name ?? "");

      const existing = acc.get(key) ?? {
        instrumentType: isStock ? "STOCK" : "MF",
        instrumentId: id,
        symbol: sym,
        name,
        quantity: 0,
        invested: 0,
      };

      if (BUY_TYPES.has(t.type)) {
        const cost = qty * price + brokerage;
        existing.quantity += qty;
        existing.invested += cost;
      } else if (SELL_TYPES.has(t.type)) {
        const sellQty = Math.min(qty, existing.quantity);
        if (existing.quantity > 0) {
          const fraction = sellQty / existing.quantity;
          existing.invested -= existing.invested * fraction;
        }
        existing.quantity -= sellQty;
      }

      acc.set(key, existing);
    }

    const rows = [...acc.values()].filter((h) => h.quantity > 1e-9);

    // Use atomic upsert approach: insert new rows first, then delete stale ones
    // This avoids the race condition where delete succeeds but insert fails
    const inserts = rows.map((h) => ({
      user_id: userId,
      instrument_type: h.instrumentType,
      instrument_id: h.instrumentId,
      symbol: h.symbol,
      name: h.name,
      quantity: Math.round(h.quantity * 1e8) / 1e8,
      avg_price: h.quantity > 0 ? Math.round((h.invested / h.quantity) * 100) / 100 : 0,
      invested: Math.round(h.invested * 100) / 100,
    }));

    // Step 1: Upsert all computed holdings (insert new, update existing)
    if (inserts.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from("portfolio_holdings")
        .upsert(inserts, {
          onConflict: "user_id,instrument_type,instrument_id",
        });

      if (upsertError) {
        return jsonRes(req, { error: "Failed to save holdings" }, 500);
      }
    }

    // Step 2: Delete stale holdings that are no longer in the computed set
    const currentInstrumentIds = new Set(rows.map((r) => `${r.instrumentType}:${r.instrumentId}`));

    const { data: existingHoldings } = await supabaseClient
      .from("portfolio_holdings")
      .select("id, instrument_type, instrument_id")
      .eq("user_id", userId);

    const staleIds = (existingHoldings ?? [])
      .filter((h) => !currentInstrumentIds.has(`${h.instrument_type}:${h.instrument_id}`))
      .map((h) => h.id);

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabaseClient
        .from("portfolio_holdings")
        .delete()
        .in("id", staleIds);

      if (deleteError) {
        return jsonRes(req, { error: "Failed to clean up stale holdings" }, 500);
      }
    }

    // Step 3: If no holdings at all, delete everything for this user
    if (rows.length === 0) {
      const { error: deleteError } = await supabaseClient
        .from("portfolio_holdings")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        return jsonRes(req, { error: "Failed to clear holdings" }, 500);
      }
    }

    return jsonRes(req, { ok: true, holdings: rows.length });
  } catch {
    return jsonRes(req, { error: "An unexpected error occurred" }, 500);
  }
});
