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
