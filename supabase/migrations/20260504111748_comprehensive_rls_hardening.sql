/*
  # Comprehensive RLS policy cleanup and hardening

  1. Removed policies
    - `portfolio_holdings` "Users can manage own holdings" (ALL) — redundant with specific SELECT/INSERT/UPDATE/DELETE policies
    - `stocks` "Anon can read stocks" — redundant, authenticated policy is sufficient
    - `mutual_funds` "Anon can read mutual funds" — redundant, authenticated policy is sufficient

  2. New policies added
    - `portfolio_transactions` UPDATE — users can update own transactions
    - `dividends` UPDATE — users can update own dividends
    - `dividends` DELETE — users can delete own dividends
    - `activity_log` UPDATE — users can update own activity log
    - `activity_log` DELETE — users can delete own activity log
    - `search_history` DELETE — users can delete own search history
    - `password_resets` UPDATE — users can update own password resets
    - `password_resets` DELETE — users can delete own password resets
    - `watchlist_items` UPDATE — users can update own watchlist items

  3. Security changes
    - Removed anonymous access to stocks and mutual_funds tables
    - All policies now require authenticated users
    - Removed overly broad ALL policy on portfolio_holdings

  4. Important notes
    1) The `handle_new_user()` trigger runs as SECURITY DEFINER and bypasses RLS
    2) The `recompute-holdings` edge function uses SERVICE_ROLE_KEY which bypasses RLS
    3) All user-facing policies check auth.uid() for ownership
*/

-- ============================================================
-- CLEANUP: Remove redundant/overly-permissive policies
-- ============================================================

-- Remove redundant ALL policy on portfolio_holdings (specific policies exist)
DROP POLICY IF EXISTS "Users can manage own holdings" ON public.portfolio_holdings;

-- Remove anonymous read access to stocks (authenticated policy is sufficient)
DROP POLICY IF EXISTS "Anon can read stocks" ON public.stocks;

-- Remove anonymous read access to mutual_funds (authenticated policy is sufficient)
DROP POLICY IF EXISTS "Anon can read mutual funds" ON public.mutual_funds;

-- ============================================================
-- ADD: Missing UPDATE policies
-- ============================================================

-- portfolio_transactions: users can update own transactions
CREATE POLICY "Users can update own transactions"
  ON public.portfolio_transactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- dividends: users can update own dividends
CREATE POLICY "Users can update own dividends"
  ON public.dividends
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- dividends: users can delete own dividends
CREATE POLICY "Users can delete own dividends"
  ON public.dividends
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- activity_log: users can update own activity log
CREATE POLICY "Users can update own activity log"
  ON public.activity_log
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- activity_log: users can delete own activity log
CREATE POLICY "Users can delete own activity log"
  ON public.activity_log
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- search_history: users can delete own search history
CREATE POLICY "Users can delete own search history"
  ON public.search_history
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- password_resets: users can update own password resets
CREATE POLICY "Users can update own password resets"
  ON public.password_resets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- password_resets: users can delete own password resets
CREATE POLICY "Users can delete own password resets"
  ON public.password_resets
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- watchlist_items: users can update own watchlist items
CREATE POLICY "Users can update own watchlist items"
  ON public.watchlist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlists
      WHERE watchlists.id = watchlist_items.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- ============================================================
-- RENAME: Clean up duplicate authenticated read policies
-- ============================================================

-- Rename stocks authenticated policy for clarity
DROP POLICY IF EXISTS "Authenticated users can read stocks" ON public.stocks;
CREATE POLICY "Authenticated users can read stocks"
  ON public.stocks
  FOR SELECT
  TO authenticated
  USING (true);

-- Rename mutual_funds authenticated policy for clarity
DROP POLICY IF EXISTS "Authenticated users can read mutual funds" ON public.mutual_funds;
CREATE POLICY "Authenticated users can read mutual funds"
  ON public.mutual_funds
  FOR SELECT
  TO authenticated
  USING (true);
