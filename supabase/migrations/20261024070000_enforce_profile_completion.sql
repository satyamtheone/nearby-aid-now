-- Require a minimum self-reported profile before a user can post a help request.
-- Government ID documents are not collected or verified by this migration.

CREATE OR REPLACE FUNCTION public.create_help_request(
  p_category public.help_category,
  p_message TEXT,
  p_is_urgent BOOLEAN,
  p_location_name TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_location GEOGRAPHY(POINT, 4326);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a help request';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_user_id
      AND char_length(trim(COALESCE(p.full_name, ''))) >= 2
      AND trim(COALESCE(p.full_name, '')) !~ '[0-9]'
      AND char_length(regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g')) BETWEEN 7 AND 15
      AND (
        char_length(trim(COALESCE(p.home_address, ''))) >= 5
        OR char_length(trim(COALESCE(p.current_address, ''))) >= 5
      )
      AND (
        char_length(trim(COALESCE(p.social_links->>'instagram', ''))) > 0
        OR char_length(trim(COALESCE(p.social_links->>'facebook', ''))) > 0
      )
  ) THEN
    RAISE EXCEPTION 'Complete your legal name, mobile number, address, and Instagram or Facebook profile before posting a request';
  END IF;

  IF p_message IS NULL OR char_length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'A request message is required';
  END IF;
  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
    RAISE EXCEPTION 'Both location coordinates are required';
  END IF;
  IF p_latitude IS NOT NULL AND (p_latitude NOT BETWEEN -90 AND 90
      OR p_longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Location coordinates are invalid';
  END IF;

  IF p_latitude IS NOT NULL THEN
    v_location := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;
  END IF;

  INSERT INTO public.help_requests (
    user_id, category, message, is_urgent, location_name, location_point
  ) VALUES (
    v_user_id, p_category, trim(p_message), COALESCE(p_is_urgent, false),
    NULLIF(trim(p_location_name), ''), v_location
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

DROP POLICY IF EXISTS "Users can create help requests" ON public.help_requests;
CREATE POLICY "Users can create help requests"
  ON public.help_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND COALESCE(is_resolved, false) = false
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND char_length(trim(COALESCE(p.full_name, ''))) >= 2
        AND trim(COALESCE(p.full_name, '')) !~ '[0-9]'
        AND char_length(regexp_replace(COALESCE(p.phone, ''), '[^0-9]', '', 'g')) BETWEEN 7 AND 15
        AND (
          char_length(trim(COALESCE(p.home_address, ''))) >= 5
          OR char_length(trim(COALESCE(p.current_address, ''))) >= 5
        )
        AND (
          char_length(trim(COALESCE(p.social_links->>'instagram', ''))) > 0
          OR char_length(trim(COALESCE(p.social_links->>'facebook', ''))) > 0
        )
    )
  );

REVOKE ALL ON FUNCTION public.create_help_request(
  public.help_category, TEXT, BOOLEAN, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_help_request(
  public.help_category, TEXT, BOOLEAN, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;

NOTIFY pgrst, 'reload schema';
