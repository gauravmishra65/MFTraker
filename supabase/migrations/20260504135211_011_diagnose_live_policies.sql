/*
  # Diagnostic: create a view to expose pg_policies for debugging
  This view will let us read live RLS policy state via the REST API.
*/
CREATE OR REPLACE VIEW public.rls_policy_audit AS
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Allow anon to read this diagnostic view temporarily
ALTER VIEW public.rls_policy_audit OWNER TO postgres;
GRANT SELECT ON public.rls_policy_audit TO anon;
