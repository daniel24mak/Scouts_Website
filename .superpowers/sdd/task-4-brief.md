# Task 4 Brief: Protected roles, permission catalogue, and operational teams

## Scope

Create the idempotent Release 1 seed for protected normalized roles, the complete permission catalogue, exact role bundles, and operational teams. Finance and Storage must be first-class but unassigned by default.

## Ownership

- `database/supabase-access-control-seed.sql`
- `database/tests/access-control-foundation.sql`
- `tests/access-control/accessControlMigration.test.js`
- `.superpowers/sdd/task-4-report.md`

Preserve unrelated edits. Do not commit, push, or apply SQL to a live project.

## Requirements

1. Seed every permission exported by `src/services/accessControlCatalog.js` exactly once.
2. Seed protected Chief, Media, Finance, Storage, Forms, Content Approval, Access Administration, and System Administration roles while retaining legacy `admin` compatibility.
3. Seed Media, Forms, Events, Website, Finance, and Storage teams.
4. Do not create user-role assignments or team memberships.
5. Team membership grants no permission by itself.
6. Use the exact reviewed role bundles; System Administrator receives every seeded permission.
7. Require MFA for the reviewed high-risk Finance and Storage operations.
8. Make reruns deterministic and idempotent without deleting unrelated legacy permission rows.

## Verification

```powershell
npm run test:access-control
npm run build
```

Live PostgreSQL execution remains behind the backup and schema-preflight gate.
