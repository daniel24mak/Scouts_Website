# Task 2 Report

Status: DONE_WITH_CONCERNS

## Files changed

- `package.json`
- `src/services/accessControlCatalog.js`
- `src/services/accessControlResolver.js`
- `tests/access-control/accessControlResolver.test.js`

## TDD evidence

### RED 1: missing production modules

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; Node reported `ERR_MODULE_NOT_FOUND` for `src/services/accessControlCatalog.js`. No test passed accidentally before implementation.

### GREEN 1: catalogue and resolver

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 15 tests passed, 0 failed.

### RED 2: malformed timestamp hardening

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 15 tests passed and `malformed assignment timestamps fail closed` failed because two malformed entries remained active.

### GREEN 2: fail-closed timestamps

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 16 tests passed, 0 failed.

### RED 3: reviewer fail-closed regressions

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 16 tests passed and 4 failed for invalid global/own-record scope IDs, explicit empty timestamps, raw malformed snapshots, and unnormalized comparison values/default scope.

### GREEN 3: hardened raw-input and scope validation

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 20 tests passed, 0 failed.

### RED 4: approved-scope and canonical-time enforcement

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 20 tests passed and 2 failed because unknown scope types and non-string/non-canonical timestamps were still accepted.

### GREEN 4: strict scope and timestamp vocabulary

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 22 tests passed, 0 failed.

### RED 5: calendar-valid timestamps and text resource IDs

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 22 tests passed and 2 failed because impossible ISO calendar dates and numeric resource IDs were accepted.

### GREEN 5: calendar and resource-ID validation

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 24 tests passed, 0 failed.

### RED 6: explicit null scopes and group-ID validation

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 24 tests passed and 2 failed because omitted global/own-record scope IDs and malformed group IDs were accepted.

### GREEN 6: strict normalized scope shape

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 26 tests passed, 0 failed.

### RED 7: malformed deny precedence

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `1`; 26 tests passed and 1 failed because malformed direct denies could be ignored while valid allows succeeded.

### GREEN 7: conservative malformed-deny handling

Command:

```powershell
npm run test:access-control
```

Exact outcome: exit code `0`; 27 tests passed, 0 failed.

### Production build

Command:

```powershell
npm run build
```

Latest exact outcome: exit code `0`; Vite 6.4.3 transformed 1,724 modules and completed in 5.58 seconds.

## Design decisions

- Catalogue constants include every permission in the approved design and stable Finance/Storage role and team keys.
- Finance and Storage remain independent permission namespaces; this task does not assign roles or connect the resolver to current application behavior.
- The resolver is pure and imports neither browser APIs nor Supabase services.
- Only active accounts receive effective access.
- Scoped grants require matching resource scopes; an unscoped check accepts only global grants.
- Global and matching scoped denies override allows.
- Expired, future, malformed, and explicitly empty timestamp entries fail closed during normalization and direct helper calls.
- Global and own-record scopes require null scope IDs; group, team, and event scopes require matching non-empty IDs.
- Permission and requested-resource scopes must use one of the five approved scope types.
- Supplied timestamps must be canonical ISO timestamps with a timezone; non-string and ambiguous date values fail closed.
- ISO timestamps must also represent a real calendar date rather than a date normalized by `Date.parse`.
- Group, team, and event resource IDs must be non-empty text values on both the grant and requested scope.
- Global and own-record grants must explicitly contain `scopeId: null`; an omitted ID is malformed and denied.
- Accessible group extraction accepts only non-empty, already-trimmed text IDs and never stringifies unknown values.
- A malformed active deny for a permission denies conservatively rather than being discarded and allowing a grant through.
- Public helper calls normalize raw snapshots before use, preventing malformed arrays or stale entries from bypassing checks.
- Caller arrays and entries are copied before normalization returns them.

## Self-review

- Confirmed existing `package.json` scripts were preserved and no dependency was added.
- Confirmed current routes, auth context, Supabase calls, and dashboard behavior are untouched.
- Added explicit tests for Finance/Storage catalogue completeness, cross-scope isolation, deny precedence, account status, expiry, malformed dates, deterministic groups, and caller immutability.

## Concerns

- PowerShell's global `npm.ps1` printed a non-fatal `Test-Path: Access is denied` warning while probing a user-level npm path. npm still executed the project scripts and returned the reported exit codes.
- SQL and frontend integration intentionally remain for later reviewed tasks.
- No commit or push was performed.
