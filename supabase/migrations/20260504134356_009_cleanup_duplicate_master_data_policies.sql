/*
  # Clean up duplicate RLS policies on stocks and mutual_funds

  ## Summary
  Two overlapping SELECT policies exist on both stocks and mutual_funds:
    1. "Authenticated users can read stocks" — TO authenticated USING (true)
    2. "Public can read stocks"             — TO anon, authenticated USING (true)

  Policy #2 fully supersedes #1 (it covers authenticated AND anon).
  Keeping both is redundant and confusing. This migration drops the narrower
  authenticated-only policies, leaving only the public-read policies.

  ## Changes
  - stocks: DROP "Authenticated users can read stocks" (superseded by "Public can read stocks")
  - mutual_funds: DROP "Authenticated users can read mutual funds" (superseded by "Public can read mutual funds")

  ## Security
  No change in access behaviour — anon and authenticated users could already read
  both tables. This is purely a cleanup to remove the duplicate.
*/

DROP POLICY IF EXISTS "Authenticated users can read stocks" ON public.stocks;
DROP POLICY IF EXISTS "Authenticated users can read mutual funds" ON public.mutual_funds;
