# Task 1 Brief: Read-only authorization preflight

## Context

This is the first task in the additive access-control foundation. It inventories the current Supabase/PostgreSQL authorization surface without changing data or schema. Later migration work depends on this evidence.

## Ownership

Create only `database/supabase-access-control-preflight.sql`. Do not edit any other file. You are not alone in the codebase; do not revert or overwrite unrelated changes.

## Requirements

The script must:

1. Begin with `BEGIN TRANSACTION READ ONLY;` and end with `ROLLBACK;`.
2. Report the current database and inspection timestamp.
3. Report columns for `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_permissions`, `audit_logs`, and `groups`.
4. Report RLS enablement for every public table.
5. Report policies in the `public` and `storage` schemas.
6. Report the security type of existing authorization helper functions, including `is_admin`, `is_coordinator_for_group`, `can_manage_group`, `can_take_equipe_attendance`, `can_manage_form_templates`, `can_post_forms`, and `can_view_all_forms`.
7. Report all storage buckets and their public/file restrictions.
8. Report legacy profile counts grouped by `role`, `chief_level`, and `account_status`.
9. Report counts for legacy coordinator and boolean permission fields.
10. Remain robust when optional legacy columns or optional tables differ between local and production schema. Use catalog-driven SQL where needed; do not turn this read-only inventory into a migration.
11. Include Finance and Storage readiness checks: report whether Finance/Storage tables, buckets, permission keys, role keys, and team keys already exist. These checks must be read-only and must not assume those resources exist.
12. Avoid selecting personal profile data. Aggregate counts only.

## Verification

- Inspect the script to confirm there are no `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, `TRUNCATE`, or `GRANT` statements.
- If the local Supabase CLI and local database are available, run the script against the local database and report the exact result.
- If unavailable, report the missing prerequisite clearly; do not connect to or modify production.
- Do not commit or push.

## Report

Write a full report to `.superpowers/sdd/task-1-report.md` containing:

- status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`
- file changed
- design decisions
- commands run and exact outcomes
- self-review findings
- remaining concerns, including whether live backup/preflight confirmation is still required

