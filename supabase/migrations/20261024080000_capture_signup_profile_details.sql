-- Save the required self-reported profile fields collected during sign-up.
-- This does not verify identity or collect government ID documents.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_social_links JSONB;
BEGIN
  v_social_links := CASE
    WHEN jsonb_typeof(NEW.raw_user_meta_data->'social_links') = 'object'
      THEN NEW.raw_user_meta_data->'social_links'
    ELSE '{}'::jsonb
  END;

  INSERT INTO public.profiles (
    id, username, full_name, phone, home_address, social_links
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'home_address'), ''),
    v_social_links
  );
  RETURN NEW;
END;
$$;
