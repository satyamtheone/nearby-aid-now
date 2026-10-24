-- Private FCM token registry and idempotent delivery records.
CREATE TABLE public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform = 'android'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(token) BETWEEN 20 AND 4096)
);

CREATE INDEX device_push_tokens_user_id_idx
  ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.device_push_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.device_push_tokens TO service_role;

CREATE TABLE public.request_push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_token_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'invalid_token')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (request_id, push_token_id)
);

CREATE INDEX request_push_deliveries_request_idx
  ON public.request_push_deliveries (request_id, status);

ALTER TABLE public.request_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.request_push_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.request_push_deliveries TO service_role;

-- A signed-in user can register only a token obtained from their own Android app.
CREATE OR REPLACE FUNCTION public.register_android_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_token IS NULL OR char_length(trim(p_token)) NOT BETWEEN 20 AND 4096 THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  INSERT INTO public.device_push_tokens (user_id, token, platform, updated_at)
  VALUES (auth.uid(), trim(p_token), 'android', now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_android_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.device_push_tokens
  WHERE user_id = auth.uid() AND token = p_token;
END;
$$;

-- This RPC returns device tokens only to the trusted Edge Function service role.
-- It never returns coordinates, only tokens for users within 10,000 meters.
CREATE OR REPLACE FUNCTION public.get_request_push_targets(p_request_id UUID)
RETURNS TABLE (push_token_id UUID, recipient_id UUID, token TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dpt.id, dpt.user_id, dpt.token
  FROM public.help_requests AS hr
  JOIN public.profiles AS recipient
    ON recipient.location_point IS NOT NULL
   AND recipient.id <> hr.user_id
   AND ST_DWithin(recipient.location_point, hr.location_point, 10000)
  JOIN public.device_push_tokens AS dpt
    ON dpt.user_id = recipient.id
  WHERE hr.id = p_request_id
    AND hr.is_resolved IS DISTINCT FROM true
    AND hr.location_point IS NOT NULL;
$$;

-- Claim each device delivery atomically so duplicate function calls do not
-- generate duplicate notifications. A stale lease can be retried after 5 min.
CREATE OR REPLACE FUNCTION public.claim_request_push_delivery(p_delivery_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.request_push_deliveries
  SET status = 'sending',
      attempt_count = attempt_count + 1,
      updated_at = now(),
      last_error_code = NULL
  WHERE id = p_delivery_id
    AND (
      status IN ('pending', 'failed')
      OR (status = 'sending' AND updated_at < now() - INTERVAL '5 minutes')
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.register_android_push_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_android_push_token(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.unregister_android_push_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_android_push_token(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_request_push_targets(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_push_targets(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.claim_request_push_delivery(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_request_push_delivery(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
