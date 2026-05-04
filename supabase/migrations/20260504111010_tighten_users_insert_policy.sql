/*
  # Tighten users table INSERT policy

  1. Security changes
    - Drop the overly permissive "Allow registration insert" policy
      which allowed anyone to insert any row into users
    - Keep "Users can insert own data" which requires auth.uid() = id
    - The trigger (handle_new_user) runs as SECURITY DEFINER and bypasses RLS,
      so it doesn't need a policy
*/

DROP POLICY IF EXISTS "Allow registration insert" ON public.users;
