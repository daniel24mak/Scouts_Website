# Registration Import and Scouting-Year Backup Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix hosted registration parsing, require explicit import confirmation, and provide an MFA-protected complete-backup-before-delete workflow for inactive scouting years.

**Architecture:** Keep parsing, backup assembly, and destructive deletion on authenticated Supabase boundaries. The frontend stages parsed imports until confirmation and treats a server-issued, 24-hour, single-use backup receipt as the only capability that can unlock year deletion. A trusted SQL RPC performs dependency-safe database changes while Edge Functions handle ZIP/storage operations.

**Tech Stack:** React 18, Vite, Supabase REST/Auth/Storage/Edge Functions, PostgreSQL PL/pgSQL, Deno TypeScript, `npm:xlsx@0.18.5`, `npm:fflate@0.8.2`, Node test runner.

## Global Constraints

- Blogs/posts, calendar events, gallery albums, announcements, content submissions, documents, reports, and archived-year snapshots are exported and detached, not deleted.
- Gallery and other preserved-content media remains in storage.
- Only inactive scouting years can be deleted.
- A complete backup receipt is valid for 24 hours, belongs to one user and year, and is single use.
- Missing referenced storage objects prevent receipt creation and keep deletion locked.
- The final destructive confirmation requires the exact scouting-year label.
- No service-role credential is exposed to frontend code.
- No automatic destructive operation runs during deployment.

---

### Task 1: Repair hosted registration parsing

**Files:**
- Modify: `supabase/functions/parse-registration-upload/index.ts`
- Modify: `tests/access-control/registrationUploadRouting.test.js`

**Interfaces:**
- Consumes: `{ contentBase64, fileName, scoutYearId?, assignmentMode? }`
- Produces: `{ ok: true, count: number, scouts: ParsedScout[] }`

- [ ] **Step 1: Extend the failing routing test**

Add assertions that the function never references the absent table and queries an existing target year:

```js
assert.doesNotMatch(edgeFunction, /registration_import_settings/);
assert.match(edgeFunction, /scout_years\?select=assignment_mode&id=eq\./);
assert.match(edgeFunction, /body\.assignmentMode \?\?/);
assert.match(edgeFunction, /"schoolGrade"/);
```

- [ ] **Step 2: Run the regression test and verify RED**

Run: `node --test tests/access-control/registrationUploadRouting.test.js`

Expected: FAIL because `registration_import_settings` is still queried.

- [ ] **Step 3: Replace the invalid settings request**

In the Edge Function, authenticate first, then fetch grouping rules plus the selected year when provided:

```ts
const yearId = typeof body.scoutYearId === "string" ? body.scoutYearId : "";
const yearResponse = yearId
  ? await fetch(`${supabaseUrl}/rest/v1/scout_years?select=assignment_mode&id=eq.${encodeURIComponent(yearId)}&limit=1`, { headers: restHeaders })
  : null;
if (yearResponse && !yearResponse.ok) throw new Error("Scouting-year settings could not be loaded.");
const yearRows = yearResponse ? await yearResponse.json() : [];
const assignmentMode = body.assignmentMode ?? yearRows[0]?.assignment_mode ?? "schoolGrade";
```

Delete the `registration_import_settings` fetch and response check.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/access-control/registrationUploadRouting.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/parse-registration-upload/index.ts tests/access-control/registrationUploadRouting.test.js
git commit -m "Fix registration parser year settings"
```

### Task 2: Split parsing from confirmed import

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/pages/AdminDashboardPage.jsx`
- Create: `tests/access-control/registrationImportConfirmation.test.js`

**Interfaces:**
- Produces: `parseRegistrationSheet(payload): Promise<{ scouts, count }>`
- Produces: `confirmRegistrationSheetImport(payloadWithScouts): Promise<ImportResult>`
- UI state: `{ fileName, contentBase64, scouts, count, targetKey } | null`

- [ ] **Step 1: Write the failing source-contract tests**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("registration selection parses without importing until confirmation", () => {
  const client = read("src/api/client.js");
  const page = read("src/pages/AdminDashboardPage.jsx");
  assert.match(client, /export function parseRegistrationSheet/);
  assert.match(client, /export function confirmRegistrationSheetImport/);
  assert.match(page, /pendingRegistrationImport/);
  assert.match(page, /Confirm upload/);
  assert.match(page, /Cancel upload/);
});

test("changing the target invalidates a pending registration import", () => {
  const page = read("src/pages/AdminDashboardPage.jsx");
  assert.match(page, /setPendingRegistrationImport\(null\)/);
  assert.match(page, /registrationTargetKey/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/access-control/registrationImportConfirmation.test.js`

Expected: FAIL because the split client functions and pending UI do not exist.

- [ ] **Step 3: Add separate client operations**

Replace the combined Supabase branch with:

```js
export function parseRegistrationSheet(payload) {
  return isSupabaseConfigured
    ? invokeSupabaseFunction("parse-registration-upload", payload)
    : request("/registration/parse", { method: "POST", body: JSON.stringify(payload) });
}

export function confirmRegistrationSheetImport(payload) {
  if (isSupabaseConfigured) return importRegistrationSheetToSupabase(payload);
  return request("/registration/upload", { method: "POST", body: JSON.stringify(payload) });
}
```

Retain `uploadRegistrationSheet` only as a compatibility wrapper if another caller exists; otherwise remove it after `rg -n "uploadRegistrationSheet" src` proves there are no remaining callers.

- [ ] **Step 4: Stage parsed data in the dashboard**

Add state and a stable target identity:

```jsx
const [pendingRegistrationImport, setPendingRegistrationImport] = useState(null);
const registrationTargetKey = registrationTargetMode === "existing"
  ? `existing:${registrationYearId}`
  : `new:${newScoutYearName.trim()}`;
```

The file input handler reads base64, calls `parseRegistrationSheet`, and stores the returned scouts without importing. Add `confirmRegistrationUpload` that first checks `pendingRegistrationImport.targetKey === registrationTargetKey`, then calls `confirmRegistrationSheetImport`. Add `cancelRegistrationUpload` that clears state and the input value.

- [ ] **Step 5: Render confirmation details**

Under the file input render a pending card with filename, target label, count, the first five scouts, the archive warning, and two buttons:

```jsx
<button type="button" className="primary-action" onClick={confirmRegistrationUpload}>Confirm upload</button>
<button type="button" className="secondary-action" onClick={cancelRegistrationUpload}>Cancel upload</button>
```

Target mode/year/name `onChange` handlers must call `setPendingRegistrationImport(null)` before updating their value.

- [ ] **Step 6: Verify GREEN and build**

Run:

```powershell
node --test tests/access-control/registrationImportConfirmation.test.js
npm run build
```

Expected: tests PASS and Vite exits 0.

- [ ] **Step 7: Commit**

```powershell
git add src/api/client.js src/pages/AdminDashboardPage.jsx tests/access-control/registrationImportConfirmation.test.js
git commit -m "Require registration import confirmation"
```

### Task 3: Add protected backup receipts and transactional year deletion

**Files:**
- Create: `database/supabase-scout-year-backup-deletion.sql`
- Modify: `database/supabase-schema.sql`
- Create: `database/tests/scout-year-backup-deletion.sql`
- Create: `tests/access-control/scoutYearBackupDeletion.test.js`

**Interfaces:**
- Table: `scout_year_backup_receipts(id, scout_year_id, requested_by, archive_path, snapshot_hash, manifest, expires_at, used_at, created_at)`
- RPC: `delete_scout_year_with_backup(target_year_id uuid, target_receipt_id uuid, expected_label text) returns jsonb`

- [ ] **Step 1: Write failing migration contract tests**

Assert that the migration includes RLS, no authenticated direct table grants, MFA-aware admin checks, active-year rejection, receipt ownership/expiry/use checks, content detachment, dependent deletion, and receipt consumption.

```js
assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.scout_year_backup_receipts/i);
assert.match(sql, /ALTER TABLE public\.scout_year_backup_receipts ENABLE ROW LEVEL SECURITY/i);
assert.match(sql, /IF target_year\.is_active THEN/i);
assert.match(sql, /receipt\.requested_by <> auth\.uid\(\)/i);
assert.match(sql, /receipt\.expires_at <= now\(\)/i);
assert.match(sql, /UPDATE public\.(posts|gallery_albums|calendar_events)[\s\S]*scout_year_id = NULL/i);
assert.match(sql, /DELETE FROM public\.scout_years/i);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the additive migration**

Create the receipt table with UUID primary key, foreign keys to `scout_years` and `user_profiles`, JSONB manifest, archive path, snapshot hash, 24-hour expiry, and single-use timestamp. Revoke all direct access from `PUBLIC` and `anon`; allow receipt creation only through service-role Edge code. Insert a private `scout-year-backups` Storage bucket with a 24-hour file-size-appropriate limit; do not create public or authenticated object policies because Edge Functions use the service role for staging and signed-download creation.

Create `delete_scout_year_with_backup` as `SECURITY DEFINER SET search_path = pg_catalog, public`. It must:

```sql
PERFORM public.require_people_access_permission('registration.retention.manage');
SELECT * INTO target_year FROM public.scout_years WHERE id = target_year_id FOR UPDATE;
IF target_year.is_active THEN RAISE EXCEPTION 'The active scouting year cannot be deleted.'; END IF;
SELECT * INTO receipt FROM public.scout_year_backup_receipts WHERE id = target_receipt_id FOR UPDATE;
IF receipt.requested_by <> auth.uid() OR receipt.scout_year_id <> target_year_id
   OR receipt.used_at IS NOT NULL OR receipt.expires_at <= now() THEN
  RAISE EXCEPTION 'Download a fresh complete backup before deleting this scouting year.';
END IF;
```

Validate `expected_label`, recompute the canonical snapshot from sorted record IDs plus relevant update timestamps/counts, compare its digest with `receipt.snapshot_hash`, detach preserved tables (`posts`, `gallery_albums`, `calendar_events`, `announcements`, `content_submissions`, `documents`, `reports`, `archived_years`), delete dependent operational rows in foreign-key order, delete the year, mark the receipt used, and insert an audit log entry.

- [ ] **Step 4: Add transaction-level SQL tests**

The SQL test must begin a transaction, seed one inactive and one active year plus dependent records, and assert exceptions for active/wrong/stale/used receipts. It must assert preserved rows remain with null year IDs and operational rows/year are removed for the valid receipt. End with `ROLLBACK`.

- [ ] **Step 5: Mirror the migration in the clean schema**

Copy the final table, function, revokes, and authenticated RPC grant into `database/supabase-schema.sql` so clean installations and incremental deployments match.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: PASS. If a disposable local Supabase database is available, run the SQL test with `psql -v ON_ERROR_STOP=1 -f database/tests/scout-year-backup-deletion.sql` and expect rollback with no assertion failure.

- [ ] **Step 7: Commit**

```powershell
git add database/supabase-scout-year-backup-deletion.sql database/supabase-schema.sql database/tests/scout-year-backup-deletion.sql tests/access-control/scoutYearBackupDeletion.test.js
git commit -m "Add protected scouting year deletion"
```

### Task 4: Build the complete year backup Edge Function

**Files:**
- Create: `supabase/functions/scout-year-backup/index.ts`
- Create: `supabase/functions/_shared/scoutYearBackup.ts`
- Modify: `tests/access-control/scoutYearBackupDeletion.test.js`

**Interfaces:**
- Request: `{ scoutYearId: string }`
- Response: `{ receiptId, downloadUrl, expiresAt, manifest }`
- Shared exports: `csvFromRows(rows)`, `buildSnapshotManifest(year, datasets, files)`, `snapshotHash(manifest)`

- [ ] **Step 1: Add failing Edge Function assertions**

Assert exact permission/MFA authorization, year-scoped table exports, transitively related attendance records, storage downloads, ZIP creation, missing-file rejection, private archive upload, receipt creation, signed URL creation, and audit logging.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: FAIL because the Edge Function and shared module are absent.

- [ ] **Step 3: Implement deterministic export helpers**

Use RFC-4180-compatible CSV escaping:

```ts
export function csvFromRows(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.map(quote).join(","), ...rows.map((row) => columns.map((key) => quote(row[key])).join(","))].join("\r\n");
}
```

Manifest counts and file paths must sort deterministically before SHA-256 hashing.

- [ ] **Step 4: Implement authenticated data collection**

Use `requireDashboardPermission(req, "registration.retention.manage")`, reject active years, and query with the admin client only after authorization. Export direct year tables plus `attendance_records` by exported session IDs and preserved gallery children by exported album IDs. Include a `year.csv` and one CSV per nonempty table.

- [ ] **Step 5: Collect referenced storage objects**

Build explicit `{ bucket, path, archivePath }` entries from registration uploads and all exported/preserved records with storage columns. Deduplicate by bucket/path. Download every object; if any download fails, return 409 with the missing paths and do not create a receipt.

- [ ] **Step 6: Create and stage the ZIP**

Use `zipSync` from `npm:fflate@0.8.2` to add `manifest.json`, CSV files, and storage objects. Upload to a private `scout-year-backups` bucket at `${callerId}/${yearId}/${crypto.randomUUID()}.zip`. Insert the receipt with a 24-hour expiry and create a signed URL valid for 15 minutes.

- [ ] **Step 7: Verify GREEN and commit**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: PASS.

```powershell
git add supabase/functions/scout-year-backup/index.ts supabase/functions/_shared/scoutYearBackup.ts tests/access-control/scoutYearBackupDeletion.test.js
git commit -m "Add complete scouting year backup"
```

### Task 5: Add the deletion coordinator Edge Function and frontend service

**Files:**
- Create: `supabase/functions/delete-scout-year/index.ts`
- Modify: `src/services/scoutService.js`
- Modify: `src/services/supabaseClient.js`
- Modify: `tests/access-control/scoutYearBackupDeletion.test.js`

**Interfaces:**
- `createScoutYearBackup(scoutYearId): Promise<BackupResult>`
- `deleteScoutYear({ scoutYearId, receiptId, expectedLabel }): Promise<DeleteResult>`

- [ ] **Step 1: Add failing service/coordinator tests**

Assert the service invokes `scout-year-backup` and `delete-scout-year`, the deletion function uses exact permission authorization, validates the receipt, removes only manifest entries marked `deleteWithYear`, invokes `delete_scout_year_with_backup`, and audits failures.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: FAIL because the functions are absent.

- [ ] **Step 3: Normalize Supabase errors**

In `supabaseRequest`, parse JSON error bodies and throw the server message:

```js
if (!response.ok) {
  const raw = await response.text();
  let message = raw || `Supabase request failed: ${response.status}`;
  try { message = JSON.parse(raw)?.error || message; } catch { /* keep text */ }
  throw new Error(message);
}
```

- [ ] **Step 4: Implement deletion coordination**

Authorize with `requireDashboardPermission(req, "registration.retention.manage")`, load and validate the caller-owned receipt, remove only registration-upload source objects identified as `deleteWithYear`, then call the RPC through the caller-authenticated client so `auth.uid()` and MFA checks remain authoritative. On failure, write a failed audit event with year/receipt IDs; on success, remove the staged ZIP after the RPC or leave it for expiry cleanup if removal fails.

- [ ] **Step 5: Add frontend service functions**

```js
export function createScoutYearBackup(scoutYearId) {
  return invokeSupabaseFunction("scout-year-backup", { scoutYearId });
}
export function deleteScoutYear({ scoutYearId, receiptId, expectedLabel }) {
  return invokeSupabaseFunction("delete-scout-year", { scoutYearId, receiptId, expectedLabel });
}
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `node --test tests/access-control/scoutYearBackupDeletion.test.js`

Expected: PASS.

```powershell
git add supabase/functions/delete-scout-year/index.ts src/services/scoutService.js src/services/supabaseClient.js tests/access-control/scoutYearBackupDeletion.test.js
git commit -m "Coordinate backed-up scouting year deletion"
```

### Task 6: Add backup and delete controls to the dashboard

**Files:**
- Modify: `src/api/client.js`
- Modify: `src/pages/AdminDashboardPage.jsx`
- Modify: `src/styles.css`
- Create: `tests/access-control/scoutYearDeletionUi.test.js`

**Interfaces:**
- UI receipt state keyed by year ID
- Uses `createScoutYearBackup` and `deleteScoutYear`

- [ ] **Step 1: Write failing UI contract tests**

Assert the page contains **Download complete backup**, disables deletion without a matching receipt, blocks active-year deletion, requires exact-label confirmation, opens the signed URL, and refreshes after successful deletion.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/access-control/scoutYearDeletionUi.test.js`

Expected: FAIL because controls do not exist.

- [ ] **Step 3: Expose client operations**

Import the two scout service functions into `src/api/client.js` and export thin dashboard-facing wrappers without local API fallback; this destructive production workflow must report that Supabase is required when unconfigured.

- [ ] **Step 4: Add per-year backup state**

Track `{ status, receiptId, downloadUrl, expiresAt, manifest, error }` by year ID. The backup handler sets loading, requests the archive, creates an anchor with `downloadUrl`, assigns `download`, clicks it, and stores the valid receipt. Any failure clears the receipt and leaves deletion disabled.

- [ ] **Step 5: Add destructive confirmation**

For inactive years, render the backup button and a delete button disabled unless a nonexpired receipt matches the year. On delete, prompt for the exact label and compare case-sensitively; mismatch cancels. Call the delete API, clear receipt state, report success, and refresh. For the active year, render “Activate another year before deleting this one.”

- [ ] **Step 6: Add narrowly scoped styles**

Style `.scout-year-danger-zone`, `.scout-year-backup-status`, and `.scout-year-delete-action` using existing dashboard tokens. Preserve mobile wrapping and dark-mode readability; do not add broad selectors or `!important`.

- [ ] **Step 7: Verify GREEN, build, and visually inspect**

Run:

```powershell
node --test tests/access-control/scoutYearDeletionUi.test.js
npm run build
```

Expected: PASS and build exit 0. With local auth available, inspect the Registration & Season Import section at desktop and mobile widths; verify active/inactive states, confirmation card, progress, and disabled destructive state.

- [ ] **Step 8: Commit**

```powershell
git add src/api/client.js src/pages/AdminDashboardPage.jsx src/styles.css tests/access-control/scoutYearDeletionUi.test.js
git commit -m "Add scouting year backup deletion controls"
```

### Task 7: Full verification and deployment handoff

**Files:**
- Modify only if verification exposes a task-scoped defect.

**Interfaces:**
- Consumes all prior task outputs.
- Produces deployment-ready migration, functions, and frontend.

- [ ] **Step 1: Run focused tests**

```powershell
node --test tests/access-control/registrationUploadRouting.test.js tests/access-control/registrationImportConfirmation.test.js tests/access-control/scoutYearBackupDeletion.test.js tests/access-control/scoutYearDeletionUi.test.js
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete access-control suite**

Run: `npm run test:access-control`

Expected: all tests pass. If unrelated pre-existing failures remain, record exact test names and confirm none touch changed files.

- [ ] **Step 3: Run production build and whitespace checks**

```powershell
npm run build
git diff --check
```

Expected: build exits 0 and diff check prints no errors.

- [ ] **Step 4: Refresh the knowledge graph**

Run: `graphify update .`

Expected: successful AST refresh.

- [ ] **Step 5: Document safe deployment order**

Deploy in this exact order:

1. Apply `database/supabase-scout-year-backup-deletion.sql` in Supabase SQL Editor.
2. Deploy `parse-registration-upload`.
3. Deploy `scout-year-backup`.
4. Deploy `delete-scout-year`.
5. Push the frontend commit to `main` and wait for GitHub Pages Actions.
6. Verify MFA, parse/cancel/confirm an upload, generate a backup for a disposable inactive year, inspect the ZIP, then delete that disposable year.
