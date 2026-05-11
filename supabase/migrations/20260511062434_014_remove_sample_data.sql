/*
  # Remove all hardcoded sample/seed stock and mutual fund data

  1. Changes
     - Deletes all rows from stocks table (was pre-populated with 23 hardcoded NSE stocks)
     - Deletes all rows from mutual_funds table (was pre-populated with 11 hardcoded schemes
       plus fake MF001–MF011 scheme codes)
  2. Reason
     - Master data is now populated on-demand via the stock-search edge function (user-driven)
       and the seed-data edge function (admin, fetches live from Yahoo Finance / AMFI India).
     - Hardcoded static rows with potentially stale prices/ISINs are replaced by live data.
  3. Notes
     - User data (watchlist_items, portfolio_transactions, portfolio_holdings, alerts) that
       references stocks/mutual_funds via FK will cascade-delete automatically per the schema
       FK ON DELETE CASCADE constraints. Since these are seeded rows with no real user data,
       this is safe.
     - This migration is idempotent — running it multiple times is harmless.
*/

DELETE FROM public.stocks;
DELETE FROM public.mutual_funds;
