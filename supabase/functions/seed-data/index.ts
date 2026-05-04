import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STOCKS = [
  { symbol: "RELIANCE",   yahoo_symbol: "RELIANCE.NS",   name: "Reliance Industries Ltd",         sector: "Energy",       cap_category: "LARGE", isin: "INE002A01018", exchange: "NSE" },
  { symbol: "TCS",        yahoo_symbol: "TCS.NS",        name: "Tata Consultancy Services Ltd",   sector: "IT",           cap_category: "LARGE", isin: "INE467B01029", exchange: "NSE" },
  { symbol: "HDFCBANK",   yahoo_symbol: "HDFCBANK.NS",   name: "HDFC Bank Ltd",                   sector: "Financials",   cap_category: "LARGE", isin: "INE040A01034", exchange: "NSE" },
  { symbol: "INFY",       yahoo_symbol: "INFY.NS",       name: "Infosys Ltd",                     sector: "IT",           cap_category: "LARGE", isin: "INE009A01021", exchange: "NSE" },
  { symbol: "ICICIBANK",  yahoo_symbol: "ICICIBANK.NS",  name: "ICICI Bank Ltd",                  sector: "Financials",   cap_category: "LARGE", isin: "INE090A01021", exchange: "NSE" },
  { symbol: "HINDUNILVR", yahoo_symbol: "HINDUNILVR.NS", name: "Hindustan Unilever Ltd",          sector: "FMCG",         cap_category: "LARGE", isin: "INE030A01027", exchange: "NSE" },
  { symbol: "BHARTIARTL", yahoo_symbol: "BHARTIARTL.NS", name: "Bharti Airtel Ltd",               sector: "Telecom",      cap_category: "LARGE", isin: "INE397D01024", exchange: "NSE" },
  { symbol: "ITC",        yahoo_symbol: "ITC.NS",        name: "ITC Ltd",                         sector: "FMCG",         cap_category: "LARGE", isin: "INE154A01025", exchange: "NSE" },
  { symbol: "SBIN",       yahoo_symbol: "SBIN.NS",       name: "State Bank of India",             sector: "Financials",   cap_category: "LARGE", isin: "INE062A01020", exchange: "NSE" },
  { symbol: "LT",         yahoo_symbol: "LT.NS",         name: "Larsen & Toubro Ltd",             sector: "Construction", cap_category: "LARGE", isin: "INE018A01030", exchange: "NSE" },
  { symbol: "KOTAKBANK",  yahoo_symbol: "KOTAKBANK.NS",  name: "Kotak Mahindra Bank Ltd",         sector: "Financials",   cap_category: "LARGE", isin: "INE237A01028", exchange: "NSE" },
  { symbol: "AXISBANK",   yahoo_symbol: "AXISBANK.NS",   name: "Axis Bank Ltd",                   sector: "Financials",   cap_category: "LARGE", isin: "INE238A01034", exchange: "NSE" },
  { symbol: "MARUTI",     yahoo_symbol: "MARUTI.NS",     name: "Maruti Suzuki India Ltd",         sector: "Auto",         cap_category: "LARGE", isin: "INE585B01010", exchange: "NSE" },
  { symbol: "TATAMOTORS", yahoo_symbol: "TATAMOTORS.NS", name: "Tata Motors Ltd",                 sector: "Auto",         cap_category: "LARGE", isin: "INE155A01022", exchange: "NSE" },
  { symbol: "WIPRO",      yahoo_symbol: "WIPRO.NS",      name: "Wipro Ltd",                       sector: "IT",           cap_category: "LARGE", isin: "INE075A01022", exchange: "NSE" },
  { symbol: "ASIANPAINT", yahoo_symbol: "ASIANPAINT.NS", name: "Asian Paints Ltd",                sector: "Consumer",     cap_category: "LARGE", isin: "INE021A01026", exchange: "NSE" },
  { symbol: "SUNPHARMA",  yahoo_symbol: "SUNPHARMA.NS",  name: "Sun Pharmaceutical Industries",   sector: "Pharma",       cap_category: "LARGE", isin: "INE044A01036", exchange: "NSE" },
  { symbol: "TITAN",      yahoo_symbol: "TITAN.NS",      name: "Titan Company Ltd",               sector: "Consumer",     cap_category: "LARGE", isin: "INE280A01028", exchange: "NSE" },
  { symbol: "BAJFINANCE", yahoo_symbol: "BAJFINANCE.NS", name: "Bajaj Finance Ltd",               sector: "Financials",   cap_category: "LARGE", isin: "INE296A01024", exchange: "NSE" },
  { symbol: "ADANIENT",   yahoo_symbol: "ADANIENT.NS",   name: "Adani Enterprises Ltd",           sector: "Diversified",  cap_category: "LARGE", isin: "INE423A01024", exchange: "NSE" },
  { symbol: "NESTLEIND",  yahoo_symbol: "NESTLEIND.NS",  name: "Nestle India Ltd",                sector: "FMCG",         cap_category: "LARGE", isin: "INE239A01016", exchange: "NSE" },
  { symbol: "ULTRACEMCO", yahoo_symbol: "ULTRACEMCO.NS", name: "UltraTech Cement Ltd",            sector: "Cement",       cap_category: "LARGE", isin: "INE481G01011", exchange: "NSE" },
  { symbol: "HCLTECH",    yahoo_symbol: "HCLTECH.NS",    name: "HCL Technologies Ltd",            sector: "IT",           cap_category: "LARGE", isin: "INE860A01027", exchange: "NSE" },
];

const FUNDS = [
  { scheme_code: "120503", name: "Axis Bluechip Fund - Direct Growth",            amc: "Axis MF",         category: "Equity", sub_category: "Large Cap",  risk_level: "Very High", expense_ratio: 0.6,  aum: 53000, min_sip: 500,  min_lumpsum: 5000,  fund_manager: "Shreyash Devalkar",    benchmark: "Nifty 50 TRI" },
  { scheme_code: "120465", name: "Mirae Asset Large Cap Fund - Direct Growth",    amc: "Mirae Asset MF",  category: "Equity", sub_category: "Large Cap",  risk_level: "Very High", expense_ratio: 0.5,  aum: 38500, min_sip: 1000, min_lumpsum: 5000,  fund_manager: "Gaurav Misra",         benchmark: "Nifty 100 TRI" },
  { scheme_code: "118989", name: "SBI Small Cap Fund - Direct Growth",            amc: "SBI MF",          category: "Equity", sub_category: "Small Cap",  risk_level: "Very High", expense_ratio: 0.7,  aum: 25800, min_sip: 500,  min_lumpsum: 5000,  fund_manager: "R. Srinivasan",        benchmark: "BSE Small Cap TRI" },
  { scheme_code: "120586", name: "Parag Parikh Flexi Cap Fund - Direct Growth",   amc: "PPFAS MF",        category: "Equity", sub_category: "Flexi Cap",  risk_level: "Very High", expense_ratio: 0.7,  aum: 65000, min_sip: 1000, min_lumpsum: 1000,  fund_manager: "Rajeev Thakkar",       benchmark: "Nifty 500 TRI" },
  { scheme_code: "119598", name: "Mirae Asset Tax Saver Fund - Direct Growth",    amc: "Mirae Asset MF",  category: "ELSS",   sub_category: "ELSS",       risk_level: "Very High", expense_ratio: 0.6,  aum: 18900, min_sip: 500,  min_lumpsum: 500,   fund_manager: "Neelesh Surana",       benchmark: "Nifty 200 TRI" },
  { scheme_code: "120716", name: "UTI Nifty 50 Index Fund - Direct Growth",       amc: "UTI MF",          category: "Index",  sub_category: "Large Cap",  risk_level: "Very High", expense_ratio: 0.2,  aum: 14500, min_sip: 500,  min_lumpsum: 5000,  fund_manager: "Sharwan Kumar Goyal",  benchmark: "Nifty 50 TRI" },
  { scheme_code: "147949", name: "ICICI Prudential Nifty Next 50 Index - Direct", amc: "ICICI Pru MF",    category: "Index",  sub_category: "Mid Cap",    risk_level: "Very High", expense_ratio: 0.3,  aum: 3500,  min_sip: 500,  min_lumpsum: 5000,  fund_manager: "Kayzad Eghlim",        benchmark: "Nifty Next 50 TRI" },
  { scheme_code: "118473", name: "HDFC Balanced Advantage Fund - Direct Growth",  amc: "HDFC MF",         category: "Hybrid", sub_category: "Balanced",   risk_level: "High",      expense_ratio: 0.85, aum: 70000, min_sip: 500,  min_lumpsum: 5000,  fund_manager: "Anil Bamboli",         benchmark: "Nifty 50 Hybrid TRI" },
  { scheme_code: "118835", name: "Kotak Equity Hybrid Fund - Direct Growth",      amc: "Kotak MF",        category: "Hybrid", sub_category: "Aggressive", risk_level: "High",      expense_ratio: 0.7,  aum: 4200,  min_sip: 1000, min_lumpsum: 5000,  fund_manager: "Pankaj Tibrewal",      benchmark: "Nifty 50 TRI" },
  { scheme_code: "120669", name: "Axis Liquid Fund - Direct Growth",              amc: "Axis MF",         category: "Debt",   sub_category: "Liquid",     risk_level: "Low",       expense_ratio: 0.15, aum: 30100, min_sip: 1000, min_lumpsum: 500,   fund_manager: "Devang Shah",          benchmark: "NIFTY Liquid Index" },
  { scheme_code: "118778", name: "Nippon India Small Cap Fund - Direct Growth",   amc: "Nippon India MF", category: "Equity", sub_category: "Small Cap",  risk_level: "Very High", expense_ratio: 0.7,  aum: 41000, min_sip: 100,  min_lumpsum: 5000,  fund_manager: "Samir Rachh",          benchmark: "BSE Small Cap TRI" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const sb = createClient(supabaseUrl, serviceKey);

    // Upsert stocks
    const { error: stocksError } = await sb.from("stocks").upsert(STOCKS, { onConflict: "symbol" });
    if (stocksError) {
      return new Response(JSON.stringify({ error: "stocks: " + stocksError.message }), { status: 500, headers: corsHeaders });
    }

    // Upsert mutual funds
    const { error: fundsError } = await sb.from("mutual_funds").upsert(FUNDS, { onConflict: "scheme_code" });
    if (fundsError) {
      return new Response(JSON.stringify({ error: "funds: " + fundsError.message }), { status: 500, headers: corsHeaders });
    }

    // Verify counts
    const { count: stockCount } = await sb.from("stocks").select("*", { count: "exact", head: true });
    const { count: fundCount } = await sb.from("mutual_funds").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      ok: true,
      stocks: stockCount,
      mutual_funds: fundCount,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
