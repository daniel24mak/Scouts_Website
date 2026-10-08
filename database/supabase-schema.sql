-- Supabase production schema for the Scouts platform.
-- Run in Supabase SQL editor after enabling Auth and Storage.

CREATE TABLE scout_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_by text NOT NULL DEFAULT 'schoolGrade',
  assignment_mode text NOT NULL DEFAULT 'schoolGrade',
  is_active boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_scout_year ON scout_years (is_active) WHERE is_active;

CREATE TABLE roles (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE permissions (
  id text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_id text REFERENCES roles(id) ON DELETE CASCADE,
  permission_id text REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  role text NOT NULL REFERENCES roles(id),
  group_id text,
  chief_level text CHECK (chief_level IN ('head', 'vice', 'chief')),
  is_coordinator boolean NOT NULL DEFAULT false,
  coordinator_group_ids text[] NOT NULL DEFAULT '{}',
  account_status text NOT NULL DEFAULT 'active',
  profile_picture_url text,
  pending_name text,
  pending_profile_picture_url text,
  profile_change_status text CHECK (profile_change_status IN ('pending', 'approved', 'rejected')),
  profile_change_comment text,
  profile_change_submitted_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,
  can_publish boolean NOT NULL DEFAULT false,
  can_create_group_meetings boolean NOT NULL DEFAULT false,
  can_edit_scouts boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

CREATE TABLE user_permissions (
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  permission_id text REFERENCES permissions(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  assignment_basis text NOT NULL CHECK (assignment_basis IN ('schoolGrade', 'age')),
  grade_range text,
  age_range text,
  grade_start integer NOT NULL,
  grade_end integer NOT NULL,
  age_start integer NOT NULL,
  age_end integer NOT NULL,
  gender_filter text NOT NULL DEFAULT 'mixed' CHECK (gender_filter IN ('male', 'female', 'mixed'))
);

CREATE TABLE equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (group_id, name)
);

CREATE TABLE scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid NOT NULL REFERENCES scout_years(id),
  name text NOT NULL,
  school_grade text,
  age integer,
  gender text,
  school text,
  group_id text NOT NULL REFERENCES groups(id),
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  parent_name text,
  parent_phone text,
  status text NOT NULL DEFAULT 'Registered',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chiefs (
  id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id text REFERENCES groups(id),
  chief_level text NOT NULL CHECK (chief_level IN ('head', 'vice', 'chief')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scout_equipe_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE equipe_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  chief_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('leader', 'co_leader')),
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (equipe_id, role)
);

CREATE TABLE registration_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid NOT NULL REFERENCES scout_years(id),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES user_profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grouping_rules (
  group_id text PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  assignment_basis text NOT NULL CHECK (assignment_basis IN ('schoolGrade', 'age')),
  grade_start integer NOT NULL,
  grade_end integer NOT NULL,
  age_start integer NOT NULL,
  age_end integer NOT NULL,
  gender_filter text NOT NULL DEFAULT 'mixed' CHECK (gender_filter IN ('male', 'female', 'mixed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid NOT NULL REFERENCES scout_years(id),
  group_id text NOT NULL REFERENCES groups(id),
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'group' CHECK (scope IN ('group', 'equipe')),
  date date NOT NULL,
  topic text NOT NULL DEFAULT 'Meeting',
  taken_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scout_year_id, group_id, date, scope, equipe_id)
);

CREATE TABLE attendance_records (
  session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  scout_id uuid NOT NULL REFERENCES scouts(id),
  status text NOT NULL,
  PRIMARY KEY (session_id, scout_id)
);

CREATE TABLE chief_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid NOT NULL REFERENCES scout_years(id),
  date date NOT NULL,
  topic text NOT NULL DEFAULT 'Chief meeting',
  taken_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chief_attendance_records (
  session_id uuid NOT NULL REFERENCES chief_attendance_sessions(id) ON DELETE CASCADE,
  chief_id uuid NOT NULL REFERENCES user_profiles(id),
  status text NOT NULL,
  PRIMARY KEY (session_id, chief_id)
);

CREATE TYPE content_status AS ENUM ('draft', 'pending', 'pending_update', 'needs_changes', 'approved', 'rejected', 'archived');

CREATE TABLE gallery_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  title text NOT NULL,
  event_date date,
  location text,
  category text,
  color text NOT NULL DEFAULT '#2f7d6d',
  cover_label text,
  description text,
  thumbnail_url text,
  thumbnail_storage_path text,
  thumbnail_source text DEFAULT 'placeholder',
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'blog' CHECK (content_type IN ('blog', 'news')),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('camp', 'weekly_meeting', 'general', 'church_mass', 'celebration', 'outdoor_activity', 'volunteering_work')),
  author_name text,
  author_profile_picture_url text,
  thumbnail_color text NOT NULL DEFAULT '#2f7d6d',
  thumbnail_url text,
  thumbnail_path text,
  linked_album_id uuid REFERENCES gallery_albums(id) ON DELETE SET NULL,
  excerpt text,
  body text NOT NULL,
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE post_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_content_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status content_status NOT NULL DEFAULT 'pending_update',
  proposed_data jsonb NOT NULL DEFAULT '{}',
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  upload_batch_id uuid,
  title text NOT NULL,
  storage_path text,
  public_url text,
  thumbnail_url text,
  thumbnail_storage_path text,
  original_file_name text,
  original_format text,
  original_file_size bigint,
  optimized_format text DEFAULT 'webp',
  optimized_width integer,
  optimized_height integer,
  optimized_file_size bigint,
  thumbnail_file_size bigint,
  quality_used numeric,
  sort_order integer NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE photo_upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status content_status NOT NULL DEFAULT 'pending',
  photo_count integer NOT NULL DEFAULT 0,
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gallery_images
  ADD CONSTRAINT gallery_images_upload_batch_id_fkey
  FOREIGN KEY (upload_batch_id) REFERENCES photo_upload_batches(id) ON DELETE SET NULL;

CREATE TABLE album_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_content_id uuid NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status content_status NOT NULL DEFAULT 'pending_update',
  proposed_data jsonb NOT NULL DEFAULT '{}',
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  title text NOT NULL,
  event_date date NOT NULL,
  date_from date,
  date_to date,
  start_time time,
  end_time time,
  event_type text NOT NULL DEFAULT 'event',
  visibility text NOT NULL DEFAULT 'public',
  group_id text REFERENCES groups(id),
  visible_group_ids text[] NOT NULL DEFAULT '{}',
  location text,
  description text,
  image_url text,
  storage_path text,
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  created_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  title text NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  title text NOT NULL,
  body text,
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  scout_year_id uuid REFERENCES scout_years(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  title text NOT NULL,
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  title text NOT NULL,
  storage_path text NOT NULL,
  visibility text NOT NULL DEFAULT 'public',
  status content_status NOT NULL DEFAULT 'pending',
  submitted_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name text NOT NULL,
  content_key text NOT NULL,
  text_value text,
  image_url text,
  storage_path text,
  updated_by uuid REFERENCES user_profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_name, content_key)
);

CREATE TABLE leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  title text NOT NULL,
  photo_url text,
  storage_path text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

CREATE TABLE contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  responded_at timestamptz,
  notes text
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id),
  title text NOT NULL,
  report_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  storage_path text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES user_profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE site_error_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  source text NOT NULL DEFAULT 'client',
  page_url text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chiefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_equipe_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grouping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chief_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chief_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_error_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_profile()
RETURNS user_profiles
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_coordinator_for_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND is_coordinator = true
      AND target_group_id = ANY(coordinator_group_ids)
      AND account_status = 'active'
  );
$$;
CREATE OR REPLACE FUNCTION can_manage_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
      AND group_id = target_group_id
      AND role IN ('admin', 'chief')
      AND chief_level IN ('head', 'vice')
      AND account_status = 'active'
  )
  OR is_coordinator_for_group(target_group_id);
$$;

CREATE OR REPLACE FUNCTION can_take_equipe_attendance(target_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM equipes e
    JOIN user_profiles p ON p.group_id = e.group_id
    WHERE e.id = target_equipe_id
      AND p.id = auth.uid()
      AND p.chief_level IN ('head', 'vice')
      AND p.account_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM equipes e
    WHERE e.id = target_equipe_id
      AND is_coordinator_for_group(e.group_id)
  )
  OR EXISTS (
    SELECT 1
    FROM equipe_leaders
    WHERE equipe_id = target_equipe_id
      AND chief_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE POLICY "admins manage profiles" ON user_profiles
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "users read own profile" ON user_profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "admins manage scout years" ON scout_years
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "logged in users read scout years" ON scout_years
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins manage user permissions" ON user_permissions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins manage groups" ON groups
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "logged in users read groups" ON groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "logged in users read equipes" ON equipes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "group managers manage equipes" ON equipes
  FOR ALL USING (can_manage_group(group_id)) WITH CHECK (can_manage_group(group_id));

CREATE POLICY "logged in users read equipe leaders" ON equipe_leaders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "group managers manage equipe leaders" ON equipe_leaders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM equipes WHERE equipes.id = equipe_id AND can_manage_group(equipes.group_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM equipes WHERE equipes.id = equipe_id AND can_manage_group(equipes.group_id))
  );

CREATE POLICY "logged in users read equipe assignments" ON scout_equipe_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "group managers manage equipe assignments" ON scout_equipe_assignments
  FOR ALL USING (can_manage_group(group_id)) WITH CHECK (can_manage_group(group_id));

CREATE POLICY "admins manage grouping rules" ON grouping_rules
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "logged in users read grouping rules" ON grouping_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins manage registration uploads" ON registration_uploads
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "logged in users read registration uploads" ON registration_uploads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admins manage scouts" ON scouts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "group managers update scout equipes" ON scouts
  FOR UPDATE USING (can_manage_group(group_id)) WITH CHECK (can_manage_group(group_id));

CREATE POLICY "chiefs read assigned scouts" ON scouts
  FOR SELECT USING (
    is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR is_coordinator_for_group(group_id)
  );

CREATE POLICY "attendance by assigned chiefs" ON attendance_sessions
  FOR ALL USING (
    is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR is_coordinator_for_group(group_id)
    OR (equipe_id IS NOT NULL AND can_take_equipe_attendance(equipe_id))
  ) WITH CHECK (
    is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR is_coordinator_for_group(group_id)
    OR (equipe_id IS NOT NULL AND can_take_equipe_attendance(equipe_id))
  );

CREATE POLICY "attendance records follow session" ON attendance_records
  FOR ALL USING (
    is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
        OR is_coordinator_for_group(group_id)
    )
  ) WITH CHECK (
    is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
        OR is_coordinator_for_group(group_id)
    )
  );

CREATE POLICY "admins manage chief attendance sessions" ON chief_attendance_sessions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins manage chief attendance records" ON chief_attendance_records
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "approved content public" ON content_submissions
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "users submit content" ON content_submissions
  FOR INSERT WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "admins review content" ON content_submissions
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins manage approval requests" ON approval_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "users read own approval requests" ON approval_requests
  FOR SELECT USING (is_admin() OR submitted_by = auth.uid());

CREATE POLICY "admins manage reports" ON reports
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "approved posts public" ON posts
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "admins manage posts" ON posts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "chiefs submit posts" ON posts
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "review post revisions visible" ON post_revisions
  FOR SELECT USING (is_admin() OR submitted_by = auth.uid());

CREATE POLICY "submitters create post revisions" ON post_revisions
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('pending_update', 'pending', 'draft'));

CREATE POLICY "admins manage post revisions" ON post_revisions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "submitters revise posts" ON posts
  FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "approved albums public" ON gallery_albums
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "admins manage albums" ON gallery_albums
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "chiefs submit albums" ON gallery_albums
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "review album revisions visible" ON album_revisions
  FOR SELECT USING (is_admin() OR submitted_by = auth.uid());

CREATE POLICY "submitters create album revisions" ON album_revisions
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('pending_update', 'pending', 'draft'));

CREATE POLICY "admins manage album revisions" ON album_revisions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "submitters revise albums" ON gallery_albums
  FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "approved photos public" ON gallery_images
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "admins manage photos" ON gallery_images
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "chiefs submit photos" ON gallery_images
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "submitters revise photos" ON gallery_images
  FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'pending', 'pending_update', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "admins manage photo batches" ON photo_upload_batches
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "submitters read own photo batches" ON photo_upload_batches
  FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "submitters create photo batches" ON photo_upload_batches
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "submitters revise own photo batches" ON photo_upload_batches
  FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

CREATE POLICY "approved events public" ON calendar_events
  FOR SELECT USING (
    is_admin()
    OR submitted_by = auth.uid()
    OR (status = 'approved' AND visibility = 'public')
    OR (status = 'approved' AND visibility = 'logged-in' AND auth.uid() IS NOT NULL)
    OR (
      status = 'approved'
      AND visibility = 'group'
      AND auth.uid() IS NOT NULL
      AND (
        group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
        OR (SELECT group_id FROM user_profiles WHERE id = auth.uid()) = ANY(visible_group_ids)
      )
    )
  );

CREATE POLICY "admins manage events" ON calendar_events
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "chiefs submit events" ON calendar_events
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "submitters revise events" ON calendar_events
  FOR UPDATE USING (
    (submitted_by = auth.uid() OR created_by = auth.uid())
    AND status IN ('draft', 'pending', 'approved', 'needs_changes', 'rejected')
  )
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

CREATE POLICY "approved announcements public" ON announcements
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "admins manage announcements" ON announcements
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins manage documents" ON documents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "approved documents public" ON documents
  FOR SELECT USING (status = 'approved' OR is_admin() OR submitted_by = auth.uid());

CREATE POLICY "public read site content" ON site_content
  FOR SELECT USING (true);

CREATE POLICY "admins manage site content" ON site_content
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "public read active leaders" ON leaders
  FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "admins manage leaders" ON leaders
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "public read active faqs" ON faqs
  FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "admins manage faqs" ON faqs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "public submit contact messages" ON contact_messages
  FOR INSERT WITH CHECK (status = 'new');

CREATE POLICY "admins manage contact messages" ON contact_messages
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admins manage audit logs" ON audit_logs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "public submit site error messages" ON site_error_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admins read site error messages" ON site_error_messages
  FOR SELECT USING (is_admin());

CREATE POLICY "admins delete site error messages" ON site_error_messages
  FOR DELETE USING (is_admin());

GRANT INSERT ON public.site_error_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.site_error_messages TO authenticated;
CREATE INDEX site_error_messages_created_at_idx ON site_error_messages (created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('scouts-files', 'scouts-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('site-images', 'site-images', true),
  ('leader-headshots', 'leader-headshots', true),
  ('gallery', 'gallery', true),
  ('blog-thumbnails', 'blog-thumbnails', true),
  ('event-images', 'event-images', true),
  ('album-thumbnails', 'album-thumbnails', true),
  ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = true
WHERE id IN ('scouts-files', 'site-images', 'leader-headshots', 'gallery', 'blog-thumbnails', 'event-images', 'album-thumbnails', 'profile-pictures');

CREATE POLICY "admins upload scouts files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scouts-files' AND public.is_admin());

CREATE POLICY "logged in users upload scouts files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scouts-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "public read scouts files" ON storage.objects
  FOR SELECT USING (bucket_id = 'scouts-files');

CREATE POLICY "admins upload site images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('site-images', 'leader-headshots', 'blog-thumbnails', 'event-images', 'album-thumbnails', 'profile-pictures') AND public.is_admin());

CREATE POLICY "admins delete replaced site images" ON storage.objects
  FOR DELETE USING (bucket_id IN ('site-images', 'leader-headshots', 'gallery', 'blog-thumbnails', 'event-images', 'album-thumbnails') AND public.is_admin());

CREATE POLICY "logged in users delete own publishable images" ON storage.objects
  FOR DELETE USING (bucket_id IN ('gallery', 'blog-thumbnails', 'album-thumbnails', 'profile-pictures') AND owner = auth.uid());

CREATE POLICY "logged in users upload publishable images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('gallery', 'blog-thumbnails', 'album-thumbnails', 'profile-pictures') AND auth.uid() IS NOT NULL);

CREATE POLICY "public read site images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('site-images', 'leader-headshots', 'gallery', 'blog-thumbnails', 'event-images', 'album-thumbnails'));


-- Dashboard Forms / Evaluations system.
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS manage_form_templates boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS view_all_forms boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS post_forms boolean NOT NULL DEFAULT false;

INSERT INTO permissions (id, description) VALUES
  ('manage_form_templates', 'Create, edit, draft, and manage reusable form templates'),
  ('view_all_forms', 'View all posted forms and all submitted responses'),
  ('post_forms', 'Prepare and submit forms for posting')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
VALUES
  ('admin', 'manage_form_templates'),
  ('admin', 'view_all_forms'),
  ('admin', 'post_forms')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_manage_form_templates()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND manage_form_templates = true
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_post_forms()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND post_forms = true
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_all_forms()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND view_all_forms = true
      AND account_status = 'active'
  );
$$;

CREATE TABLE IF NOT EXISTS form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  current_version_id uuid,
  schema_json jsonb NOT NULL DEFAULT '{"questions": []}',
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS form_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  schema_json jsonb NOT NULL DEFAULT '{"questions": []}',
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'form_templates_current_version_id_fkey'
  ) THEN
    ALTER TABLE form_templates
    ADD CONSTRAINT form_templates_current_version_id_fkey
    FOREIGN KEY (current_version_id) REFERENCES form_template_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS posted_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES form_template_versions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  instructions text,
  schema_json jsonb NOT NULL DEFAULT '{"questions": []}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'needs_changes', 'open', 'closed', 'rejected', 'archived')),
  target_type text NOT NULL DEFAULT 'all_chiefs' CHECK (target_type IN ('all_chiefs', 'groups', 'users')),
  target_group_ids text[] NOT NULL DEFAULT '{}',
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  linked_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  due_date date,
  allow_edits boolean NOT NULL DEFAULT true,
  reviewer_comment text,
  created_by uuid REFERENCES user_profiles(id),
  approved_by uuid REFERENCES user_profiles(id),
  posted_at timestamptz,
  closed_by uuid REFERENCES user_profiles(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posted_forms
ADD COLUMN IF NOT EXISTS generate_ai_summary boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_form_id uuid NOT NULL REFERENCES posted_forms(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  group_id text REFERENCES groups(id) ON DELETE SET NULL,
  answers_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'edited', 'locked')),
  submitted_at timestamptz,
  edited_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (posted_form_id, submitted_by)
);

CREATE TABLE IF NOT EXISTS form_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_form_id uuid NOT NULL REFERENCES posted_forms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'pending', 'ready', 'failed')),
  summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (posted_form_id)
);

ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posted_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "form templates visible" ON form_templates;
CREATE POLICY "form templates visible" ON form_templates
  FOR SELECT USING (public.can_manage_form_templates() OR public.can_post_forms() OR created_by = auth.uid());
DROP POLICY IF EXISTS "form templates managed" ON form_templates;
CREATE POLICY "form templates managed" ON form_templates
  FOR ALL USING (public.can_manage_form_templates() OR created_by = auth.uid()) WITH CHECK (public.can_manage_form_templates() OR created_by = auth.uid());

DROP POLICY IF EXISTS "form template versions visible" ON form_template_versions;
CREATE POLICY "form template versions visible" ON form_template_versions
  FOR SELECT USING (public.can_manage_form_templates() OR public.can_post_forms() OR created_by = auth.uid());
DROP POLICY IF EXISTS "form template versions managed" ON form_template_versions;
CREATE POLICY "form template versions managed" ON form_template_versions
  FOR ALL USING (public.can_manage_form_templates() OR created_by = auth.uid()) WITH CHECK (public.can_manage_form_templates() OR created_by = auth.uid());

DROP POLICY IF EXISTS "posted forms visible" ON posted_forms;
CREATE POLICY "posted forms visible" ON posted_forms
  FOR SELECT USING (
    public.can_view_all_forms()
    OR public.can_post_forms()
    OR created_by = auth.uid()
    OR (
      status IN ('open', 'closed')
      AND auth.uid() IS NOT NULL
      AND (
        target_type = 'all_chiefs'
        OR auth.uid() = ANY(target_user_ids)
        OR (SELECT group_id FROM user_profiles WHERE id = auth.uid()) = ANY(target_group_ids)
      )
    )
  );
DROP POLICY IF EXISTS "posted forms managed" ON posted_forms;
CREATE POLICY "posted forms managed" ON posted_forms
  FOR ALL USING (public.can_view_all_forms() OR public.can_post_forms() OR created_by = auth.uid())
  WITH CHECK (public.can_view_all_forms() OR public.can_post_forms() OR created_by = auth.uid());

DROP POLICY IF EXISTS "form submissions visible" ON form_submissions;
CREATE POLICY "form submissions visible" ON form_submissions
  FOR SELECT USING (public.can_view_all_forms() OR submitted_by = auth.uid());
DROP POLICY IF EXISTS "form submissions write own" ON form_submissions;
DROP POLICY IF EXISTS "form submissions insert own open forms" ON form_submissions;
CREATE POLICY "form submissions insert own open forms" ON form_submissions
  FOR INSERT WITH CHECK (
    public.can_view_all_forms()
    OR (
      submitted_by = auth.uid()
      AND EXISTS (SELECT 1 FROM posted_forms WHERE id = posted_form_id AND status = 'open')
    )
  );

DROP POLICY IF EXISTS "form submissions update own open forms" ON form_submissions;
CREATE POLICY "form submissions update own open forms" ON form_submissions
  FOR UPDATE USING (
    public.can_view_all_forms()
    OR (
      submitted_by = auth.uid()
      AND EXISTS (SELECT 1 FROM posted_forms WHERE id = posted_form_id AND status = 'open' AND allow_edits = true)
    )
  ) WITH CHECK (
    public.can_view_all_forms()
    OR (
      submitted_by = auth.uid()
      AND EXISTS (SELECT 1 FROM posted_forms WHERE id = posted_form_id AND status = 'open' AND allow_edits = true)
    )
  );

DROP POLICY IF EXISTS "form ai summaries visible" ON form_ai_summaries;
CREATE POLICY "form ai summaries visible" ON form_ai_summaries
  FOR SELECT USING (public.can_view_all_forms() OR public.can_post_forms());
DROP POLICY IF EXISTS "form ai summaries managed" ON form_ai_summaries;
CREATE POLICY "form ai summaries managed" ON form_ai_summaries
  FOR ALL USING (public.can_view_all_forms()) WITH CHECK (public.can_view_all_forms());

CREATE INDEX IF NOT EXISTS form_templates_status_idx ON form_templates (status);
CREATE INDEX IF NOT EXISTS posted_forms_status_idx ON posted_forms (status);
CREATE INDEX IF NOT EXISTS posted_forms_created_by_idx ON posted_forms (created_by);
CREATE INDEX IF NOT EXISTS form_submissions_posted_form_id_idx ON form_submissions (posted_form_id);
CREATE INDEX IF NOT EXISTS form_submissions_submitted_by_idx ON form_submissions (submitted_by);

-- Notifications and approval-gated website content revisions.
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id text,
  target_section text NOT NULL DEFAULT 'overview',
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Website content changes',
  page_key text NOT NULL DEFAULT 'home',
  proposed_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'needs_changes', 'approved', 'rejected', 'archived')),
  submitted_by uuid REFERENCES user_profiles(id),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "users update own notifications" ON notifications;
CREATE POLICY "users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "system inserts notifications" ON notifications;
CREATE POLICY "system inserts notifications" ON notifications FOR INSERT WITH CHECK (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "admins manage site content revisions" ON site_content_revisions;
CREATE POLICY "admins manage site content revisions" ON site_content_revisions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS site_content_revisions_status_idx ON site_content_revisions (status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.notify_admin_users(notification_type text, notification_title text, notification_message text, entity_type text, entity_id text, target_section text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
  SELECT id, notification_type, notification_title, notification_message, entity_type, entity_id, target_section
  FROM user_profiles WHERE role = 'admin' AND account_status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.notify_contact_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_users('contact', 'New contact message', NEW.name || ' sent: ' || NEW.subject, 'contact_message', NEW.id::text, 'contactMessages');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_message_notification_trigger ON contact_messages;
CREATE TRIGGER contact_message_notification_trigger AFTER INSERT ON contact_messages FOR EACH ROW EXECUTE FUNCTION public.notify_contact_message_created();

CREATE OR REPLACE FUNCTION public.notify_website_revision_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admin_users('approval', 'Website content approval requested', NEW.title, 'site_content_revision', NEW.id::text, 'approvals');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS website_revision_notification_trigger ON site_content_revisions;
CREATE TRIGGER website_revision_notification_trigger AFTER INSERT ON site_content_revisions FOR EACH ROW EXECUTE FUNCTION public.notify_website_revision_created();

CREATE OR REPLACE FUNCTION public.notify_website_revision_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected', 'needs_changes') AND NEW.submitted_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (NEW.submitted_by, 'approval_result', 'Website content ' || replace(NEW.status, '_', ' '), NEW.title || ' was ' || replace(NEW.status, '_', ' '), 'site_content_revision', NEW.id::text, 'websiteContent');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS website_revision_result_notification_trigger ON site_content_revisions;
CREATE TRIGGER website_revision_result_notification_trigger AFTER UPDATE ON site_content_revisions FOR EACH ROW EXECUTE FUNCTION public.notify_website_revision_result();

CREATE OR REPLACE FUNCTION public.notify_profile_change_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.profile_change_status IS DISTINCT FROM NEW.profile_change_status AND NEW.profile_change_status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (NEW.id, 'profile', 'Profile change ' || NEW.profile_change_status, 'Your profile change request was ' || NEW.profile_change_status, 'profile', NEW.id::text, 'overview');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_change_result_notification_trigger ON user_profiles;
CREATE TRIGGER profile_change_result_notification_trigger AFTER UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION public.notify_profile_change_result();

CREATE OR REPLACE FUNCTION public.notify_posted_form_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    SELECT p.id, 'form', 'New form assigned', NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' - due ' || NEW.due_date::text ELSE '' END, 'posted_form', NEW.id::text, 'myForms'
    FROM user_profiles p
    WHERE p.role = 'chief' AND p.account_status = 'active'
      AND (NEW.target_type = 'all_chiefs' OR (NEW.target_type = 'groups' AND p.group_id = ANY(NEW.target_group_ids)) OR (NEW.target_type = 'users' AND p.id = ANY(NEW.target_user_ids)));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS posted_form_opened_notification_trigger ON posted_forms;
CREATE TRIGGER posted_form_opened_notification_trigger AFTER INSERT OR UPDATE ON posted_forms FOR EACH ROW EXECUTE FUNCTION public.notify_posted_form_opened();
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.notify_content_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  submitter uuid;
  item_title text;
  section_name text;
  entity_name text;
BEGIN
  submitter := COALESCE(NULLIF(to_jsonb(NEW) ->> 'submitted_by', '')::uuid, NULLIF(to_jsonb(NEW) ->> 'created_by', '')::uuid);
  item_title := COALESCE(to_jsonb(NEW) ->> 'title', 'Untitled submission');
  section_name := CASE TG_TABLE_NAME WHEN 'posts' THEN 'posts' WHEN 'gallery_albums' THEN 'gallery' WHEN 'calendar_events' THEN 'calendar' ELSE 'overview' END;
  entity_name := CASE TG_TABLE_NAME WHEN 'posts' THEN 'Blog post' WHEN 'gallery_albums' THEN 'Album' WHEN 'calendar_events' THEN 'Calendar event' ELSE 'Content' END;
  IF TG_OP = 'INSERT' AND NEW.status::text IN ('pending', 'pending_update') THEN
    PERFORM public.notify_admin_users('approval', 'New ' || lower(entity_name) || ' approval', item_title, TG_TABLE_NAME, NEW.id::text, 'approvals');
  ELSIF TG_OP = 'UPDATE' AND OLD.status::text IS DISTINCT FROM NEW.status::text AND NEW.status::text IN ('approved', 'rejected', 'needs_changes') AND submitter IS NOT NULL THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (submitter, 'approval_result', entity_name || ' ' || replace(NEW.status::text, '_', ' '), 'Your ' || lower(entity_name) || ' "' || item_title || '" was ' || replace(NEW.status::text, '_', ' '), TG_TABLE_NAME, NEW.id::text, section_name);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_workflow_notification_trigger ON posts;
CREATE TRIGGER posts_workflow_notification_trigger AFTER INSERT OR UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION public.notify_content_workflow();
DROP TRIGGER IF EXISTS albums_workflow_notification_trigger ON gallery_albums;
CREATE TRIGGER albums_workflow_notification_trigger AFTER INSERT OR UPDATE ON gallery_albums FOR EACH ROW EXECUTE FUNCTION public.notify_content_workflow();
DROP TRIGGER IF EXISTS events_workflow_notification_trigger ON calendar_events;
CREATE TRIGGER events_workflow_notification_trigger AFTER INSERT OR UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION public.notify_content_workflow();
CREATE OR REPLACE FUNCTION public.notify_profile_change_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.profile_change_status IS DISTINCT FROM NEW.profile_change_status AND NEW.profile_change_status = 'pending' THEN
    PERFORM public.notify_admin_users('approval', 'Profile change approval requested', NEW.name || ' submitted a profile change', 'profile', NEW.id::text, 'approvals');
  ELSIF OLD.profile_change_status IS DISTINCT FROM NEW.profile_change_status AND NEW.profile_change_status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (NEW.id, 'profile', 'Profile change ' || NEW.profile_change_status, 'Your profile change request was ' || NEW.profile_change_status, 'profile', NEW.id::text, 'overview');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_posted_form_opened()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.notify_admin_users('approval', 'New form approval', NEW.title, 'posted_form', NEW.id::text, 'approvals');
  END IF;

  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    SELECT p.id, 'form', 'New form assigned', NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' - due ' || NEW.due_date::text ELSE '' END, 'posted_form', NEW.id::text, 'myForms'
    FROM user_profiles p
    WHERE p.role = 'chief' AND p.account_status = 'active'
      AND (NEW.target_type = 'all_chiefs' OR (NEW.target_type = 'groups' AND p.group_id = ANY(NEW.target_group_ids)) OR (NEW.target_type = 'users' AND p.id = ANY(NEW.target_user_ids)));

    IF TG_OP = 'UPDATE' AND NEW.created_by IS NOT NULL THEN
      INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
      VALUES (NEW.created_by, 'approval_result', 'Form approved', 'Your form "' || NEW.title || '" was approved and opened', 'posted_form', NEW.id::text, 'manageForms');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('rejected', 'needs_changes') AND NEW.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (NEW.created_by, 'approval_result', 'Form ' || replace(NEW.status, '_', ' '), 'Your form "' || NEW.title || '" was ' || replace(NEW.status, '_', ' '), 'posted_form', NEW.id::text, 'manageForms');
  END IF;
  RETURN NEW;
END $$;
-- Idempotent form assignment notifications. The trigger and client RPC both use
-- this function so an approval transition cannot silently miss its recipients.
CREATE OR REPLACE FUNCTION public.create_posted_form_notifications(target_form_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_form public.posted_forms%ROWTYPE;
  inserted_count integer := 0;
BEGIN
  SELECT * INTO target_form FROM public.posted_forms WHERE id = target_form_id;
  IF NOT FOUND OR target_form.status <> 'open' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
  SELECT
    profile.id,
    'form',
    'New form assigned',
    'A new form "' || target_form.title || '" has been assigned to you' ||
      CASE WHEN target_form.due_date IS NOT NULL THEN '. Due ' || target_form.due_date::text ELSE '' END,
    'posted_form',
    target_form.id::text,
    'myForms'
  FROM public.user_profiles profile
  WHERE profile.role = 'chief'
    AND profile.account_status = 'active'
    AND (
      target_form.target_type = 'all_chiefs'
      OR (target_form.target_type = 'groups' AND profile.group_id = ANY(target_form.target_group_ids))
      OR (target_form.target_type = 'users' AND profile.id = ANY(target_form.target_user_ids))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications existing
      WHERE existing.user_id = profile.id
        AND existing.notification_type = 'form'
        AND existing.entity_type = 'posted_form'
        AND existing.entity_id = target_form.id::text
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION public.notify_posted_form_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.notify_admin_users('approval', 'New form approval', NEW.title, 'posted_form', NEW.id::text, 'approvals');
  END IF;

  IF NEW.status = 'open' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.create_posted_form_notifications(NEW.id);
    IF TG_OP = 'UPDATE' AND NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
      SELECT NEW.created_by, 'approval_result', 'Form approved', 'Your form "' || NEW.title || '" was approved and opened', 'posted_form', NEW.id::text, 'manageForms'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = NEW.created_by AND n.notification_type = 'approval_result'
          AND n.entity_type = 'posted_form' AND n.entity_id = NEW.id::text AND n.title = 'Form approved'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('rejected', 'needs_changes') AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, notification_type, title, message, entity_type, entity_id, target_section)
    VALUES (NEW.created_by, 'approval_result', 'Form ' || replace(NEW.status, '_', ' '), 'Your form "' || NEW.title || '" was ' || replace(NEW.status, '_', ' '), 'posted_form', NEW.id::text, 'manageForms');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posted_form_opened_notification_trigger ON public.posted_forms;
CREATE TRIGGER posted_form_opened_notification_trigger
AFTER INSERT OR UPDATE ON public.posted_forms
FOR EACH ROW EXECUTE FUNCTION public.notify_posted_form_opened();
DO $$
DECLARE
  open_form record;
BEGIN
  FOR open_form IN SELECT id FROM public.posted_forms WHERE status = 'open' LOOP
    PERFORM public.create_posted_form_notifications(open_form.id);
  END LOOP;
END $$;
-- Public contact submissions and notification cleanup policy refresh.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow anonymous contact submissions" ON public.contact_messages;
CREATE POLICY "Allow anonymous contact submissions" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND length(trim(name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(subject)) > 0
    AND length(trim(message)) > 0
  );

DROP POLICY IF EXISTS "users delete own notifications" ON public.notifications;
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());
-- Automatically complete stale related notifications when work is handled.
CREATE OR REPLACE FUNCTION public.mark_entity_notifications_done(target_entity_type text, target_entity_id text, target_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE entity_type = target_entity_type
    AND entity_id = target_entity_id
    AND is_read = false
    AND (target_user_id IS NULL OR user_id = target_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.complete_approval_notifications_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text;
  new_status text;
  entity_name text;
BEGIN
  old_status := COALESCE(to_jsonb(OLD) ->> 'status', to_jsonb(OLD) ->> 'profile_change_status');
  new_status := COALESCE(to_jsonb(NEW) ->> 'status', to_jsonb(NEW) ->> 'profile_change_status');
  entity_name := CASE TG_TABLE_NAME
    WHEN 'posts' THEN 'posts'
    WHEN 'gallery_albums' THEN 'gallery_albums'
    WHEN 'calendar_events' THEN 'calendar_events'
    WHEN 'posted_forms' THEN 'posted_form'
    WHEN 'site_content_revisions' THEN 'site_content_revision'
    WHEN 'user_profiles' THEN 'profile'
    ELSE TG_TABLE_NAME
  END;

  IF old_status IS DISTINCT FROM new_status AND new_status NOT IN ('pending', 'pending_update') THEN
    PERFORM public.mark_entity_notifications_done(entity_name, NEW.id::text);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complete_posts_notifications_trigger ON public.posts;
CREATE TRIGGER complete_posts_notifications_trigger AFTER UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();
DROP TRIGGER IF EXISTS complete_albums_notifications_trigger ON public.gallery_albums;
CREATE TRIGGER complete_albums_notifications_trigger AFTER UPDATE ON public.gallery_albums FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();
DROP TRIGGER IF EXISTS complete_events_notifications_trigger ON public.calendar_events;
CREATE TRIGGER complete_events_notifications_trigger AFTER UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();
DROP TRIGGER IF EXISTS complete_posted_forms_notifications_trigger ON public.posted_forms;
CREATE TRIGGER complete_posted_forms_notifications_trigger AFTER UPDATE ON public.posted_forms FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();
DROP TRIGGER IF EXISTS complete_site_content_notifications_trigger ON public.site_content_revisions;
CREATE TRIGGER complete_site_content_notifications_trigger AFTER UPDATE ON public.site_content_revisions FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();
DROP TRIGGER IF EXISTS complete_profile_notifications_trigger ON public.user_profiles;
CREATE TRIGGER complete_profile_notifications_trigger AFTER UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.complete_approval_notifications_on_status_change();

CREATE OR REPLACE FUNCTION public.complete_form_notification_on_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.mark_entity_notifications_done('posted_form', NEW.posted_form_id::text, NEW.submitted_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS complete_form_notification_on_submission_trigger ON public.form_submissions;
CREATE TRIGGER complete_form_notification_on_submission_trigger AFTER INSERT OR UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION public.complete_form_notification_on_submission();
-- Public contact message RPC. Use this instead of direct public table inserts.
CREATE OR REPLACE FUNCTION public.submit_contact_message(
  contact_name text,
  contact_email text,
  contact_subject text,
  contact_message text,
  contact_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_message_id uuid;
BEGIN
  IF length(trim(COALESCE(contact_name, ''))) = 0
    OR length(trim(COALESCE(contact_email, ''))) = 0
    OR length(trim(COALESCE(contact_subject, ''))) = 0
    OR length(trim(COALESCE(contact_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Missing required contact message fields';
  END IF;

  INSERT INTO public.contact_messages (name, email, phone, subject, message, status)
  VALUES (
    left(trim(contact_name), 120),
    left(lower(trim(contact_email)), 180),
    NULLIF(left(trim(COALESCE(contact_phone, '')), 40), ''),
    left(trim(contact_subject), 180),
    left(trim(contact_message), 3000),
    'new'
  )
  RETURNING id INTO new_message_id;

  RETURN new_message_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_contact_message(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(text, text, text, text, text) TO anon, authenticated;
-- Settings: documents, reports, and archived years.
CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_name text,
ADD COLUMN IF NOT EXISTS file_type text,
ADD COLUMN IF NOT EXISTS mime_type text,
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES document_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS archived_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_year_id uuid REFERENCES scout_years(id) ON DELETE SET NULL,
  year_label text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}',
  archived_by uuid REFERENCES user_profiles(id),
  archived_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read document categories" ON document_categories;
CREATE POLICY "authenticated read document categories" ON document_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins manage document categories" ON document_categories;
CREATE POLICY "admins manage document categories" ON document_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "approved documents public" ON documents;
DROP POLICY IF EXISTS "authenticated read documents" ON documents;
CREATE POLICY "authenticated read documents" ON documents
  FOR SELECT USING (auth.uid() IS NOT NULL AND status::text = 'approved');

DROP POLICY IF EXISTS "authenticated read archived years" ON archived_years;
CREATE POLICY "authenticated read archived years" ON archived_years
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

DROP POLICY IF EXISTS "admins manage archived years" ON archived_years;
CREATE POLICY "admins manage archived years" ON archived_years
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS documents_category_id_idx ON documents (category_id);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS archived_years_archived_at_idx ON archived_years (archived_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('dashboard-documents', 'dashboard-documents', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = true
WHERE id = 'dashboard-documents';

DROP POLICY IF EXISTS "admins upload dashboard documents" ON storage.objects;
CREATE POLICY "admins upload dashboard documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dashboard-documents' AND public.is_admin());

DROP POLICY IF EXISTS "admins delete dashboard documents" ON storage.objects;
CREATE POLICY "admins delete dashboard documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'dashboard-documents' AND public.is_admin());

DROP POLICY IF EXISTS "authenticated read dashboard documents" ON storage.objects;
CREATE POLICY "authenticated read dashboard documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'dashboard-documents' AND auth.uid() IS NOT NULL);
-- Automatic admin activity report logging for critical dashboard tables.
CREATE OR REPLACE FUNCTION public.log_dashboard_table_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id text;
  action_name text;
  old_row jsonb;
  new_row jsonb;
  changed_fields jsonb;
BEGIN
  target_id := COALESCE(NEW.id::text, OLD.id::text);
  action_name := lower(TG_OP) || '_' || TG_TABLE_NAME;
  old_row := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_row := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  changed_fields := CASE
    WHEN TG_OP = 'UPDATE' THEN (
      SELECT COALESCE(jsonb_agg(new_entry.key), '[]'::jsonb)
      FROM jsonb_each(new_row) AS new_entry
      JOIN jsonb_each(old_row) AS old_entry ON old_entry.key = new_entry.key
      WHERE new_entry.value IS DISTINCT FROM old_entry.value
    )
    ELSE '[]'::jsonb
  END;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    action_name,
    TG_TABLE_NAME,
    target_id,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'changed_fields', changed_fields,
      'old_status', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)->>'status' ELSE NULL END,
      'new_status', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)->>'status' ELSE NULL END,
      'old', jsonb_strip_nulls(jsonb_build_object(
        'name', old_row->>'name',
        'title', old_row->>'title',
        'file_name', old_row->>'file_name',
        'role', old_row->>'role',
        'account_status', old_row->>'account_status',
        'status', old_row->>'status',
        'approval_status', old_row->>'approval_status',
        'chief_level', old_row->>'chief_level',
        'group_id', old_row->>'group_id',
        'category_id', old_row->>'category_id',
        'date', old_row->>'date',
        'date_from', old_row->>'date_from',
        'source', old_row->>'source',
        'roles', old_row->'roles',
        'assigned_group_ids', old_row->'assigned_group_ids',
        'coordinator_group_ids', old_row->'coordinator_group_ids',
        'posted_form_id', old_row->>'posted_form_id',
        'album_id', old_row->>'album_id'
      )),
      'new', jsonb_strip_nulls(jsonb_build_object(
        'name', new_row->>'name',
        'title', new_row->>'title',
        'file_name', new_row->>'file_name',
        'role', new_row->>'role',
        'account_status', new_row->>'account_status',
        'status', new_row->>'status',
        'approval_status', new_row->>'approval_status',
        'chief_level', new_row->>'chief_level',
        'group_id', new_row->>'group_id',
        'category_id', new_row->>'category_id',
        'date', new_row->>'date',
        'date_from', new_row->>'date_from',
        'source', new_row->>'source',
        'roles', new_row->'roles',
        'assigned_group_ids', new_row->'assigned_group_ids',
        'coordinator_group_ids', new_row->'coordinator_group_ids',
        'posted_form_id', new_row->>'posted_form_id',
        'album_id', new_row->>'album_id'
      ))
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_profiles',
    'scouts',
    'registration_uploads',
    'groups',
    'grouping_rules',
    'site_content',
    'site_content_revisions',
    'posts',
    'post_revisions',
    'gallery_albums',
    'album_revisions',
    'gallery_images',
    'photo_upload_batches',
    'calendar_events',
    'attendance_sessions',
    'chief_attendance_sessions',
    'contact_messages',
    'documents',
    'document_categories',
    'archived_years',
    'form_templates',
    'posted_forms',
    'form_submissions'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS dashboard_activity_audit ON public.%I', table_name);
      EXECUTE format(
        'CREATE TRIGGER dashboard_activity_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_dashboard_table_activity()',
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- BEGIN ACCESS CONTROL FOUNDATION
-- Mirrored from database/supabase-access-control-foundation.sql.
-- Additive normalized access-control foundation.
-- This release is shadow-only: existing authorization remains authoritative.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS is_system_role boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS requires_mfa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS ip_address_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_summary text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_risk_level_check' AND conrelid = 'public.roles'::regclass) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_risk_level_check CHECK (risk_level IN ('standard', 'elevated', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permissions_risk_level_check' AND conrelid = 'public.permissions'::regclass) THEN
    ALTER TABLE public.permissions
      ADD CONSTRAINT permissions_risk_level_check CHECK (risk_level IN ('standard', 'elevated', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_account_status_check' AND conrelid = 'public.user_profiles'::regclass) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_account_status_check
      CHECK (account_status IN ('invited', 'active', 'disabled', 'suspended', 'archived')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assignment_reason text NOT NULL DEFAULT 'Legacy migration',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.user_group_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('chief','vice_chief','head_chief','coordinator','equipe_leader','assistant')),
  is_primary boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (length(btrim(key)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  team_type text NOT NULL DEFAULT 'committee',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('member','assistant','coordinator','manager')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  added_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permissions(id) ON DELETE RESTRICT,
  effect text NOT NULL CHECK (effect IN ('allow','deny')),
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.authorization_migration_differences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  permission_key text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  resource_type text,
  resource_id text,
  legacy_allowed boolean NOT NULL,
  normalized_allowed boolean NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolution_note text,
  CHECK (legacy_allowed IS DISTINCT FROM normalized_allowed),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.authorization_module_modes (
  module text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode IN ('legacy','shadow','normalized')),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  review_type text NOT NULL,
  status text NOT NULL DEFAULT 'review_required'
    CHECK (status IN ('review_required','confirmed','remove_access','pending_clarification')),
  findings jsonb NOT NULL DEFAULT '{}',
  due_at timestamptz,
  reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.authorization_module_modes (module, mode)
VALUES
  ('dashboard', 'shadow'),
  ('forms', 'shadow'),
  ('content', 'shadow'),
  ('media', 'shadow'),
  ('scouts', 'shadow'),
  ('attendance', 'shadow'),
  ('equipes', 'shadow'),
  ('documents', 'shadow'),
  ('reports', 'shadow'),
  ('archives', 'shadow'),
  ('contact_messages', 'shadow'),
  ('website_content', 'shadow'),
  ('people_access', 'shadow'),
  ('finance', 'shadow'),
  ('storage', 'shadow')
ON CONFLICT (module) DO UPDATE
SET mode = 'shadow', updated_by = NULL, updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_assignments_no_overlap' AND conrelid = 'public.user_role_assignments'::regclass) THEN
    ALTER TABLE public.user_role_assignments
      ADD CONSTRAINT user_role_assignments_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        role_id WITH =,
        scope_type WITH =,
        (COALESCE(scope_id, '')) WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_group_assignments_no_overlap' AND conrelid = 'public.user_group_assignments'::regclass) THEN
    ALTER TABLE public.user_group_assignments
      ADD CONSTRAINT user_group_assignments_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        group_id WITH =,
        position WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_group_assignments_primary_no_overlap' AND conrelid = 'public.user_group_assignments'::regclass) THEN
    ALTER TABLE public.user_group_assignments
      ADD CONSTRAINT user_group_assignments_primary_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      ) WHERE (is_primary);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_team_memberships_no_overlap' AND conrelid = 'public.user_team_memberships'::regclass) THEN
    ALTER TABLE public.user_team_memberships
      ADD CONSTRAINT user_team_memberships_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        team_id WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permission_overrides_no_overlap' AND conrelid = 'public.user_permission_overrides'::regclass) THEN
    ALTER TABLE public.user_permission_overrides
      ADD CONSTRAINT user_permission_overrides_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        permission_id WITH =,
        effect WITH =,
        scope_type WITH =,
        (COALESCE(scope_id, '')) WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_current_unique
  ON public.user_role_assignments (user_id, role_id, scope_type, COALESCE(scope_id, ''))
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_current_unique
  ON public.user_group_assignments (user_id, group_id, position)
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_primary_unique
  ON public.user_group_assignments (user_id)
  WHERE is_primary AND expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_team_memberships_current_unique
  ON public.user_team_memberships (user_id, team_id)
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_current_unique
  ON public.user_permission_overrides (user_id, permission_id, effect, scope_type, COALESCE(scope_id, ''))
  WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS user_role_assignments_user_active_idx
  ON public.user_role_assignments (user_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS user_role_assignments_scope_idx
  ON public.user_role_assignments (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON public.role_permissions (permission_id, role_id);
CREATE INDEX IF NOT EXISTS user_group_assignments_group_idx
  ON public.user_group_assignments (group_id, user_id);
CREATE INDEX IF NOT EXISTS user_team_memberships_user_idx
  ON public.user_team_memberships (user_id, team_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx
  ON public.user_permission_overrides (user_id, permission_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS authorization_migration_unresolved_idx
  ON public.authorization_migration_differences (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_migration_differences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_module_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_dashboard_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_required_aal(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (
      SELECT NOT p.requires_mfa
        OR COALESCE(
          auth.jwt() ->> 'aal' = 'aal2',
          false
        )
      FROM public.permissions p
      WHERE p.id = target_permission
        AND p.is_active
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND ura.scope_type = 'global'
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND upo.scope_type = 'global'
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_global_permission(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND ura.scope_type = 'global'
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND upo.scope_type = 'global'
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_group_access(target_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_group_assignments uga
      WHERE uga.user_id = auth.uid()
        AND uga.group_id = target_group_id
        AND uga.starts_at <= now()
        AND (uga.expires_at IS NULL OR uga.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_team_access(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_team_memberships utm
      JOIN public.teams t ON t.id = utm.team_id AND t.is_active
      WHERE utm.user_id = auth.uid()
        AND utm.team_id = target_team_id
        AND utm.starts_at <= now()
        AND (utm.expires_at IS NULL OR utm.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_group(target_permission text, target_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'group' AND ura.scope_id = target_group_id)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_team(target_permission text, target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = target_team_id
        AND t.is_active
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'team' AND ura.scope_id = target_team_id::text)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_event(target_permission text, target_event_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'event' AND ura.scope_id = target_event_id)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.get_my_effective_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  account_status_value text;
  role_items jsonb := '[]'::jsonb;
  permission_items jsonb := '[]'::jsonb;
  group_items jsonb := '[]'::jsonb;
  team_items jsonb := '[]'::jsonb;
  restriction_items jsonb := '[]'::jsonb;
BEGIN
  SELECT p.account_status
  INTO account_status_value
  FROM public.user_profiles p
  WHERE p.id = auth.uid();

  IF account_status_value IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object(
      'accountStatus', COALESCE(account_status_value, 'missing'),
      'roles', role_items,
      'permissions', permission_items,
      'groupAssignments', group_items,
      'teamMemberships', team_items,
      'restrictions', restriction_items,
      'generatedAt', now()
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', ura.role_id,
        'scopeType', ura.scope_type,
        'scopeId', ura.scope_id,
        'expiresAt', ura.expires_at
      )
      ORDER BY ura.role_id, ura.scope_type, COALESCE(ura.scope_id, '')
    ),
    '[]'::jsonb
  )
  INTO role_items
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id AND r.is_active
  WHERE ura.user_id = auth.uid()
    AND ura.starts_at <= now()
    AND (ura.expires_at IS NULL OR ura.expires_at > now())
    AND (
      ura.scope_type <> 'team'
      OR EXISTS (
        SELECT 1 FROM public.teams scoped_team
        WHERE scoped_team.id::text = ura.scope_id AND scoped_team.is_active
      )
    );

  WITH candidates AS (
    SELECT
      rp.permission_id AS permission_key,
      ura.scope_type,
      ura.scope_id,
      ura.role_id AS source,
      ura.expires_at,
      p.requires_mfa
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
    WHERE ura.user_id = auth.uid()
      AND ura.starts_at <= now()
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
      AND (
        ura.scope_type <> 'team'
        OR EXISTS (
          SELECT 1 FROM public.teams scoped_team
          WHERE scoped_team.id::text = ura.scope_id AND scoped_team.is_active
        )
      )

    UNION ALL

    SELECT
      upo.permission_id,
      upo.scope_type,
      upo.scope_id,
      'override'::text,
      upo.expires_at,
      p.requires_mfa
    FROM public.user_permission_overrides upo
    JOIN public.permissions p ON p.id = upo.permission_id AND p.is_active
    WHERE upo.user_id = auth.uid()
      AND upo.effect = 'allow'
      AND upo.starts_at <= now()
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
      AND (
        upo.scope_type <> 'team'
        OR EXISTS (
          SELECT 1 FROM public.teams scoped_team
          WHERE scoped_team.id::text = upo.scope_id AND scoped_team.is_active
        )
      )
  ), effective AS (
    SELECT DISTINCT
      candidate.permission_key,
      candidate.scope_type,
      candidate.scope_id,
      candidate.source,
      candidate.expires_at,
      candidate.requires_mfa
    FROM candidates candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides denied
      WHERE denied.user_id = auth.uid()
        AND denied.permission_id = candidate.permission_key
        AND denied.effect = 'deny'
        AND denied.starts_at <= now()
        AND (denied.expires_at IS NULL OR denied.expires_at > now())
        AND (
          denied.scope_type = 'global'
          OR (
            denied.scope_type = candidate.scope_type
            AND denied.scope_id IS NOT DISTINCT FROM candidate.scope_id
          )
        )
    )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', effective.permission_key,
        'scopeType', effective.scope_type,
        'scopeId', effective.scope_id,
        'source', effective.source,
        'expiresAt', effective.expires_at,
        'requiresMfa', effective.requires_mfa
      )
      ORDER BY effective.permission_key, effective.scope_type, COALESCE(effective.scope_id, ''), effective.source
    ),
    '[]'::jsonb
  )
  INTO permission_items
  FROM effective;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'groupId', uga.group_id,
        'position', uga.position,
        'isPrimary', uga.is_primary,
        'expiresAt', uga.expires_at
      )
      ORDER BY uga.is_primary DESC, uga.group_id, uga.position
    ),
    '[]'::jsonb
  )
  INTO group_items
  FROM public.user_group_assignments uga
  WHERE uga.user_id = auth.uid()
    AND uga.starts_at <= now()
    AND (uga.expires_at IS NULL OR uga.expires_at > now());

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'teamId', utm.team_id,
        'key', t.key,
        'position', utm.position,
        'expiresAt', utm.expires_at
      )
      ORDER BY t.key, utm.position
    ),
    '[]'::jsonb
  )
  INTO team_items
  FROM public.user_team_memberships utm
  JOIN public.teams t ON t.id = utm.team_id AND t.is_active
  WHERE utm.user_id = auth.uid()
    AND utm.starts_at <= now()
    AND (utm.expires_at IS NULL OR utm.expires_at > now());

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', upo.permission_id,
        'effect', upo.effect,
        'scopeType', upo.scope_type,
        'scopeId', upo.scope_id,
        'expiresAt', upo.expires_at
      )
      ORDER BY upo.permission_id, upo.scope_type, COALESCE(upo.scope_id, '')
    ),
    '[]'::jsonb
  )
  INTO restriction_items
  FROM public.user_permission_overrides upo
  JOIN public.permissions p ON p.id = upo.permission_id AND p.is_active
  WHERE upo.user_id = auth.uid()
    AND upo.effect = 'deny'
    AND upo.starts_at <= now()
    AND (upo.expires_at IS NULL OR upo.expires_at > now())
    AND (
      upo.scope_type <> 'team'
      OR EXISTS (
        SELECT 1 FROM public.teams scoped_team
        WHERE scoped_team.id::text = upo.scope_id AND scoped_team.is_active
      )
    );

  RETURN jsonb_build_object(
    'accountStatus', account_status_value,
    'roles', role_items,
    'permissions', permission_items,
    'groupAssignments', group_items,
    'teamMemberships', team_items,
    'restrictions', restriction_items,
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM anon;
REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM anon;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_required_aal(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_global_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_group_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_group(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_team(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_event(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_legacy_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_legacy_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_legacy_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_legacy_admin() TO authenticated;

DROP POLICY IF EXISTS "active users read active roles" ON public.roles;
CREATE POLICY "active users read active roles" ON public.roles
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read active permissions" ON public.permissions;
CREATE POLICY "active users read active permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read role permissions" ON public.role_permissions;
CREATE POLICY "active users read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read active teams" ON public.teams;
CREATE POLICY "active users read active teams" ON public.teams
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own role assignments" ON public.user_role_assignments;
CREATE POLICY "users read own role assignments" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own group assignments" ON public.user_group_assignments;
CREATE POLICY "users read own group assignments" ON public.user_group_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own team memberships" ON public.user_team_memberships;
CREATE POLICY "users read own team memberships" ON public.user_team_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own permission overrides" ON public.user_permission_overrides;
CREATE POLICY "users read own permission overrides" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "legacy admins read migration differences" ON public.authorization_migration_differences;
CREATE POLICY "legacy admins read migration differences" ON public.authorization_migration_differences
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "legacy admins read authorization modes" ON public.authorization_module_modes;
CREATE POLICY "legacy admins read authorization modes" ON public.authorization_module_modes
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "legacy admins read access reviews" ON public.access_reviews;
CREATE POLICY "legacy admins read access reviews" ON public.access_reviews
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "admins manage audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "legacy admins read audit logs" ON public.audit_logs;
CREATE POLICY "legacy admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "active users append own audit logs" ON public.audit_logs;
CREATE POLICY "active users append own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.is_active_dashboard_user());

REVOKE ALL ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
FROM anon;

REVOKE ALL ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
FROM authenticated;

GRANT SELECT ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
TO authenticated;

GRANT INSERT ON TABLE public.audit_logs TO authenticated;

COMMIT;
-- END ACCESS CONTROL FOUNDATION

-- BEGIN SCOUT YEAR BACKUP DELETION
-- Protected scouting-year backup receipts and transactional deletion.
-- Apply after normalized access control and (when installed) scout registration.
-- The clean-schema mirror also works before the optional registration tables exist.
BEGIN;

INSERT INTO public.permissions (id, description, module, action, risk_level, requires_mfa, is_active)
VALUES ('registration.retention.manage', 'Run protected registration retention workflows', 'registration', 'retention.manage', 'high', true, true)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  requires_mfa = EXCLUDED.requires_mfa,
  is_active = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'system_administrator', 'registration.retention.manage'
FROM public.roles WHERE id = 'system_administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scout_year_backup_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL only after the referenced year has been deleted; manifest retains its ID.
  scout_year_id uuid REFERENCES public.scout_years(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  archive_path text NOT NULL UNIQUE CHECK (length(btrim(archive_path)) > 0 AND archive_path !~ '(^/|(^|/)\.\.(/|$)|://)'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS scout_year_backup_receipts_year_idx
  ON public.scout_year_backup_receipts (scout_year_id, requested_by, created_at DESC);
ALTER TABLE public.scout_year_backup_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scout_year_backup_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.scout_year_backup_receipts TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('scout-year-backups', 'scout-year-backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;
-- No public/anon/authenticated storage.objects policies are added for this bucket.
-- Trusted server code alone uploads archives and issues short-lived signed URLs.

-- Cross-year duplicate reviews must survive removal of a candidate scout.
-- The year-owned duplicate reviews themselves are deleted below.
DO $migration$
BEGIN
  IF to_regclass('public.scout_registration_duplicate_matches') IS NOT NULL THEN
    ALTER TABLE public.scout_registration_duplicate_matches
      ALTER COLUMN candidate_scout_id DROP NOT NULL;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.get_scout_year_backup_snapshot(target_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  source record;
  table_rows jsonb;
  snapshot_data jsonb := '{}'::jsonb;
  snapshot_counts jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.scout_years WHERE id = target_year_id) THEN
    RAISE EXCEPTION 'year_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Full row values include all update timestamps AND fields on tables without
  -- updated_at (attendance status, scout details, uploads, etc.). Ordered IDs
  -- plus complete values detect same-count replacements and in-place edits.
  FOR source IN
    SELECT * FROM (VALUES
      ('scout_years', 'record.id = $1'),
      ('posts', 'record.scout_year_id = $1'),
      ('post_revisions', 'record.original_content_id IN (SELECT id FROM public.posts WHERE scout_year_id = $1)'),
      ('gallery_albums', 'record.scout_year_id = $1'),
      ('gallery_images', 'record.album_id IN (SELECT id FROM public.gallery_albums WHERE scout_year_id = $1)'),
      ('photo_upload_batches', 'record.album_id IN (SELECT id FROM public.gallery_albums WHERE scout_year_id = $1)'),
      ('album_revisions', 'record.original_content_id IN (SELECT id FROM public.gallery_albums WHERE scout_year_id = $1)'),
      ('calendar_events', 'record.scout_year_id = $1'),
      ('announcements', 'record.scout_year_id = $1'),
      ('content_submissions', 'record.scout_year_id = $1'),
      ('documents', 'record.scout_year_id = $1'),
      ('reports', 'record.scout_year_id = $1'),
      ('archived_years', 'record.scout_year_id = $1'),
      ('scouts', 'record.scout_year_id = $1'),
      ('registration_uploads', 'record.scout_year_id = $1'),
      ('attendance_sessions', 'record.scout_year_id = $1'),
      ('chief_attendance_sessions', 'record.scout_year_id = $1'),
      ('attendance_records', 'record.session_id IN (SELECT id FROM public.attendance_sessions WHERE scout_year_id = $1) OR record.scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1)'),
      ('chief_attendance_records', 'record.session_id IN (SELECT id FROM public.chief_attendance_sessions WHERE scout_year_id = $1)'),
      ('scout_equipe_assignments', 'record.scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1)'),
      ('registration_campaigns', 'record.scout_year_id = $1'),
      ('registration_parent_verification_challenges', 'record.campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1) OR record.scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1)'),
      ('scout_registration_drafts', 'record.campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1) OR record.matched_scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1) OR record.parent_verification_id IN (SELECT id FROM public.registration_parent_verification_challenges WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_submissions', 'record.campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1) OR record.matched_scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1) OR record.parent_verification_id IN (SELECT id FROM public.registration_parent_verification_challenges WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_people', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_parent_contacts', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_reviews', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_consents', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('scout_registration_documents', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR record.draft_id IN (SELECT id FROM public.scout_registration_drafts WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR record.original_document_id IN (SELECT owned_document.id FROM public.scout_registration_documents owned_document WHERE owned_document.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR owned_document.draft_id IN (SELECT id FROM public.scout_registration_drafts WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)))'),
      ('scout_registration_duplicate_matches', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR record.candidate_scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1)'),
      ('scout_season_enrollments', 'record.scout_year_id = $1 OR record.scout_id IN (SELECT id FROM public.scouts WHERE scout_year_id = $1) OR record.registration_submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1))'),
      ('registration_retention_jobs', 'record.campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)'),
      ('registration_document_access_logs', 'record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR record.document_id IN (SELECT record.id FROM public.scout_registration_documents record WHERE record.submission_id IN (SELECT id FROM public.scout_registration_submissions WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)) OR record.draft_id IN (SELECT id FROM public.scout_registration_drafts WHERE campaign_id IN (SELECT id FROM public.registration_campaigns WHERE scout_year_id = $1)))')
    ) AS sources(table_name, predicate)
  LOOP
    table_rows := '[]'::jsonb;
    IF to_regclass('public.' || source.table_name) IS NOT NULL THEN
      EXECUTE format(
        'SELECT COALESCE(jsonb_agg(to_jsonb(record) ORDER BY to_jsonb(record)->>''id'', to_jsonb(record)->>''session_id'', to_jsonb(record)->>''scout_id'', to_jsonb(record)->>''chief_id''), ''[]''::jsonb) FROM public.%I record WHERE %s',
        source.table_name, source.predicate
      ) INTO table_rows USING target_year_id;
    END IF;
    snapshot_data := snapshot_data || jsonb_build_object(source.table_name, table_rows);
    snapshot_counts := snapshot_counts || jsonb_build_object(source.table_name, jsonb_array_length(table_rows));
  END LOOP;

  RETURN jsonb_build_object(
    'version', 1,
    'yearId', target_year_id,
    'data', snapshot_data,
    'counts', snapshot_counts,
    'snapshotHash', encode(sha256(convert_to(snapshot_data::text, 'UTF8')), 'hex')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_scout_year_backup_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scout_year_backup_snapshot(uuid) TO service_role;

-- A permanent mutex row closes the gap between database transactions and the
-- Storage HTTP API. FOR SHARE in write guards also detects obsolete snapshots
-- under REPEATABLE READ. Only overlapping rows/paths are frozen, not whole tables.
CREATE TABLE IF NOT EXISTS public.scout_year_deletion_claim (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  claim_id uuid,
  year_id uuid,
  receipt_id uuid,
  caller_id uuid,
  snapshot_hash text,
  protected_ids text[] NOT NULL DEFAULT '{}',
  inventory jsonb NOT NULL DEFAULT '[]',
  cleanup_complete boolean NOT NULL DEFAULT false,
  cleanup_started boolean NOT NULL DEFAULT false,
  cleanup_running boolean NOT NULL DEFAULT false,
  renewed_at timestamptz
);
ALTER TABLE public.scout_year_deletion_claim ADD COLUMN IF NOT EXISTS cleanup_started boolean NOT NULL DEFAULT false;
ALTER TABLE public.scout_year_deletion_claim ADD COLUMN IF NOT EXISTS cleanup_running boolean NOT NULL DEFAULT false;
INSERT INTO public.scout_year_deletion_claim (singleton) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.scout_year_deletion_claim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scout_year_deletion_claim FROM PUBLIC, anon, authenticated, service_role;

-- Read-only recovery deliberately omits file locations and does not renew or
-- release the worker fence. Active claims remain resumable after receipt expiry.
CREATE OR REPLACE FUNCTION public.get_scout_year_deletion_recovery()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp SET timezone = 'UTC' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('registration.retention.manage')
    OR NOT public.has_required_aal('registration.retention.manage') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'yearId', c.year_id, 'receiptId', c.receipt_id, 'claimId', c.claim_id,
    'expiresAt', r.expires_at, 'cleanupStarted', c.cleanup_started,
    'cleanupRunning', c.cleanup_running, 'cleanupComplete', c.cleanup_complete
  )), '[]'::jsonb) INTO result
  FROM public.scout_year_deletion_claim c
  JOIN public.scout_year_backup_receipts r ON r.id = c.receipt_id AND r.scout_year_id = c.year_id
  JOIN public.scout_years y ON y.id = c.year_id
  WHERE c.singleton AND c.claim_id IS NOT NULL AND c.caller_id = auth.uid()
    AND r.requested_by = auth.uid() AND r.used_at IS NULL AND y.is_active = false;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_scout_year_deletion_recovery() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_scout_year_deletion_recovery() TO authenticated;

-- Fast preflight plus an insert-time guard close the race with claim creation.
-- Neither a new backup nor another caller may supersede a claimed year's receipt.
CREATE OR REPLACE FUNCTION public.assert_scout_year_backup_available(target_year_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR SHARE;
  IF claim.claim_id IS NOT NULL AND claim.year_id = target_year_id THEN
    RAISE EXCEPTION 'deletion_claim_active' USING ERRCODE = '55000';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_scout_year_backup_available(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_scout_year_backup_available(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_scout_year_backup_receipt_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.assert_scout_year_backup_available(NEW.scout_year_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_scout_year_backup_receipt_insert() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS scout_year_backup_receipt_insert_guard ON public.scout_year_backup_receipts;
CREATE TRIGGER scout_year_backup_receipt_insert_guard BEFORE INSERT ON public.scout_year_backup_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_scout_year_backup_receipt_insert();

CREATE OR REPLACE FUNCTION public.scout_year_json_strings(value jsonb)
RETURNS SETOF text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH RECURSIVE leaves(item) AS (
    SELECT value
    UNION ALL
    SELECT child.item FROM leaves
    CROSS JOIN LATERAL (
      SELECT entry.value AS item FROM jsonb_each(CASE WHEN jsonb_typeof(leaves.item) = 'object' THEN leaves.item ELSE '{}' END) entry
      UNION ALL
      SELECT element FROM jsonb_array_elements(CASE WHEN jsonb_typeof(leaves.item) = 'array' THEN leaves.item ELSE '[]' END) element
    ) child
  ) SELECT item #>> '{}' FROM leaves WHERE jsonb_typeof(item) = 'string';
$$;

CREATE OR REPLACE FUNCTION public.scout_year_decode_reference(value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE encoded text; decoded text; work_bytes bigint := 0;
BEGIN
  -- Decode until no encoded run remains, not an arbitrary number of layers.
  -- Each successful replacement strictly shortens the input. Bound both input
  -- size and cumulative scanning work; NULL means uncertain, never "no match".
  IF strpos(value, '%') = 0 THEN RETURN lower(value); END IF;
  IF octet_length(value) > 65536 THEN RETURN NULL; END IF;
  LOOP
    work_bytes := work_bytes + octet_length(value);
    IF work_bytes > 1048576 THEN RETURN NULL; END IF;
    encoded := substring(value FROM '(?:%[0-9a-fA-F]{2})+');
    EXIT WHEN encoded IS NULL;
    BEGIN decoded := convert_from(decode(replace(encoded, '%', ''), 'hex'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
    value := replace(value, encoded, decoded);
  END LOOP;
  RETURN lower(value);
END;
$$;

CREATE OR REPLACE FUNCTION public.scout_year_row_mentions(value jsonb, ids text[], files jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scout_year_json_strings(value) leaf
    WHERE leaf = ANY(ids) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(files) file
      WHERE COALESCE(strpos(public.scout_year_decode_reference(leaf), public.scout_year_decode_reference(file->>'path')) > 0, true)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_scout_year_deletion_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR SHARE;
  IF claim.claim_id IS NOT NULL AND (
    (TG_OP <> 'INSERT' AND public.scout_year_row_mentions(to_jsonb(OLD), claim.protected_ids, claim.inventory))
    OR (TG_OP <> 'DELETE' AND public.scout_year_row_mentions(to_jsonb(NEW), claim.protected_ids, claim.inventory))
  ) THEN
    RAISE EXCEPTION 'scout_year_deletion_in_progress' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Guard every public row shape, including nested JSON and otherwise unrelated
-- tables that could begin referencing a claimed object. Audit/receipt evidence
-- is intentionally excluded. These guards do not change RLS or grants.
DO $guards$
DECLARE item record;
BEGIN
  FOR item IN SELECT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('audit_logs', 'scout_year_backup_receipts', 'scout_year_deletion_claim')
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS scout_year_deletion_write_guard ON public.%I', item.relname);
    EXECUTE format('CREATE TRIGGER scout_year_deletion_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_scout_year_deletion_write()', item.relname);
  END LOOP;
END;
$guards$;

CREATE OR REPLACE FUNCTION public.guard_scout_year_storage_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE; receipt public.scout_year_backup_receipts%ROWTYPE; object_row jsonb;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR SHARE;
  IF claim.claim_id IS NOT NULL THEN
    SELECT * INTO receipt FROM public.scout_year_backup_receipts WHERE id = claim.receipt_id;
    FOR object_row IN SELECT value FROM jsonb_array_elements(
      CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP = 'DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW)) END)
    LOOP
      IF (object_row->>'bucket_id' = 'scout-year-backups' AND object_row->>'name' = receipt.archive_path)
        OR (EXISTS (SELECT 1 FROM jsonb_array_elements(receipt.manifest->'files') file WHERE file->>'bucket' = object_row->>'bucket_id' AND file->>'path' = object_row->>'name')
          AND NOT (TG_OP = 'DELETE' AND claim.cleanup_running AND EXISTS (SELECT 1 FROM jsonb_array_elements(claim.inventory) file WHERE file->>'bucket' = object_row->>'bucket_id' AND file->>'path' = object_row->>'name'))) THEN
        RAISE EXCEPTION 'scout_year_deletion_in_progress' USING ERRCODE = '55000';
      END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS scout_year_deletion_storage_guard ON storage.objects;
CREATE TRIGGER scout_year_deletion_storage_guard BEFORE INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.guard_scout_year_storage_write();
REVOKE ALL ON FUNCTION public.guard_scout_year_storage_write() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_scout_year_deletion(target_year_id uuid, target_receipt_id uuid, expected_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp SET timezone = 'UTC' AS $$
DECLARE
  claim public.scout_year_deletion_claim%ROWTYPE;
  receipt public.scout_year_backup_receipts%ROWTYPE;
  selected_year public.scout_years%ROWTYPE;
  snapshot jsonb; source record; file jsonb; row_value jsonb;
  cleanup jsonb := '[]'; protected text[]; owned boolean; survives boolean;
  campaign text; owner_id text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('registration.retention.manage')
    OR NOT public.has_required_aal('registration.retention.manage') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  -- Always take data-table locks before the mutex, matching write-trigger order.
  -- Waiting writers then see the committed claim (or serialization failure).
  FOR source IN SELECT c.oid, c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('audit_logs', 'scout_year_backup_receipts', 'scout_year_deletion_claim')
    ORDER BY c.relname
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid = source.oid
      AND t.tgname = 'scout_year_deletion_write_guard' AND t.tgenabled IN ('O', 'A')) THEN
      RAISE EXCEPTION 'unsupported_year_dependency';
    END IF;
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', source.relname);
  END LOOP;
  LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF claim.claim_id IS NOT NULL AND (claim.caller_id IS DISTINCT FROM auth.uid()
    OR claim.year_id IS DISTINCT FROM target_year_id OR claim.receipt_id IS DISTINCT FROM target_receipt_id) THEN
    RAISE EXCEPTION 'deletion_claim_busy';
  END IF;
  SELECT * INTO selected_year FROM public.scout_years WHERE id = target_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'year_not_found'; END IF;
  IF selected_year.is_active THEN RAISE EXCEPTION 'active_year'; END IF;
  IF selected_year.label IS DISTINCT FROM expected_label THEN RAISE EXCEPTION 'label_mismatch'; END IF;
  SELECT * INTO receipt FROM public.scout_year_backup_receipts WHERE id = target_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'receipt_not_found'; END IF;
  IF receipt.requested_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'receipt_wrong_user'; END IF;
  IF receipt.used_at IS NOT NULL THEN RAISE EXCEPTION 'receipt_used'; END IF;
  IF receipt.scout_year_id IS DISTINCT FROM target_year_id THEN RAISE EXCEPTION 'receipt_wrong_year'; END IF;
  -- A partial cleanup remains resumable after expiry; only the identical claim
  -- may bypass expiry. Its frozen data and recovery archive are still required.
  IF receipt.expires_at <= clock_timestamp() AND claim.claim_id IS NULL THEN RAISE EXCEPTION 'receipt_expired'; END IF;
  IF receipt.manifest->'complete' IS DISTINCT FROM 'true'::jsonb
    OR receipt.manifest->'filesComplete' IS DISTINCT FROM 'true'::jsonb
    OR receipt.manifest->>'yearId' IS DISTINCT FROM target_year_id::text
    OR receipt.manifest->>'snapshotHash' IS DISTINCT FROM receipt.snapshot_hash
    OR jsonb_typeof(receipt.manifest->'files') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'incomplete_manifest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'scout-year-backups' AND name = receipt.archive_path) THEN RAISE EXCEPTION 'archive_not_found'; END IF;
  snapshot := public.get_scout_year_backup_snapshot(target_year_id);
  IF snapshot->>'snapshotHash' IS DISTINCT FROM receipt.snapshot_hash
    OR snapshot->'counts' IS DISTINCT FROM receipt.manifest->'counts' THEN RAISE EXCEPTION 'stale_snapshot'; END IF;
  IF claim.claim_id IS NOT NULL THEN
    UPDATE public.scout_year_deletion_claim SET renewed_at = clock_timestamp() WHERE singleton;
    RETURN jsonb_build_object('claimId', claim.claim_id, 'inventory', claim.inventory);
  END IF;

  FOR file IN SELECT value FROM jsonb_array_elements(receipt.manifest->'files') WHERE value->'deleteWithYear' = 'true'::jsonb LOOP
    IF file->>'bucket' !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]*$'
      OR file->>'path' IS NULL OR file->>'path' ~ '(^/|\\|:|%|(^|/)\.\.?(/|$)|[[:cntrl:]])' THEN RAISE EXCEPTION 'unsafe_cleanup_path'; END IF;
    owned := false;
    -- The receipt is server-issued; ownership additionally requires the current
    -- source row AND canonical year/campaign/owner path, never a flag alone.
    IF file->>'path' LIKE 'registration/' || target_year_id::text || '/%' THEN
      owned := EXISTS (SELECT 1 FROM public.registration_uploads WHERE scout_year_id = target_year_id AND storage_path = file->>'path');
    ELSIF file->>'bucket' IN ('scout-headshots', 'identity-documents', 'form-attachments') THEN
      FOR row_value IN SELECT value FROM jsonb_array_elements(snapshot->'data'->'scout_registration_documents') LOOP
        owner_id := COALESCE(row_value->>'submission_id', row_value->>'draft_id');
        SELECT value->>'campaign_id' INTO campaign FROM jsonb_array_elements(
          (snapshot->'data'->'scout_registration_submissions') || (snapshot->'data'->'scout_registration_drafts'))
          WHERE value->>'id' = owner_id;
        IF row_value->>'object_path' = file->>'path' AND row_value->>'bucket_id' = file->>'bucket'
          AND row_value->>'deleted_at' IS NULL AND row_value->>'verification_status' IS DISTINCT FROM 'deleted'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'data'->'registration_campaigns') c WHERE c->>'id' = campaign AND c->>'scout_year_id' = target_year_id::text)
          AND file->>'path' LIKE campaign || '/' || owner_id || '/%' THEN owned := true; END IF;
      END LOOP;
    END IF;
    IF NOT owned THEN RAISE EXCEPTION 'unsafe_cleanup_path'; END IF;
    survives := false;
    FOR source IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname NOT IN ('audit_logs', 'scout_year_backup_receipts', 'scout_year_deletion_claim') ORDER BY c.relname
    LOOP
      FOR row_value IN EXECUTE format('SELECT to_jsonb(r) FROM public.%I r', source.relname) LOOP
        IF NOT public.scout_year_row_mentions(row_value, '{}', jsonb_build_array(file)) THEN CONTINUE; END IF;
        IF source.relname = 'registration_uploads' AND row_value->>'scout_year_id' = target_year_id::text AND row_value->>'storage_path' = file->>'path' THEN CONTINUE; END IF;
        IF source.relname = 'scout_registration_documents' AND row_value->>'object_path' = file->>'path' AND row_value->>'bucket_id' = file->>'bucket'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements((snapshot->'data'->'scout_registration_submissions') || (snapshot->'data'->'scout_registration_drafts')) s
            WHERE s->>'id' = COALESCE(row_value->>'submission_id', row_value->>'draft_id')
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'data'->'registration_campaigns') c WHERE c->>'id' = s->>'campaign_id' AND c->>'scout_year_id' = target_year_id::text)) THEN CONTINUE; END IF;
        survives := true; EXIT;
      END LOOP;
      EXIT WHEN survives;
    END LOOP;
    IF survives THEN
      INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
        VALUES (auth.uid(), 'scout_year.storage_reference_survives', 'scout_year', target_year_id::text, jsonb_build_object('receiptId', target_receipt_id));
    ELSE cleanup := cleanup || jsonb_build_array(jsonb_build_object('bucket', file->>'bucket', 'path', file->>'path')); END IF;
  END LOOP;
  SELECT array_agg(DISTINCT id) INTO protected FROM (
    SELECT target_year_id::text AS id UNION ALL
    SELECT item.value->>'id' FROM jsonb_each(snapshot->'data') datasets
    CROSS JOIN LATERAL jsonb_array_elements(datasets.value) item WHERE item.value->>'id' IS NOT NULL
  ) ids;
  UPDATE public.scout_year_deletion_claim SET claim_id = gen_random_uuid(), year_id = target_year_id,
    receipt_id = target_receipt_id, caller_id = auth.uid(), snapshot_hash = receipt.snapshot_hash,
    protected_ids = protected, inventory = cleanup, cleanup_complete = false, cleanup_started = false, cleanup_running = false, renewed_at = clock_timestamp()
    WHERE singleton RETURNING * INTO claim;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'scout_year.deletion_claimed', 'scout_year', target_year_id::text, jsonb_build_object('receiptId', target_receipt_id, 'claimId', claim.claim_id));
  RETURN jsonb_build_object('claimId', claim.claim_id, 'inventory', claim.inventory);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_scout_year_cleanup(target_claim_id uuid, target_caller_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF claim.claim_id IS NULL OR claim.claim_id IS DISTINCT FROM target_claim_id OR claim.caller_id IS DISTINCT FROM target_caller_id THEN RAISE EXCEPTION 'invalid_deletion_claim'; END IF;
  IF claim.cleanup_complete THEN RETURN jsonb_build_object('started', true, 'complete', true); END IF;
  IF claim.cleanup_running THEN RAISE EXCEPTION 'cleanup_in_progress'; END IF;
  UPDATE public.scout_year_deletion_claim SET cleanup_started = true, cleanup_running = true, renewed_at = clock_timestamp() WHERE singleton;
  RETURN jsonb_build_object('started', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_scout_year_cleanup(target_claim_id uuid, target_caller_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF claim.claim_id IS NULL OR claim.claim_id IS DISTINCT FROM target_claim_id OR claim.caller_id IS DISTINCT FROM target_caller_id THEN RAISE EXCEPTION 'invalid_deletion_claim'; END IF;
  IF NOT claim.cleanup_started THEN RAISE EXCEPTION 'cleanup_not_complete'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(claim.inventory) file JOIN storage.objects o ON o.bucket_id = file->>'bucket' AND o.name = file->>'path') THEN RAISE EXCEPTION 'cleanup_not_complete'; END IF;
  UPDATE public.scout_year_deletion_claim SET cleanup_complete = true, cleanup_running = false, renewed_at = clock_timestamp() WHERE singleton;
  RETURN jsonb_build_object('complete', true);
END;
$$;

-- Called only by the trusted coordinator after its awaited Storage request
-- fails. A terminated worker is deliberately not auto-expired: an operator must
-- first verify no request remains in flight, then use this audited release.
CREATE OR REPLACE FUNCTION public.release_scout_year_cleanup(target_claim_id uuid, target_caller_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF claim.claim_id IS NULL OR claim.claim_id IS DISTINCT FROM target_claim_id OR claim.caller_id IS DISTINCT FROM target_caller_id THEN RAISE EXCEPTION 'invalid_deletion_claim'; END IF;
  UPDATE public.scout_year_deletion_claim SET cleanup_running = false, renewed_at = clock_timestamp() WHERE singleton;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (claim.caller_id, 'scout_year.cleanup_worker_released', 'scout_year', claim.year_id::text, jsonb_build_object('claimId', claim.claim_id, 'receiptId', claim.receipt_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.abort_scout_year_deletion(target_claim_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE claim public.scout_year_deletion_claim%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('registration.retention.manage') OR NOT public.has_required_aal('registration.retention.manage') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF claim.claim_id IS NULL OR claim.claim_id IS DISTINCT FROM target_claim_id OR claim.caller_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'invalid_deletion_claim'; END IF;
  -- A caller must not release the guards while a Storage HTTP request might
  -- still be in flight. Once work starts the same claim must be resumed.
  IF claim.cleanup_started THEN RAISE EXCEPTION 'cleanup_started_resume_required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(claim.inventory) file WHERE NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = file->>'bucket' AND o.name = file->>'path')) THEN
    RAISE EXCEPTION 'restore_cleanup_objects_before_abort';
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'scout_year.deletion_aborted', 'scout_year', claim.year_id::text, jsonb_build_object('receiptId', claim.receipt_id, 'claimId', claim.claim_id));
  UPDATE public.scout_year_deletion_claim SET claim_id = NULL, protected_ids = '{}', inventory = '[]', cleanup_complete = false WHERE singleton;
END;
$$;
REVOKE ALL ON FUNCTION public.scout_year_json_strings(jsonb), public.scout_year_decode_reference(text), public.scout_year_row_mentions(jsonb, text[], jsonb), public.guard_scout_year_deletion_write() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_scout_year_deletion(uuid, uuid, text), public.abort_scout_year_deletion(uuid), public.start_scout_year_cleanup(uuid, uuid), public.complete_scout_year_cleanup(uuid, uuid), public.release_scout_year_cleanup(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_scout_year_deletion(uuid, uuid, text), public.abort_scout_year_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_scout_year_cleanup(uuid, uuid), public.complete_scout_year_cleanup(uuid, uuid), public.release_scout_year_cleanup(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_scout_year_with_backup(
  target_year_id uuid,
  target_receipt_id uuid,
  expected_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  actor_id uuid := auth.uid();
  selected_year public.scout_years%ROWTYPE;
  receipt public.scout_year_backup_receipts%ROWTYPE;
  claim public.scout_year_deletion_claim%ROWTYPE;
  current_snapshot jsonb;
  dependent_table text;
  locked_table record;
  campaign_ids uuid[] := '{}';
  submission_ids uuid[] := '{}';
  draft_ids uuid[] := '{}';
  scout_ids uuid[] := '{}';
  document_ids uuid[] := '{}';
BEGIN
  IF actor_id IS NULL
    OR NOT public.has_permission('registration.retention.manage')
    OR NOT public.has_required_aal('registration.retention.manage') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  -- Rare destructive operation: serialize all affected writes, including inserts.
  -- Row locks alone cannot protect against new children after the snapshot check.
  -- Consistent table order also serializes concurrent deletions of different years.
  FOR locked_table IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('audit_logs', 'scout_year_backup_receipts', 'scout_year_deletion_claim') ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', locked_table.relname);
  END LOOP;
  LOCK TABLE public.scout_years IN SHARE ROW EXCLUSIVE MODE;
  FOREACH dependent_table IN ARRAY ARRAY[
    'album_revisions',
    'announcements',
    'archived_years',
    'attendance_records',
    'attendance_sessions',
    'calendar_events',
    'chief_attendance_records',
    'chief_attendance_sessions',
    'content_submissions',
    'documents',
    'gallery_albums',
    'gallery_images',
    'photo_upload_batches',
    'posts',
    'post_revisions',
    'registration_campaigns',
    'registration_document_access_logs',
    'registration_parent_verification_challenges',
    'registration_retention_jobs',
    'registration_uploads',
    'reports',
    'scout_equipe_assignments',
    'scout_registration_consents',
    'scout_registration_documents',
    'scout_registration_drafts',
    'scout_registration_duplicate_matches',
    'scout_registration_parent_contacts',
    'scout_registration_people',
    'scout_registration_reviews',
    'scout_registration_submissions',
    'scout_season_enrollments',
    'scout_year_backup_receipts',
    'scouts'
  ] LOOP
    IF to_regclass('public.' || dependent_table) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', dependent_table);
    END IF;
  END LOOP;

  -- Fail closed if a future migration adds a new child outside this reviewed set.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint dependency
    JOIN pg_catalog.pg_class child ON child.oid = dependency.conrelid
    JOIN pg_catalog.pg_namespace child_schema ON child_schema.oid = child.relnamespace
    WHERE dependency.contype = 'f'
      AND dependency.confrelid IN (
        SELECT to_regclass('public.' || parent_name)
        FROM unnest(ARRAY[
          'scout_years', 'scouts', 'attendance_sessions', 'chief_attendance_sessions',
          'registration_campaigns', 'registration_parent_verification_challenges',
          'scout_registration_drafts', 'scout_registration_submissions',
          'scout_registration_documents'
        ]) AS parents(parent_name)
      )
      AND NOT (child_schema.nspname = 'public' AND child.relname = ANY(ARRAY[
        'scout_years',
        'posts',
        'gallery_albums',
        'calendar_events',
        'announcements',
        'content_submissions',
        'documents',
        'reports',
        'archived_years',
        'scouts',
        'registration_uploads',
        'attendance_sessions',
        'attendance_records',
        'chief_attendance_sessions',
        'chief_attendance_records',
        'scout_equipe_assignments',
        'registration_campaigns',
        'registration_parent_verification_challenges',
        'scout_registration_drafts',
        'scout_registration_submissions',
        'scout_registration_people',
        'scout_registration_parent_contacts',
        'scout_registration_documents',
        'scout_registration_duplicate_matches',
        'scout_registration_reviews',
        'scout_registration_consents',
        'scout_season_enrollments',
        'registration_retention_jobs',
        'registration_document_access_logs',
        'scout_year_backup_receipts'
      ]))
  ) THEN
    RAISE EXCEPTION 'unsupported_year_dependency' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO selected_year FROM public.scout_years WHERE id = target_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'year_not_found' USING ERRCODE = 'P0002'; END IF;
  IF selected_year.is_active THEN RAISE EXCEPTION 'active_year' USING ERRCODE = '22023'; END IF;
  IF expected_label IS DISTINCT FROM selected_year.label THEN RAISE EXCEPTION 'label_mismatch' USING ERRCODE = '22023'; END IF;

  SELECT * INTO receipt FROM public.scout_year_backup_receipts WHERE id = target_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'receipt_not_found' USING ERRCODE = '22023'; END IF;
  IF receipt.requested_by IS DISTINCT FROM actor_id THEN RAISE EXCEPTION 'receipt_wrong_user' USING ERRCODE = '42501'; END IF;
  IF receipt.used_at IS NOT NULL THEN RAISE EXCEPTION 'receipt_used' USING ERRCODE = '22023'; END IF;
  IF receipt.scout_year_id IS DISTINCT FROM target_year_id THEN RAISE EXCEPTION 'receipt_wrong_year' USING ERRCODE = '22023'; END IF;
  LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO claim FROM public.scout_year_deletion_claim WHERE singleton FOR UPDATE;
  IF receipt.expires_at <= clock_timestamp() AND NOT (claim.claim_id IS NOT NULL AND claim.receipt_id = target_receipt_id AND claim.caller_id = actor_id AND claim.year_id = target_year_id) THEN RAISE EXCEPTION 'receipt_expired' USING ERRCODE = '22023'; END IF;
  IF receipt.manifest->'version' IS DISTINCT FROM '1'::jsonb
    OR receipt.manifest->'complete' IS DISTINCT FROM 'true'::jsonb
    OR receipt.manifest->'filesComplete' IS DISTINCT FROM 'true'::jsonb
    OR receipt.manifest->>'yearId' IS DISTINCT FROM target_year_id::text
    OR receipt.manifest->>'snapshotHash' IS DISTINCT FROM receipt.snapshot_hash
    OR jsonb_typeof(receipt.manifest->'counts') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'incomplete_manifest' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects archive
    WHERE archive.bucket_id = 'scout-year-backups' AND archive.name = receipt.archive_path
  ) THEN
    RAISE EXCEPTION 'archive_not_found' USING ERRCODE = '22023';
  END IF;

  current_snapshot := public.get_scout_year_backup_snapshot(target_year_id);
  IF current_snapshot->>'snapshotHash' IS DISTINCT FROM receipt.snapshot_hash
    OR current_snapshot->'counts' IS DISTINCT FROM receipt.manifest->'counts' THEN
    RAISE EXCEPTION 'stale_snapshot' USING ERRCODE = '40001';
  END IF;

  IF claim.claim_id IS NULL OR claim.receipt_id IS DISTINCT FROM target_receipt_id
    OR claim.caller_id IS DISTINCT FROM actor_id OR claim.year_id IS DISTINCT FROM target_year_id
    OR claim.snapshot_hash IS DISTINCT FROM receipt.snapshot_hash OR NOT claim.cleanup_complete THEN
    RAISE EXCEPTION 'cleanup_not_complete';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(claim.inventory) file JOIN storage.objects o ON o.bucket_id = file->>'bucket' AND o.name = file->>'path') THEN RAISE EXCEPTION 'cleanup_not_complete'; END IF;
  -- Clearing within this transaction lets its own guarded writes proceed;
  -- other transactions still see the claim or wait until deletion commits.
  UPDATE public.scout_year_deletion_claim SET claim_id = NULL, protected_ids = '{}', inventory = '[]', cleanup_complete = false WHERE singleton;

  UPDATE public.posts SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.gallery_albums SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.calendar_events SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.announcements SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.content_submissions SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.documents SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.reports SET scout_year_id = NULL WHERE scout_year_id = target_year_id;
  UPDATE public.archived_years SET scout_year_id = NULL WHERE scout_year_id = target_year_id;

  SELECT COALESCE(array_agg(id), '{}') INTO scout_ids FROM public.scouts WHERE scout_year_id = target_year_id;
  DELETE FROM public.attendance_records WHERE session_id IN (SELECT id FROM public.attendance_sessions WHERE scout_year_id = target_year_id) OR scout_id = ANY(scout_ids);
  DELETE FROM public.attendance_sessions WHERE scout_year_id = target_year_id;
  DELETE FROM public.chief_attendance_records WHERE session_id IN (SELECT id FROM public.chief_attendance_sessions WHERE scout_year_id = target_year_id);
  DELETE FROM public.chief_attendance_sessions WHERE scout_year_id = target_year_id;
  DELETE FROM public.scout_equipe_assignments WHERE scout_id = ANY(scout_ids);

  IF to_regclass('public.registration_campaigns') IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), '{}') INTO campaign_ids FROM public.registration_campaigns WHERE scout_year_id = target_year_id;
    SELECT COALESCE(array_agg(id), '{}') INTO submission_ids FROM public.scout_registration_submissions WHERE campaign_id = ANY(campaign_ids);
    SELECT COALESCE(array_agg(id), '{}') INTO draft_ids FROM public.scout_registration_drafts WHERE campaign_id = ANY(campaign_ids);
    SELECT COALESCE(array_agg(id), '{}') INTO document_ids FROM public.scout_registration_documents WHERE submission_id = ANY(submission_ids) OR draft_id = ANY(draft_ids);

    -- Delete only owned registration rows. Other campaigns and submissions stay.
    DELETE FROM public.registration_document_access_logs WHERE submission_id = ANY(submission_ids) OR document_id = ANY(document_ids);
    -- Prevent a cross-year derivative document being cascade-deleted.
    UPDATE public.scout_registration_documents SET original_document_id = NULL
      WHERE original_document_id = ANY(document_ids) AND NOT (id = ANY(document_ids));
    DELETE FROM public.scout_registration_documents WHERE id = ANY(document_ids);
    DELETE FROM public.scout_registration_people WHERE submission_id = ANY(submission_ids);
    DELETE FROM public.scout_registration_parent_contacts WHERE submission_id = ANY(submission_ids);
    DELETE FROM public.scout_registration_reviews WHERE submission_id = ANY(submission_ids);
    DELETE FROM public.scout_registration_consents WHERE submission_id = ANY(submission_ids);
    DELETE FROM public.scout_registration_duplicate_matches WHERE submission_id = ANY(submission_ids);
    UPDATE public.scout_registration_duplicate_matches SET candidate_scout_id = NULL WHERE candidate_scout_id = ANY(scout_ids);
    DELETE FROM public.scout_season_enrollments WHERE scout_year_id = target_year_id OR scout_id = ANY(scout_ids);
    DELETE FROM public.scout_registration_submissions WHERE id = ANY(submission_ids);
    DELETE FROM public.scout_registration_drafts WHERE id = ANY(draft_ids);
    DELETE FROM public.registration_parent_verification_challenges WHERE campaign_id = ANY(campaign_ids);
    DELETE FROM public.registration_retention_jobs WHERE campaign_id = ANY(campaign_ids);
    DELETE FROM public.registration_campaigns WHERE id = ANY(campaign_ids);
    -- Cross-year nullable links in drafts/submissions/challenges and enrollment
    -- submission pointers use their existing ON DELETE SET NULL constraints.
  END IF;

  DELETE FROM public.registration_uploads WHERE scout_year_id = target_year_id;
  DELETE FROM public.scouts WHERE scout_year_id = target_year_id;
  UPDATE public.scout_year_backup_receipts SET used_at = clock_timestamp() WHERE id = target_receipt_id;
  DELETE FROM public.scout_years WHERE id = target_year_id;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    actor_id, 'scout_year.deleted_with_backup', 'scout_year', target_year_id::text,
    jsonb_build_object('yearLabel', selected_year.label, 'receiptId', target_receipt_id,
      'archivePath', receipt.archive_path, 'snapshotHash', receipt.snapshot_hash,
      'counts', current_snapshot->'counts')
  );
  RETURN jsonb_build_object('deleted', true, 'yearId', target_year_id, 'receiptId', target_receipt_id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_scout_year_with_backup(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_scout_year_with_backup(uuid, uuid, text) TO authenticated;
-- Existing INSERT/UPDATE/SELECT grants and policies are preserved.
-- Direct REST DELETE must not bypass the receipt requirement.
REVOKE DELETE ON TABLE public.scout_years FROM PUBLIC, anon, authenticated;

COMMIT;

-- END SCOUT YEAR BACKUP DELETION
