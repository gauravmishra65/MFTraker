/*
  # Auth trigger: auto-create user profile + watchlist on signup

  Creates handle_new_user() function that fires on auth.users INSERT.
  Also auto-confirms email so users can sign in immediately.

  On signup:
    1. Auto-confirms the user's email in auth.users
    2. Creates a row in public.users
    3. Creates a default "My Watchlist" watchlist
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-confirm email so login works immediately without email verification
  UPDATE auth.users
  SET
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = '',
    confirmation_sent_at = NULL
  WHERE id = NEW.id
    AND email_confirmed_at IS NULL;

  -- Create user profile
  INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    password_hash,
    email_verified,
    dob,
    pan,
    city,
    state,
    investment_experience,
    risk_tolerance,
    annual_income_range,
    investment_goals
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NEW.encrypted_password,
    true,
    NULLIF(NEW.raw_user_meta_data->>'dob', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'pan', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'state', ''),
    NULLIF(NEW.raw_user_meta_data->>'investment_experience', ''),
    NULLIF(NEW.raw_user_meta_data->>'risk_tolerance', ''),
    NULLIF(NEW.raw_user_meta_data->>'annual_income_range', ''),
    COALESCE(
      (SELECT array_agg(val)
       FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'investment_goals') AS val),
      '{}'::text[]
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create default watchlist
  INSERT INTO public.watchlists (user_id, name, position)
  VALUES (NEW.id, 'My Watchlist', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
