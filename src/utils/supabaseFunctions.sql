
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
    ul.user_id,
    p.full_name,
    p.username,
    ul.location_name,
    ST_Y(ul.location_point::geometry) as lat,
    ST_X(ul.location_point::geometry) as lng,
    ST_Distance(
      ul.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0 as distance_km,
    CASE 
      WHEN p.status = 'online' AND p.last_seen > NOW() - INTERVAL '2 minutes' THEN true
      ELSE false
    END as is_online
  FROM user_locations ul
  JOIN profiles p ON ul.user_id = p.id
  WHERE 
    ul.is_active = true
    AND ST_DWithin(
      ul.location_point::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND ul.updated_at > NOW() - INTERVAL '10 minutes' -- Only show users active in last 10 minutes
    AND ul.user_id != (SELECT auth.uid()) -- Exclude current user
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
