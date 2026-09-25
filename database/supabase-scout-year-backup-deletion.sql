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
SET search_path = pg_catalog, public
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
      ('gallery_albums', 'record.scout_year_id = $1'),
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

CREATE OR REPLACE FUNCTION public.delete_scout_year_with_backup(
  target_year_id uuid,
  target_receipt_id uuid,
  expected_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
SET timezone = 'UTC'
AS $$
DECLARE
  actor_id uuid := auth.uid();
  selected_year public.scout_years%ROWTYPE;
  receipt public.scout_year_backup_receipts%ROWTYPE;
  current_snapshot jsonb;
  dependent_table text;
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
  LOCK TABLE public.scout_years IN SHARE ROW EXCLUSIVE MODE;
  FOREACH dependent_table IN ARRAY ARRAY[
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
    'posts',
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
    SELECT 1 FROM pg_constraint dependency
    JOIN pg_class child ON child.oid = dependency.conrelid
    JOIN pg_namespace child_schema ON child_schema.oid = child.relnamespace
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
  IF receipt.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'receipt_expired' USING ERRCODE = '22023'; END IF;
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
