/*
  # Allow public read access to master data tables

  ## Summary
  stocks and mutual_funds are reference/catalogue data — every visitor (authenticated
  or not) must be able to read them for search, screener, and detail pages to work.

  ## Changes
  - stocks: add SELECT policy for `anon` and `authenticated` roles
  - mutual_funds: add SELECT policy for `anon` and `authenticated` roles

  ## Security
  No write access is granted. INSERT/UPDATE/DELETE remain blocked for all non-service roles.
*/

CREATE POLICY "Public can read stocks"
  ON stocks FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read mutual funds"
  ON mutual_funds FOR SELECT
  TO anon, authenticated
  USING (true);
