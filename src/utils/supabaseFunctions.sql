
-- Function to get nearby users with their coordinates and online status
CREATE OR REPLACE FUNCTION get_nearby_users(
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.username,
    p.location_name,
    ST_Y(p.location_point::geometry) as lat,
    ST_X(p.location_point::geometry) as lng,
    ST_Distance(
      p.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0 as distance_km,
    CASE 
      WHEN p.status = 'online' AND p.last_seen > NOW() - INTERVAL '5 minutes' THEN true
      ELSE false
    END as is_online
  FROM profiles p
  WHERE 
    p.location_point IS NOT NULL
    AND ST_DWithin(
      p.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND p.id != COALESCE((SELECT auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
