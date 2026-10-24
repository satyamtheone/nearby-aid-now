-- Create new requests using the authenticated database identity. This avoids
-- relying on a client-supplied owner ID or direct INSERT policy state.
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

REVOKE ALL ON FUNCTION public.create_help_request(
  public.help_category, TEXT, BOOLEAN, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_help_request(
  public.help_category, TEXT, BOOLEAN, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;

NOTIFY pgrst, 'reload schema';
