# Task 5 Report

## Status

Complete. Independent security review approved the helper layer and fixtures.

## Red/Green Evidence

- RED: `npm run test:access-control` failed because the existing dashboard-user helper lacked the fixed definer search path and the remaining Task 5 helpers did not exist.
- GREEN: the standalone foundation and both mirrors now expose the reviewed helper set; all 32 access-control tests pass.

## Changes

- Hardened `is_active_dashboard_user()` with `search_path = pg_catalog, public`.
- Added global, group, team, and event permission helpers that use only `auth.uid()`.
- Added active-account, active-role, active-permission, assignment-expiry, override-expiry, direct-deny, and AAL enforcement.
- Kept unscoped checks global-only and resource helpers scope-aware.
- Added a team-membership helper without treating membership as a permission grant.
- Added `get_my_effective_access()` with the reviewed camelCase arrays, active grants, direct-deny filtering, restrictions, MFA metadata, and generated timestamp.
- Revoked public execution and granted only the reviewed signatures to `authenticated`.
- Added transactional SQL fixtures covering active/disabled users, expired roles, scoped Finance/Storage access, membership-only denial, direct denial, and aal1/aal2 behavior.
- Mirrored the standalone migration exactly into clean-install and incremental schema files.

## Verification

- `npm run test:access-control`: PASS, 32/32.
- `npm run build`: PASS.
- Lint: not available in this project.
- Live PostgreSQL behavior tests and `EXPLAIN (ANALYZE, BUFFERS)`: not run because this workspace has no configured disposable Supabase/PostgreSQL target.

## Safety

- Every authorization module remains in `shadow` mode; legacy application authorization remains authoritative.
- No user assignment, route, RLS cutover, frontend permission decision, or live database was changed.
- Finance and Storage roles remain unassigned by default.

## Concerns

- Static tests cannot prove PostgreSQL execution or query-plan selection; both remain deployment-gate checks on a disposable target before production.

## Independent Review

- Inactive teams now fail closed in team-scoped helpers and are excluded from access snapshots.
- Function ACLs explicitly reset `PUBLIC`, `anon`, and `authenticated`, then grant only the reviewed helper signatures back to `authenticated`.
- Missing and inactive permissions now return `false` instead of SQL `NULL`.
- Transactional fixtures cover inactive/future/expired/scoped/MFA/ACL cases and calls under `SET LOCAL ROLE authenticated`.
- Final review: APPROVED with no actionable findings.
