# Task 3 Review Brief

Review Task 3 of `docs/superpowers/plans/2026-07-15-access-control-foundation.md`.

Files in scope:

- `database/supabase-access-control-foundation.sql`
- `database/supabase-access-control-rollback.sql`
- `database/tests/access-control-foundation.sql`
- mirrored sections in `database/supabase-schema.sql` and `database/supabase-upload-fix.sql`
- `tests/access-control/accessControlMigration.test.js`
- `.gitignore`

Review priorities:

- additive and idempotent PostgreSQL/Supabase compatibility;
- all module modes, including Finance and Storage, remain `shadow`;
- no automatic Finance/Storage assignments;
- RLS and grants deny anonymous access and client writes;
- own-record reads are limited to active users;
- migration/review data is visible only to legacy active admins;
- rollback is non-destructive;
- mirrors exactly match the standalone source;
- identify any statement likely to fail on the existing schema.

Known verification limitation: Docker, `psql`, and Supabase CLI are unavailable on PATH and `supabase/config.toml` is absent. PostgreSQL execution is therefore still required before deployment.
