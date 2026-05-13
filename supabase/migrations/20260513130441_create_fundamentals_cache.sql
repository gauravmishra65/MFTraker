/*
  # Create fundamentals_cache table

  Caches Alpha Vantage OVERVIEW responses per stock symbol to stay within the
  free-tier 25 req/day limit. Entries are considered fresh for 24 hours.

  1. New Tables
    - `fundamentals_cache`
      - `yahoo_symbol` (text, primary key) — the symbol key used for lookup
      - `data` (jsonb) — the mapped fundamentals object
      - `fetched_at` (timestamptz) — when the data was last fetched from Alpha Vantage

  2. Security
    - Enable RLS
    - Edge functions use the service role key and bypass RLS; no user-facing
      policies are needed because this is internal cache data only.
*/

CREATE TABLE IF NOT EXISTS fundamentals_cache (
  yahoo_symbol  text        PRIMARY KEY,
  data          jsonb       NOT NULL DEFAULT '{}',
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fundamentals_cache ENABLE ROW LEVEL SECURITY;
