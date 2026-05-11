/*
  # Fix handle_new_user function security issues

  ## Problems addressed
  1. Mutable search_path: function lacked a fixed `search_path`, allowing privilege escalation via search path manipulation
  2. Public/authenticated roles could call it directly as SECURITY DEFINER via RPC — it should only fire as a trigger, never be called directly

  ## Changes
  - Recreate `handle_new_user` with `SET search_path = ''` to pin the search path
  - Revoke EXECUTE on the function from `anon` and `authenticated` roles
  - Use fully-qualified schema names (`public.`, `auth.`) throughout the function body
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
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

-- Revoke direct execution from all non-superuser roles
-- The function should only be invoked by its trigger, not called via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
