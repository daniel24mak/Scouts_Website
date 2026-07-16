# Task 4 Report

## Status

Complete. Independent review approved the corrected seed and assertions.

## Red/Green Evidence

- RED: `npm run test:access-control` failed because `database/supabase-access-control-seed.sql` did not exist.
- GREEN iteration 1: the seed existed, exposing a stale test count (`107`) while the current catalogue contains 114 keys.
- GREEN iteration 2: exact key-set comparison passed; a malformed test regex incorrectly rejected valid `high, true` MFA rows.
- GREEN: after correcting the test defects, all 31 access-control tests passed.

## Changes

- Added an idempotent transactional seed for 114 current permissions.
- Added protected normalized roles and retained legacy `admin` compatibility.
- Added exact reviewed role-permission bundles.
- Added active Media, Forms, Events, Website, Finance, and Storage teams.
- Kept Finance and Storage roles unassigned and team membership non-authoritative.
- Added SQL assertions for protected roles, exact Finance/Storage bundles, MFA requirements, and absence of automatic Finance/Storage assignments.
- Added static migration tests for complete catalogue parity, exact bundles, idempotency, and assignment safety.

## Verification

- `npm run test:access-control`: PASS, 31/31.
- `npm run build`: PASS.
- Lint: not available in this project.
- Live PostgreSQL execution: not run; the local environment has no configured Supabase CLI project, `psql`, or Docker database and production execution requires a confirmed backup.

## Self-review

- The seed modifies only catalogue metadata, protected role definitions, teams, and protected role-permission mappings.
- It does not insert into `user_role_assignments` or `user_team_memberships`.
- Cleanup removes stale grants outside the current catalogue from normalized protected roles while preserving legacy `admin` grants and permission rows.
- System Administrator receives every permission from the same temporary catalogue used for the permission upsert.

## Concerns

- Static Node and SQL assertion tests cannot replace execution against a disposable PostgreSQL/Supabase instance.
- The seed must not be applied to production until the preflight and recoverable-backup gates are satisfied.

## Independent Review

- Initial review found that protected-role cleanup preserved stale out-of-catalogue grants. The cleanup now enforces exact bundles across every grant on normalized protected roles.
- Initial review found SQL assertions that assumed assignment tables were globally empty. Those assertions were removed because the seed's non-assignment guarantee is enforced statically without rejecting legitimate later assignments.
