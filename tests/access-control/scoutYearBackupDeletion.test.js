import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transform } from "esbuild";
import { unzipSync, zipSync as realZipSync } from "fflate";

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
  assert.match(sql, /INSERT INTO public\.role_permissions\s*\(role_id, permission_id\)[\s\S]*'system_administrator', 'registration\.retention\.manage'[\s\S]*ON CONFLICT.*DO NOTHING/i);
  assert.match(deletion, /target_year_id uuid,\s*target_receipt_id uuid,\s*expected_label text/i);
  assert.match(deletion, /RETURNS jsonb[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public, pg_temp[\s\S]*SET timezone = 'UTC'/i);
  assert.match(deletion, /actor_id uuid := auth\.uid\(\)/i);
  assert.match(deletion, /public\.has_permission\('registration\.retention\.manage'\)/i);
  assert.match(deletion, /public\.has_required_aal\('registration\.retention\.manage'\)/i);
  assert.doesNotMatch(deletion, /is_admin\(|user_permissions|role\s*=\s*'admin'/i);
  assert.match(sql, /REVOKE DELETE ON TABLE public\.scout_years FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_scout_year_with_backup\(uuid, uuid, text\) TO authenticated/i);
});

test("database claims protect cleanup, require completion, and support guarded release", () => {
  for (const name of ["claim_scout_year_deletion", "complete_scout_year_cleanup", "abort_scout_year_deletion", "guard_scout_year_deletion_write"]) assert.notEqual(body(name), "", name);
  assert.match(body("delete_scout_year_with_backup"), /cleanup_not_complete/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.scout_year_deletion_claim/);
  assert.match(sql, /storage_reference_survives/);
  assert.match(sql, /FOR SHARE/);
  assert.match(body("abort_scout_year_deletion"), /restore_cleanup_objects_before_abort/);
  assert.match(sql, /CREATE TRIGGER scout_year_deletion_storage_guard/);
  assert.match(body("guard_scout_year_storage_write"), /scout_year_deletion_in_progress/);
});

test("storage reference decoding reaches a fixed point or conservatively reports uncertainty", () => {
  const decoder = body("scout_year_decode_reference");
  assert.doesNotMatch(decoder, /FOR round IN 1\.\.5/);
  assert.match(decoder, /octet_length\(value\)/);
  assert.match(decoder, /work_bytes/);
  assert.match(decoder, /RETURN NULL/);
  assert.match(body("scout_year_row_mentions"), /COALESCE\(strpos\([\s\S]*, true\)/i);
  const fixture = fs.readFileSync(new URL("../../database/tests/scout-year-backup-deletion.sql", import.meta.url), "utf8");
  assert.match(fixture, /deeply_encoded_path/);
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

const helperUrl = new URL("../../supabase/functions/_shared/scoutYearBackup.ts", import.meta.url);
const functionUrl = new URL("../../supabase/functions/scout-year-backup/index.ts", import.meta.url);
const edgeSource = fs.existsSync(functionUrl) ? fs.readFileSync(functionUrl, "utf8") : "";
const yearId = "11111111-1111-4111-8111-111111111111";
const callerId = "22222222-2222-4222-8222-222222222222";
const snapshotHash = "a".repeat(64);
const fixtureSnapshot = (extra = {}) => {
  const data = { scout_years: [{ id: yearId, label: "2024–2025", is_active: false }], ...extra };
  return { version: 1, yearId, snapshotHash, data, counts: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])) };
};
async function helpers() {
  assert.ok(fs.existsSync(helperUrl), "backup pure helper must exist");
  return import(helperUrl.href);
}

test("backup Edge Function authorizes retention before trusted reads and uses pinned ZIP/CORS", () => {
  assert.notEqual(edgeSource, "", "backup Edge Function must exist");
  assert.match(edgeSource, /npm:fflate@0\.8\.2/);
  assert.match(edgeSource, /req\.method === "OPTIONS"/);
  assert.match(edgeSource, /req\.method !== "POST"/);
  assert.match(edgeSource, /requireDashboardPermission\(req, "registration\.retention\.manage"\)/);
  assert.ok(edgeSource.indexOf("await requireDashboardPermission") < edgeSource.indexOf('.rpc("get_scout_year_backup_snapshot"'));
  assert.match(edgeSource, /adminClient\.rpc\("get_scout_year_backup_snapshot"/);
  assert.doesNotMatch(edgeSource, /userClient\.(?:from|rpc)/);
});

test("CSV exports are RFC-4180, stable across key/row ordering, and include every nonempty dataset", async () => {
  const { rowsToCsv, createCsvExports } = await helpers();
  const rows = [{ z: null, id: "b", value: 'two,"quotes"\r\nlines', nested: { z: 2, a: 1 } }, { value: "first", id: "a", nested: [1, 2] }];
  const csv = rowsToCsv(rows);
  assert.equal(csv, 'id,nested,value,z\r\na,"[1,2]",first,\r\nb,"{""a"":1,""z"":2}","two,""quotes""\r\nlines",\r\n');
  assert.equal(csv, rowsToCsv([...rows].reverse().map((row) => Object.fromEntries(Object.entries(row).reverse()))));
  const files = createCsvExports(fixtureSnapshot({ scouts: rows, reports: [] }));
  assert.deepEqual(files.map((file) => file.archivePath), ["year.csv", "scout_years.csv", "scouts.csv"]);
  assert.equal(new TextDecoder().decode(files[2].bytes), csv);
});

test("trusted snapshot validation rejects malformed counts/hash, missing years, and active years", async () => {
  const { validateBackupSnapshot } = await helpers();
  const good = fixtureSnapshot();
  assert.deepEqual(validateBackupSnapshot(good, yearId), good);
  for (const bad of [null, { ...good, snapshotHash: "bad" }, { ...good, yearId: callerId }, { ...good, counts: {} }, fixtureSnapshot({ scout_years: [] }), fixtureSnapshot({ scout_years: [{ id: yearId, is_active: true }] })]) {
    assert.throws(() => validateBackupSnapshot(bad, yearId));
  }
});

test("storage inventory maps all current paths, nested revisions, and deduplicates with preservation winning", async () => {
  const { collectStorageReferences } = await helpers();
  const snapshot = fixtureSnapshot({
    registration_uploads: [{ id: "u", scout_year_id: yearId, storage_path: "registration/year/source.xlsx" }],
    posts: [{ id: "p", thumbnail_path: "post.webp" }],
    post_revisions: [{ id: "pr", proposed_data: { thumbnailPath: "revision.webp" } }],
    gallery_albums: [{ id: "a", thumbnail_storage_path: "album.webp" }],
    album_revisions: [{ id: "ar", proposed_data: { thumbnailPath: "new-album.webp" } }],
    gallery_images: [{ id: "i", storage_path: "image.webp", thumbnail_storage_path: "thumb.webp" }, { id: "j", storage_path: "image.webp" }],
    calendar_events: [{ id: "e", storage_path: "event.webp" }],
    documents: [{ id: "d", storage_path: "file.pdf" }],
    reports: [{ id: "r", storage_path: "report.pdf" }, { id: "shared", storage_path: "registration/year/source.xlsx" }],
    registration_campaigns: [{ id: "c", scout_year_id: yearId }],
    scout_registration_submissions: [{ id: "s", campaign_id: "c" }],
    scout_registration_documents: [{ id: "rd", submission_id: "s", bucket_id: "identity-documents", object_path: "c/s/identity.webp" }, { id: "cross", submission_id: "other-year", bucket_id: "identity-documents", object_path: "other/cross.webp" }]
  });
  const refs = collectStorageReferences(snapshot);
  const byPath = Object.fromEntries(refs.map((ref) => [ref.path, ref]));
  for (const [path, bucket] of Object.entries({ "post.webp": "blog-thumbnails", "revision.webp": "blog-thumbnails", "album.webp": "album-thumbnails", "new-album.webp": "album-thumbnails", "image.webp": "gallery", "thumb.webp": "gallery", "event.webp": "event-images", "file.pdf": "dashboard-documents", "report.pdf": "scouts-files", "c/s/identity.webp": "identity-documents" })) assert.equal(byPath[path].bucket, bucket);
  assert.equal(refs.filter((ref) => ref.path === "image.webp").length, 1);
  assert.equal(byPath["registration/year/source.xlsx"].deleteWithYear, false);
  assert.equal(byPath["c/s/identity.webp"].deleteWithYear, true);
  assert.equal(byPath["other/cross.webp"].deleteWithYear, false);
  assert.ok(refs.filter((ref) => !ref.path.startsWith("c/s/")).every((ref) => ref.deleteWithYear === false));
  assert.deepEqual(refs, collectStorageReferences({ ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).reverse()) }));
});

test("storage inventory honors configured upload bucket and fails closed on unmapped or unsafe references", async () => {
  const { collectStorageReferences } = await helpers();
  const snapshot = fixtureSnapshot({ registration_uploads: [{ scout_year_id: yearId, storage_path: "registration/source.xlsx" }] });
  assert.equal(collectStorageReferences(snapshot, "custom-uploads")[0].bucket, "custom-uploads");
  assert.equal(collectStorageReferences(snapshot)[0].deleteWithYear, true);
  for (const path of ["../escape", "/absolute", "C:\\secret", "a/../b", "a/%2e%2e/b", "https://example.com/file"]) {
    assert.throws(() => collectStorageReferences(fixtureSnapshot({ gallery_images: [{ storage_path: path }] })), /storage reference/i);
  }
  assert.throws(() => collectStorageReferences(fixtureSnapshot({ new_dataset: [{ storage_path: "unknown.pdf" }] })), /storage reference/i);
});

test("deleted registration document tombstones remain metadata and cannot hide malformed or live references", async () => {
  const helper = await helpers();
  const documentId = "33333333-3333-4333-8333-333333333333";
  const path = `${callerId}/${documentId}/${yearId}.deleted`;
  const doc = { id: documentId, submission_id: callerId, bucket_id: "identity-documents", object_path: path, verification_status: "deleted", deleted_at: "2026-09-25T00:00:00Z" };
  const snapshot = fixtureSnapshot({ scout_registration_documents: [doc] });
  assert.deepEqual(helper.collectStorageReferences(snapshot), []);
  const csvs = helper.createCsvExports(snapshot);
  assert.match(new TextDecoder().decode(csvs.find((f) => f.dataset === "scout_registration_documents").bytes), /\.deleted/);
  const manifest = await helper.createBackupManifest(snapshot, csvs, [], [], new Date().toISOString());
  assert.equal(manifest.complete, true);
  assert.equal(manifest.counts.scout_registration_documents, 1);
  for (const change of [{ verification_status: "verified" }, { deleted_at: null }, { deleted_at: "invalid" }, { object_path: `${yearId}/${documentId}/${yearId}.deleted` }, { object_path: `${callerId}/${documentId}/../fake.deleted` }, { object_path: "live.webp" }]) {
    assert.throws(() => helper.collectStorageReferences(fixtureSnapshot({ scout_registration_documents: [{ ...doc, ...change }] })), /tombstone/i);
  }
});

test("archived year snapshots map their real nested public-content shape without deletion ownership", async () => {
  const { collectStorageReferences } = await helpers();
  const refs = collectStorageReferences(fixtureSnapshot({
    archived_years: [{
      snapshot: {
        posts: [{ thumbnailPath: "archives/post.webp" }],
        albums: [{
          thumbnailPath: "archives/album.webp",
          photos: [{ storagePath: "archives/photo.webp", thumbnailPath: "archives/photo-thumb.webp" }]
        }],
        events: [{ storagePath: "archives/event.webp" }]
      }
    }]
  }));
  const byPath = Object.fromEntries(refs.map((ref) => [ref.path, ref]));
  assert.deepEqual(Object.fromEntries(Object.entries(byPath).map(([path, ref]) => [path, ref.bucket])), {
    "archives/album.webp": "album-thumbnails",
    "archives/event.webp": "event-images",
    "archives/photo-thumb.webp": "gallery",
    "archives/photo.webp": "gallery",
    "archives/post.webp": "blog-thumbnails"
  });
  assert.ok(refs.every((ref) => ref.deleteWithYear === false));
});

test("archive paths cannot traverse or collide after sanitization, including case-insensitive extraction", async () => {
  const { collectStorageReferences } = await helpers();
  const refs = collectStorageReferences(fixtureSnapshot({ gallery_images: ["a/b?.webp", "a/b*.webp", "a/B.webp", "a/b.webp", "a/日本語.webp"].map((storage_path) => ({ storage_path })) }));
  assert.equal(new Set(refs.map((ref) => ref.archivePath.toLowerCase())).size, refs.length);
  for (const ref of refs) {
    assert.match(ref.archivePath, /^files\/[a-zA-Z0-9_.-]+$/);
    assert.ok(!ref.archivePath.split("/").includes(".."));
  }
});

test("manifest completeness requires every referenced object and retains the trusted SQL hash", async () => {
  const { collectStorageReferences, createCsvExports, createBackupManifest, sha256Hex } = await helpers();
  assert.equal(await sha256Hex(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const snapshot = fixtureSnapshot({ gallery_images: [{ storage_path: "photo.webp" }] });
  const refs = collectStorageReferences(snapshot);
  const csvs = createCsvExports(snapshot);
  const generatedAt = "2026-09-25T00:00:00.000Z";
  const incomplete = await createBackupManifest(snapshot, csvs, refs, [], generatedAt);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.filesComplete, false);
  assert.equal(incomplete.missing.length, 1);
  const complete = await createBackupManifest(snapshot, csvs, refs, [{ ...refs[0], bytes: new Uint8Array([1, 2, 3]) }], generatedAt);
  assert.equal(complete.complete, true);
  assert.equal(complete.filesComplete, true);
  assert.equal(complete.yearLabel, "2024–2025");
  assert.equal(complete.snapshotHash, snapshotHash);
  assert.deepEqual(complete.counts, snapshot.counts);
  assert.equal(complete.generatedAt, generatedAt);
  assert.equal(complete.files.length, csvs.length + 1);
  assert.deepEqual(complete.missing, []);
  assert.ok(complete.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256) && file.sizeBytes > 0));
});

test("real fflate ZIP output uses deterministic entry mtimes", async () => {
  const { createDeterministicZipEntries } = await helpers();
  const files = [{ archivePath: "year.csv", bytes: new TextEncoder().encode("id\r\n1\r\n") }];
  const manifestBytes = new TextEncoder().encode('{"complete":true}');
  const first = realZipSync(createDeterministicZipEntries(files, manifestBytes), { level: 6 });
  const second = realZipSync(createDeterministicZipEntries(files, manifestBytes), { level: 6 });
  assert.deepEqual(first, second);
  assert.equal(new DataView(first.buffer, first.byteOffset, first.byteLength).getUint16(10, true), 0, "DOS entry time must be midnight");
  assert.equal(new DataView(first.buffer, first.byteOffset, first.byteLength).getUint16(12, true), 0x2821, "DOS entry date must be 2000-01-01");
  const unzipped = unzipSync(first);
  assert.equal(new TextDecoder().decode(unzipped["year.csv"]), "id\r\n1\r\n");
  assert.equal(new TextDecoder().decode(unzipped["manifest.json"]), '{"complete":true}');
});

// External boundaries alone are replaced; CSV, reference, hash, manifest, and
// request orchestration execute their production implementations.
async function edgeHarness(options = {}) {
  assert.notEqual(edgeSource, "", "backup Edge Function must exist");
  const helper = await helpers();
  const events = [];
  const archives = [];
  const receipts = [];
  const audits = [];
  class AuthorizationError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const snapshot = options.snapshot ?? fixtureSnapshot({ registration_uploads: [{ scout_year_id: yearId, storage_path: "registration/source.xlsx" }] });
  const adminClient = {
    rpc: async (name) => { events.push(name); return { data: snapshot, error: null }; },
    from(table) {
      if (table === "scout_years") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.missingYear ? null : snapshot.data.scout_years[0], error: null }) }) }) };
      if (table === "audit_logs") return { insert: async (row) => { audits.push(row); return { error: options.auditFailure ? { message: "private audit error" } : null }; } };
      if (table === "scout_year_backup_receipts") return { insert: (row) => { receipts.push(row); return { select: () => ({ single: async () => ({ data: options.receiptFailure ? null : { id: "receipt-id" }, error: options.receiptFailure ? { message: "private receipt error" } : null }) }) }; } };
      throw new Error(`Unexpected table ${table}`);
    },
    storage: { from(bucket) { return {
      download: async (path) => { events.push(`download:${bucket}/${path}`); return { data: options.missingFile ? null : new Blob(["sheet bytes"]), error: options.missingFile ? { message: "secret signed url" } : null }; },
      upload: async (path, bytes) => { archives.push({ path, bytes }); events.push("upload"); return { error: null }; },
      remove: async (paths) => { events.push("cleanup"); return { error: options.cleanupFailure ? { message: "private cleanup error" } : null }; },
      createSignedUrl: async (path, ttl) => { events.push(`sign:${ttl}`); return { data: options.signFailure ? null : { signedUrl: "https://private.test/archive?secret=token" }, error: options.signFailure ? { message: "private signing error" } : null }; }
    }; } }
  };
  let handler;
  const source = edgeSource.replace(/^import[\s\S]*?;\s*$/gm, "");
  const compiled = await transform(source, { loader: "ts", format: "iife" });
  vm.runInNewContext(compiled.code, {
    ...helper, Uint8Array, TextEncoder, TextDecoder, Request, Response, Blob, Date, crypto,
    console: { error() {}, warn() {}, log() {} },
    Deno: { env: { get: () => undefined }, serve: (callback) => { handler = callback; } },
    AuthorizationError,
    parseUuid(value) { if (value !== yearId) throw new AuthorizationError("Scouting year is invalid", 400); return value; },
    requireDashboardPermission: async () => { events.push("authorize"); if (options.denied) throw new AuthorizationError("Forbidden", 403); return { adminClient, callerId }; },
    corsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
    jsonResponse: (req, body, status = 200) => new Response(JSON.stringify(body), { status }),
    zipSync: (entries) => { events.push("zip"); archives.push({ entries }); return new Uint8Array([80, 75]); }
  });
  return { events, archives, receipts, audits, request: (body = { scoutYearId: yearId }, method = "POST") => handler(new Request("http://localhost/backup", { method, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) })) };
}

test("user-editable revision JSON cannot choose a service-role storage bucket", async () => {
  const harness = await edgeHarness({
    snapshot: fixtureSnapshot({
      post_revisions: [{
        id: "malicious-revision",
        proposed_data: {
          thumbnailPath: "revisions/safe-thumbnail.webp",
          bucket: "finance-private",
          bucket_id: "finance-private",
          storageBucket: "finance-private"
        }
      }]
    })
  });
  assert.equal((await harness.request()).status, 200);
  assert.ok(harness.events.includes("download:blog-thumbnails/revisions/safe-thumbnail.webp"));
  assert.ok(!harness.events.some((event) => event.startsWith("download:finance-private/")));
});

test("Edge success uploads a full archive and issues a caller-bound unused 24-hour receipt and 15-minute URL", async () => {
  const harness = await edgeHarness();
  const before = Date.now();
  const response = await harness.request();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.receiptId, "receipt-id");
  assert.equal(result.manifest.filesComplete, true);
  assert.ok(result.downloadUrl.includes("secret=token"));
  assert.ok(harness.events.indexOf("authorize") < harness.events.indexOf("get_scout_year_backup_snapshot"));
  assert.ok(harness.events.indexOf("zip") > harness.events.findIndex((value) => value.startsWith("download:")));
  assert.ok(harness.events.includes("sign:900"));
  const receipt = harness.receipts[0];
  assert.equal(receipt.requested_by, callerId);
  assert.equal(receipt.scout_year_id, yearId);
  assert.equal(receipt.snapshot_hash, snapshotHash);
  assert.equal(receipt.used_at, null);
  assert.match(receipt.archive_path, new RegExp(`^${callerId}/${yearId}/[a-f0-9-]+\\.zip$`));
  assert.ok(Date.parse(receipt.expires_at) >= before + 24 * 60 * 60 * 1000);
  assert.equal(result.expiresAt, receipt.expires_at);
  assert.ok(harness.archives[0].entries["manifest.json"]);
  assert.ok(harness.archives[0].entries["year.csv"]);
  assert.ok(harness.audits.some((audit) => audit.outcome === "success"));
  assert.ok(!JSON.stringify(harness.audits).includes("secret=token"));
});

test("Edge rejects methods, denied permission, invalid year, missing year, and active year before backup", async () => {
  for (const [options, body, method, status] of [
    [{}, undefined, "OPTIONS", 200], [{}, undefined, "GET", 405],
    [{ denied: true }, undefined, "POST", 403], [{}, { scoutYearId: "bad" }, "POST", 400],
    [{ missingYear: true }, undefined, "POST", 404],
    [{ snapshot: fixtureSnapshot({ scout_years: [{ id: yearId, is_active: true }] }) }, undefined, "POST", 409]
  ]) {
    const harness = await edgeHarness(options);
    assert.equal((await harness.request(body, method)).status, status);
    assert.equal(harness.archives.length, 0);
    assert.equal(harness.receipts.length, 0);
    assert.ok(!harness.events.includes("get_scout_year_backup_snapshot"));
  }
});

test("a missing file fails closed with 409, bounded details, an audit, and no ZIP or receipt", async () => {
  const harness = await edgeHarness({ missingFile: true });
  const response = await harness.request();
  assert.equal(response.status, 409);
  const result = await response.json();
  assert.equal(result.missing.length, 1);
  assert.equal(harness.archives.length, 0);
  assert.equal(harness.receipts.length, 0);
  assert.ok(harness.audits.some((audit) => audit.outcome === "failed"));
  assert.ok(!JSON.stringify(result).includes("secret signed url"));
});

test("receipt, signing, and success-audit failures clean up the staged ZIP and never return success", async () => {
  for (const options of [{ receiptFailure: true }, { signFailure: true }, { auditFailure: true }, { signFailure: true, cleanupFailure: true }]) {
    const harness = await edgeHarness(options);
    const response = await harness.request();
    assert.equal(response.status, 500);
    assert.ok(harness.events.includes("cleanup"));
    const result = await response.json();
    assert.equal(result.downloadUrl, undefined);
    assert.ok(!JSON.stringify(result).includes("private"));
  }
});

const deletionUrl = new URL("../../supabase/functions/delete-scout-year/index.ts", import.meta.url);
const receiptId = "33333333-3333-4333-8333-333333333333";

async function deletionHarness(options = {}) {
  assert.ok(fs.existsSync(deletionUrl), "deletion coordinator must exist");
  const helper = await helpers();
  const snapshot = options.snapshot ?? fixtureSnapshot({
    registration_uploads: [{ id: "upload", scout_year_id: yearId, storage_path: `registration/${yearId}/source.xlsx` }],
    posts: [{ id: "post", thumbnail_path: "preserved.webp" }]
  });
  const refs = helper.collectStorageReferences(snapshot, options.uploadBucket ?? "scouts-files");
  const manifest = await helper.createBackupManifest(snapshot, helper.createCsvExports(snapshot), refs,
    refs.map((ref) => ({ ...ref, bytes: new TextEncoder().encode("file") })), new Date().toISOString());
  const receipt = {
    id: receiptId, scout_year_id: yearId, requested_by: callerId,
    archive_path: `${callerId}/${yearId}/archive.zip`, snapshot_hash: snapshotHash,
    expires_at: new Date(Date.now() + 60000).toISOString(), used_at: null,
    manifest: options.manifest ? options.manifest(manifest) : manifest,
    ...options.receipt
  };
  const events = [], audits = [], logs = [], removals = [], rpcCalls = [];
  const claimId = "44444444-4444-4444-8444-444444444444";
  let cleanupAttempts = 0;
  let claimed = false;
  let cleanupRunning = false;
  let cleanupComplete = false;
  let deletionAttempts = 0;
  const storageObjects = new Map(refs.map((ref) => [`${ref.bucket}/${ref.path}`, "original bytes"]));
  storageObjects.set(`scout-year-backups/${receipt.archive_path}`, "backup bytes");
  const survivingRecords = options.survivingRecords ?? [];
  class AuthorizationError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const adminClient = {
    from(table) {
      if (table === "audit_logs") return { insert: async (row) => {
        events.push("audit"); audits.push(row);
        return { error: options.auditFailure ? { message: "secret audit details" } : null };
      } };
      assert.equal(table, "scout_year_backup_receipts");
      return { select: () => ({ eq: (key, value) => {
        assert.equal(key, "id"); assert.equal(value, receiptId);
        return { maybeSingle: async () => {
          events.push("receipt");
          return { data: options.missingReceipt ? null : receipt, error: options.receiptReadFailure ? { message: "secret read details" } : null };
        } };
      } }) };
    },
    rpc: async (name, payload) => {
      if (name === "start_scout_year_cleanup") {
        events.push("start-cleanup");
        if (cleanupComplete) return { data: { started: true, complete: true }, error: null };
        if (cleanupRunning) return { data: null, error: { message: "cleanup_in_progress" } };
        if (options.startFailure) return { data: null, error: { message: "invalid_deletion_claim" } };
        cleanupRunning = true;
        if (options.startThrows) throw new TypeError("cleanup start response lost");
        return { data: { started: true }, error: null };
      }
      if (name === "release_scout_year_cleanup") {
        events.push("release-cleanup"); cleanupRunning = false;
        return { data: null, error: null };
      }
      if (name === "complete_scout_year_cleanup") {
        events.push("complete-cleanup");
        assert.equal(payload.target_claim_id, claimId);
        if (options.completeThrows) throw new TypeError("cleanup RPC network failure");
        if (options.completeUnknown) return { data: null, error: { message: "cleanup RPC response lost" } };
        if (!options.completeFailure) { cleanupRunning = false; cleanupComplete = true; }
        return { data: { complete: true }, error: options.completeFailure ? { code: "P0001", message: "cleanup_not_complete" } : null };
      }
      assert.equal(name, "get_scout_year_backup_snapshot");
      assert.equal(payload.target_year_id, yearId);
      events.push("snapshot");
      return { data: options.staleSnapshot ? { ...snapshot, snapshotHash: "b".repeat(64) } : snapshot, error: null };
    },
    storage: { from(bucket) {
      if (options.preRequestFailure && cleanupAttempts++ === 0) throw new Error("local storage client initialization failed");
      return { remove: async (paths) => {
      events.push("remove"); removals.push({ bucket, paths });
      assert.equal(receipt.used_at, null, "year must remain until cleanup succeeds");
      if (options.removalGate) await options.removalGate;
      if (options.cleanupFailure && cleanupAttempts++ === 0) return { data: null, error: { message: "secret storage failure" } };
      if (options.cleanupThrows) throw options.cleanupThrows;
      for (const path of paths) storageObjects.delete(`${bucket}/${path}`);
      if (options.cleanupResponse !== undefined) return options.cleanupResponse;
      return { data: [], error: null };
    } }; } }
  };
  const userClient = { rpc: async (name, payload) => {
    if (name === "claim_scout_year_deletion") {
      events.push("claim");
      if (!claimed && Date.parse(receipt.expires_at) <= Date.now()) return { data: null, error: { message: "receipt_expired" } };
      if (options.claimError || options.rpcError) return { data: null, error: { message: options.claimError ?? options.rpcError } };
      if (refs.some((ref) => ref.deleteWithYear && ref.bucket === (options.uploadBucket ?? "scouts-files") && !ref.path.startsWith(`registration/${yearId}/`))) return { data: null, error: { message: "unsafe_cleanup_path" } };
      claimed = true;
      return { data: { claimId, inventory: survivingRecords.length ? [] : refs.filter((ref) => ref.deleteWithYear).map(({ bucket, path }) => ({ bucket, path })) }, error: null };
    }
    events.push("delete-rpc"); rpcCalls.push({ name, payload });
    if (options.deletionFailureOnce && deletionAttempts++ === 0) return { data: null, error: { message: "internal transaction failure" } };
    if (options.rpcError) return { data: null, error: { message: options.rpcError } };
    receipt.used_at = new Date().toISOString();
    receipt.scout_year_id = null;
    return { data: { deleted: true, yearId, receiptId }, error: null };
  } };
  let handler;
  const source = fs.readFileSync(deletionUrl, "utf8").replace(/^import[\s\S]*?;\s*$/gm, "");
  const compiled = await transform(source, { loader: "ts", format: "iife" });
  vm.runInNewContext(compiled.code, {
    ...helper, TextEncoder, Uint8Array, Request, Response, Date,
    Deno: { env: { get: (name) => name === "SCOUT_UPLOAD_STORAGE_BUCKET" ? options.uploadBucket : undefined }, serve: (callback) => { handler = callback; } },
    console: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    AuthorizationError,
    parseUuid(value, field) {
      if (typeof value !== "string" || ![yearId, receiptId].includes(value.toLowerCase())) throw new AuthorizationError(`${field} is invalid`, 400);
      return value;
    },
    requireDashboardPermission: async (req, permission) => {
      assert.equal(permission, "registration.retention.manage"); events.push("authorize");
      if (options.denied) throw new AuthorizationError("Forbidden", 403);
      return { adminClient, userClient, callerId };
    },
    corsHeaders: () => ({ "Access-Control-Allow-Origin": "http://localhost:5173" }),
    jsonResponse: (req, body, status = 200) => new Response(JSON.stringify(body), { status })
  });
  return { events, audits, logs, removals, rpcCalls, storageObjects, survivingRecords, request: (body = { scoutYearId: yearId, receiptId, expectedLabel: "2024-2025" }, method = "POST") =>
    handler(new Request("http://localhost/delete", { method, ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) })) };
}

test("deletion claims the snapshot, removes exclusive source objects, completes cleanup, then commits", async () => {
  const harness = await deletionHarness();
  const response = await harness.request({ scoutYearId: yearId, receiptId, expectedLabel: "2024-2025", paths: ["unrelated"], bucket: "finance-private", files: [{ path: "arbitrary" }] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, yearId, receiptId, storageCleanupPending: false });
  assert.ok(harness.events.indexOf("authorize") < harness.events.indexOf("receipt"));
  assert.ok(harness.events.indexOf("snapshot") < harness.events.indexOf("delete-rpc"));
  assert.ok(harness.events.indexOf("delete-rpc") < harness.events.indexOf("audit"));
  assert.deepEqual(JSON.parse(JSON.stringify(harness.rpcCalls)), [{ name: "delete_scout_year_with_backup", payload: { target_year_id: yearId, target_receipt_id: receiptId, expected_label: "2024-2025" } }]);
  assert.ok(harness.events.indexOf("claim") < harness.events.indexOf("remove"));
  assert.ok(harness.events.indexOf("claim") < harness.events.indexOf("start-cleanup"));
  assert.ok(harness.events.indexOf("start-cleanup") < harness.events.indexOf("remove"));
  assert.ok(harness.events.indexOf("remove") < harness.events.indexOf("complete-cleanup"));
  assert.ok(harness.events.indexOf("complete-cleanup") < harness.events.indexOf("delete-rpc"));
  assert.equal(harness.removals.length, 1);
  assert.ok(harness.audits.some((audit) => audit.outcome === "success"));
  assert.equal(harness.storageObjects.has(`scouts-files/registration/${yearId}/source.xlsx`), false);
  assert.equal(harness.storageObjects.get(`scout-year-backups/${callerId}/${yearId}/archive.zip`), "backup bytes");
});

for (const [name, record] of [
  ["another year's registration upload", { table: "registration_uploads", scout_year_id: callerId }],
  ["a preserved report with no year", { table: "reports", scout_year_id: null }]
]) {
  test(`deletion keeps the actual object referenced by ${name}`, async () => {
    const path = `registration/${yearId}/source.xlsx`;
    const harness = await deletionHarness({ survivingRecords: [{ ...record, storage_path: path }] });
    const response = await harness.request();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.deleted, true); assert.equal(result.storageCleanupPending, false);
    assert.equal(harness.survivingRecords[0].storage_path, path);
    assert.equal(harness.storageObjects.get(`scouts-files/${path}`), "original bytes", "surviving reference must keep resolving");
    assert.equal(harness.removals.length, 0);
  });
}

test("foreign and legacy paths cannot acquire cleanup ownership", async () => {
  for (const path of [`registration/${callerId}/source.xlsx`, "legacy/source.xlsx"]) {
    const harness = await deletionHarness({ snapshot: fixtureSnapshot({ registration_uploads: [{ scout_year_id: yearId, storage_path: path }] }) });
    const response = await harness.request();
    assert.equal(response.status, 409);
    assert.equal(harness.storageObjects.get(`scouts-files/${path}`), "original bytes");
    assert.equal(harness.removals.length, 0);
  }
});

test("a year without operational source objects completes with no pending cleanup", async () => {
  const harness = await deletionHarness({ snapshot: fixtureSnapshot({ posts: [{ thumbnail_path: "preserved.webp" }] }) });
  const response = await harness.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, yearId, receiptId, storageCleanupPending: false });
  assert.equal(harness.removals.length, 0);
  assert.ok(harness.audits.some((audit) => audit.outcome === "success" && audit.metadata.pendingFileCount === 0));
});

test("deletion rejects invalid methods, JSON, UUIDs and labels without database mutation", async () => {
  for (const [body, method, status] of [
    [undefined, "OPTIONS", 200], [undefined, "GET", 405], ["{", "POST", 400], [null, "POST", 400],
    [{ scoutYearId: "bad", receiptId, expectedLabel: "year" }, "POST", 400],
    [{ scoutYearId: yearId, receiptId: "bad", expectedLabel: "year" }, "POST", 400],
    [{ scoutYearId: yearId, receiptId, expectedLabel: 1 }, "POST", 400],
    [{ scoutYearId: yearId, receiptId, expectedLabel: "" }, "POST", 400]
  ]) {
    const harness = await deletionHarness();
    assert.equal((await harness.request(body, method)).status, status);
    assert.equal(harness.rpcCalls.length, 0); assert.equal(harness.removals.length, 0);
    if (status >= 400) assert.ok(harness.audits.length || harness.logs.length, "rejection must leave a safe audit event");
  }
  const denied = await deletionHarness({ denied: true });
  assert.equal((await denied.request()).status, 403);
  assert.deepEqual(denied.events, ["authorize"]);
  assert.ok(denied.logs.length);
});

test("deletion validates caller/year ownership, unused/unexpired receipt, and complete manifest", async () => {
  for (const options of [
    { missingReceipt: true }, { receiptReadFailure: true },
    { receipt: { requested_by: yearId } }, { receipt: { scout_year_id: callerId } },
    { receipt: { used_at: new Date().toISOString() } },
    { receipt: { expires_at: new Date(Date.now() - 1000).toISOString() } }, { receipt: { expires_at: "invalid" } },
    { manifest: () => null }, { manifest: (m) => ({ ...m, complete: false }) },
    { manifest: (m) => ({ ...m, filesComplete: false }) }, { manifest: (m) => ({ ...m, yearId: callerId }) },
    { manifest: (m) => ({ ...m, snapshotHash: "b".repeat(64) }) }, { manifest: (m) => ({ ...m, counts: [] }) },
    { manifest: (m) => ({ ...m, missing: [{ bucket: "scouts-files", path: "missing" }] }) }
  ]) {
    const harness = await deletionHarness(options);
    const response = await harness.request();
    assert.ok(response.status >= 400, JSON.stringify(options));
    assert.equal(harness.rpcCalls.length, 0); assert.equal(harness.removals.length, 0);
    assert.ok(harness.audits.some((audit) => audit.outcome === "failed"));
    assert.ok(!(await response.text()).includes("secret"));
  }
});

test("deletion rejects malformed or forged inventory against the shared trusted allowlist", async () => {
  const mutateFile = (change) => (m) => ({ ...m, files: m.files.map((f) => f.deleteWithYear ? { ...f, ...change } : f) });
  for (const manifest of [
    (m) => ({ ...m, files: {} }), (m) => ({ ...m, files: [] }),
    (m) => ({ ...m, files: [...m.files, m.files.at(-1)] }),
    mutateFile({ bucket: "finance-private" }), mutateFile({ path: "../escape" }),
    mutateFile({ path: "registration/another-year/source.xlsx" }), mutateFile({ deleteWithYear: "true" }),
    mutateFile({ sha256: "invalid" }), mutateFile({ sizeBytes: -1 }),
    (m) => ({ ...m, files: m.files.map((f) => f.bucket === "blog-thumbnails" ? { ...f, deleteWithYear: true } : f) })
  ]) {
    const harness = await deletionHarness({ manifest });
    assert.equal((await harness.request()).status, 409);
    assert.equal(harness.rpcCalls.length, 0); assert.equal(harness.removals.length, 0);
  }
  const custom = await deletionHarness({ uploadBucket: "custom-uploads" });
  assert.equal((await custom.request()).status, 200);
  assert.equal(custom.removals.length, 1);
  assert.equal(custom.storageObjects.has(`custom-uploads/registration/${yearId}/source.xlsx`), false);
});

test("stale snapshots and RPC transaction failures never trigger source storage deletion", async () => {
  for (const options of [{ staleSnapshot: true }, { rpcError: "stale_snapshot" }, { rpcError: "receipt_used" }, { rpcError: "permission_denied" }, { rpcError: "secret backend detail https://private.test?token=secret" }]) {
    const harness = await deletionHarness(options);
    const response = await harness.request();
    assert.ok(response.status >= 400);
    assert.equal(harness.removals.length, 0);
    assert.ok(harness.audits.some((audit) => audit.outcome === "failed"));
    assert.ok(!JSON.stringify([await response.json(), harness.audits, harness.logs]).includes("secret"));
  }
});

test("a definite pre-request failure keeps the year and releases its worker for a safe retry", async () => {
    const harness = await deletionHarness({ preRequestFailure: true });
    const response = await harness.request();
    assert.equal(response.status, 500);
    const result = await response.json();
    assert.equal(result.deleted, undefined);
    assert.equal(harness.rpcCalls.length, 0);
    assert.equal(harness.events.includes("complete-cleanup"), false);
    assert.equal(harness.events.includes("release-cleanup"), true);
    assert.ok(harness.audits.some((audit) => audit.outcome === "failed"));
    assert.equal(harness.storageObjects.get(`scout-year-backups/${callerId}/${yearId}/archive.zip`), "backup bytes");
    assert.ok(!JSON.stringify([result, harness.audits, harness.logs]).includes("secret"));
    const retry = await harness.request();
    assert.equal(retry.status, 200);
    assert.equal(harness.rpcCalls.length, 1); assert.equal(harness.removals.length, 1);
});

test("ambiguous Storage outcomes preserve the worker fence and cannot retry or finalize", async () => {
  for (const options of [
    { cleanupFailure: true },
    { cleanupThrows: new TypeError("fetch failed") },
    { cleanupThrows: new Error("The request timed out") },
    { cleanupResponse: { data: null, error: { name: "StorageUnknownError", message: "network unavailable" } } },
    { cleanupResponse: { data: null, error: { name: "StorageApiError", status: 504, message: "gateway timeout" } } },
    { cleanupResponse: { data: null, error: { name: "StorageApiError", status: 500, message: "server failed after dispatch" } } },
    { cleanupResponse: { data: null, error: { name: "StorageApiError", status: 403, message: "unproven failure source" } } },
    { cleanupResponse: { data: null, error: null } },
    { cleanupResponse: undefined, cleanupThrows: new SyntaxError("response JSON could not be parsed") }
  ]) {
    const harness = await deletionHarness(options);
    const response = await harness.request();
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.code, "storage_cleanup_ambiguous");
    assert.equal(result.operatorActionRequired, true);
    assert.match(result.error, /operator/i);
    assert.equal(harness.events.includes("release-cleanup"), false);
    assert.equal(harness.events.includes("complete-cleanup"), false);
    assert.equal(harness.rpcCalls.length, 0);
    assert.equal((await harness.request()).status, 409);
    assert.equal(harness.removals.length, 1);
    assert.equal(harness.rpcCalls.length, 0);
    assert.equal(harness.storageObjects.get(`scout-year-backups/${callerId}/${yearId}/archive.zip`), "backup bytes");
    assert.ok(harness.audits.some((audit) => audit.metadata.code === "storage_cleanup_ambiguous"));
  }
});

test("an incomplete database cleanup confirmation prevents final deletion", async () => {
  const harness = await deletionHarness({ completeFailure: true });
  assert.ok((await harness.request()).status >= 400);
  assert.equal(harness.rpcCalls.length, 0);
  assert.equal(harness.events.includes("release-cleanup"), true);
});

test("an ambiguous cleanup confirmation retains the worker fence until operator reconciliation", async () => {
  for (const options of [{ completeThrows: true }, { completeUnknown: true }]) {
    const harness = await deletionHarness(options);
    const response = await harness.request();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).operatorActionRequired, true);
    assert.equal(harness.events.includes("release-cleanup"), false);
    assert.equal(harness.rpcCalls.length, 0);
    assert.equal((await harness.request()).status, 409);
    assert.equal(harness.removals.length, 1);
  }
});

test("an ambiguous worker-start response requires operator reconciliation without dispatching Storage", async () => {
  const harness = await deletionHarness({ startThrows: true });
  const response = await harness.request();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "cleanup_start_ambiguous");
  assert.equal(harness.events.includes("release-cleanup"), false);
  assert.equal((await harness.request()).status, 409);
  assert.equal(harness.removals.length, 0);
  assert.equal(harness.rpcCalls.length, 0);
});

test("a released claim cannot start storage work", async () => {
  const harness = await deletionHarness({ startFailure: true });
  assert.ok((await harness.request()).status >= 400);
  assert.equal(harness.removals.length, 0);
  assert.equal(harness.rpcCalls.length, 0);
});

test("concurrent same-receipt workers cannot overlap Storage removal or release each other's fence", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = await deletionHarness({ removalGate: gate });
  const first = harness.request();
  while (!harness.events.includes("remove")) await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await harness.request()).status, 409);
  assert.equal(harness.removals.length, 1);
  assert.equal(harness.events.includes("release-cleanup"), false);
  assert.equal(harness.rpcCalls.length, 0);
  release();
  assert.equal((await first).status, 200);
});

test("a database failure after successful cleanup retries without another Storage removal", async () => {
  const harness = await deletionHarness({ deletionFailureOnce: true });
  assert.equal((await harness.request()).status, 500);
  assert.equal(harness.removals.length, 1);
  assert.equal((await harness.request()).status, 200);
  assert.equal(harness.removals.length, 1);
  assert.equal(harness.rpcCalls.length, 2);
});

test("backup Edge exports tombstone metadata without requesting nonexistent bytes", async () => {
  const doc = { id: receiptId, submission_id: callerId, bucket_id: "identity-documents", object_path: `${callerId}/${receiptId}/${yearId}.deleted`, verification_status: "deleted", deleted_at: "2026-09-25T00:00:00Z" };
  const harness = await edgeHarness({ snapshot: fixtureSnapshot({ scout_registration_documents: [doc] }) });
  assert.equal((await harness.request()).status, 200);
  assert.ok(!harness.events.some((event) => event.startsWith("download:")));
  assert.equal(harness.receipts[0].manifest.counts.scout_registration_documents, 1);
});

test("a missing live registration document still blocks receipt issuance", async () => {
  const doc = { id: receiptId, submission_id: callerId, bucket_id: "identity-documents", object_path: `${yearId}/${callerId}/live.webp`, verification_status: "pending", deleted_at: null };
  const harness = await edgeHarness({ snapshot: fixtureSnapshot({ scout_registration_documents: [doc] }), missingFile: true });
  assert.equal((await harness.request()).status, 409);
  assert.equal(harness.receipts.length, 0);
  assert.ok(harness.events.some((event) => event.startsWith("download:identity-documents/")));
});

test("an Edge audit outage after commit cannot turn completed deletion into an error", async () => {
  const harness = await deletionHarness({ auditFailure: true });
  const response = await harness.request();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.deleted, true); assert.equal(result.auditPending, true);
  assert.ok(harness.logs.length);
  assert.ok(!JSON.stringify([result, harness.logs]).includes("secret"));
});

async function frontendServices(options = {}) {
  const requests = [];
  const removedKeys = [];
  let session = { access_token: "user-access-token", user: { id: callerId }, ...options.session };
  const globals = { FormData, Response, console, window: { localStorage: {
    getItem: () => session ? JSON.stringify(session) : null,
    setItem(key, value) { session = JSON.parse(value); },
    removeItem(key) { removedKeys.push(key); session = null; }
  } }, fetch: async (url, init) => {
    requests.push({ url, ...init });
    const response = options.responses?.[requests.length - 1] ?? options;
    return new Response(response.responseBody ?? JSON.stringify({ ok: true }), { status: response.status ?? 200 });
  } };
  const clientSource = fs.readFileSync(new URL("../../src/services/supabaseClient.js", import.meta.url), "utf8")
    .replace("import.meta.env", JSON.stringify({ VITE_SUPABASE_URL: "https://supabase.test", VITE_SUPABASE_PUBLISHABLE_KEY: "public-key" }));
  const clientModule = { exports: {} };
  vm.runInNewContext((await transform(clientSource, { format: "cjs" })).code, { ...globals, module: clientModule });
  const serviceModule = { exports: {} };
  const serviceSource = fs.readFileSync(new URL("../../src/services/scoutService.js", import.meta.url), "utf8");
  vm.runInNewContext((await transform(serviceSource, { format: "cjs" })).code, {
    ...globals, module: serviceModule, require: (name) => name === "./supabaseClient.js" ? clientModule.exports : {}
  });
  return { requests, removedKeys, services: serviceModule.exports, client: clientModule.exports };
}

test("frontend backup and deletion services invoke the authenticated Edge endpoints with bounded payloads", async () => {
  const { services, requests } = await frontendServices();
  assert.equal(typeof services.createScoutYearBackup, "function");
  assert.equal(typeof services.deleteScoutYear, "function");
  await services.createScoutYearBackup(yearId);
  await services.deleteScoutYear({ scoutYearId: yearId, receiptId, expectedLabel: "2024-2025", paths: ["untrusted"] });
  assert.deepEqual(requests.map((request) => [request.url, request.method, request.headers.Authorization, JSON.parse(request.body)]), [
    ["https://supabase.test/functions/v1/scout-year-backup", "POST", "Bearer user-access-token", { scoutYearId: yearId }],
    ["https://supabase.test/functions/v1/delete-scout-year", "POST", "Bearer user-access-token", { scoutYearId: yearId, receiptId, expectedLabel: "2024-2025" }]
  ]);
});

test("Supabase errors surface JSON error text, message fallback, plain text, and empty response fallback", async () => {
  for (const [responseBody, expected] of [
    ['{"error":"Create a fresh backup","code":"stale_snapshot"}', "Create a fresh backup"],
    ['{"message":"Permission denied","details":"private context"}', "Permission denied"],
    ['{"error_description":"Session expired","error":"invalid_grant"}', "invalid_grant"],
    ['{"error":{"detail":"not user-facing"}}', "Supabase request failed: 409"],
    ["Plain failure", "Plain failure"], ["", "Supabase request failed: 409"]
  ]) {
    const { client } = await frontendServices({ status: 409, responseBody });
    await assert.rejects(client.invokeSupabaseFunction("delete-scout-year", {}), (error) => error.message === expected);
  }
});

test("a 401 followed by a JSON refresh failure exposes one clean error and clears invalid sessions", async () => {
  for (const [responseBody, expected] of [
    ['{"error":"Session expired","details":"private context"}', "Session expired"],
    ['{"message":"Refresh token is invalid","details":"private context"}', "Refresh token is invalid"],
    ['{"error_description":"Please log in again"}', "Please log in again"],
    ["", "Session refresh failed: 400"]
  ]) {
    const { client, requests, removedKeys } = await frontendServices({
      session: { refresh_token: "refresh-token" },
      responses: [{ status: 401, responseBody: '{"error":"expired JWT"}' }, { status: 400, responseBody }]
    });
    await assert.rejects(client.invokeSupabaseFunction("delete-scout-year", {}), (error) => error.message === expected);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].url, "https://supabase.test/auth/v1/token?grant_type=refresh_token");
    assert.deepEqual(JSON.parse(requests[1].body), { refresh_token: "refresh-token" });
    assert.deepEqual(removedKeys, ["scouts-supabase-session"]);
  }
});
