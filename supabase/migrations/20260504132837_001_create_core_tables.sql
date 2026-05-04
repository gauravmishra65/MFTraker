/*
  # Create core tables

  All 12 application tables created from scratch with full RLS.

  Tables:
    1. users              - user profiles (mirrors auth.users)
    2. stocks             - NSE/BSE listed stocks master data
    3. mutual_funds       - mutual fund schemes master data
    4. watchlists         - user watchlists
    5. watchlist_items    - items inside a watchlist (stock or MF)
    6. portfolio_transactions - buy/sell/SIP transactions
    7. portfolio_holdings - computed current holdings
    8. alerts             - price/change alerts
    9. dividends          - dividend income records
    10. search_history    - recent searches
    11. activity_log      - audit trail
    12. password_resets   - OTP-based resets

  Security: RLS enabled on every table, authenticated-only policies.
*/

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text NOT NULL,
  email                 text UNIQUE NOT NULL,
  phone                 text,
  password_hash         text,
  google_id             text UNIQUE,
  email_verified        boolean NOT NULL DEFAULT false,
  preferences           jsonb,
  dob                   timestamptz,
  pan                   text,
  city                  text,
  state                 text,
  investment_experience text CHECK (investment_experience IN ('BEGINNER','INTERMEDIATE','ADVANCED')),
  risk_tolerance        text CHECK (risk_tolerance IN ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
  annual_income_range   text CHECK (annual_income_range IN ('UNDER_5L','5L_10L','10L_25L','25L_50L','OVER_50L','PREFER_NOT_SAY')),
  investment_goals      text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own data"
  ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ─── STOCKS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       text UNIQUE NOT NULL,
  yahoo_symbol text UNIQUE NOT NULL,
  name         text NOT NULL,
  exchange     text NOT NULL DEFAULT 'NSE',
  sector       text,
  industry     text,
  isin         text UNIQUE,
  market_cap   float8,
  cap_category text CHECK (cap_category IN ('LARGE','MID','SMALL')),
  face_value   float8,
  description  text,
  logo_url     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stocks"
  ON public.stocks FOR SELECT TO authenticated USING (true);

-- ─── MUTUAL FUNDS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mutual_funds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code    text UNIQUE NOT NULL,
  name           text NOT NULL,
  amc            text NOT NULL,
  category       text NOT NULL,
  sub_category   text,
  risk_level     text,
  fund_manager   text,
  expense_ratio  float8,
  aum            float8,
  min_sip        float8,
  min_lumpsum    float8,
  benchmark      text,
  inception_date timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mutual funds"
  ON public.mutual_funds FOR SELECT TO authenticated USING (true);

-- ─── WATCHLISTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  position   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own watchlists"
  ON public.watchlists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own watchlists"
  ON public.watchlists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own watchlists"
  ON public.watchlists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own watchlists"
  ON public.watchlists FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── WATCHLIST ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  stock_id     uuid REFERENCES public.stocks(id) ON DELETE CASCADE,
  mf_id        uuid REFERENCES public.mutual_funds(id) ON DELETE CASCADE,
  position     int NOT NULL DEFAULT 0,
  added_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own watchlist items"
  ON public.watchlist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can insert own watchlist items"
  ON public.watchlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can update own watchlist items"
  ON public.watchlist_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));
CREATE POLICY "Users can delete own watchlist items"
  ON public.watchlist_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.user_id = auth.uid()));

-- ─── PORTFOLIO TRANSACTIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_id   uuid REFERENCES public.stocks(id) ON DELETE SET NULL,
  mf_id      uuid REFERENCES public.mutual_funds(id) ON DELETE SET NULL,
  type       text NOT NULL CHECK (type IN ('BUY','SELL','SIP','LUMPSUM','REDEEM')),
  date       timestamptz NOT NULL,
  quantity   float8 NOT NULL,
  price      float8 NOT NULL,
  brokerage  float8 NOT NULL DEFAULT 0,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON public.portfolio_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own transactions"
  ON public.portfolio_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own transactions"
  ON public.portfolio_transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own transactions"
  ON public.portfolio_transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── PORTFOLIO HOLDINGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  instrument_type text NOT NULL CHECK (instrument_type IN ('STOCK','MF')),
  instrument_id   uuid NOT NULL,
  symbol          text NOT NULL,
  name            text NOT NULL,
  quantity        float8 NOT NULL,
  avg_price       float8 NOT NULL,
  invested        float8 NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, instrument_type, instrument_id)
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own holdings"
  ON public.portfolio_holdings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own holdings"
  ON public.portfolio_holdings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own holdings"
  ON public.portfolio_holdings FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own holdings"
  ON public.portfolio_holdings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── ALERTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_id     uuid REFERENCES public.stocks(id) ON DELETE SET NULL,
  symbol       text NOT NULL,
  type         text NOT NULL CHECK (type IN ('PRICE_ABOVE','PRICE_BELOW','PCT_CHANGE','VOLUME_SPIKE')),
  threshold    float8 NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  triggered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alerts"
  ON public.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own alerts"
  ON public.alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts"
  ON public.alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own alerts"
  ON public.alerts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── DIVIDENDS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dividends (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol     text NOT NULL,
  amount     float8 NOT NULL,
  per_share  float8,
  date       timestamptz NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dividends"
  ON public.dividends FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own dividends"
  ON public.dividends FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own dividends"
  ON public.dividends FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own dividends"
  ON public.dividends FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── SEARCH HISTORY ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query      text NOT NULL,
  result_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search history"
  ON public.search_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own search history"
  ON public.search_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own search history"
  ON public.search_history FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action     text NOT NULL,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity log"
  ON public.activity_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own activity log"
  ON public.activity_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own activity log"
  ON public.activity_log FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── PASSWORD RESETS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  otp_hash   text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own password resets"
  ON public.password_resets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own password resets"
  ON public.password_resets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own password resets"
  ON public.password_resets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own password resets"
  ON public.password_resets FOR DELETE TO authenticated USING (user_id = auth.uid());
