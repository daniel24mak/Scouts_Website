# Task 2 Brief: Pure authorization catalogue and resolver

## Context

This task creates the browser-independent authorization vocabulary and pure resolver used by later SQL/frontend shadow-mode work. It must not alter current routing, permissions, Supabase calls, or dashboard behavior.

## Ownership

You may create or modify only:

- `src/services/accessControlCatalog.js`
- `src/services/accessControlResolver.js`
- `tests/access-control/accessControlResolver.test.js`
- `package.json`
- `.superpowers/sdd/task-2-report.md`

You are not alone in the codebase. Preserve unrelated edits and existing scripts. Do not commit or push.

## TDD Requirements

Follow red-green-refactor. Add tests first, run them, and record the expected failure before writing production modules.

Tests must prove:

1. Missing payload normalizes to `accountStatus: "missing"`, empty arrays, and denied dashboard access.
2. Disabled, suspended, archived, invited, and missing accounts cannot receive protected permissions.
3. Global permissions match any applicable scope.
4. Group-scoped permissions match only the same group.
5. Team-, event-, and own-record scopes do not match unrelated resources.
6. A matching direct deny restriction takes precedence over an allow.
7. Expired roles/permissions/restrictions are ignored when expiry is represented in the effective-access payload.
8. Accessible group IDs are unique, active, deterministic, and sorted.
9. Legacy/normalized comparison returns the exact normalized mismatch object described in the plan.
10. Finance and Storage are independent first-class catalogue families:
   - roles: `finance_viewer`, `finance_contributor`, `finance_approver`, `storage_assistant`, `storage_manager`
   - teams: `finance`, `storage`
   - all Finance and Storage permission constants from the approved design
11. No Finance role includes Storage permissions and no Storage role includes Finance permissions. This task defines stable keys, not role bundles; test key separation rather than inventing assignments.

## Required API

`src/services/accessControlCatalog.js` exports:

- `SCOPE_TYPES`
- `ACCOUNT_STATUSES`
- `ROLE_KEYS`
- `TEAM_KEYS`
- `PERMISSIONS`

Use the exact keys in `docs/superpowers/plans/2026-07-15-access-control-foundation.md`, Interfaces section, and include the complete approved permission catalogue rather than only the test subset.

`src/services/accessControlResolver.js` exports:

- `normalizeEffectiveAccess(payload = {})`
- `hasEffectivePermission(access, permissionKey, scope = null)`
- `getAccessibleGroupIds(access)`
- `compareLegacyAndNormalized({ legacyAllowed, normalizedAllowed, permissionKey, scope })`

The resolver must be pure, deny by default, avoid browser/Supabase imports, and not mutate caller data.

Add this script without replacing existing scripts:

```json
"test:access-control": "node --test tests/access-control/*.test.js"
```

## Verification

Run and report:

```powershell
npm run test:access-control
npm run build
```

The project currently has no lint script. Do not add or upgrade dependencies.

## Report

Write `.superpowers/sdd/task-2-report.md` with status, red/green evidence, files changed, commands and outcomes, self-review, and concerns. Return only status, changed paths, one-line verification summary, and concerns.

