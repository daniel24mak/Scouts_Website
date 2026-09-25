import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transform } from "esbuild";

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
