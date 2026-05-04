/*
  # Auto-create user profile on signup

  Creates a trigger that automatically inserts a row in public.users
  and a default watchlist whenever a new Supabase Auth user signs up.
  Runs as SECURITY DEFINER to bypass RLS.
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

  INSERT INTO public.users (
    id, full_name, email, phone, password_hash, email_verified,
    dob, pan, city, state,
    investment_experience, risk_tolerance, annual_income_range, investment_goals
  )
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

  INSERT INTO public.watchlists (user_id, name, position)
  VALUES (new_user_id, 'My Watchlist', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
