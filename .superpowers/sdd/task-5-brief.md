# Task 5 Brief: Secure effective-access SQL helpers

## Scope

Add shadow-mode SQL helpers that resolve the authenticated user's normalized access without changing any module from legacy authority.

## Ownership

- `database/supabase-access-control-foundation.sql`
- mirrored foundation blocks in `database/supabase-schema.sql` and `database/supabase-upload-fix.sql`
- `database/tests/access-control-foundation.sql`
- `tests/access-control/accessControlMigration.test.js`
- `.superpowers/sdd/task-5-report.md`

Do not commit, push, or apply SQL to a live project.

## Security requirements

1. Helpers derive identity only from `auth.uid()` and never accept a user ID.
2. Only active profiles, active roles, active permissions, and unexpired assignments/overrides count.
3. Unscoped helpers authorize global grants only.
4. Group, team, and event helpers accept only matching resource scopes or global grants.
5. Applicable direct denies win over role and direct allows.
6. Every permission helper enforces the permission's AAL/MFA requirement.
7. Team membership alone grants no permission.
8. Every function is `SECURITY DEFINER` with `search_path = pg_catalog, public` and fully-qualified tables.
9. Public execution is revoked; authenticated execution is granted only for the reviewed helper signatures.
10. The RPC returns the reviewed camelCase access snapshot and remains descriptive shadow data.

## Verification

```powershell
npm run test:access-control
npm run build
```

Live SQL behavior tests and query plans remain pending until a disposable Supabase/PostgreSQL target is available.
