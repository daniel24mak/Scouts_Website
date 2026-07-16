# Task 6 Report: Legacy Access Backfill

Status: complete and independently approved.

Implemented an idempotent, reviewable legacy-to-normalized access backfill. It maps legacy administrators, Chiefs, Head/Vice Chiefs, coordinators, and Forms Managers while preserving all legacy profile fields. Broad legacy posting, response-viewing, and publishing flags are recorded as review differences instead of being auto-granted.

Safety properties:

- rerunnable through `public.backfill_legacy_access_control()`;
- guarded against current and future assignment conflicts;
- conflicting primary-group mappings are recorded for review;
- duplicate coordinator groups cannot duplicate assignments;
- no direct Finance or Storage role assignments;
- no team memberships created;
- function execution revoked from public client roles;
- legacy authorization snapshot verified unchanged.

Verification:

- `npm run test:access-control`: 33/33 passed;
- `npm run build`: passed;
- database fixture creates exact legacy-role cases and runs the backfill twice;
- independent review: APPROVED;
- live PostgreSQL execution remains pending because no configured local/live database was available.
