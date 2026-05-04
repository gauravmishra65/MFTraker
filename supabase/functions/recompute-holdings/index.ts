import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a client with the user's token to verify auth
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Rate limit per user
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Fetch all transactions for the user
    const { data: txs, error: txError } = await supabaseClient
      .from("portfolio_transactions")
      .select("id, stock_id, mf_id, type, date, quantity, price, brokerage, stock:stocks(id, symbol, yahoo_symbol, name), mf:mutual_funds(id, scheme_code, name)")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (txError) {
      return new Response(JSON.stringify({ error: "Failed to fetch transactions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      // Validate transaction type
      if (!VALID_TYPES.has(t.type)) continue;

      // Validate numeric fields
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

    // Delete existing holdings and insert new ones (within a logical operation)
    const { error: deleteError } = await supabaseClient
      .from("portfolio_holdings")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "Failed to update holdings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rows.length > 0) {
      const inserts = rows.map((h) => ({
        user_id: userId,
        instrument_type: h.instrumentType,
        instrument_id: h.instrumentId,
        symbol: h.symbol,
        name: h.name,
        quantity: Math.round(h.quantity * 1e8) / 1e8, // Avoid floating point drift
        avg_price: h.quantity > 0 ? Math.round((h.invested / h.quantity) * 100) / 100 : 0,
        invested: Math.round(h.invested * 100) / 100,
      }));

      const { error: insertError } = await supabaseClient
        .from("portfolio_holdings")
        .insert(inserts);

      if (insertError) {
        return new Response(JSON.stringify({ error: "Failed to save holdings" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, holdings: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
