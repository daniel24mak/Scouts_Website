# Attendance Save Reliability and MFA Isolation Design

## Problem

Scout and chief attendance currently use a destructive multi-request save: existing records are deleted and replacement records are inserted individually. Concurrent clicks can overlap, and a failed insertion can leave a session empty or partially written. The UI then clears local edits or reloads missing values as `Present`, making an `Absent` selection appear to have changed.

The administrator dashboard also requests scouting-year deletion recovery whenever the dashboard loads. That protected retention endpoint requires MFA, so an MFA error can appear while the user is working in an unrelated section such as attendance.

## Desired Behavior

- Scout and chief attendance saves are atomic: either the entire sheet is saved or the previous sheet remains unchanged.
- `Present`, `Absent`, `Late`, and `Excused` persist exactly as selected.
- Only one save can run at a time in each attendance manager.
- The Save button immediately becomes disabled and shows `Saving...` while the request is active.
- A failed save retains the user's selections and displays an attendance-specific error.
- Local edits clear only after the server confirms the save.
- Scouting-year deletion recovery is requested only while an authorized administrator is viewing the registration/scouting-year management section.
- Retention MFA errors remain local to that section and never appear during attendance work.

## Architecture

### Transactional attendance RPCs

Add one PostgreSQL RPC for scout attendance and one for chief attendance. Each function will:

1. Validate the caller, active scouting year, meeting details, record payload, permitted status values, and group/equipe scope.
2. Create or update the matching attendance session.
3. Replace all records for that session inside the same database transaction.
4. Return the saved session identifier and record count only after every write succeeds.

PostgreSQL function execution supplies the transaction boundary. Any validation or insertion failure rolls the entire operation back, preserving the previous attendance data. The functions will use the existing authorization helpers and will not require registration-retention permission or MFA.

The frontend attendance service will replace its delete-and-insert sequence with calls to these RPCs. Status values will be validated before the request and returned records will continue using the existing display casing.

### Attendance UI state

Both attendance managers will maintain an `isSaving` state plus a synchronous in-flight guard. This prevents rapid double clicks before React rerenders. During a save:

- The button is disabled and labelled `Saving...`.
- Attendance controls remain visible.
- A second invocation returns without issuing another request.

On success, local edits are cleared, a success message is shown, and bootstrap data is refreshed. On failure, local edits remain intact and an error message is shown. Refresh failure after a confirmed save will be reported separately without describing the database save as failed.

### MFA request isolation

The scouting-year recovery effect will be gated by the active dashboard section in addition to administrator access. It will run when the user enters the Scouts / Registration section and when the year list changes while that section remains open. Leaving the section will not invoke the protected endpoint.

Recovery failures will update the scouting-year recovery controls. They will not overwrite the global dashboard save message used by attendance and unrelated modules.

## Error Handling

- Invalid or incomplete attendance payloads fail before any records are changed.
- Database errors roll back the full attendance save.
- The frontend shows the server message when safe, with a clear attendance fallback otherwise.
- A confirmed attendance save remains confirmed even if the subsequent dashboard refresh fails.
- MFA or retention authorization errors appear only beside scouting-year backup/deletion controls.

## Testing

Regression tests will prove:

- Scout and chief saves call their transactional RPC exactly once.
- An `Absent` selection is included and persists without defaulting to `Present`.
- Existing records survive a simulated replacement failure at the SQL transaction boundary.
- Rapid duplicate saves issue only one request.
- Failed saves keep local selections and restore the Save button.
- Successful saves clear edits only after confirmation.
- Dashboard load and attendance-section navigation do not request deletion recovery.
- Entering the registration/scouting-year section requests recovery for authorized administrators.
- Recovery MFA failures remain local to the registration section.

Focused tests, the existing access-control suite, and a production build will be run before completion is reported.

## Deployment

Deployment requires applying the attendance RPC migration before deploying the frontend bundle. No new Edge Function is required for this fix.
