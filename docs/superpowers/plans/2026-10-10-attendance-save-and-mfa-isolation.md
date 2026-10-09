# Attendance Save Reliability and MFA Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scout and chief attendance saves atomic and duplicate-safe while preventing registration-retention MFA errors from appearing outside scouting-year management.

**Architecture:** Two PostgreSQL RPCs validate and replace complete attendance sheets inside one transaction. The frontend service submits a single JSON payload per save, both React managers guard duplicate submissions and preserve edits on errors, and the dashboard loads protected deletion recovery only inside the Scouts / Registration section.

**Tech Stack:** React 18, JavaScript, Supabase PostgREST RPC, PostgreSQL/PLpgSQL, Node.js test runner, Vite.

## Global Constraints

- Supported statuses are exactly `Present`, `Absent`, `Late`, and `Excused`.
- Attendance saves do not require registration-retention permission or MFA.
- A failed replacement must preserve all previously saved attendance records.
- UI edits clear only after a confirmed database save.
- No new Edge Function or npm dependency is introduced.
- Existing unrelated working-tree files under `graphify-out/` and `.superpowers/` must not be modified or committed.

---

## File Structure

- Create `database/supabase-attendance-save-fix.sql`: additive RPC migration for atomic scout and chief saves.
- Modify `database/supabase-schema.sql`: clean-schema mirror of the two RPCs and grants.
- Modify `src/services/attendanceService.js`: validate payloads and call one RPC per save.
- Modify `src/features/attendance/ScoutAttendanceManager.jsx`: duplicate guard and reliable success/error state.
- Modify `src/features/attendance/ChiefAttendanceManager.jsx`: duplicate guard and reliable success/error state.
- Modify `src/pages/AdminDashboardPage.jsx`: scope deletion recovery and its errors to registration management.
- Create `tests/access-control/attendanceSaveReliability.test.js`: source-contract regression coverage for SQL, service, and UI behavior.
- Create `tests/access-control/attendanceMfaIsolation.test.js`: dashboard recovery isolation regression coverage.

### Task 1: Atomic attendance database functions

**Files:**
- Create: `database/supabase-attendance-save-fix.sql`
- Modify: `database/supabase-schema.sql`
- Create: `tests/access-control/attendanceSaveReliability.test.js`

**Interfaces:**
- Produces: `public.save_scout_attendance(target_group_id text, target_equipe_id uuid, target_scope text, target_date date, target_topic text, target_records jsonb) returns jsonb`
- Produces: `public.save_chief_attendance(target_date date, target_topic text, target_records jsonb) returns jsonb`
- Both return `{ "id": <uuid>, "recordCount": <integer> }`.

- [ ] **Step 1: Write failing SQL contract tests**

Create `tests/access-control/attendanceSaveReliability.test.js` with Node assertions that read both SQL files and require:

```js
test("attendance saves are transactional RPCs with strict status validation", () => {
  for (const sql of [migrationSql, schemaSql]) {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_scout_attendance[\s\S]*target_records jsonb/i);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_chief_attendance[\s\S]*target_records jsonb/i);
    assert.match(sql, /jsonb_each_text\(target_records\)/i);
    assert.match(sql, /NOT IN \('Present', 'Absent', 'Late', 'Excused'\)/i);
    assert.match(sql, /DELETE FROM public\.attendance_records[\s\S]*INSERT INTO public\.attendance_records/i);
    assert.match(sql, /DELETE FROM public\.chief_attendance_records[\s\S]*INSERT INTO public\.chief_attendance_records/i);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_scout_attendance/i);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_chief_attendance/i);
  }
});
```

Also assert the scout function calls the existing `can_take_equipe_attendance`/group authorization logic, both functions reject a null active year, both lock or upsert the session deterministically, and neither references `registration.retention.manage` or `has_required_aal`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: FAIL because `supabase-attendance-save-fix.sql` and the RPC definitions do not exist.

- [ ] **Step 3: Implement the additive migration**

In `database/supabase-attendance-save-fix.sql`, wrap definitions in `BEGIN; ... COMMIT;`. Each `SECURITY DEFINER` function must set `search_path = pg_catalog, public`, require `auth.uid()`, resolve the active year, require a JSON object, validate every UUID key and exact status, validate every referenced scout/chief, authorize the caller using existing admin/group/coordinator/equipe helpers, then create or update the session and replace its rows. Use one set-based insertion:

```sql
INSERT INTO public.attendance_records (session_id, scout_id, status)
SELECT saved_session_id, key::uuid, value
FROM jsonb_each_text(target_records);
```

Raise exceptions before the `DELETE` for all payload and scope validation. Any later error relies on the PostgreSQL function transaction to roll back the delete. Revoke public/anon execution and grant only authenticated execution.

- [ ] **Step 4: Mirror the RPCs into the clean schema**

Insert the exact function definitions and grants into `database/supabase-schema.sql` after attendance policies and before later optional modules. Keep signatures byte-for-byte consistent with the additive migration.

- [ ] **Step 5: Run SQL contract tests and verify GREEN**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: PASS for the SQL contract tests.

- [ ] **Step 6: Commit Task 1**

```powershell
git add database/supabase-attendance-save-fix.sql database/supabase-schema.sql tests/access-control/attendanceSaveReliability.test.js
git commit -m "Make attendance saves transactional"
```

### Task 2: Route frontend attendance saves through the RPCs

**Files:**
- Modify: `src/services/attendanceService.js`
- Modify: `tests/access-control/attendanceSaveReliability.test.js`

**Interfaces:**
- Consumes: the two RPC signatures from Task 1.
- Produces: unchanged exported functions `saveSupabaseScoutAttendance(payload)` and `saveSupabaseChiefAttendance(payload)`, each resolving to `{ id, recordCount }`.

- [ ] **Step 1: Add failing service tests**

Extend the test to require `callSupabaseRpc("save_scout_attendance", ...)` and `callSupabaseRpc("save_chief_attendance", ...)`, exact snake_case argument names, and no attendance-record delete/insert sequence inside either save function. Assert the source contains a shared validator accepting only the four supported statuses.

```js
assert.match(serviceSource, /callSupabaseRpc\("save_scout_attendance"/);
assert.match(serviceSource, /callSupabaseRpc\("save_chief_attendance"/);
assert.doesNotMatch(scoutSaveBody, /deleteSupabaseRows|insertSupabaseRow/);
assert.doesNotMatch(chiefSaveBody, /deleteSupabaseRows|insertSupabaseRow/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: FAIL because both functions still delete and insert through separate requests.

- [ ] **Step 3: Implement minimal RPC service calls**

Import `callSupabaseRpc`. Validate `records` is a non-array object and every value is supported. Call:

```js
return callSupabaseRpc("save_scout_attendance", {
  target_group_id: groupId,
  target_equipe_id: equipeId,
  target_scope: scope,
  target_date: date,
  target_topic: topic,
  target_records: records
});
```

Use the analogous chief arguments. Remove obsolete current-user, active-year, delete, and insert dependencies from these two save paths. Keep audit logging server-side in the SQL functions so a post-commit audit request cannot misreport a successful save as failed.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/services/attendanceService.js tests/access-control/attendanceSaveReliability.test.js
git commit -m "Use atomic attendance save RPCs"
```

### Task 3: Make both attendance interfaces duplicate-safe

**Files:**
- Modify: `src/features/attendance/ScoutAttendanceManager.jsx`
- Modify: `src/features/attendance/ChiefAttendanceManager.jsx`
- Modify: `tests/access-control/attendanceSaveReliability.test.js`

**Interfaces:**
- Consumes: attendance service promises from Task 2.
- Produces: one in-flight save maximum per mounted manager, `Saving...` button state, retained edits after failure.

- [ ] **Step 1: Add failing UI regression tests**

Extend the source-contract test to require both managers to import/use `useRef`, define `saveInFlightRef`, check it at the first line of `handleSave`, set it before awaiting, and clear it in `finally`. Require `isSaving`, a disabled Save button, `Saving...`, and `catch` branches that set an attendance-specific failure message. Require `setRecords({})` only in the success path after the save promise resolves.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: FAIL because neither manager prevents repeated submissions or catches save failures.

- [ ] **Step 3: Implement scout manager save state**

Add `isSaving` state and `saveInFlightRef`. In `handleSave`, return immediately if guarded; validate scope; snapshot the payload; set the guard and saving state; clear only the message; then:

```js
try {
  await saveScoutAttendance(payload);
  setRecords({});
  setSaveMessage("Attendance saved to the database.");
  try { await refresh(); }
  catch (error) { setSaveMessage(`Attendance was saved, but the refreshed list could not be loaded: ${error.message}`); }
} catch (error) {
  setSaveMessage(`Attendance could not be saved: ${error.message || "Please try again."}`);
} finally {
  saveInFlightRef.current = false;
  setIsSaving(false);
}
```

Disable the button and render `Saving...` while active. Do not clear `records` in the catch branch.

- [ ] **Step 4: Implement the same chief manager behavior**

Apply the same guard, state transitions, failure preservation, refresh distinction, disabled state, and label to `ChiefAttendanceManager.jsx`, using the chief-specific success/failure copy.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/access-control/attendanceSaveReliability.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/features/attendance/ScoutAttendanceManager.jsx src/features/attendance/ChiefAttendanceManager.jsx tests/access-control/attendanceSaveReliability.test.js
git commit -m "Prevent duplicate attendance submissions"
```

### Task 4: Isolate scouting-year MFA recovery from attendance

**Files:**
- Modify: `src/pages/AdminDashboardPage.jsx`
- Create: `tests/access-control/attendanceMfaIsolation.test.js`

**Interfaces:**
- Produces: deletion recovery requests only while `activeSection === "scouts"`; recovery errors stored in `scoutYearRecoveryError` and rendered only in scouting-year controls.

- [ ] **Step 1: Write failing isolation tests**

Create a Node source-contract test that extracts the recovery effect and asserts it checks the exact registration section before calling `hydrateScoutYearDeletionRecovery`. Assert the effect depends on `activeSection`, `user?.id`, and `data.scoutYears`. Assert the recovery catch does not call `setSaveMessage` and instead calls `setScoutYearRecoveryError`. Assert the error is rendered inside `.scout-year-backup-status`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/access-control/attendanceMfaIsolation.test.js`

Expected: FAIL because recovery currently runs across the administrator dashboard and writes the global save message.

- [ ] **Step 3: Gate recovery by registration section**

Update the effect to:

```js
useEffect(() => {
  if (activeSection === "scouts" && user?.id && canManageSystem(user)) {
    void hydrateScoutYearDeletionRecovery();
  }
}, [activeSection, user?.id, data.scoutYears]);
```

Initialize non-admin/other-section recovery state without calling the endpoint so attendance UI is not blocked by retention authorization.

- [ ] **Step 4: Localize recovery errors**

Add `scoutYearRecoveryError`. Clear it at recovery start/success and set it in the catch. Remove the catch's `setSaveMessage`. Render the exact error beside the existing recovery-state message within scouting-year management:

```jsx
{scoutYearRecoveryStatus === "error" && (
  <span role="alert">{scoutYearRecoveryError || "Recovery state unavailable. Refresh before creating a new backup."}</span>
)}
```

- [ ] **Step 5: Run isolation and prior focused tests**

Run: `node --test tests/access-control/attendanceMfaIsolation.test.js tests/access-control/attendanceSaveReliability.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/pages/AdminDashboardPage.jsx tests/access-control/attendanceMfaIsolation.test.js
git commit -m "Scope retention MFA checks to registration"
```

### Task 5: Final verification

**Files:**
- Verify only; do not modify unrelated generated files.

**Interfaces:**
- Consumes: all deliverables above.
- Produces: evidence that focused regressions and the production bundle pass.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node --test tests/access-control/attendanceSaveReliability.test.js tests/access-control/attendanceMfaIsolation.test.js
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run the full access-control suite**

Run: `npm run test:access-control`

Expected: no new failures. If the two documented pre-existing People & Access failures remain, report them exactly and do not claim the whole suite passes.

- [ ] **Step 3: Build production assets**

Run: `npm run build`

Expected: Vite exits 0 and writes `dist/`.

- [ ] **Step 4: Check patch hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only implementation files plus pre-existing `.superpowers/` and `graphify-out/` workspace changes are present.

- [ ] **Step 5: Review deployment order**

Confirm the handoff states: apply `database/supabase-attendance-save-fix.sql` first, then deploy the frontend. No Edge Function deployment is required.
