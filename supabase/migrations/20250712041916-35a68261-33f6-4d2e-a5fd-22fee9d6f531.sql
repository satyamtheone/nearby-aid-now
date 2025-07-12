-- Add social_links and avatar_emoji columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN social_links JSONB DEFAULT '{}',
ADD COLUMN avatar_emoji TEXT DEFAULT NULL;

-- Update the get_nearby_users function to include the new fields
CREATE OR REPLACE FUNCTION public.get_nearby_users(user_lat double precision, user_lng double precision, radius_km double precision DEFAULT 10.0)
 RETURNS TABLE(user_id uuid, full_name text, username text, location_name text, lat double precision, lng double precision, distance_km double precision, is_online boolean, avatar_emoji text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      WHEN p.status = 'online' AND p.last_seen > NOW() - INTERVAL '2 minutes' THEN true
      ELSE false
    END as is_online,
    p.avatar_emoji
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
$function$