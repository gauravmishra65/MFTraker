/*
  # Tighten table-level grants to match RLS intent

  ## Problem
  All tables currently have full privileges (SELECT, INSERT, UPDATE, DELETE,
  TRUNCATE, TRIGGER, REFERENCES) granted to the `anon` role. RLS policies are
  the only enforcement layer. This violates defense-in-depth: if an RLS policy
  is ever misconfigured, anon users could read or write any table.

  ## Changes
  - Revoke all privileges from `anon` on every table
  - Grant `anon` SELECT-only on `stocks` and `mutual_funds` (public reference data)
  - Grant `authenticated` only the operations each table actually needs:
    - Reference data (stocks, mutual_funds): SELECT only
    - User-data tables: SELECT, INSERT, UPDATE, DELETE
  - `service_role` bypasses RLS entirely and retains full access (unchanged)

  ## Tables affected
  activity_log, alerts, dividends, mutual_funds, password_resets,
  portfolio_holdings, portfolio_transactions, search_history, stocks,
  users, watchlist_items, watchlists
*/

-- ============================================================
-- 1. Revoke everything from anon on all public tables
-- ============================================================
REVOKE ALL ON public.activity_log        FROM anon;
REVOKE ALL ON public.alerts              FROM anon;
REVOKE ALL ON public.dividends           FROM anon;
REVOKE ALL ON public.mutual_funds        FROM anon;
REVOKE ALL ON public.password_resets     FROM anon;
REVOKE ALL ON public.portfolio_holdings  FROM anon;
REVOKE ALL ON public.portfolio_transactions FROM anon;
REVOKE ALL ON public.search_history      FROM anon;
REVOKE ALL ON public.stocks              FROM anon;
REVOKE ALL ON public.users               FROM anon;
REVOKE ALL ON public.watchlist_items     FROM anon;
REVOKE ALL ON public.watchlists          FROM anon;

-- ============================================================
-- 2. Revoke all from authenticated, then re-grant precisely
-- ============================================================
REVOKE ALL ON public.activity_log        FROM authenticated;
REVOKE ALL ON public.alerts              FROM authenticated;
REVOKE ALL ON public.dividends           FROM authenticated;
REVOKE ALL ON public.mutual_funds        FROM authenticated;
REVOKE ALL ON public.password_resets     FROM authenticated;
REVOKE ALL ON public.portfolio_holdings  FROM authenticated;
REVOKE ALL ON public.portfolio_transactions FROM authenticated;
REVOKE ALL ON public.search_history      FROM authenticated;
REVOKE ALL ON public.stocks              FROM authenticated;
REVOKE ALL ON public.users               FROM authenticated;
REVOKE ALL ON public.watchlist_items     FROM authenticated;
REVOKE ALL ON public.watchlists          FROM authenticated;

-- ============================================================
-- 3. Grant anon SELECT-only on public reference data
-- ============================================================
GRANT SELECT ON public.stocks        TO anon;
GRANT SELECT ON public.mutual_funds  TO anon;

-- ============================================================
-- 4. Grant authenticated SELECT-only on reference data
-- ============================================================
GRANT SELECT ON public.stocks        TO authenticated;
GRANT SELECT ON public.mutual_funds  TO authenticated;

-- ============================================================
-- 5. Grant authenticated full CRUD on user-data tables
--    (RLS policies still enforce per-row ownership)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users                    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_transactions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_holdings       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dividends                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_resets          TO authenticated;
