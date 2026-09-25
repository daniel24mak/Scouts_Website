-- Run as the database owner after schema/access control/registration migrations
-- and supabase-scout-year-backup-deletion.sql. Every fixture is rolled back.
-- Storage metadata below is a fixture, not a real uploaded archive.
BEGIN;

CREATE FUNCTION pg_temp.expect_year_deletion_error(year_id uuid, receipt_id uuid, label text, expected_error text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.delete_scout_year_with_backup(year_id, receipt_id, label);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = expected_error THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, received % (%)', expected_error, SQLERRM, SQLSTATE;
  END;
  RAISE EXCEPTION 'Deletion unexpectedly accepted: %', expected_error;
END;
$$;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE id = 'registration.retention.manage'
      AND module = 'registration'
      AND action = 'retention.manage'
      AND risk_level = 'high'
      AND requires_mfa
      AND is_active
  ), 'normalized retention permission is missing, inactive, or not MFA-protected';
  ASSERT NOT has_table_privilege('authenticated', 'public.scout_year_backup_receipts', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated receipt access';
  ASSERT NOT has_table_privilege('anon', 'public.scout_year_backup_receipts', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous receipt access';
  ASSERT NOT has_table_privilege('authenticated', 'public.scout_years', 'DELETE'), 'direct year deletion allowed';
  ASSERT NOT has_function_privilege('anon', 'public.delete_scout_year_with_backup(uuid,uuid,text)', 'EXECUTE'), 'anonymous deletion allowed';
  ASSERT has_function_privilege('authenticated', 'public.delete_scout_year_with_backup(uuid,uuid,text)', 'EXECUTE'), 'authenticated RPC missing';
  ASSERT NOT has_function_privilege('authenticated', 'public.get_scout_year_backup_snapshot(uuid)', 'EXECUTE'), 'client snapshot access';
  ASSERT has_function_privilege('service_role', 'public.get_scout_year_backup_snapshot(uuid)', 'EXECUTE'), 'server snapshot access missing';
  ASSERT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'scout-year-backups' AND NOT public), 'backup bucket is public or absent';
END;
$$;

DO $$
DECLARE
  requesting_user uuid := gen_random_uuid();
  another_user uuid := gen_random_uuid();
  target_year uuid := gen_random_uuid();
  other_year uuid := gen_random_uuid();
  target_label text := 'Year deletion fixture ' || target_year::text;
  target_scout uuid := gen_random_uuid();
  other_scout uuid := gen_random_uuid();
  attendance_id uuid := gen_random_uuid();
  chief_attendance_id uuid := gen_random_uuid();
  post_id uuid := gen_random_uuid();
  album_id uuid := gen_random_uuid();
  calendar_id uuid := gen_random_uuid();
  announcement_id uuid := gen_random_uuid();
  content_id uuid := gen_random_uuid();
  preserved_document_id uuid := gen_random_uuid();
  report_id uuid := gen_random_uuid();
  archived_id uuid := gen_random_uuid();
  receipt_id uuid := gen_random_uuid();
  backup_path text := target_year::text || '/' || receipt_id::text || '.zip';
  snapshot jsonb;
  original_snapshot jsonb;
  receipt_manifest jsonb;
  result jsonb;
  group_key text := 'year-delete-' || target_year::text;
  form_id uuid := gen_random_uuid();
  other_form_id uuid := gen_random_uuid();
  owned_campaign_id uuid := gen_random_uuid();
  other_campaign_id uuid := gen_random_uuid();
  owned_submission_id uuid := gen_random_uuid();
  other_submission_id uuid := gen_random_uuid();
  owned_draft_id uuid := gen_random_uuid();
  verification_id uuid := gen_random_uuid();
  registration_document_id uuid := gen_random_uuid();
  cross_year_document_id uuid := gen_random_uuid();
  duplicate_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.roles (id, name) VALUES ('year_backup_test_role', 'Year backup SQL fixture') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_profiles (id, full_name, role, account_status) VALUES
    (requesting_user, 'Year deletion requester', 'year_backup_test_role', 'active'),
    (another_user, 'Another requester', 'year_backup_test_role', 'active');
  INSERT INTO public.user_permission_overrides (user_id, permission_id, effect, scope_type, reason, assigned_by)
  VALUES (requesting_user, 'registration.retention.manage', 'allow', 'global', 'Rollback SQL fixture', requesting_user);
  INSERT INTO public.groups (id, name, assignment_basis, grade_start, grade_end, age_start, age_end)
  VALUES (group_key, 'Year deletion fixture', 'age', 1, 12, 1, 99);
  INSERT INTO public.scout_years (id, label) VALUES (target_year, target_label), (other_year, 'Other ' || other_year::text);
  INSERT INTO public.scouts (id, scout_year_id, name, group_id)
  VALUES (target_scout, target_year, 'Target scout', group_key), (other_scout, other_year, 'Other scout', group_key);
  INSERT INTO public.attendance_sessions (id, scout_year_id, group_id, date) VALUES (attendance_id, target_year, group_key, current_date);
  INSERT INTO public.attendance_records (session_id, scout_id, status) VALUES (attendance_id, target_scout, 'present');
  INSERT INTO public.chief_attendance_sessions (id, scout_year_id, date) VALUES (chief_attendance_id, target_year, current_date);
  INSERT INTO public.chief_attendance_records (session_id, chief_id, status) VALUES (chief_attendance_id, requesting_user, 'present');
  INSERT INTO public.scout_equipe_assignments (scout_id, group_id) VALUES (target_scout, group_key);
  INSERT INTO public.registration_uploads (scout_year_id, file_name, storage_path) VALUES (target_year, 'fixture.csv', target_year::text || '/fixture.csv');
  INSERT INTO public.posts (id, scout_year_id, slug, title, body, status) VALUES (post_id, target_year, post_id::text, 'Preserve post', 'Original body', 'draft');
  INSERT INTO public.gallery_albums (id, scout_year_id, title, status) VALUES (album_id, target_year, 'Preserve album', 'draft');
  INSERT INTO public.calendar_events (id, scout_year_id, title, event_date, status) VALUES (calendar_id, target_year, 'Preserve event', current_date, 'draft');
  INSERT INTO public.announcements (id, scout_year_id, title, body, status) VALUES (announcement_id, target_year, 'Preserve announcement', 'Original body', 'draft');
  INSERT INTO public.content_submissions (id, scout_year_id, content_type, title, status) VALUES (content_id, target_year, 'test', 'Preserve content', 'draft');
  INSERT INTO public.documents (id, scout_year_id, title, storage_path, status) VALUES (preserved_document_id, target_year, 'Preserve document', 'fixture/document.pdf', 'draft');
  INSERT INTO public.reports (id, scout_year_id, title, report_type) VALUES (report_id, target_year, 'Preserve report', 'test');
  INSERT INTO public.archived_years (id, scout_year_id, year_label) VALUES (archived_id, target_year, target_label);

  -- Optional registration migration has additional RESTRICT and CASCADE edges.
  IF to_regclass('public.registration_campaigns') IS NOT NULL THEN
    INSERT INTO public.posted_forms (id, title) VALUES (form_id, 'Owned campaign form'), (other_form_id, 'Unrelated campaign form');
    INSERT INTO public.registration_campaigns (id, posted_form_id, scout_year_id, title, slug)
    VALUES (owned_campaign_id, form_id, target_year, 'Owned campaign', 'test-' || owned_campaign_id::text),
      (other_campaign_id, other_form_id, other_year, 'Other campaign', 'test-' || other_campaign_id::text);
    INSERT INTO public.registration_parent_verification_challenges (id, campaign_id, scout_id, destination_hash, expires_at)
    VALUES (verification_id, owned_campaign_id, target_scout, 'fixture', now() + interval '1 hour');
    INSERT INTO public.scout_registration_drafts (id, campaign_id, registration_path, resume_token_hash, matched_scout_id)
    VALUES (owned_draft_id, owned_campaign_id, 'returning', owned_draft_id::text, target_scout);
    INSERT INTO public.scout_registration_submissions (id, campaign_id, registration_path, matched_scout_id, parent_verification_id)
    VALUES (owned_submission_id, owned_campaign_id, 'returning', target_scout, verification_id),
      (other_submission_id, other_campaign_id, 'returning', target_scout, verification_id);
    INSERT INTO public.scout_registration_people (submission_id, full_name) VALUES (owned_submission_id, 'Owned person');
    INSERT INTO public.scout_registration_parent_contacts (submission_id, relationship, full_name) VALUES (owned_submission_id, 'guardian', 'Owned guardian');
    INSERT INTO public.scout_registration_consents (submission_id, consent_version, consent_text_hash, accepted, signer_name)
    VALUES (owned_submission_id, 'v1', 'fixture', true, 'Owned guardian');
    INSERT INTO public.scout_registration_reviews (submission_id, review_type, decision, reviewed_by)
    VALUES (owned_submission_id, 'approval', 'approved', requesting_user);
    INSERT INTO public.scout_registration_documents (id, submission_id, question_id, bucket_id, object_path, document_type, original_format, mime_type, size_bytes)
    VALUES (registration_document_id, owned_submission_id, 'headshot', 'scout-headshots', owned_campaign_id::text || '/' || registration_document_id::text || '.webp', 'headshot', 'webp', 'image/webp', 10),
      (cross_year_document_id, other_submission_id, 'headshot', 'scout-headshots', other_campaign_id::text || '/' || cross_year_document_id::text || '.webp', 'headshot', 'webp', 'image/webp', 10);
    UPDATE public.scout_registration_documents SET original_document_id = registration_document_id WHERE id = cross_year_document_id;
    INSERT INTO public.registration_document_access_logs (document_id, submission_id, actor_id, action, purpose)
    VALUES (registration_document_id, owned_submission_id, requesting_user, 'reveal', 'SQL fixture');
    INSERT INTO public.scout_registration_duplicate_matches (id, submission_id, candidate_scout_id, score, classification)
    VALUES (duplicate_id, other_submission_id, target_scout, 50, 'medium');
    INSERT INTO public.scout_season_enrollments (scout_id, scout_year_id, registration_submission_id)
    VALUES (target_scout, target_year, owned_submission_id);
    INSERT INTO public.registration_retention_jobs (campaign_id, eligible_before) VALUES (owned_campaign_id, now());
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', requesting_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  snapshot := public.get_scout_year_backup_snapshot(target_year);
  original_snapshot := snapshot;
  ASSERT snapshot = public.get_scout_year_backup_snapshot(target_year), 'snapshot is nondeterministic';
  PERFORM set_config('TimeZone', 'Asia/Dubai', true);
  ASSERT snapshot = public.get_scout_year_backup_snapshot(target_year), 'snapshot changes with session timezone';
  receipt_manifest := jsonb_build_object('version', 1, 'complete', true, 'filesComplete', true, 'yearId', target_year,
    'snapshotHash', snapshot->>'snapshotHash', 'counts', snapshot->'counts');
  INSERT INTO public.scout_year_backup_receipts (id, scout_year_id, requested_by, archive_path, snapshot_hash, manifest, expires_at)
  VALUES (receipt_id, target_year, requesting_user, backup_path, snapshot->>'snapshotHash', receipt_manifest, now() + interval '1 hour');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('scout-year-backups', backup_path);

  PERFORM pg_temp.expect_year_deletion_error(gen_random_uuid(), receipt_id, target_label, 'year_not_found');
  PERFORM pg_temp.expect_year_deletion_error(target_year, gen_random_uuid(), target_label, 'receipt_not_found');
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, 'wrong label', 'label_mismatch');
  -- The existing one-active-year invariant remains valid inside the subtransaction.
  BEGIN
    UPDATE public.scout_years SET is_active = false WHERE is_active;
    UPDATE public.scout_years SET is_active = true WHERE id = target_year;
    PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'active_year');
    RAISE EXCEPTION 'rollback_active_fixture' USING ERRCODE = 'ZX001';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', requesting_user, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'permission_denied');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', another_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'permission_denied');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', requesting_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  UPDATE public.scout_year_backup_receipts SET requested_by = another_user WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'receipt_wrong_user');
  UPDATE public.scout_year_backup_receipts SET requested_by = requesting_user, scout_year_id = other_year WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'receipt_wrong_year');
  UPDATE public.scout_year_backup_receipts SET scout_year_id = target_year, created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'receipt_expired');
  UPDATE public.scout_year_backup_receipts SET expires_at = now() + interval '1 hour', used_at = now() WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'receipt_used');
  UPDATE public.scout_year_backup_receipts SET used_at = NULL, manifest = '{}' WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'incomplete_manifest');
  UPDATE public.scout_year_backup_receipts SET manifest = receipt_manifest - 'filesComplete' WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'incomplete_manifest');
  UPDATE public.scout_year_backup_receipts SET manifest = original_snapshot - 'data' || jsonb_build_object('complete', true, 'filesComplete', true) WHERE id = receipt_id;
  UPDATE public.scout_year_backup_receipts SET archive_path = backup_path || '.missing' WHERE id = receipt_id;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'archive_not_found');
  UPDATE public.scout_year_backup_receipts SET archive_path = target_year::text || '/' || receipt_id::text || '.zip' WHERE id = receipt_id;

  -- Same count, same ID, different field: counts-only snapshots would miss this.
  UPDATE public.attendance_records SET status = 'absent' WHERE session_id = attendance_id AND scout_id = target_scout;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'stale_snapshot');
  UPDATE public.attendance_records SET status = 'present' WHERE session_id = attendance_id AND scout_id = target_scout;
  -- Same count, replacement ID: counts and timestamps alone would miss this.
  UPDATE public.registration_uploads SET id = gen_random_uuid() WHERE scout_year_id = target_year;
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'stale_snapshot');
  ASSERT EXISTS (SELECT 1 FROM public.scout_years WHERE id = target_year), 'denial deleted year';
  ASSERT EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND scout_year_id = target_year), 'denial detached post';
  ASSERT EXISTS (SELECT 1 FROM public.scout_year_backup_receipts WHERE id = receipt_id AND used_at IS NULL), 'denial consumed receipt';

  snapshot := public.get_scout_year_backup_snapshot(target_year);
  UPDATE public.scout_year_backup_receipts SET snapshot_hash = snapshot->>'snapshotHash',
    manifest = snapshot - 'data' || jsonb_build_object('complete', true, 'filesComplete', true) WHERE id = receipt_id;
  -- Force failure after all deletion statements to prove transaction rollback.
  EXECUTE 'CREATE FUNCTION pg_temp.reject_year_audit() RETURNS trigger LANGUAGE plpgsql AS $trigger$ BEGIN RAISE EXCEPTION ''fixture_audit_failure''; END; $trigger$';
  EXECUTE 'CREATE TRIGGER reject_year_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = ''scout_year.deleted_with_backup'') EXECUTE FUNCTION pg_temp.reject_year_audit()';
  PERFORM pg_temp.expect_year_deletion_error(target_year, receipt_id, target_label, 'fixture_audit_failure');
  ASSERT EXISTS (SELECT 1 FROM public.scouts WHERE id = target_scout), 'audit failure did not roll back scout deletion';
  ASSERT EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND scout_year_id = target_year), 'audit failure did not roll back content detach';
  ASSERT EXISTS (SELECT 1 FROM public.scout_year_backup_receipts WHERE id = receipt_id AND used_at IS NULL), 'audit failure consumed receipt';
  EXECUTE 'DROP TRIGGER reject_year_audit ON public.audit_logs';

  result := public.delete_scout_year_with_backup(target_year, receipt_id, target_label);
  ASSERT result->>'deleted' = 'true', 'success response missing';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scout_years WHERE id = target_year), 'year retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scouts WHERE id = target_scout), 'scout retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.attendance_sessions WHERE id = attendance_id), 'attendance retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.attendance_records WHERE scout_id = target_scout), 'attendance record retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.chief_attendance_sessions WHERE id = chief_attendance_id), 'chief session retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.chief_attendance_records WHERE session_id = chief_attendance_id), 'chief record retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.scout_equipe_assignments WHERE scout_id = target_scout), 'equipe assignment retained';
  ASSERT NOT EXISTS (SELECT 1 FROM public.registration_uploads WHERE scout_year_id = target_year), 'upload retained';
  ASSERT EXISTS (SELECT 1 FROM public.scouts WHERE id = other_scout AND scout_year_id = other_year), 'unrelated scout deleted';
  ASSERT EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND scout_year_id IS NULL AND body = 'Original body'), 'post lost';
  ASSERT EXISTS (SELECT 1 FROM public.gallery_albums WHERE id = album_id AND scout_year_id IS NULL), 'album lost';
  ASSERT EXISTS (SELECT 1 FROM public.calendar_events WHERE id = calendar_id AND scout_year_id IS NULL), 'calendar lost';
  ASSERT EXISTS (SELECT 1 FROM public.announcements WHERE id = announcement_id AND scout_year_id IS NULL), 'announcement lost';
  ASSERT EXISTS (SELECT 1 FROM public.content_submissions WHERE id = content_id AND scout_year_id IS NULL), 'content lost';
  ASSERT EXISTS (SELECT 1 FROM public.documents WHERE id = preserved_document_id AND scout_year_id IS NULL), 'document lost';
  ASSERT EXISTS (SELECT 1 FROM public.reports WHERE id = report_id AND scout_year_id IS NULL), 'report lost';
  ASSERT EXISTS (SELECT 1 FROM public.archived_years WHERE id = archived_id AND scout_year_id IS NULL), 'archive lost';
  ASSERT EXISTS (SELECT 1 FROM public.scout_year_backup_receipts WHERE id = receipt_id AND used_at IS NOT NULL AND scout_year_id IS NULL), 'receipt audit evidence lost';
  ASSERT EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = target_year::text AND action = 'scout_year.deleted_with_backup'), 'audit missing';
  IF to_regclass('public.registration_campaigns') IS NOT NULL THEN
    ASSERT NOT EXISTS (SELECT 1 FROM public.registration_campaigns WHERE id = owned_campaign_id), 'owned campaign retained';
    ASSERT NOT EXISTS (SELECT 1 FROM public.scout_registration_submissions WHERE id = owned_submission_id), 'owned submission retained';
    ASSERT NOT EXISTS (SELECT 1 FROM public.scout_registration_documents WHERE id = registration_document_id), 'owned document retained';
    ASSERT NOT EXISTS (SELECT 1 FROM public.registration_document_access_logs WHERE document_id = registration_document_id), 'owned access log retained';
    ASSERT NOT EXISTS (SELECT 1 FROM public.scout_season_enrollments WHERE scout_id = target_scout), 'owned enrollment retained';
    ASSERT EXISTS (SELECT 1 FROM public.registration_campaigns WHERE id = other_campaign_id), 'other campaign deleted';
    ASSERT EXISTS (SELECT 1 FROM public.scout_registration_submissions WHERE id = other_submission_id AND matched_scout_id IS NULL AND parent_verification_id IS NULL), 'other submission not preserved/detached';
    ASSERT EXISTS (SELECT 1 FROM public.scout_registration_duplicate_matches WHERE id = duplicate_id AND candidate_scout_id IS NULL), 'cross-year duplicate review lost';
    ASSERT EXISTS (SELECT 1 FROM public.scout_registration_documents WHERE id = cross_year_document_id AND original_document_id IS NULL), 'cross-year document lost';
    ASSERT EXISTS (SELECT 1 FROM public.posted_forms WHERE id = form_id), 'posted form deleted';
  END IF;
END;
$$;

ROLLBACK;
