
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create enum types
CREATE TYPE public.help_category AS ENUM ('Medical', 'Food', 'Vehicle', 'Other');
CREATE TYPE public.user_status AS ENUM ('online', 'offline', 'away');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  location_name TEXT,
  location_point GEOGRAPHY(POINT, 4326),
  status user_status DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create help_requests table
CREATE TABLE public.help_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category help_category NOT NULL,
  message TEXT NOT NULL,
  is_urgent BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  location_name TEXT,
  location_point GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create messages table for chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  help_request_id UUID REFERENCES public.help_requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  location_name TEXT,
  location_point GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create user_locations table for real-time location tracking
CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_point GEOGRAPHY(POINT, 4326) NOT NULL,
  location_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE(user_id)
);

-- Create spatial indexes for location queries
CREATE INDEX idx_profiles_location ON public.profiles USING GIST (location_point);
CREATE INDEX idx_help_requests_location ON public.help_requests USING GIST (location_point);
CREATE INDEX idx_messages_location ON public.messages USING GIST (location_point);
CREATE INDEX idx_user_locations_point ON public.user_locations USING GIST (location_point);

-- Create indexes for performance
CREATE INDEX idx_help_requests_created_at ON public.help_requests (created_at DESC);
CREATE INDEX idx_messages_created_at ON public.messages (created_at DESC);
CREATE INDEX idx_help_requests_user_id ON public.help_requests (user_id);
CREATE INDEX idx_messages_user_id ON public.messages (user_id);
CREATE INDEX idx_messages_help_request_id ON public.messages (help_request_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Help requests policies
CREATE POLICY "Users can view all help requests" ON public.help_requests FOR SELECT USING (true);
CREATE POLICY "Users can create help requests" ON public.help_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own help requests" ON public.help_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own help requests" ON public.help_requests FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view all messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Users can create messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- User locations policies
CREATE POLICY "Users can view all user locations" ON public.user_locations FOR SELECT USING (true);
CREATE POLICY "Users can manage own location" ON public.user_locations FOR ALL USING (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user's last seen
CREATE OR REPLACE FUNCTION public.update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen = NOW(), status = 'online'
  WHERE id = auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get nearby help requests
CREATE OR REPLACE FUNCTION public.get_nearby_help_requests(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION, radius_km INTEGER DEFAULT 2)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  category help_category,
  message TEXT,
  is_urgent BOOLEAN,
  is_resolved BOOLEAN,
  location_name TEXT,
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hr.id,
    hr.user_id,
    p.username,
    hr.category,
    hr.message,
    hr.is_urgent,
    hr.is_resolved,
    hr.location_name,
    ST_Distance(hr.location_point, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1000 AS distance_km,
    hr.created_at
  FROM public.help_requests hr
  JOIN public.profiles p ON hr.user_id = p.id
  WHERE ST_DWithin(
    hr.location_point,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000
  )
  AND hr.is_resolved = false
  ORDER BY hr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby users count
CREATE OR REPLACE FUNCTION public.get_nearby_users_count(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION, radius_km INTEGER DEFAULT 2)
RETURNS INTEGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO user_count
  FROM public.user_locations ul
  JOIN public.profiles p ON ul.user_id = p.id
  WHERE ST_DWithin(
    ul.location_point,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_km * 1000
  )
  AND ul.is_active = true
  AND p.status = 'online'
  AND p.last_seen > NOW() - INTERVAL '5 minutes';
  
  RETURN COALESCE(user_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Enable realtime for tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.help_requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_locations REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
