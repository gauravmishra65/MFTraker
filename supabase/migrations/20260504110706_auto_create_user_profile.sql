/*
  # Auto-create user profile on signup

  1. New function
    - `handle_new_user()`: trigger function that creates a row in `public.users`
      from `auth.users` metadata when a new auth user is created, and also
      creates a default watchlist.

  2. New trigger
    - `on_auth_user_created`: AFTER INSERT on `auth.users` calls `handle_new_user()`

  3. Security
    - The function runs with SECURITY DEFINER (as the database owner)
    - Only triggered by auth.user inserts (Supabase Auth)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  new_user_id := NEW.id;

  INSERT INTO public.users (id, full_name, email, phone, password_hash, email_verified, dob, pan, city, state, investment_experience, risk_tolerance, annual_income_range, investment_goals)
  VALUES (
    new_user_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.encrypted_password,
    NEW.email_confirmed_at IS NOT NULL,
    NULLIF(NEW.raw_user_meta_data->>'dob', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'pan', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'investment_experience', ''),
    NULLIF(NEW.raw_user_meta_data->>'risk_tolerance', ''),
    NULLIF(NEW.raw_user_meta_data->>'annual_income_range', ''),
    COALESCE(
      (SELECT array_agg(val) FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'investment_goals') AS val),
      '{}'::text[]
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default watchlist
  INSERT INTO public.watchlists (user_id, name, position)
  VALUES (new_user_id, 'My Watchlist', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();