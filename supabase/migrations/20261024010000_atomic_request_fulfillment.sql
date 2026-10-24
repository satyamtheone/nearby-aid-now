-- Fulfillment and its feedback must succeed or fail together.
ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS closed_without_helper BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_reopening_fulfilled_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_resolved, false) THEN
      RAISE EXCEPTION 'New help requests must be open';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.is_resolved, false) AND NOT COALESCE(NEW.is_resolved, false) THEN
    RAISE EXCEPTION 'A fulfilled help request cannot be reopened';
  END IF;

  IF NOT COALESCE(OLD.is_resolved, false)
     AND COALESCE(NEW.is_resolved, false)
     AND current_setting('app.fulfill_request_id', true) IS DISTINCT FROM OLD.id::text THEN
    RAISE EXCEPTION 'Use the fulfillment flow to close this request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_reopening_fulfilled_request ON public.help_requests;
CREATE TRIGGER prevent_reopening_fulfilled_request
  BEFORE INSERT OR UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_reopening_fulfilled_request();

CREATE OR REPLACE FUNCTION public.fulfill_help_request(
  p_request_id UUID,
  p_helper_id UUID,
  p_rating INTEGER,
  p_feedback TEXT,
  p_confirm_no_helpers BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.help_requests%ROWTYPE;
  v_has_helpers BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to fulfill a request';
  END IF;

  SELECT * INTO v_request
  FROM public.help_requests
  WHERE id = p_request_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or you are not its owner';
  END IF;
  IF COALESCE(v_request.is_resolved, false) THEN
    RAISE EXCEPTION 'This request is already fulfilled';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.help_request_id = p_request_id AND m.user_id <> v_request.user_id
  ) INTO v_has_helpers;

  IF v_has_helpers THEN
    IF p_confirm_no_helpers THEN
      RAISE EXCEPTION 'Choose a chat participant and submit feedback';
    END IF;
    IF p_helper_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.help_request_id = p_request_id AND m.user_id = p_helper_id
        AND m.user_id <> v_request.user_id
    ) THEN
      RAISE EXCEPTION 'Choose someone who participated in this request chat';
    END IF;
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
      RAISE EXCEPTION 'Choose a rating from 1 to 5';
    END IF;
    IF p_feedback IS NULL OR char_length(trim(p_feedback)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Feedback must be between 1 and 500 characters';
    END IF;
  ELSE
    IF NOT COALESCE(p_confirm_no_helpers, false) THEN
      RAISE EXCEPTION 'Confirm that nobody joined before closing without feedback';
    END IF;
    IF p_helper_id IS NOT NULL OR p_rating IS NOT NULL OR NULLIF(trim(p_feedback), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Feedback details cannot be submitted without a chat participant';
    END IF;
  END IF;

  PERFORM set_config('app.fulfill_request_id', p_request_id::text, true);
  UPDATE public.help_requests
  SET is_resolved = true,
      closed_without_helper = NOT v_has_helpers,
      updated_at = now()
  WHERE id = p_request_id;

  IF v_has_helpers THEN
    INSERT INTO public.request_feedback (request_id, requester_id, helper_id, rating, feedback)
    VALUES (p_request_id, auth.uid(), p_helper_id, p_rating, trim(p_feedback));
  END IF;

  RETURN v_has_helpers;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_help_request(UUID, UUID, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_help_request(UUID, UUID, INTEGER, TEXT, BOOLEAN) TO authenticated;
