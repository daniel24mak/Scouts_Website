# Access Control Foundation

## Model

`auth.users` and identity fields in `user_profiles` identify a person. Authorization comes from normalized roles, permissions, scoped role assignments, group assignments, team memberships, direct overrides, and restrictions. Legacy profile fields remain authoritative while every module is in `legacy` or `shadow` mode.

Scopes are `global`, `group`, `team`, `event`, and `own_records`. Global access requires a null scope ID; resource scopes require the matching ID. Current assignments have started and are not expired. Disabled roles, permissions, teams, accounts, expired assignments, and malformed scopes fail closed. A matching direct deny always wins over an allow.

Group positions are derived during backfill: `head` becomes `head_chief`, `vice` becomes `vice_chief`, other Chiefs become `chief`, and additional coordinator groups become `coordinator`. Team membership alone grants no permission; a matching scoped role is also required. High-risk permissions require the configured MFA/AAL level.

The frontend effective-access snapshot and admin comparison report are observational only. They do not control routes, buttons, API calls, or RLS in this release.

## Local Verification

Run in order against a disposable local Supabase database:

```powershell
supabase db reset
supabase db query --file database/supabase-access-control-preflight.sql
supabase db query --file database/supabase-access-control-foundation.sql
supabase db query --file database/supabase-access-control-seed.sql
supabase db query --file database/supabase-access-control-backfill.sql
supabase db query --file database/tests/access-control-foundation.sql
supabase db query --file database/supabase-security-hardening.sql
supabase db query --file database/tests/security-hardening.sql
```

Run the backfill a second time before the SQL fixture to verify idempotency. Run `npm run test:access-control`, `npm run test:dark-mode`, and `npm run build` for repository verification.

## Production Deployment

1. Confirm and record a current database backup.
2. Run preflight and review every reported conflict.
3. Apply foundation, seed, then backfill through the Supabase SQL editor or the project's approved migration process.
4. Run the backfill twice and verify assignment counts do not change.
5. Run `database/tests/access-control-foundation.sql` and inspect unresolved migration differences.
6. Apply `database/supabase-security-hardening.sql` only after confirming the backfill created at least one active global System Administrator.
7. Run `database/tests/security-hardening.sql`. It is read-only and rolls back.
8. Redeploy the three user-management Edge Functions so they enforce normalized permissions and secure invitation/recovery flows.

The hardening migration enables normalized authority only for `people_access`,
`forms`, `documents`, and `archives`. Other modules remain in shadow mode.

## Rollback

Use `database/supabase-access-control-rollback.sql` only through the approved database process after confirming a backup. It restores legacy module authority and removes foundation objects without deleting legacy profile authorization fields. Re-run preflight and application tests afterward.

## Security Rule

> Never authorize an action only because a component, button, or route is hidden. Every protected action must also be authorized by the database or trusted server-side code.
