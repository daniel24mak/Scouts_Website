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
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  role text NOT NULL REFERENCES roles(id),
  group_id text,
  chief_level text CHECK (chief_level IN ('head', 'vice', 'chief')),
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
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
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
  );
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
  );

CREATE POLICY "attendance by assigned chiefs" ON attendance_sessions
  FOR ALL USING (
    is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR (equipe_id IS NOT NULL AND can_take_equipe_attendance(equipe_id))
  ) WITH CHECK (
    is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR (equipe_id IS NOT NULL AND can_take_equipe_attendance(equipe_id))
  );

CREATE POLICY "attendance records follow session" ON attendance_records
  FOR ALL USING (
    is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
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







