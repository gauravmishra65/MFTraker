/*
  # Audit: expose current RLS policies for review
  This is a read-only migration that creates no objects.
  We use a DO block to raise a notice listing all policies.
*/
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE 'TABLE=% POLICY=% CMD=% ROLES=%', r.tablename, r.policyname, r.cmd, r.roles;
  END LOOP;
END $$;
