-- Use this when a user exists in Supabase Authentication but is missing from user_profiles.
-- Replace the placeholders before running.

INSERT INTO user_profiles (
  id,
  full_name,
  email,
  role,
  group_id,
  chief_level,
  account_status,
  can_publish,
  can_create_group_meetings,
  can_edit_scouts
)
VALUES (
  'PASTE_AUTH_USER_ID_HERE',
  'Full Name Here',
  'user@example.com',
  'admin',
  'louvetoux',
  'head',
  'active',
  true,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  group_id = EXCLUDED.group_id,
  chief_level = EXCLUDED.chief_level,
  account_status = EXCLUDED.account_status,
  can_publish = EXCLUDED.can_publish,
  can_create_group_meetings = EXCLUDED.can_create_group_meetings,
  can_edit_scouts = EXCLUDED.can_edit_scouts,
  updated_at = now();
