-- Keep fulfilled requests and their conversations visible only to their owner
-- and people who participated in that request's chat.
CREATE OR REPLACE FUNCTION public.can_access_help_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.help_requests hr
    WHERE hr.id = p_request_id
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

CREATE OR REPLACE FUNCTION public.prevent_reopening_fulfilled_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.is_resolved, false) = true AND COALESCE(NEW.is_resolved, false) = false THEN
    RAISE EXCEPTION 'A fulfilled help request cannot be reopened';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_reopening_fulfilled_request
  BEFORE UPDATE OF is_resolved ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_reopening_fulfilled_request();

DROP POLICY IF EXISTS "Users can view all help requests" ON public.help_requests;
CREATE POLICY "Users can view open or participating help requests"
  ON public.help_requests FOR SELECT
  USING (public.can_access_help_request(id));

DROP POLICY IF EXISTS "Users can view all messages" ON public.messages;
CREATE POLICY "Users can view public or accessible request messages"
  ON public.messages FOR SELECT
  USING (
    help_request_id IS NULL
    OR public.can_access_help_request(help_request_id)
  );

DROP POLICY IF EXISTS "Users can create messages" ON public.messages;
CREATE POLICY "Users can create messages in open accessible chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
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

CREATE TABLE public.request_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT NOT NULL CHECK (char_length(trim(feedback)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, helper_id),
  CHECK (requester_id <> helper_id)
);

CREATE INDEX request_feedback_helper_created_idx
  ON public.request_feedback (helper_id, created_at DESC);

ALTER TABLE public.request_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.request_feedback TO authenticated;
CREATE POLICY "Anyone can view request feedback"
  ON public.request_feedback FOR SELECT USING (true);
CREATE POLICY "Request owners can rate chat participants after fulfillment"
  ON public.request_feedback FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.help_requests hr
      WHERE hr.id = request_id
        AND hr.user_id = auth.uid()
        AND COALESCE(hr.is_resolved, false) = true
    )
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.help_request_id = request_id AND m.user_id = helper_id
    )
  );
