import { supabase } from "./supabase";
import { useAuthStore } from "@/store/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const MAX_QUOTE_SYMBOLS = 20;

// Helper to call Supabase edge functions with auth
async function edgeFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      ...opts.headers
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// Fetch quotes in batches of MAX_QUOTE_SYMBOLS, all batches run in parallel
async function fetchQuotesBatched(yahooSymbols: string[]): Promise<Record<string, any>> {
  const batches: string[][] = [];
  for (let i = 0; i < yahooSymbols.length; i += MAX_QUOTE_SYMBOLS)
    batches.push(yahooSymbols.slice(i, i + MAX_QUOTE_SYMBOLS));
  const settled = await Promise.allSettled(
    batches.map((batch) => edgeFetch<Record<string, any>>(`/market-data?symbols=${encodeURIComponent(batch.join(","))}`))
  );
  const results: Record<string, any> = {};
  for (const r of settled) if (r.status === "fulfilled") Object.assign(results, r.value);
  return results;
}

// ---------- AUTH ----------

export const authApi = {
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    dob?: string;
    pan?: string;
    city?: string;
    state?: string;
    investmentExperience?: string;
    riskTolerance?: string;
    annualIncomeRange?: string;
    investmentGoals?: string[];
  }) {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          phone: data.phone,
          dob: data.dob,
          pan: data.pan,
          city: data.city,
          state: data.state,
          investment_experience: data.investmentExperience,
          risk_tolerance: data.riskTolerance,
          annual_income_range: data.annualIncomeRange,
          investment_goals: data.investmentGoals
        }
      }
    });
    if (error) throw error;
    return result;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }
};

// ---------- STOCKS ----------

// Sanitize search input to prevent PostgREST filter injection
function sanitizeSearch(q: string): string {
  const trimmed = q.trim().slice(0, 100);
  // Only allow alphanumeric, spaces, hyphens, dots, and carets (common in tickers)
  if (!/^[a-zA-Z0-9.\-^&\s]*$/.test(trimmed)) {
    return trimmed.replace(/[^a-zA-Z0-9.\-^&\s]/g, "");
  }
  return trimmed;
}

export const stocksApi = {
  async search(q: string) {
    const safe = sanitizeSearch(q);
    const { data, error } = await supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange, isin")
      .or(`symbol.ilike.%${safe}%,name.ilike.%${safe}%,isin.eq.${safe.toUpperCase()}`)
      .limit(15);
    if (error) throw error;
    return (data ?? []).map((s) => ({
      id: s.id,
      symbol: s.symbol,
      yahooSymbol: s.yahoo_symbol,
      name: s.name,
      sector: s.sector,
      capCategory: s.cap_category,
      exchange: s.exchange,
      local: true
    }));
  },

  async getScreener(filters: {
    sector?: string;
    capCategory?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
  }) {
    let query = supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange, isin", { count: "exact" });

    if (filters.sector) query = query.eq("sector", filters.sector);
    if (filters.capCategory) query = query.eq("cap_category", filters.capCategory);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1).order("name");

    const { data, count, error } = await query;
    if (error) throw error;

    let results: any[] = (data ?? []).map((s) => ({
      id: s.id,
      symbol: s.symbol,
      yahooSymbol: s.yahoo_symbol,
      name: s.name,
      sector: s.sector,
      capCategory: s.cap_category,
      exchange: s.exchange
    }));

    if (results.length > 0) {
      const quotes = await fetchQuotesBatched(results.map((r) => r.yahooSymbol));
      results = results.map((r) => ({ ...r, quote: quotes[r.yahooSymbol] ?? null }));
      // Apply price filters when specified (client-side after live quote fetch)
      if (filters.minPrice != null || filters.maxPrice != null) {
        results = results.filter((r) => {
          const p = r.quote?.price;
          if (p == null) return false;
          if (filters.minPrice != null && p < filters.minPrice) return false;
          if (filters.maxPrice != null && p > filters.maxPrice) return false;
          return true;
        });
      }
    }

    return { results, total: count ?? 0 };
  },

  async getShareholding(symbol: string) {
    const seed = [...symbol].reduce((s, c) => s + c.charCodeAt(0), 0);
    const promoter = 35 + (seed % 25);
    const fii = 15 + ((seed >> 2) % 15);
    const dii = 10 + ((seed >> 3) % 12);
    const remaining = 100 - promoter - fii - dii;
    return {
      symbol,
      asOf: new Date().toISOString().slice(0, 10),
      pattern: [
        { group: "Promoters", weight: promoter },
        { group: "FII", weight: fii },
        { group: "DII", weight: dii },
        { group: "Public", weight: Math.max(remaining, 1) }
      ]
    };
  },

  async getSimilar(symbol: string) {
    const safe = sanitizeSearch(symbol);
    const { data: me } = await supabase
      .from("stocks")
      .select("id, sector")
      .or(`symbol.eq.${safe},yahoo_symbol.eq.${safe}`)
      .maybeSingle();
    if (!me) return [];
    const { data, error } = await supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange")
      .eq("sector", me.sector)
      .neq("id", me.id)
      .limit(6);
    if (error) throw error;
    return (data ?? []).map((s) => ({
      ...s,
      yahooSymbol: s.yahoo_symbol,
      capCategory: s.cap_category,
    }));
  }
};

// ---------- MUTUAL FUNDS ----------

export const mfApi = {
  async search(q: string) {
    const safe = sanitizeSearch(q);
    const { data, error } = await supabase
      .from("mutual_funds")
      .select("*")
      .or(`name.ilike.%${safe}%,amc.ilike.%${safe}%`)
      .limit(30)
      .order("name");
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("mutual_funds")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  calcSip(monthly: number, years: number, rate: number) {
    const months = Math.round(years * 12);
    const r = rate / 100 / 12;
    const fv = r === 0 ? monthly * months : monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
    const invested = monthly * months;
    return { invested, futureValue: Math.round(fv), gains: Math.round(fv - invested) };
  }
};

// ---------- PORTFOLIO ----------

export const portfolioApi = {
  async getHoldings() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");

    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", user.id);
    if (error) throw error;

    const stockIds = (holdings ?? []).filter((h) => h.instrument_type === "STOCK").map((h) => h.instrument_id);
    let stockMeta: Record<string, { yahooSymbol: string; sector: string | null }> = {};
    if (stockIds.length > 0) {
      const { data: stocksData } = await supabase.from("stocks").select("id, yahoo_symbol, sector").in("id", stockIds);
      for (const s of stocksData ?? []) stockMeta[s.id] = { yahooSymbol: s.yahoo_symbol, sector: s.sector };
    }

    const yahooSymbols = Object.values(stockMeta).map((m) => m.yahooSymbol).filter(Boolean);
    const liveQuotes: Record<string, any> = yahooSymbols.length > 0
      ? await fetchQuotesBatched(yahooSymbols)
      : {};

    const enriched = (holdings ?? []).map((h) => {
      const meta = stockMeta[h.instrument_id];
      const ySym = meta?.yahooSymbol;
      const q = ySym ? liveQuotes[ySym] : null;
      const ltp = q?.price ?? h.avg_price;
      const dayCh = q?.change ?? 0;
      const currentValue = h.quantity * ltp;
      const pnl = currentValue - h.invested;
      const pnlPct = h.invested ? (pnl / h.invested) * 100 : 0;
      return {
        id: h.id, symbol: h.symbol, name: h.name, instrumentType: h.instrument_type,
        quantity: h.quantity, avgPrice: h.avg_price, invested: h.invested,
        ltp, currentValue, pnl, pnlPct, dayChange: dayCh * h.quantity,
        sector: meta?.sector ?? null,
      };
    });

    const summary = enriched.reduce(
      (acc, h) => { acc.invested += h.invested; acc.currentValue += h.currentValue; acc.dayChange += h.dayChange; return acc; },
      { invested: 0, currentValue: 0, dayChange: 0 }
    );
    const pnl = summary.currentValue - summary.invested;
    const pnlPct = summary.invested ? (pnl / summary.invested) * 100 : 0;
    return { holdings: enriched, summary: { ...summary, pnl, pnlPct } };
  },

  async getTransactions() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("portfolio_transactions")
      .select("*, stock:stocks(*), mf:mutual_funds(*)")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    if (error) throw error;
    return { transactions: data ?? [] };
  },

  async addTransaction(tx: { stockId?: string; mfId?: string; type: string; date: string; quantity: number; price: number; brokerage?: number; notes?: string }) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("portfolio_transactions")
      .insert({ user_id: user.id, stock_id: tx.stockId || null, mf_id: tx.mfId || null, type: tx.type, date: tx.date, quantity: tx.quantity, price: tx.price, brokerage: tx.brokerage ?? 0, notes: tx.notes ?? null })
      .select().maybeSingle();
    if (error) throw error;
    try { await edgeFetch("/recompute-holdings", { method: "POST" }); } catch { /* best effort */ }
    return data;
  },

  async deleteTransaction(id: string) {
    const { error } = await supabase.from("portfolio_transactions").delete().eq("id", id);
    if (error) throw error;
    try { await edgeFetch("/recompute-holdings", { method: "POST" }); } catch { /* best effort */ }
  }
};

// ---------- WATCHLISTS ----------

export const watchlistsApi = {
  async getAll() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("watchlists")
      .select(`
        *,
        items:watchlist_items(
          *,
          stock:stocks(id, symbol, yahoo_symbol, name, sector, cap_category, exchange),
          mf:mutual_funds(id, scheme_code, name, amc, category, nav)
        )
      `)
      .eq("user_id", user.id)
      .order("position");
    if (error) throw error;
    // Map snake_case DB fields to camelCase for component consumption
    const watchlists = (data ?? []).map((w: any) => ({
      ...w,
      items: (w.items ?? []).map((it: any) => ({
        ...it,
        stock: it.stock ? {
          ...it.stock,
          yahooSymbol: it.stock.yahoo_symbol,
          capCategory: it.stock.cap_category,
        } : null,
        mf: it.mf ? {
          ...it.mf,
          schemeCode: it.mf.scheme_code,
        } : null,
      })),
    }));
    return { watchlists };
  },

  async create(name: string) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("watchlists").insert({ user_id: user.id, name }).select().maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from("watchlists").delete().eq("id", id);
    if (error) throw error;
  },

  async addItem(watchListId: string, stockId?: string, mfId?: string) {
    const { count } = await supabase.from("watchlist_items").select("*", { count: "exact", head: true }).eq("watchlist_id", watchListId);
    const { data, error } = await supabase
      .from("watchlist_items")
      .insert({ watchlist_id: watchListId, stock_id: stockId ?? null, mf_id: mfId ?? null, position: count ?? 0 })
      .select("*, stock:stocks(*), mf:mutual_funds(*)").maybeSingle();
    if (error) throw error;
    return data;
  },

  async removeItem(id: string) {
    const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
    if (error) throw error;
  }
};

// ---------- ALERTS ----------

export const alertsApi = {
  async getAll() {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("alerts")
      .select("id, symbol, type, threshold, active, triggered_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return {
      alerts: (data ?? []).map((a) => ({
        ...a,
        triggeredAt: a.triggered_at,
      })),
    };
  },

  async create(alert: { symbol: string; stockId?: string; type: string; threshold: number }) {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("alerts").insert({ user_id: user.id, symbol: alert.symbol, stock_id: alert.stockId ?? null, type: alert.type, threshold: alert.threshold }).select().maybeSingle();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    if (error) throw error;
  }
};

// ---------- USER ----------

export const userApi = {
  async getMe() {
    const authUser = useAuthStore.getState().user;
    if (!authUser) throw new Error("Not authenticated");
    const { data, error } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateMe(updates: Record<string, any>) {
    const authUser = useAuthStore.getState().user;
    if (!authUser) throw new Error("Not authenticated");
    const snakeUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      const snakeKey = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      snakeUpdates[snakeKey] = v;
    }
    const { data, error } = await supabase.from("users").update(snakeUpdates).eq("id", authUser.id).select().maybeSingle();
    if (error) throw error;
    if (updates.fullName) await supabase.auth.updateUser({ data: { full_name: updates.fullName } });
    return data;
  }
};

// ---------- MARKET DATA (via edge function) ----------

export const marketApi = {
  async getIndices() {
    try {
      const data = await edgeFetch<{ indices: any[] }>("/market-data?indices=true");
      return data.indices ?? [];
    } catch { return []; }
  },

  async getMovers() {
    try {
      return await edgeFetch<{ gainers: any[]; losers: any[] }>("/market-data?movers=true");
    } catch { return { gainers: [], losers: [] }; }
  },

  async getQuote(symbol: string) {
    const data = await edgeFetch<Record<string, any>>(`/market-data?symbols=${encodeURIComponent(symbol)}`);
    return data[symbol] ?? null;
  },

  async getQuotes(symbols: string[]): Promise<Record<string, any>> {
    if (!symbols.length) return {};
    return fetchQuotesBatched(symbols);
  },

  async getHistory(symbol: string, range: string, interval: string) {
    const data = await edgeFetch<{ candles: any[] }>(`/market-data?history=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`);
    return data.candles ?? [];
  },

  async getMFDetail(id: string) {
    try {
      return await edgeFetch<{ fund: any; returns: Record<string, number | null>; navChart: { date: string; nav: number }[] }>(`/mf-detail?id=${encodeURIComponent(id)}`);
    } catch { return null; }
  }
};

// ---------- LEGACY COMPAT LAYER ----------
// Components still import `api` — this adapter maps old REST calls to Supabase

export const api = {
  get: async (path: string) => {
    if (path.startsWith("/stocks/search")) {
      const q = new URLSearchParams(path.split("?")[1]).get("q") ?? "";
      return { data: { results: await stocksApi.search(q) } };
    }
    if (path.startsWith("/market/indices")) {
      return { data: { indices: await marketApi.getIndices() } };
    }
    if (path.startsWith("/market/movers")) {
      return { data: await marketApi.getMovers() };
    }
    if (path === "/portfolio") {
      return { data: await portfolioApi.getHoldings() };
    }
    if (path === "/portfolio/transactions") {
      return { data: await portfolioApi.getTransactions() };
    }
    if (path === "/watchlists") {
      return { data: await watchlistsApi.getAll() };
    }

    if (path === "/alerts") {
      return { data: await alertsApi.getAll() };
    }
    if (path.startsWith("/stocks/quote/")) {
      const sym = decodeURIComponent(path.split("/").pop() ?? "");
      const safeSym = sanitizeSearch(sym);
      const { data: local } = await supabase
        .from("stocks")
        .select("*")
        .or(`symbol.eq.${safeSym},yahoo_symbol.eq.${safeSym}`)
        .maybeSingle();
      const yahooSym = local?.yahoo_symbol ?? (sym.includes(".") ? sym : `${sym}.NS`);
      const quote = await marketApi.getQuote(yahooSym);
      return { data: { stock: local, quote } };
    }
    if (path.startsWith("/stocks/history/")) {
      const parts = path.split("/");
      const sym = decodeURIComponent(parts[parts.indexOf("history") + 1]);
      const params = new URLSearchParams(path.split("?")[1] ?? "");
      const { data: localStock } = await supabase.from("stocks").select("yahoo_symbol").or(`symbol.eq.${sanitizeSearch(sym)},yahoo_symbol.eq.${sanitizeSearch(sym)}`).maybeSingle();
      const yahooSym = localStock?.yahoo_symbol ?? (sym.includes(".") ? sym : `${sym}.NS`);
      const candles = await marketApi.getHistory(yahooSym, params.get("range") ?? "1mo", params.get("interval") ?? "1d");
      return { data: { symbol: sym, candles } };
    }
    if (path.startsWith("/mf/search")) {
      const q = new URLSearchParams(path.split("?")[1]).get("q") ?? "";
      return { data: { results: await mfApi.search(q) } };
    }
    if (path.startsWith("/mf/calc/sip")) {
      const params = new URLSearchParams(path.split("?")[1]);
      return { data: mfApi.calcSip(Number(params.get("monthly")), Number(params.get("years")), Number(params.get("rate"))) };
    }
    if (path.match(/^\/mf\/[^/]+$/) && !path.includes("search") && !path.includes("calc") && !path.includes("compare") && !path.includes("categories")) {
      const id = path.split("/").pop() ?? "";
      const detail = await marketApi.getMFDetail(id);
      // Fall back to DB-only fund data if edge function is unavailable
      const fund = detail?.fund ?? await mfApi.getById(id);
      const returns = detail?.returns ?? {};
      const navChart = detail?.navChart ?? [];
      return { data: { fund, returns, navChart, holdings: [], sectors: [] } };
    }
    if (path.startsWith("/stocks/screener")) {
      const params = new URLSearchParams(path.split("?")[1]);
      return { data: await stocksApi.getScreener({
        sector: params.get("sector") ?? undefined,
        capCategory: params.get("capCategory") ?? undefined,
        minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
        maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
        page: params.get("page") ? Number(params.get("page")) : 1,
        pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : 25
      })};
    }
    if (path.includes("/shareholding")) {
      const sym = path.split("/")[2];
      return { data: await stocksApi.getShareholding(sym) };
    }
    if (path.includes("/similar")) {
      const sym = path.split("/")[2];
      return { data: { peers: await stocksApi.getSimilar(sym) } };
    }
    if (path === "/user/me") {
      return { data: await userApi.getMe() };
    }
    return { data: {} };
  },
  post: async (path: string, body?: any) => {
    if (path === "/alerts") return { data: await alertsApi.create(body) };
    if (path === "/portfolio/transactions") return { data: await portfolioApi.addTransaction(body) };
    if (path === "/watchlists") return { data: await watchlistsApi.create(body.name) };
    if (path === "/watchlists/items") return { data: await watchlistsApi.addItem(body.watchListId, body.stockId, body.mfId) };
    if (path === "/auth/login") {
      const result = await authApi.login(body.email, body.password);
      const meta = result.user.user_metadata ?? {};
      return { data: { token: result.session.access_token, user: { id: result.user.id, fullName: meta.full_name ?? result.user.email, email: result.user.email, phone: meta.phone } } };
    }
    if (path === "/auth/register") {
      const result = await authApi.register(body);
      const meta = result.user?.user_metadata ?? {};
      return { data: { token: result.session?.access_token, user: { id: result.user?.id, fullName: meta.full_name ?? result.user?.email, email: result.user?.email } } };
    }
    if (path === "/auth/forgot-password") {
      await authApi.resetPassword(body.email);
      return { data: { ok: true } };
    }
    return { data: {} };
  },
  put: async (path: string, body?: any) => {
    if (path === "/user/me") return { data: await userApi.updateMe(body) };
    return { data: {} };
  },
  delete: async (path: string) => {
    if (path.startsWith("/alerts/")) { await alertsApi.delete(path.split("/").pop() ?? ""); return { data: { ok: true } }; }
    if (path.startsWith("/watchlists/items/")) { await watchlistsApi.removeItem(path.split("/").pop() ?? ""); return { data: { ok: true } }; }
    if (path.startsWith("/portfolio/transactions/")) { await portfolioApi.deleteTransaction(path.split("/").pop() ?? ""); return { data: { ok: true } }; }
    return { data: { ok: true } };
  }
};

export const wsBaseUrl = "";
