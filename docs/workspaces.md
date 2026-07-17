# Dashboard Workspaces

The authenticated dashboard is a separate application surface from the public website. Routes under `/dashboard/*`, `/admin*`, and `/chiefs*` do not render the public header or footer.

Workspace availability is calculated from server-provided effective permissions. The workspace switcher changes context only; it never grants access. Canonical routes are `/dashboard/scouting`, `/dashboard/admin`, `/dashboard/finance`, `/dashboard/storage`, and `/dashboard/my-work`.

Apply migrations in this order: access-control foundation and seed, `supabase-workspace-access.sql`, `supabase-workflow-engine.sql`, Finance core/workflows, Storage core/workflows, private workspace storage, then Finance/Storage integration. Deploy the `workspace-private-files` Edge Function after configuring its standard Supabase secrets.

Rollback should disable workspace role grants and routes before removing new objects. Do not drop tables containing operational records; export and archive them first.
