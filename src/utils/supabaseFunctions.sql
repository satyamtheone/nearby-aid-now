
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
    COALESCE(ul.location_name, p.location_name) as location_name,
    COALESCE(ST_Y(ul.location_point::geometry), ST_Y(p.location_point::geometry)) as lat,
    COALESCE(ST_X(ul.location_point::geometry), ST_X(p.location_point::geometry)) as lng,
    ST_Distance(
      COALESCE(ul.location_point::geography, p.location_point::geography),
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0 as distance_km,
    CASE 
      WHEN p.status = 'online' AND p.last_seen > NOW() - INTERVAL '5 minutes' THEN true
      ELSE false
    END as is_online
  FROM profiles p
  LEFT JOIN user_locations ul ON p.id = ul.user_id AND ul.is_active = true
  WHERE 
    (ul.location_point IS NOT NULL OR p.location_point IS NOT NULL)
    AND ST_DWithin(
      COALESCE(ul.location_point::geography, p.location_point::geography),
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND p.id != (SELECT auth.uid()) -- Exclude current user
    AND (ul.updated_at IS NULL OR ul.updated_at > NOW() - INTERVAL '10 minutes') -- Only recent locations
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
