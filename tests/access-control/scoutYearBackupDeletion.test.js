import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationUrl = new URL("../../database/supabase-scout-year-backup-deletion.sql", import.meta.url);
const sql = fs.existsSync(migrationUrl) ? fs.readFileSync(migrationUrl, "utf8") : "";
const preserved = ["posts", "gallery_albums", "calendar_events", "announcements", "content_submissions", "documents", "reports", "archived_years"];
const transitive = ["gallery_images", "photo_upload_batches", "post_revisions", "album_revisions"];
const operational = ["attendance_records", "attendance_sessions", "chief_attendance_records", "chief_attendance_sessions", "scout_equipe_assignments", "registration_uploads", "scouts"];
const registration = ["registration_campaigns", "registration_parent_verification_challenges", "scout_registration_drafts", "scout_registration_submissions", "scout_registration_people", "scout_registration_parent_contacts", "scout_registration_documents", "scout_registration_duplicate_matches", "scout_registration_reviews", "scout_registration_consents", "scout_season_enrollments", "registration_retention_jobs", "registration_document_access_logs"];
const body = (name) => sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"))?.[0] ?? "";

test("year deletion requires a dedicated protected backup migration", () => {
  assert.notEqual(sql, "", "protected year deletion migration must exist");
});

test("receipts remain private and survive deletion as consumed audit evidence", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.scout_year_backup_receipts/i);
  assert.match(sql, /scout_year_id uuid REFERENCES public\.scout_years\(id\) ON DELETE SET NULL/i);
  assert.match(sql, /requested_by uuid NOT NULL REFERENCES public\.user_profiles\(id\)/i);
  for (const field of ["archive_path", "snapshot_hash", "manifest", "expires_at", "used_at", "created_at"]) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.match(sql, /ALTER TABLE public\.scout_year_backup_receipts ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.scout_year_backup_receipts FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(sql, /CREATE POLICY[^;]+ON public\.scout_year_backup_receipts/i);
  assert.match(sql, /'scout-year-backups', 'scout-year-backups', false/i);
  assert.doesNotMatch(sql, /CREATE POLICY[^;]+ON storage\.objects/i);
});

test("only normalized retention permission and its MFA authorize deletion", () => {
  const deletion = body("delete_scout_year_with_backup");
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE SET[\s\S]*requires_mfa = EXCLUDED\.requires_mfa,[\s\S]*is_active = true;/i);
  assert.match(deletion, /target_year_id uuid,\s*target_receipt_id uuid,\s*expected_label text/i);
  assert.match(deletion, /RETURNS jsonb[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public, pg_temp[\s\S]*SET timezone = 'UTC'/i);
  assert.match(deletion, /actor_id uuid := auth\.uid\(\)/i);
  assert.match(deletion, /public\.has_permission\('registration\.retention\.manage'\)/i);
  assert.match(deletion, /public\.has_required_aal\('registration\.retention\.manage'\)/i);
  assert.doesNotMatch(deletion, /is_admin\(|user_permissions|role\s*=\s*'admin'/i);
  assert.match(sql, /REVOKE DELETE ON TABLE public\.scout_years FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_scout_year_with_backup\(uuid, uuid, text\) TO authenticated/i);
});

test("backup snapshot records deterministic rows, not counts alone", () => {
  const snapshot = body("get_scout_year_backup_snapshot");
  assert.match(snapshot, /SET search_path = pg_catalog, public, pg_temp/i);
  assert.match(snapshot, /SET timezone = 'UTC'/i);
  assert.match(snapshot, /jsonb_agg\(to_jsonb\(record\) ORDER BY/i);
  assert.match(snapshot, /sha256\(convert_to\(/i);
  assert.match(snapshot, /record\.original_document_id IN \(SELECT owned_document\.id/i, "cross-year derivative documents must be included before detaching their parent link");
  for (const table of ["scout_years", ...preserved, ...transitive, ...operational, ...registration]) assert.match(snapshot, new RegExp(`'${table}'`));
  assert.match(snapshot, /'data',[\s\S]*'counts',[\s\S]*'snapshotHash'/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_scout_year_backup_snapshot\(uuid\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_scout_year_backup_snapshot\(uuid\) TO service_role/i);
});

test("deletion rejects invalid year, receipt, manifest, and stale snapshot before mutations", () => {
  const deletion = body("delete_scout_year_with_backup");
  for (const error of ["year_not_found", "active_year", "label_mismatch", "receipt_not_found", "receipt_wrong_user", "receipt_wrong_year", "receipt_expired", "receipt_used", "incomplete_manifest", "stale_snapshot", "archive_not_found"]) assert.match(deletion, new RegExp(`'${error}'`));
  for (const field of ["complete", "filesComplete", "version", "yearId", "snapshotHash", "counts"]) assert.match(deletion, new RegExp(`->>?\\s*'${field}'`));
  assert.match(deletion, /FOR UPDATE/i);
  assert.match(deletion, /IN SHARE ROW EXCLUSIVE MODE/i);
  assert.ok(deletion.indexOf("'stale_snapshot'") < deletion.indexOf("UPDATE public.posts"));
});

test("deletion preserves content and deletes every known operational dependency in order", () => {
  const deletion = body("delete_scout_year_with_backup");
  assert.match(deletion, /FROM pg_catalog\.pg_constraint dependency/i);
  assert.match(deletion, /JOIN pg_catalog\.pg_class child/i);
  assert.match(deletion, /JOIN pg_catalog\.pg_namespace child_schema/i);
  assert.doesNotMatch(deletion, /(?:FROM|JOIN)\s+pg_(?:constraint|class|namespace)\b/i);
  for (const table of transitive) assert.match(deletion, new RegExp(`'${table}'`), `${table} must be locked during snapshot validation and deletion`);
  for (const table of preserved) {
    assert.match(deletion, new RegExp(`UPDATE public\\.${table} SET scout_year_id = NULL WHERE scout_year_id = target_year_id`, "i"));
    assert.doesNotMatch(deletion, new RegExp(`DELETE FROM public\\.${table}\\b`, "i"));
  }
  for (const table of [...operational, ...registration, "scout_years"]) assert.match(deletion, new RegExp(`DELETE FROM public\\.${table}\\b`, "i"));
  for (const [child, parent] of [["attendance_records", "attendance_sessions"], ["attendance_records", "scouts"], ["chief_attendance_records", "chief_attendance_sessions"], ["scout_equipe_assignments", "scouts"], ["registration_document_access_logs", "scout_registration_documents"], ["scout_registration_documents", "scout_registration_submissions"], ["scout_season_enrollments", "scouts"], ["scout_registration_submissions", "registration_campaigns"], ["scouts", "scout_years"]]) {
    assert.ok(deletion.indexOf(`DELETE FROM public.${child} `) < deletion.indexOf(`DELETE FROM public.${parent} `), `${child} must be deleted before ${parent}`);
  }
  assert.match(deletion, /UPDATE public\.scout_registration_duplicate_matches SET candidate_scout_id = NULL/i);
  assert.doesNotMatch(sql, /ALTER TABLE public\.(?:registration_campaigns|scout_season_enrollments)[^;]*DROP NOT NULL/i);
  assert.match(deletion, /UPDATE public\.scout_year_backup_receipts SET used_at =/i);
  assert.match(deletion, /INSERT INTO public\.audit_logs/i);
});

test("clean schema mirrors the complete additive migration", () => {
  const schema = fs.readFileSync(new URL("../../database/supabase-schema.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
  assert.notEqual(sql, "");
  assert.ok(schema.includes(sql.replaceAll("\r\n", "\n").trim()), "clean schema must include the exact migration");
});

test("rollback SQL covers denial and successful data preservation", () => {
  const url = new URL("../../database/tests/scout-year-backup-deletion.sql", import.meta.url);
  const fixture = fs.existsSync(url) ? fs.readFileSync(url, "utf8") : "";
  assert.match(fixture, /^BEGIN;/m);
  assert.match(fixture, /ROLLBACK;\s*$/);
  for (const name of ["active_year", "receipt_wrong_user", "receipt_wrong_year", "receipt_expired", "receipt_used", "incomplete_manifest", "stale_snapshot", "label_mismatch", "permission_denied"]) assert.match(fixture, new RegExp(`'${name}'`));
  assert.match(fixture, /CREATE TEMP TABLE pg_constraint/i);
  assert.match(fixture, /UPDATE public\.gallery_images SET title = 'Mutated image title'[\s\S]*'stale_snapshot'/i);
  assert.match(fixture, /used_at IS NOT NULL/i);
  assert.match(fixture, /scout_year_id IS NULL/i);
  assert.match(fixture, /registration_campaigns/i);
});
