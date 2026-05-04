/*
  # Auto-confirm email on signup

  Updates the trigger to also confirm the user's email in auth.users
  so they can sign in immediately without email verification.
  Runs as SECURITY DEFINER to access auth schema.
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

  -- Auto-confirm email so users can log in immediately
  UPDATE auth.users
  SET email_confirmed_at = now(),
      confirmation_token = '',
      confirmation_sent_at = NULL
  WHERE id = new_user_id
    AND email_confirmed_at IS NULL;

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
    true,
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