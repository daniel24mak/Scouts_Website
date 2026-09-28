import { AuthorizationError, parseUuid, requireDashboardPermission } from "../_shared/dashboardAuthorization.ts";
import type { AuthorizedContext } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { collectStorageReferences, createCsvExports, validateBackupSnapshot } from "../_shared/scoutYearBackup.ts";
import type { BackupSnapshot } from "../_shared/scoutYearBackup.ts";

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const hashPattern = /^[a-f0-9]{64}$/;
const rpcFailures: Record<string, [string, number]> = {
  permission_denied: ["This action requires retention permission and an MFA-verified session", 403],
  year_not_found: ["Scouting year was not found", 404],
  active_year: ["The active scouting year cannot be deleted", 409],
  label_mismatch: ["The scouting year label does not match", 409],
  receipt_not_found: ["Backup receipt was not found", 404],
  receipt_wrong_user: ["This backup belongs to another user", 403],
  receipt_wrong_year: ["This backup belongs to another scouting year", 409],
  receipt_expired: ["The backup has expired. Create a fresh backup", 409],
  receipt_used: ["This backup receipt has already been used", 409],
  incomplete_manifest: ["The backup inventory is incomplete. Create a fresh backup", 409],
  stale_snapshot: ["Scouting year data changed. Create a fresh backup", 409],
  archive_not_found: ["The backup archive is unavailable. Create a fresh backup", 409],
  unsupported_year_dependency: ["Scouting year dependencies must be reviewed before deletion", 409]
};

function reject(code: string): never {
  const [message, status] = rpcFailures[code];
  throw new AuthorizationError(message, status);
}

async function auditDeletion(context: AuthorizedContext, yearId: string | null, outcome: "success" | "failed", metadata: JsonObject) {
  const { error } = await context.adminClient.from("audit_logs").insert({
    actor_id: context.callerId,
    action: outcome === "success" ? "scout_year.deletion_completed" : "scout_year.deletion_failed",
    entity_type: "scout_year", entity_id: yearId,
    module: "registration", resource_type: "scout_year", resource_id: yearId,
    outcome, metadata
  });
  if (error) throw new Error("Deletion audit could not be recorded");
}

function validateManifest(value: unknown, yearId: string, snapshotHash: unknown): JsonObject {
  if (!isObject(value) || value.version !== 1 || value.complete !== true || value.filesComplete !== true
    || value.yearId !== yearId || typeof snapshotHash !== "string" || !hashPattern.test(snapshotHash)
    || value.snapshotHash !== snapshotHash || !isObject(value.counts)
    || !Array.isArray(value.files) || !Array.isArray(value.missing) || value.missing.length) reject("incomplete_manifest");
  return value;
}

function validatedCleanupInventory(manifest: JsonObject, snapshot: BackupSnapshot) {
  const counts = manifest.counts as JsonObject;
  if (manifest.snapshotHash !== snapshot.snapshotHash
    || Object.keys(counts).length !== Object.keys(snapshot.counts).length
    || Object.entries(snapshot.counts).some(([name, count]) => counts[name] !== count)) reject("stale_snapshot");

  // Reuse backup's explicit dataset/bucket ownership allowlist. Neither the
  // request nor a manifest deletion flag alone can select privileged objects.
  const references = collectStorageReferences(snapshot, Deno.env.get("SCOUT_UPLOAD_STORAGE_BUCKET") ?? "scouts-files");
  const csvFiles = createCsvExports(snapshot);
  const expected = new Map<string, JsonObject>([
    ...references.map((ref): [string, JsonObject] => [ref.archivePath, ref]),
    ...csvFiles.map((file): [string, JsonObject] => [file.archivePath, { dataset: file.dataset }])
  ]);
  const files = manifest.files as unknown[];
  if (files.length !== expected.size) reject("incomplete_manifest");
  const cleanup: { bucket: string; path: string }[] = [];
  for (const file of files) {
    if (!isObject(file) || typeof file.archivePath !== "string"
      || !Number.isSafeInteger(file.sizeBytes) || (file.sizeBytes as number) < 0
      || typeof file.sha256 !== "string" || !hashPattern.test(file.sha256)) reject("incomplete_manifest");
    const allowed = expected.get(file.archivePath);
    if (!allowed) reject("incomplete_manifest");
    expected.delete(file.archivePath);
    if (allowed.bucket !== undefined) {
      if (file.bucket !== allowed.bucket || file.path !== allowed.path || file.deleteWithYear !== allowed.deleteWithYear) reject("incomplete_manifest");
      if (file.deleteWithYear === true) cleanup.push({ bucket: file.bucket as string, path: file.path as string });
    } else if (file.dataset !== allowed.dataset || file.bucket !== undefined || file.path !== undefined || file.deleteWithYear !== undefined) {
      reject("incomplete_manifest");
    }
  }
  return cleanup;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") {
    console.warn("scout_year.deletion_denied", { code: "method_not_allowed", status: 405 });
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  let context: AuthorizedContext | undefined;
  let scoutYearId: string | null = null;
  let receiptId: string | null = null;
  let failureCode = "authorization_failed";
  try {
    context = await requireDashboardPermission(req, "registration.retention.manage");
    failureCode = "invalid_request";
    const body = await req.json().catch(() => { throw new AuthorizationError("Invalid JSON request", 400); });
    scoutYearId = parseUuid(body?.scoutYearId, "Scouting year").toLowerCase();
    receiptId = parseUuid(body?.receiptId, "Backup receipt").toLowerCase();
    if (typeof body?.expectedLabel !== "string" || !body.expectedLabel.trim()) throw new AuthorizationError("Enter the scouting year label", 400);

    failureCode = "receipt_validation_failed";
    const { data: receipt, error: receiptError } = await context.adminClient.from("scout_year_backup_receipts")
      .select("id,scout_year_id,requested_by,snapshot_hash,manifest,expires_at,used_at").eq("id", receiptId).maybeSingle();
    if (receiptError) throw new Error("Backup receipt could not be read");
    if (!receipt) reject("receipt_not_found");
    if (receipt.requested_by !== context.callerId) reject("receipt_wrong_user");
    // A consumed receipt's year FK is nulled by deletion. Check use first so
    // retries report the completed consumption rather than the absent FK.
    if (receipt.used_at !== null) reject("receipt_used");
    if (receipt.scout_year_id !== scoutYearId) reject("receipt_wrong_year");
    if (!Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= Date.now()) reject("receipt_expired");
    const manifest = validateManifest(receipt.manifest, scoutYearId, receipt.snapshot_hash);

    failureCode = "snapshot_validation_failed";
    const { data, error: snapshotError } = await context.adminClient.rpc("get_scout_year_backup_snapshot", { target_year_id: scoutYearId });
    if (snapshotError) {
      if (snapshotError.message === "year_not_found") reject("year_not_found");
      throw new Error("Scouting year snapshot could not be read");
    }
    let cleanup: { bucket: string; path: string }[];
    try {
      const snapshot = validateBackupSnapshot(data, scoutYearId);
      cleanup = validatedCleanupInventory(manifest, snapshot);
    } catch (error) {
      if (error instanceof AuthorizationError) throw error;
      throw new AuthorizationError("Scouting year backup inventory could not be verified. Create a fresh backup", 409);
    }

    failureCode = "deletion_transaction_failed";
    // The caller JWT/AAL remains authoritative. The SQL transaction rechecks
    // permission, active state, exact label, receipt, archive, and snapshot under
    // locks; no operational object is removed before the transaction succeeds.
    const { data: result, error: deletionError } = await context.userClient.rpc("delete_scout_year_with_backup", {
      target_year_id: scoutYearId, target_receipt_id: receiptId, expected_label: body.expectedLabel
    });
    if (deletionError) {
      if (Object.prototype.hasOwnProperty.call(rpcFailures, deletionError.message)) {
        failureCode = deletionError.message;
        reject(failureCode);
      }
      throw new Error("Scouting year deletion transaction failed");
    }
    if (result?.deleted !== true || result.yearId !== scoutYearId || result.receiptId !== receiptId) throw new Error("Deletion result could not be verified");

    const byBucket = new Map<string, string[]>();
    for (const file of cleanup) byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.path]);
    let pendingFileCount = 0;
    for (const [bucket, paths] of byBucket) {
      for (let offset = 0; offset < paths.length; offset += 100) {
        const batch = paths.slice(offset, offset + 100);
        try {
          const { error } = await context.adminClient.storage.from(bucket).remove(batch);
          if (error) pendingFileCount += batch.length;
        } catch { pendingFileCount += batch.length; }
      }
    }
    const storageCleanupPending = pendingFileCount > 0;
    let auditPending = false;
    try {
      await auditDeletion(context, scoutYearId, storageCleanupPending ? "failed" : "success", {
        receiptId, deleted: true, storageCleanupPending, pendingFileCount,
        fileCount: cleanup.length, code: storageCleanupPending ? "storage_cleanup_failed" : "deletion_completed"
      });
    } catch {
      // SQL already wrote the durable deletion audit in the committed transaction.
      auditPending = true;
      console.error("scout_year.deletion_audit_failed", { callerId: context.callerId, yearId: scoutYearId, receiptId, deleted: true, storageCleanupPending, pendingFileCount });
    }
    // Retain the receipt manifest and staged ZIP for recovery until expiry.
    // Expired archives may be purged separately; do not invalidate a signed URL
    // that the client may still be downloading immediately after deletion.
    return jsonResponse(req, { deleted: true, yearId: scoutYearId, receiptId, storageCleanupPending, ...(auditPending ? { auditPending: true } : {}) });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    if (context) {
      try { await auditDeletion(context, scoutYearId, "failed", { receiptId, code: failureCode, status }); }
      catch { console.error("scout_year.deletion_audit_failed", { callerId: context.callerId, yearId: scoutYearId, receiptId, code: failureCode, status }); }
    } else {
      console.warn("scout_year.deletion_denied", { status });
    }
    return jsonResponse(req, { error: error instanceof AuthorizationError ? error.message : "Scouting year deletion failed", code: failureCode }, status);
  }
});
