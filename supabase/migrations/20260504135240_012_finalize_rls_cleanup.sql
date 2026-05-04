/*
  # Finalize RLS: drop diagnostic view, add missing UPDATE policies

  ## Summary
  1. Drops the temporary rls_policy_audit diagnostic view (no longer needed).
  2. Adds missing UPDATE policy on activity_log — the table has SELECT/INSERT/DELETE
     but no UPDATE, which is inconsistent. The trigger-driven insert pattern means
     direct UPDATE by users should still be gated.
  3. Adds missing UPDATE policy on search_history for the same reason.

  ## Changes
  - DROP VIEW public.rls_policy_audit
  - activity_log: add UPDATE policy (users can update own rows)
  - search_history: add UPDATE policy (users can update own rows)
*/

-- Drop the temporary diagnostic view
DROP VIEW IF EXISTS public.rls_policy_audit;

-- activity_log: missing UPDATE policy
CREATE POLICY "Users can update own activity log"
  ON public.activity_log
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- search_history: missing UPDATE policy
CREATE POLICY "Users can update own search history"
  ON public.search_history
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
