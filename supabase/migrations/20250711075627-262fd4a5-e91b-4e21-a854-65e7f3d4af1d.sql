-- Add additional profile fields for user details
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS current_address TEXT;

-- Create a function to calculate distance between users and help request creator
CREATE OR REPLACE FUNCTION public.get_help_request_user_distance(
  request_user_id UUID,
  current_user_lat DOUBLE PRECISION,
  current_user_lng DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_user_location geometry;
  distance_km DOUBLE PRECISION;
BEGIN
  -- Get the request creator's location
  SELECT location_point INTO request_user_location
  FROM profiles
  WHERE id = request_user_id;
  
  -- Return null if no location found
  IF request_user_location IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate distance
  SELECT ST_Distance(
    request_user_location::geography,
    ST_SetSRID(ST_MakePoint(current_user_lng, current_user_lat), 4326)::geography
  ) / 1000.0 INTO distance_km;
  
  RETURN distance_km;
END;
$$;