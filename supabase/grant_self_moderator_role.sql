-- Run once in Supabase Dashboard -> SQL Editor while signed in as the project owner.
-- This UUID is the authenticated profile ID from the user's own request log.
-- It updates protected app metadata (not user-editable profile metadata).
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'moderator')
WHERE id = '6542e4b0-b1ef-4184-871b-fe8aead0d781'::uuid
RETURNING id, email, raw_app_meta_data ->> 'role' AS assigned_role;
