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

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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
  );
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
  );

DROP POLICY IF EXISTS "attendance by assigned chiefs" ON attendance_sessions;
CREATE POLICY "attendance by assigned chiefs" ON attendance_sessions
  FOR ALL USING (
    public.is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  ) WITH CHECK (
    public.is_admin()
    OR group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    OR (equipe_id IS NOT NULL AND public.can_take_equipe_attendance(equipe_id))
  );

DROP POLICY IF EXISTS "attendance records follow session" ON attendance_records;
CREATE POLICY "attendance records follow session" ON attendance_records
  FOR ALL USING (
    public.is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
    )
  ) WITH CHECK (
    public.is_admin()
    OR session_id IN (
      SELECT id FROM attendance_sessions
      WHERE group_id = (SELECT group_id FROM user_profiles WHERE id = auth.uid())
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










