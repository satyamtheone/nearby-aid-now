-- Extend the private FCM token registry to include opt-in browser subscriptions.
ALTER TABLE public.device_push_tokens
  DROP CONSTRAINT IF EXISTS device_push_tokens_platform_check;
ALTER TABLE public.device_push_tokens
  ADD CONSTRAINT device_push_tokens_platform_check
  CHECK (platform IN ('android', 'web'));

CREATE OR REPLACE FUNCTION public.register_user_push_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_platform NOT IN ('android', 'web') THEN
    RAISE EXCEPTION 'Unsupported push platform';
  END IF;
  IF p_token IS NULL OR char_length(trim(p_token)) NOT BETWEEN 20 AND 4096 THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  INSERT INTO public.device_push_tokens (user_id, token, platform, updated_at)
  VALUES (auth.uid(), trim(p_token), p_platform, now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_user_push_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.device_push_tokens
  WHERE user_id = auth.uid()
    AND token = p_token
    AND platform = p_platform;
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_push_token(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_push_token(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.unregister_user_push_token(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_user_push_token(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
