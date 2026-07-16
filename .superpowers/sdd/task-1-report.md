# Task 1 Report

Status: DONE_WITH_CONCERNS

## Files changed

- `database/supabase-access-control-preflight.sql`

## Design decisions

- The script starts a read-only transaction and always rolls it back.
- Legacy profile fields are read through `to_jsonb`, so absent optional columns become null instead of causing parse errors.
- Only aggregate profile counts are returned; names, emails, IDs, and other personal data are not selected.
- Optional Finance, inventory, team, role, and permission resources are probed through PostgreSQL catalog functions and dynamic read-only XML queries.
- `storage.*` inventory permissions are explicitly separated from Supabase object-storage buckets.

## Verification performed

Command:

```powershell
.\node_modules\.bin\supabase.cmd --version
Test-Path supabase\config.toml
Test-Path database\supabase-schema.sql
```

Exact outcome: Supabase CLI `2.107.0`; `supabase/config.toml` returned `False`; `database/supabase-schema.sql` returned `True`.

Command:

```powershell
Select-String -Path database\supabase-access-control-preflight.sql -Pattern '^BEGIN TRANSACTION READ ONLY;$','^ROLLBACK;$'
```

Exact outcome after the review fixes: matches at lines 4 and 187.

Command:

```powershell
Select-String -Path database\supabase-access-control-preflight.sql -Pattern '^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b' -CaseSensitive:$false
```

Exact outcome: no matches.

Command:

```powershell
Select-String -Path database\supabase-access-control-preflight.sql -Pattern '\b(full_name|email|profile_picture_url|phone|address)\b' -CaseSensitive:$false
```

Exact outcome: no matches.

- Did not run `supabase db reset` because this checkout has no local Supabase project configuration; no production connection was attempted.

## Self-review findings

- The first draft protected optional legacy columns but not a missing `user_profiles` table. Review identified this, and both profile inventories now use guarded dynamic read-only queries.
- The first draft assumed fixed key columns in existing catalogue tables. Review identified this, and probes now derive keys from row JSON using `id`/`key` fallbacks.
- Partitioned public tables are now included in the RLS inventory.
- PostgreSQL execution remains the only unperformed verification because no local Supabase project is configured.

## Remaining concerns

- The script has not yet been parsed by a live PostgreSQL/Supabase database.
- A recoverable production backup and approved live read-only preflight remain mandatory before any production migration.
- Live schemas may use Finance or inventory table names not anticipated by the readiness list; the broader public-table inventory will still reveal them.
- No commit or push was performed.
