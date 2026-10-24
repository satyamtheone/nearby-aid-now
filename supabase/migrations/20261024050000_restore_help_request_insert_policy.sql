-- Restore the request creation rule if the hosted database's policy drifted.
-- A signed-in user may create an open request only for their own profile.
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON TABLE public.help_requests TO authenticated;

DROP POLICY IF EXISTS "Users can create help requests" ON public.help_requests;
CREATE POLICY "Users can create help requests"
  ON public.help_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND COALESCE(is_resolved, false) = false
  );

NOTIFY pgrst, 'reload schema';
