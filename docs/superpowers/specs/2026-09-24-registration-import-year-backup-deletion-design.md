# Registration Import Confirmation and Scouting-Year Backup Deletion

## Objective

Fix production registration parsing, prevent accidental registration imports, and provide a protected scouting-year deletion workflow that requires a complete downloadable backup first.

## Registration Import

### Parsing source

The `parse-registration-upload` Edge Function must not query `registration_import_settings`, because that table is not present in the production Supabase schema. For an existing target year, it reads `assignment_mode` from that `scout_years` row. For a new year that does not exist yet, it uses `schoolGrade`, matching the schema default. Group assignment continues to use authenticated reads of `grouping_rules`.

### Two-step workflow

Choosing a file parses it but performs no database or storage writes. The UI stores the parsed result temporarily and displays:

- filename;
- target scouting year;
- detected scout count;
- a small row preview;
- any parsing error.

The user must press **Confirm upload** before the existing import service uploads the source spreadsheet, records the upload, archives existing scouts in the target year, and inserts the parsed scouts. **Cancel** clears the pending file and parsed data. Changing the target year after parsing invalidates the pending import so data cannot be confirmed against a different year accidentally.

The confirmation copy must clearly warn that existing scouts in the target year will be archived before the imported rows are created.

## Year Backup

### Authorization

Backup generation and deletion are authenticated administrator actions and require an MFA-verified session. Authorization is enforced by trusted server-side code, not by UI visibility. Attempts and outcomes are written to the audit log.

### Archive contents

The backup is one ZIP named from the scouting-year label and export timestamp. It contains:

- a manifest with year identity, export time, schema/export version, record counts, file counts, and checksums where practical;
- CSV exports for every database table with records directly or transitively owned by the year;
- metadata exports for linked posts, calendar events, and gallery albums;
- the original registration-upload spreadsheets;
- gallery thumbnails/photos and other stored objects referenced by included records;
- a report of missing or inaccessible files rather than silently omitting them.

The archive is complete only when all database exports and available storage objects have been written successfully. Missing referenced storage objects make the export visibly incomplete and do not issue a deletion receipt.

### Backup receipt

After successfully generating the complete archive, the server stores the ZIP temporarily in private storage and creates a short-lived, single-use receipt tied to:

- the scouting year;
- the requesting user;
- the export manifest/hash;
- the exported record/file counts;
- generation time and expiry;
- unused/used state.

The browser downloads the completed ZIP through a short-lived signed URL and retains the receipt identifier. The UI enables **Delete scouting year** only after archive generation completes and the browser starts the download. Browsers cannot prove that a user retained a file on disk, so the server guarantee is that the complete ZIP was generated and delivered as a successful response. The staged server copy remains available until receipt expiry for recovery and is then eligible for cleanup.

Receipts expire after 24 hours. A new backup is required if the year changes after export or if the receipt has expired or already been used. The server compares current year data with the receipt snapshot before deletion and rejects stale receipts.

## Year Deletion

### Preconditions

Deletion is refused unless:

- the caller is authorized and MFA verified;
- the target year exists and is inactive;
- the caller supplies a valid, unused backup receipt for that year;
- the receipt still matches the current year snapshot;
- no export was incomplete.

### Preserved public content

Posts/blogs, calendar events, and gallery albums are included in the backup but are not deleted. Their `scout_year_id` values are set to `NULL` inside the deletion transaction so the content remains available. Gallery media remains in storage because the preserved gallery still references it.

### Deleted operational data

The trusted deletion function deletes year-owned operational records in dependency-safe order, including scouts, scout attendance, chief attendance, registration-upload records, original registration-upload files, and any other records that cannot exist independently of the year. The implementation must inspect all current foreign keys and include every dependent table rather than maintaining a partial hard-coded list in the browser.

Deletion is transactional for database records. Storage files are handled through a staged server workflow: validate the receipt, remove only storage objects owned exclusively by records being deleted, perform the database transaction, mark the receipt used, and write an audit result. Shared or preserved-content files are never removed.

If storage cleanup fails before the database transaction, deletion stops. If an unexpected failure occurs after storage removal but before the transaction completes, the audit log records the failed cleanup so administrators can reconcile it from the downloaded backup.

## User Interface

Each inactive year receives a destructive-action area with these states:

1. **Download complete backup** enabled.
2. Backup progress with clear record/file status.
3. **Delete scouting year** enabled only after a valid receipt is returned.
4. Final confirmation dialog requiring the exact scouting-year label.
5. Success refreshes dashboard data and clears the receipt; failure preserves the year and presents the server error.

The active year displays an explanation that it must be replaced as active before deletion. Starting a new backup invalidates the prior local receipt display.

## Service Boundaries

- The dashboard owns pending-import and backup/delete UI state.
- The frontend service invokes authenticated Supabase functions and downloads returned archives.
- The backup Edge Function gathers authorized data/files, builds the ZIP, and creates the receipt.
- The deletion Edge Function validates the receipt, coordinates owned-file removal, and calls a transactional database RPC.
- A database migration adds the protected receipt table and trusted deletion RPC with authenticated-only execution grants and RLS/default-deny protections.

No service-role credential is exposed to the frontend.

## Error Handling

- Supabase function errors are normalized so the UI displays the contained `error` message instead of raw JSON.
- Parse failures leave the target year and selected mode intact but clear invalid pending data.
- Backup failures never enable deletion.
- Missing files are listed explicitly and prevent receipt creation.
- Stale or mismatched receipts produce an instruction to download a fresh backup.
- Database or authorization failures do not optimistically remove the year from UI state.

## Testing

Tests must cover:

- production parsing no longer queries `registration_import_settings`;
- existing-year assignment mode and new-year default behavior;
- selecting a file does not import it;
- confirm performs the import and cancel clears it;
- changing the target invalidates a parsed import;
- backup authorization and MFA enforcement;
- archive manifest and required CSV/file inclusion;
- incomplete archives do not create receipts;
- active-year, stale-receipt, wrong-user, wrong-year, and reused-receipt rejection;
- preserved content is detached rather than deleted;
- operational records are deleted in dependency-safe order;
- shared/preserved files remain and exclusively owned registration files are removed;
- audit success and failure outcomes;
- production build and relevant access-control regression suite.

## Deployment

Deployment requires applying the additive database migration, deploying the parsing, backup, and deletion Edge Functions, and then deploying the frontend. The functions must be live before the frontend release. No destructive migration or automatic deletion runs during deployment.
