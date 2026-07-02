-- Incremental fix for registration uploads and admin writes.
-- Use this if you already ran supabase-schema.sql before the upload fixes.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND account_status = 'active'
  )
  OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

DO $$
BEGIN
  ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'needs_changes';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'draft';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE content_status ADD VALUE IF NOT EXISTS 'pending_update';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_picture_url text,
ADD COLUMN IF NOT EXISTS pending_name text,
ADD COLUMN IF NOT EXISTS pending_profile_picture_url text,
ADD COLUMN IF NOT EXISTS profile_change_status text,
ADD COLUMN IF NOT EXISTS profile_change_comment text,
ADD COLUMN IF NOT EXISTS profile_change_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_profile_change_status_check;
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_profile_change_status_check CHECK (profile_change_status IN ('pending', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_coordinator boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS coordinator_group_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE scout_years ENABLE ROW LEVEL SECURITY;

-- Scouting years are created with only a label/name. These date columns are optional
-- in older databases where they may already exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scout_years' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE public.scout_years ALTER COLUMN start_date DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scout_years' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.scout_years ALTER COLUMN end_date DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE scout_years
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS one_active_scout_year ON scout_years (is_active) WHERE is_active;
ALTER TABLE registration_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS equipes (
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

ALTER TABLE scouts
ADD COLUMN IF NOT EXISTS equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS scout_equipe_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id uuid NOT NULL REFERENCES scouts(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS equipe_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  chief_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('leader', 'co_leader')),
  assigned_by uuid REFERENCES user_profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (equipe_id, role)
);

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'group' CHECK (scope IN ('group', 'equipe'));

DO $$
BEGIN
  ALTER TABLE attendance_sessions DROP CONSTRAINT IF EXISTS attendance_sessions_scout_year_id_group_id_date_key;
  ALTER TABLE attendance_sessions
    ADD CONSTRAINT attendance_sessions_year_group_date_scope_equipe_key
    UNIQUE (scout_year_id, group_id, date, scope, equipe_id);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_equipe_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grouping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chief_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chief_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS album_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE gallery_images
ADD COLUMN IF NOT EXISTS public_url text;

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS reviewer_comment text;
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'blog',
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS author_profile_picture_url text;

DO $$
BEGIN
  ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_content_type_check;
  ALTER TABLE public.posts ADD CONSTRAINT posts_content_type_check CHECK (content_type IN ('blog', 'news'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_category_check;
  ALTER TABLE public.posts ADD CONSTRAINT posts_category_check CHECK (category IN ('camp', 'weekly_meeting', 'general', 'church_mass', 'celebration', 'outdoor_activity', 'volunteering_work'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS thumbnail_path text;

ALTER TABLE gallery_albums
ADD COLUMN IF NOT EXISTS reviewer_comment text;

ALTER TABLE gallery_albums
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS thumbnail_storage_path text,
ADD COLUMN IF NOT EXISTS thumbnail_source text DEFAULT 'placeholder';

ALTER TABLE gallery_images
ADD COLUMN IF NOT EXISTS reviewer_comment text;

ALTER TABLE gallery_images
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS photo_upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'needs_changes', 'approved', 'rejected', 'archived')),
  photo_count integer NOT NULL DEFAULT 0,
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gallery_images
ADD COLUMN IF NOT EXISTS upload_batch_id uuid REFERENCES photo_upload_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS thumbnail_storage_path text,
ADD COLUMN IF NOT EXISTS original_file_name text,
ADD COLUMN IF NOT EXISTS original_format text,
ADD COLUMN IF NOT EXISTS original_file_size bigint,
ADD COLUMN IF NOT EXISTS optimized_format text DEFAULT 'webp',
ADD COLUMN IF NOT EXISTS optimized_width integer,
ADD COLUMN IF NOT EXISTS optimized_height integer,
ADD COLUMN IF NOT EXISTS optimized_file_size bigint,
ADD COLUMN IF NOT EXISTS thumbnail_file_size bigint,
ADD COLUMN IF NOT EXISTS quality_used numeric;

CREATE TABLE IF NOT EXISTS post_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_content_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'pending_update' CHECK (status IN ('draft', 'pending', 'pending_update', 'needs_changes', 'approved', 'rejected', 'archived')),
  proposed_data jsonb NOT NULL DEFAULT '{}',
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_content_id uuid NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'pending_update' CHECK (status IN ('draft', 'pending', 'pending_update', 'needs_changes', 'approved', 'rejected', 'archived')),
  proposed_data jsonb NOT NULL DEFAULT '{}',
  reviewer_comment text,
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_upload_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS date_from date,
ADD COLUMN IF NOT EXISTS date_to date,
ADD COLUMN IF NOT EXISTS start_time time,
ADD COLUMN IF NOT EXISTS end_time time,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS storage_path text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS reviewer_comment text,
ADD COLUMN IF NOT EXISTS linked_blog_id uuid REFERENCES posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_album_id uuid REFERENCES gallery_albums(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS site_content (
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

CREATE TABLE IF NOT EXISTS leaders (
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

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

CREATE TABLE IF NOT EXISTS contact_messages (
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES user_profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_error_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  source text NOT NULL DEFAULT 'client',
  page_url text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_error_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_coordinator_for_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_coordinator = true
      AND target_group_id = ANY(coordinator_group_ids)
      AND account_status = 'active'
  );
$$;
CREATE OR REPLACE FUNCTION public.can_manage_group(target_group_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND group_id = target_group_id
      AND role IN ('admin', 'chief')
      AND chief_level IN ('head', 'vice')
      AND account_status = 'active'
  )
  OR public.is_coordinator_for_group(target_group_id);
$$;

CREATE OR REPLACE FUNCTION public.can_take_equipe_attendance(target_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.equipes e
    JOIN public.user_profiles p ON p.group_id = e.group_id
    WHERE e.id = target_equipe_id
      AND p.id = auth.uid()
      AND p.chief_level IN ('head', 'vice')
      AND p.account_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.equipes e
    WHERE e.id = target_equipe_id
      AND public.is_coordinator_for_group(e.group_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.equipe_leaders
    WHERE equipe_id = target_equipe_id
      AND chief_id = auth.uid()
      AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "admins manage scout years" ON scout_years;
CREATE POLICY "admins manage scout years" ON scout_years
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "logged in users read scout years" ON scout_years;
CREATE POLICY "logged in users read scout years" ON scout_years
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins manage registration uploads" ON registration_uploads;
CREATE POLICY "admins manage registration uploads" ON registration_uploads
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "logged in users read registration uploads" ON registration_uploads;
CREATE POLICY "logged in users read registration uploads" ON registration_uploads
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins manage scouts" ON scouts;
CREATE POLICY "admins manage scouts" ON scouts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "logged in users read equipes" ON equipes;
CREATE POLICY "logged in users read equipes" ON equipes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "group managers manage equipes" ON equipes;
CREATE POLICY "group managers manage equipes" ON equipes
  FOR ALL USING (public.can_manage_group(group_id)) WITH CHECK (public.can_manage_group(group_id));

DROP POLICY IF EXISTS "logged in users read equipe leaders" ON equipe_leaders;
CREATE POLICY "logged in users read equipe leaders" ON equipe_leaders
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "group managers manage equipe leaders" ON equipe_leaders;
CREATE POLICY "group managers manage equipe leaders" ON equipe_leaders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM equipes WHERE equipes.id = equipe_id AND public.can_manage_group(equipes.group_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM equipes WHERE equipes.id = equipe_id AND public.can_manage_group(equipes.group_id))
  );

DROP POLICY IF EXISTS "logged in users read equipe assignments" ON scout_equipe_assignments;
CREATE POLICY "logged in users read equipe assignments" ON scout_equipe_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "group managers manage equipe assignments" ON scout_equipe_assignments;
CREATE POLICY "group managers manage equipe assignments" ON scout_equipe_assignments
  FOR ALL USING (public.can_manage_group(group_id)) WITH CHECK (public.can_manage_group(group_id));

DROP POLICY IF EXISTS "group managers update scout equipes" ON scouts;
CREATE POLICY "group managers update scout equipes" ON scouts
  FOR UPDATE USING (public.can_manage_group(group_id)) WITH CHECK (public.can_manage_group(group_id));

DROP POLICY IF EXISTS "chiefs read assigned scouts" ON scouts;
CREATE POLICY "chiefs read assigned scouts" ON scouts
  FOR SELECT USING (
    public.is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_coordinator_for_group(group_id)
  );

DROP POLICY IF EXISTS "attendance by assigned chiefs" ON attendance_sessions;
CREATE POLICY "attendance by assigned chiefs" ON attendance_sessions
  FOR ALL USING (
    public.is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_coordinator_for_group(group_id)
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  ) WITH CHECK (
    public.is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR public.is_coordinator_for_group(group_id)
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  );

DROP POLICY IF EXISTS "attendance records follow session" ON attendance_records;
CREATE POLICY "attendance records follow session" ON attendance_records
  FOR ALL USING (
    public.is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
        OR public.is_coordinator_for_group(group_id)
    )
  ) WITH CHECK (
    public.is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
        OR public.is_coordinator_for_group(group_id)
    )
  );

DROP POLICY IF EXISTS "admins manage chief attendance sessions" ON chief_attendance_sessions;
CREATE POLICY "admins manage chief attendance sessions" ON chief_attendance_sessions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage chief attendance records" ON chief_attendance_records;
CREATE POLICY "admins manage chief attendance records" ON chief_attendance_records
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage posts" ON posts;
CREATE POLICY "admins manage posts" ON posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chiefs submit posts" ON posts;
CREATE POLICY "chiefs submit posts" ON posts
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending'));

DROP POLICY IF EXISTS "submitters revise posts" ON posts;
CREATE POLICY "submitters revise posts" ON posts
  FOR UPDATE USING (submitted_by = auth.uid() AND status::text IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending'));

DROP POLICY IF EXISTS "review post revisions visible" ON post_revisions;
CREATE POLICY "review post revisions visible" ON post_revisions
  FOR SELECT USING (public.is_admin() OR submitted_by = auth.uid());

DROP POLICY IF EXISTS "submitters create post revisions" ON post_revisions;
CREATE POLICY "submitters create post revisions" ON post_revisions
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending', 'pending_update'));

DROP POLICY IF EXISTS "admins manage post revisions" ON post_revisions;
CREATE POLICY "admins manage post revisions" ON post_revisions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage albums" ON gallery_albums;
CREATE POLICY "admins manage albums" ON gallery_albums
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chiefs submit albums" ON gallery_albums;
CREATE POLICY "chiefs submit albums" ON gallery_albums
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending'));

DROP POLICY IF EXISTS "submitters revise albums" ON gallery_albums;
CREATE POLICY "submitters revise albums" ON gallery_albums
  FOR UPDATE USING (submitted_by = auth.uid() AND status::text IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending'));

DROP POLICY IF EXISTS "review album revisions visible" ON album_revisions;
CREATE POLICY "review album revisions visible" ON album_revisions
  FOR SELECT USING (public.is_admin() OR submitted_by = auth.uid());

DROP POLICY IF EXISTS "submitters create album revisions" ON album_revisions;
CREATE POLICY "submitters create album revisions" ON album_revisions
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status::text IN ('draft', 'pending', 'pending_update'));

DROP POLICY IF EXISTS "admins manage album revisions" ON album_revisions;
CREATE POLICY "admins manage album revisions" ON album_revisions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage photos" ON gallery_images;
CREATE POLICY "admins manage photos" ON gallery_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chiefs submit photos" ON gallery_images;
CREATE POLICY "chiefs submit photos" ON gallery_images
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "submitters revise photos" ON gallery_images;
CREATE POLICY "submitters revise photos" ON gallery_images
  FOR UPDATE USING (submitted_by = auth.uid() AND status::text IN ('draft', 'pending', 'pending_update', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admins manage photo batches" ON photo_upload_batches;
CREATE POLICY "admins manage photo batches" ON photo_upload_batches
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "submitters manage own photo batches" ON photo_upload_batches;
DROP POLICY IF EXISTS "submitters read own photo batches" ON photo_upload_batches;
CREATE POLICY "submitters read own photo batches" ON photo_upload_batches
  FOR SELECT USING (submitted_by = auth.uid());

DROP POLICY IF EXISTS "submitters create photo batches" ON photo_upload_batches;
CREATE POLICY "submitters create photo batches" ON photo_upload_batches
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

DROP POLICY IF EXISTS "submitters revise own photo batches" ON photo_upload_batches;
CREATE POLICY "submitters revise own photo batches" ON photo_upload_batches
  FOR UPDATE USING (submitted_by = auth.uid() AND status IN ('draft', 'pending', 'needs_changes', 'rejected'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

DROP POLICY IF EXISTS "admins manage events" ON calendar_events;
DROP POLICY IF EXISTS "approved events public" ON calendar_events;
CREATE POLICY "approved events public" ON calendar_events
  FOR SELECT USING (
    public.is_admin()
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

DROP POLICY IF EXISTS "admins manage events" ON calendar_events;
CREATE POLICY "admins manage events" ON calendar_events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "chiefs submit events" ON calendar_events;
CREATE POLICY "chiefs submit events" ON calendar_events
  FOR INSERT WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "submitters revise events" ON calendar_events;
CREATE POLICY "submitters revise events" ON calendar_events
  FOR UPDATE USING (
    (submitted_by = auth.uid() OR created_by = auth.uid())
    AND status::text IN ('draft', 'pending', 'approved', 'needs_changes', 'rejected')
  )
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admins manage documents" ON documents;
CREATE POLICY "admins manage documents" ON documents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public read site content" ON site_content;
CREATE POLICY "public read site content" ON site_content
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage site content" ON site_content;
CREATE POLICY "admins manage site content" ON site_content
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public read active leaders" ON leaders;
CREATE POLICY "public read active leaders" ON leaders
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admins manage leaders" ON leaders;
CREATE POLICY "admins manage leaders" ON leaders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public read active faqs" ON faqs;
CREATE POLICY "public read active faqs" ON faqs
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admins manage faqs" ON faqs;
CREATE POLICY "admins manage faqs" ON faqs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public submit contact messages" ON contact_messages;
CREATE POLICY "public submit contact messages" ON contact_messages
  FOR INSERT WITH CHECK (status = 'new');

DROP POLICY IF EXISTS "admins manage contact messages" ON contact_messages;
CREATE POLICY "admins manage contact messages" ON contact_messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage audit logs" ON audit_logs;
CREATE POLICY "admins manage audit logs" ON audit_logs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public submit site error messages" ON site_error_messages;
CREATE POLICY "public submit site error messages" ON site_error_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "admins read site error messages" ON site_error_messages;
CREATE POLICY "admins read site error messages" ON site_error_messages
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins delete site error messages" ON site_error_messages;
CREATE POLICY "admins delete site error messages" ON site_error_messages
  FOR DELETE USING (public.is_admin());

GRANT INSERT ON public.site_error_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.site_error_messages TO authenticated;
CREATE INDEX IF NOT EXISTS site_error_messages_created_at_idx ON site_error_messages (created_at DESC);

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

DROP POLICY IF EXISTS "admins upload scouts files" ON storage.objects;
CREATE POLICY "admins upload scouts files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scouts-files' AND public.is_admin());

DROP POLICY IF EXISTS "logged in users upload scouts files" ON storage.objects;
CREATE POLICY "logged in users upload scouts files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scouts-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public read scouts files" ON storage.objects;
CREATE POLICY "public read scouts files" ON storage.objects
  FOR SELECT USING (bucket_id = 'scouts-files');

DROP POLICY IF EXISTS "admins upload site images" ON storage.objects;
CREATE POLICY "admins upload site images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('site-images', 'leader-headshots', 'blog-thumbnails', 'event-images', 'album-thumbnails', 'profile-pictures') AND public.is_admin());

DROP POLICY IF EXISTS "admins delete replaced site images" ON storage.objects;
CREATE POLICY "admins delete replaced site images" ON storage.objects
  FOR DELETE USING (bucket_id IN ('site-images', 'leader-headshots', 'gallery', 'blog-thumbnails', 'event-images', 'album-thumbnails', 'profile-pictures') AND public.is_admin());

DROP POLICY IF EXISTS "logged in users delete own publishable images" ON storage.objects;
CREATE POLICY "logged in users delete own publishable images" ON storage.objects
  FOR DELETE USING (bucket_id IN ('gallery', 'blog-thumbnails', 'album-thumbnails', 'profile-pictures') AND owner = auth.uid());

DROP POLICY IF EXISTS "logged in users upload publishable images" ON storage.objects;
CREATE POLICY "logged in users upload publishable images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('gallery', 'blog-thumbnails', 'album-thumbnails', 'profile-pictures') AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public read site images" ON storage.objects;
CREATE POLICY "public read site images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('site-images', 'leader-headshots', 'gallery', 'blog-thumbnails', 'event-images', 'album-thumbnails', 'profile-pictures'));


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
BEGIN
  target_id := COALESCE(NEW.id::text, OLD.id::text);
  action_name := lower(TG_OP) || '_' || TG_TABLE_NAME;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    action_name,
    TG_TABLE_NAME,
    target_id,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old_status', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)->>'status' ELSE NULL END,
      'new_status', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)->>'status' ELSE NULL END
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
    'posts',
    'post_revisions',
    'gallery_albums',
    'album_revisions',
    'gallery_images',
    'photo_upload_batches',
    'calendar_events',
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
