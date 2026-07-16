# Task 3 Implementation Report

## Changes

- Added the transactional SQL smoke test for normalized tables.
- Added an additive shadow-only access-control foundation migration.
- Added a non-destructive rollback that restores all module modes to legacy.
- Mirrored the reviewed foundation into clean and incremental Supabase schemas.
- Added static migration contract tests and made access-control tests trackable.
- Included Finance and Storage module modes as shadow-only from the foundation.

## TDD Evidence

- RED: `npm run test:access-control` reported 27 passing resolver tests and 3 failing migration tests because the foundation, rollback, and mirror sections were absent.
- GREEN: after implementation, `npm run test:access-control` reported 30 passing tests and 0 failures.
- REVIEW RED: independent review identified rollback, stale-JWT admin, incomplete privilege, mutable-audit, shadow-mode, timed-overlap, scope-normalization, SQL-smoke, and mirror-test gaps.
- REVIEW GREEN: each finding received regression coverage and was repaired. A second review found three audit/shadow edge cases; those were also regression-tested and repaired.
- FINAL REVIEW: independent spec and SQL quality review approved with no remaining Task 3 findings.

## Safety

- No module defaults to normalized authority.
- No user assignments are created.
- No client INSERT, UPDATE, or DELETE policies are created.
- Anonymous table privileges are revoked from the normalized catalogue and assignment tables.
- Existing data is not dropped or rewritten by rollback.
- Audit logs are append-only for active authenticated users acting as themselves; clients cannot update, delete, or truncate audit evidence.
- Time-bounded role, group, team, and override assignments use exclusion constraints to prevent overlaps.

## Verification Limitation

The current machine has no Docker, `psql`, or Supabase CLI on PATH, and the repository has no `supabase/config.toml`. The transactional PostgreSQL test has not been executed. Local database execution remains mandatory before any production migration.
