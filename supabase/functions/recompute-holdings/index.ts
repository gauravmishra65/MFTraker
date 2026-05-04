import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUY_TYPES = ["BUY", "SIP", "LUMPSUM"];
const SELL_TYPES = ["SELL", "REDEEM"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Fetch all transactions for the user
    const { data: txs, error: txError } = await supabase
      .from("portfolio_transactions")
      .select("*, stock:stocks(id, symbol, yahoo_symbol, name), mf:mutual_funds(id, scheme_code, name)")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (txError) throw txError;

    // Accumulate holdings
    const acc = new Map<string, {
      instrumentType: string;
      instrumentId: string;
      symbol: string;
      name: string;
      quantity: number;
      invested: number;
      avgPrice: number;
    }>();

    for (const t of txs ?? []) {
      const isStock = !!t.stock_id;
      const id = t.stock_id ?? t.mf_id;
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
        avgPrice: 0,
      };

      if (BUY_TYPES.includes(t.type)) {
        const cost = t.quantity * t.price + (t.brokerage ?? 0);
        existing.quantity += t.quantity;
        existing.invested += cost;
        existing.avgPrice = existing.quantity > 0 ? existing.invested / existing.quantity : 0;
      } else if (SELL_TYPES.includes(t.type)) {
        const sellQty = Math.min(t.quantity, existing.quantity);
        const fraction = existing.quantity ? sellQty / existing.quantity : 0;
        existing.invested -= existing.invested * fraction;
        existing.quantity -= sellQty;
      }

      acc.set(key, existing);
    }

    const rows = [...acc.values()].filter((h) => h.quantity > 1e-9);

    // Delete existing holdings and insert new ones
    const { error: deleteError } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const inserts = rows.map((h) => ({
        user_id: userId,
        instrument_type: h.instrumentType,
        instrument_id: h.instrumentId,
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        avg_price: h.avgPrice,
        invested: h.invested,
      }));

      const { error: insertError } = await supabase
        .from("portfolio_holdings")
        .insert(inserts);

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ ok: true, holdings: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
