-- Play publishing preparation: terms acceptance, user blocking and UGC reports.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
DROP POLICY IF EXISTS "Users can view their blocks" ON public.user_blocks;
CREATE POLICY "Users can view their blocks" ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Users can block others" ON public.user_blocks;
CREATE POLICY "Users can block others" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());
DROP POLICY IF EXISTS "Users can unblock others" ON public.user_blocks;
CREATE POLICY "Users can unblock others" ON public.user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_user_blocked(p_other_user UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND p_other_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other_user)
       OR (b.blocker_id = p_other_user AND b.blocked_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_user_blocked(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  help_request_id UUID REFERENCES public.help_requests(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 80),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Allow references to become null when referenced content/account is deleted;
  -- insert policy below still requires exactly one report target.
  CHECK (num_nonnulls(reported_user_id, message_id, help_request_id) <= 1)
);
CREATE INDEX IF NOT EXISTS moderation_reports_open_created_idx
  ON public.moderation_reports (created_at DESC) WHERE status = 'open';
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.moderation_reports TO authenticated;
DROP POLICY IF EXISTS "Users can submit moderation reports" ON public.moderation_reports;
CREATE POLICY "Users can submit moderation reports" ON public.moderation_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND num_nonnulls(reported_user_id, message_id, help_request_id) = 1
    AND (reported_user_id IS NULL OR reported_user_id <> auth.uid())
  );
DROP POLICY IF EXISTS "Users can view their submitted reports" ON public.moderation_reports;
CREATE POLICY "Users can view their submitted reports" ON public.moderation_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_content_moderator()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role' IN ('moderator', 'admin'), false);
$$;
REVOKE ALL ON FUNCTION public.is_content_moderator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_content_moderator() TO authenticated;

DROP POLICY IF EXISTS "Moderators can review reports" ON public.moderation_reports;
CREATE POLICY "Moderators can review reports" ON public.moderation_reports
  FOR SELECT TO authenticated USING (public.is_content_moderator());

CREATE OR REPLACE FUNCTION public.get_moderation_queue()
RETURNS TABLE (
  id UUID,
  reported_user_id UUID,
  reported_user_name TEXT,
  target_type TEXT,
  target_content TEXT,
  reason TEXT,
  details TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_content_moderator() THEN RAISE EXCEPTION 'Moderator access required'; END IF;
  RETURN QUERY
  SELECT r.id, r.reported_user_id,
    COALESCE(p.full_name, p.username, 'Deleted or unknown user'),
    CASE WHEN r.message_id IS NOT NULL THEN 'message'
         WHEN r.help_request_id IS NOT NULL THEN 'request' ELSE 'user' END,
    COALESCE(m.message, h.message, 'User profile report'),
    r.reason, r.details, r.status, r.created_at
  FROM public.moderation_reports r
  LEFT JOIN public.messages m ON m.id = r.message_id
  LEFT JOIN public.help_requests h ON h.id = r.help_request_id
  LEFT JOIN public.profiles p ON p.id = COALESCE(r.reported_user_id, m.user_id, h.user_id)
  ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_moderation_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_moderation_queue() TO authenticated;

CREATE OR REPLACE FUNCTION public.review_moderation_report(
  p_report_id UUID,
  p_status TEXT,
  p_remove_content BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.moderation_reports%ROWTYPE;
BEGIN
  IF NOT public.is_content_moderator() THEN
    RAISE EXCEPTION 'Moderator access required';
  END IF;
  IF p_status NOT IN ('reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid report status';
  END IF;
  SELECT * INTO v_report FROM public.moderation_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  IF p_remove_content AND v_report.message_id IS NOT NULL THEN
    UPDATE public.messages
      SET message = '[This message was removed by moderation]',
          content_type = 'text', attachment_url = NULL, attachment_name = NULL,
          location_name = NULL, location_point = NULL
      WHERE id = v_report.message_id;
  ELSIF p_remove_content AND v_report.help_request_id IS NOT NULL THEN
    UPDATE public.help_requests
      SET message = '[This request was removed by moderation]', updated_at = now()
      WHERE id = v_report.help_request_id;
  END IF;

  UPDATE public.moderation_reports SET status = p_status,
    reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_report_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_moderation_report(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_moderation_report(UUID, TEXT, BOOLEAN) TO authenticated;

-- Exclude people who either blocked the current user or were blocked by them
-- from coordinate-returning nearby discovery RPCs.
-- PostgreSQL cannot replace a table-returning function if the hosted function's
-- OUT column types differ, so drop this exact signature before recreating it.
-- The app calls this RPC directly; no database objects depend on it.
DROP FUNCTION IF EXISTS public.get_nearby_users(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.get_nearby_users(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 10.0
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  location_name TEXT,
  lat FLOAT,
  lng FLOAT,
  distance_km FLOAT,
  is_online BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.full_name, p.username, p.location_name,
    ST_Y(p.location_point::geometry)::FLOAT,
    ST_X(p.location_point::geometry)::FLOAT,
    (ST_Distance(p.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000.0)::FLOAT,
    (p.status = 'online' AND p.last_seen > now() - interval '2 minutes')
  FROM public.profiles p
  WHERE p.location_point IS NOT NULL
    AND ST_DWithin(p.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_km * 1000)
    AND p.id <> auth.uid()
    AND NOT public.is_user_blocked(p.id)
  ORDER BY 7;
$$;
GRANT EXECUTE ON FUNCTION public.get_nearby_users(FLOAT, FLOAT, FLOAT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_nearby_users(FLOAT, FLOAT, FLOAT) FROM PUBLIC, anon;

-- Respect blocks for nearby help alerts as well as in-app discovery.
CREATE OR REPLACE FUNCTION public.get_request_push_targets(p_request_id UUID)
RETURNS TABLE (push_token_id UUID, recipient_id UUID, token TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT dpt.id, dpt.user_id, dpt.token
  FROM public.help_requests hr
  JOIN public.profiles recipient
    ON recipient.location_point IS NOT NULL
   AND recipient.id <> hr.user_id
   AND ST_DWithin(recipient.location_point, hr.location_point, 10000)
  JOIN public.device_push_tokens dpt ON dpt.user_id = recipient.id
  WHERE hr.id = p_request_id
    AND hr.is_resolved IS DISTINCT FROM true
    AND hr.location_point IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = recipient.id AND b.blocked_id = hr.user_id)
         OR (b.blocker_id = hr.user_id AND b.blocked_id = recipient.id)
    );
$$;
REVOKE ALL ON FUNCTION public.get_request_push_targets(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_push_targets(UUID) TO service_role;

-- Force terms acceptance at the database boundary for all user generated text.
CREATE OR REPLACE FUNCTION public.require_terms_acceptance_for_ugc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_user AND p.terms_accepted_at IS NOT NULL
      AND p.terms_version = '2026-10-25'
  ) THEN
    RAISE EXCEPTION 'Please accept the current Terms of Use before posting';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_terms_acceptance_for_ugc() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS require_terms_for_help_request ON public.help_requests;
CREATE TRIGGER require_terms_for_help_request
  BEFORE INSERT ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_terms_acceptance_for_ugc();
DROP TRIGGER IF EXISTS require_terms_for_message ON public.messages;
CREATE TRIGGER require_terms_for_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.require_terms_acceptance_for_ugc();

-- Hide content from either side of a block, including in public community chat.
CREATE OR REPLACE FUNCTION public.can_access_help_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.help_requests hr
    WHERE hr.id = p_request_id
      AND NOT public.is_user_blocked(hr.user_id)
      AND (
        COALESCE(hr.is_resolved, false) = false
        OR hr.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.help_request_id = hr.id AND m.user_id = auth.uid()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_help_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_help_request(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view public or accessible request messages" ON public.messages;
CREATE POLICY "Users can view public or accessible request messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    NOT public.is_user_blocked(user_id)
    AND (help_request_id IS NULL OR public.can_access_help_request(help_request_id))
  );

DROP POLICY IF EXISTS "Users can create messages in open accessible chats" ON public.messages;
CREATE POLICY "Users can create messages in open accessible chats"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_user_blocked(user_id)
    AND (
      help_request_id IS NULL
      OR (
        public.can_access_help_request(help_request_id)
        AND EXISTS (
          SELECT 1 FROM public.help_requests hr
          WHERE hr.id = help_request_id AND COALESCE(hr.is_resolved, false) = false
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
