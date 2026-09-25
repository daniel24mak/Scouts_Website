import { zipSync } from "npm:fflate@0.8.2";
import { AuthorizationError, parseUuid, requireDashboardPermission } from "../_shared/dashboardAuthorization.ts";
import type { AuthorizedContext } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { collectStorageReferences, createBackupManifest, createCsvExports, validateBackupSnapshot } from "../_shared/scoutYearBackup.ts";
import type { DownloadedFile } from "../_shared/scoutYearBackup.ts";

const backupBucket = "scout-year-backups";
const maxFailureDetails = 50;

async function auditBackup(context: AuthorizedContext, yearId: string | null, outcome: "success" | "failed", metadata: Record<string, unknown>) {
  const { error } = await context.adminClient.from("audit_logs").insert({
    actor_id: context.callerId,
    action: outcome === "success" ? "scout_year.backup_created" : "scout_year.backup_failed",
    entity_type: "scout_year", entity_id: yearId,
    module: "registration", resource_type: "scout_year", resource_id: yearId,
    outcome, metadata
  });
  if (error) throw new Error("Backup audit could not be recorded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  let context: AuthorizedContext | undefined;
  let scoutYearId: string | null = null;
  let stagedPath: string | null = null;
  let failureCode = "authorization_failed";
  const missing: { bucket: string; path: string; reason: string }[] = [];
  try {
    context = await requireDashboardPermission(req, "registration.retention.manage");
    failureCode = "invalid_request";
    const body = await req.json().catch(() => { throw new AuthorizationError("Invalid JSON request", 400); });
    scoutYearId = parseUuid(body?.scoutYearId, "Scouting year").toLowerCase();

    failureCode = "year_validation_failed";
    const { data: year, error: yearError } = await context.adminClient.from("scout_years")
      .select("id,label,is_active").eq("id", scoutYearId).maybeSingle();
    if (yearError) throw new Error("Scouting year could not be read");
    if (!year) throw new AuthorizationError("Scouting year was not found", 404);
    if (year.is_active !== false) throw new AuthorizationError("The active scouting year cannot be backed up for deletion", 409);

    failureCode = "snapshot_failed";
    const { data, error: snapshotError } = await context.adminClient.rpc("get_scout_year_backup_snapshot", { target_year_id: scoutYearId });
    if (snapshotError) throw new Error("Scouting year snapshot could not be read");
    const snapshot = validateBackupSnapshot(data, scoutYearId);
    const csvFiles = createCsvExports(snapshot);
    failureCode = "storage_inventory_failed";
    const references = collectStorageReferences(snapshot, Deno.env.get("SCOUT_UPLOAD_STORAGE_BUCKET") ?? "scouts-files");
    const downloaded: DownloadedFile[] = [];
    failureCode = "file_download_failed";
    for (const reference of references) {
      try {
        const { data: file, error } = await context.adminClient.storage.from(reference.bucket).download(reference.path);
        if (error || !file) throw new Error("Object unavailable");
        downloaded.push({ ...reference, bytes: new Uint8Array(await file.arrayBuffer()) });
      } catch {
        missing.push({ bucket: reference.bucket, path: reference.path, reason: "Object missing or inaccessible" });
      }
    }
    if (missing.length) throw new AuthorizationError("Backup is incomplete: referenced files could not be downloaded", 409);

    failureCode = "archive_failed";
    const manifest = await createBackupManifest(snapshot, csvFiles, references, downloaded, new Date().toISOString());
    if (!manifest.complete || !manifest.filesComplete) throw new Error("Backup inventory is incomplete");
    const entries: Record<string, Uint8Array> = Object.create(null);
    for (const file of [...csvFiles, ...downloaded]) entries[file.archivePath] = file.bytes;
    entries["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    const zip = zipSync(entries, { level: 6 });

    stagedPath = `${context.callerId}/${scoutYearId}/${crypto.randomUUID()}.zip`;
    failureCode = "archive_upload_failed";
    const { error: uploadError } = await context.adminClient.storage.from(backupBucket).upload(stagedPath, zip, {
      contentType: "application/zip", upsert: false, cacheControl: "0"
    });
    if (uploadError) throw new Error("Backup archive could not be stored");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    failureCode = "receipt_failed";
    const { data: receipt, error: receiptError } = await context.adminClient.from("scout_year_backup_receipts").insert({
      scout_year_id: scoutYearId, requested_by: context.callerId,
      archive_path: stagedPath, snapshot_hash: snapshot.snapshotHash, manifest,
      expires_at: expiresAt, used_at: null
    }).select("id").single();
    if (receiptError || !receipt?.id) throw new Error("Backup receipt could not be saved");

    failureCode = "download_url_failed";
    const { data: signed, error: signedError } = await context.adminClient.storage.from(backupBucket).createSignedUrl(stagedPath, 15 * 60);
    if (signedError || !signed?.signedUrl) throw new Error("Backup download could not be prepared");

    failureCode = "audit_failed";
    await auditBackup(context, scoutYearId, "success", {
      receiptId: receipt.id, snapshotHash: snapshot.snapshotHash, counts: snapshot.counts,
      fileCount: references.length, archiveSizeBytes: zip.length
    });
    return jsonResponse(req, { receiptId: receipt.id, downloadUrl: signed.signedUrl, expiresAt, manifest });
  } catch (error) {
    let cleanupFailed = false;
    if (context && stagedPath) {
      try {
        const { error: cleanupError } = await context.adminClient.storage.from(backupBucket).remove([stagedPath]);
        cleanupFailed = Boolean(cleanupError);
      } catch { cleanupFailed = true; }
    }
    const status = error instanceof AuthorizationError ? error.status : 500;
    const details = missing.slice(0, maxFailureDetails).map(({ bucket, path, reason }) => ({ bucket, path: path.slice(0, 512), reason }));
    const metadata = { code: failureCode, status, missingCount: missing.length, missing: details, cleanupFailed };
    if (context) {
      try { await auditBackup(context, scoutYearId, "failed", metadata); }
      catch { console.error("scout_year.backup_audit_failed", { callerId: context.callerId, yearId: scoutYearId, code: failureCode, cleanupFailed }); }
    } else {
      // Authorization did not yield a trusted caller/admin context. Keep a safe
      // operational security event without decoding or recording the bearer token.
      console.warn("scout_year.backup_denied", { status });
    }
    return jsonResponse(req, {
      error: error instanceof AuthorizationError ? error.message : "Scouting year backup failed",
      code: failureCode,
      ...(missing.length ? { missing: details, missingCount: missing.length, missingTruncated: missing.length > maxFailureDetails } : {})
    }, status);
  }
});
