-- Read-only inventory for the access-control modernization.
-- Run against a local or explicitly approved Supabase database before applying migrations.

BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name, now() AS inspected_at;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles', 'roles', 'permissions', 'role_permissions',
    'user_permissions', 'audit_logs', 'groups'
  )
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin', 'is_coordinator_for_group', 'can_manage_group',
    'can_take_equipe_attendance', 'can_manage_form_templates',
    'can_post_forms', 'can_view_all_forms'
  )
ORDER BY routine_name;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

-- query_to_xml delays parsing until execution, so the preflight can report a
-- missing legacy table instead of aborting. Row JSON protects optional fields.
SELECT
  'legacy_profile_distribution' AS inventory,
  to_regclass('public.user_profiles') IS NOT NULL AS source_exists,
  CASE
    WHEN to_regclass('public.user_profiles') IS NULL THEN NULL
    ELSE query_to_xml(
      $query$
        SELECT
          profile ->> 'role' AS role,
          profile ->> 'chief_level' AS chief_level,
          profile ->> 'account_status' AS account_status,
          count(*) AS users
        FROM (
          SELECT to_jsonb(p) AS profile
          FROM public.user_profiles p
        ) profiles
        GROUP BY profile ->> 'role', profile ->> 'chief_level', profile ->> 'account_status'
        ORDER BY role, chief_level, account_status
      $query$,
      true,
      false,
      ''
    )::text
  END AS results;

SELECT
  'legacy_authorization_counts' AS inventory,
  to_regclass('public.user_profiles') IS NOT NULL AS source_exists,
  CASE
    WHEN to_regclass('public.user_profiles') IS NULL THEN NULL
    ELSE query_to_xml(
      $query$
        WITH profiles AS (
          SELECT to_jsonb(p) AS profile
          FROM public.user_profiles p
        )
        SELECT
          count(*) FILTER (WHERE COALESCE((profile ->> 'is_coordinator')::boolean, false)) AS coordinator_flags,
          count(*) FILTER (
            WHERE jsonb_typeof(profile -> 'coordinator_group_ids') = 'array'
              AND jsonb_array_length(profile -> 'coordinator_group_ids') > 1
          ) AS multi_group_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'can_publish')::boolean, false)) AS can_publish_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'can_create_group_meetings')::boolean, false)) AS meeting_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'can_edit_scouts')::boolean, false)) AS scout_edit_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'manage_form_templates')::boolean, false)) AS form_template_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'post_forms')::boolean, false)) AS form_post_profiles,
          count(*) FILTER (WHERE COALESCE((profile ->> 'view_all_forms')::boolean, false)) AS all_form_response_profiles
        FROM profiles
      $query$,
      true,
      false,
      ''
    )::text
  END AS results;

-- Finance and Storage readiness. `storage.*` permission keys refer to the
-- inventory/equipment module, not Supabase object-storage access.
WITH expected_tables(table_name) AS (
  VALUES
    ('finance_transactions'),
    ('finance_categories'),
    ('storage_inventory_items'),
    ('storage_categories'),
    ('storage_stock_movements'),
    ('teams'),
    ('user_team_memberships')
)
SELECT
  table_name,
  to_regclass(format('public.%I', table_name)) IS NOT NULL AS exists
FROM expected_tables
ORDER BY table_name;

SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id ILIKE ANY (ARRAY['%finance%', '%receipt%', '%inventory%', '%storage%'])
   OR name ILIKE ANY (ARRAY['%finance%', '%receipt%', '%inventory%', '%storage%'])
ORDER BY id;

-- query_to_xml keeps optional-table probes dynamic, allowing this script to
-- run both before and after the additive foundation creates the catalogues.
SELECT
  'roles' AS catalogue,
  CASE
    WHEN to_regclass('public.roles') IS NULL THEN NULL
    ELSE query_to_xml(
      $query$
        SELECT COALESCE(to_jsonb(role_row) ->> 'id', to_jsonb(role_row) ->> 'key') AS role_key
        FROM public.roles role_row
        WHERE COALESCE(to_jsonb(role_row) ->> 'id', to_jsonb(role_row) ->> 'key') IN (
          'finance_viewer', 'finance_contributor', 'finance_approver',
          'storage_assistant', 'storage_manager'
        )
        ORDER BY role_key
      $query$,
      true,
      false,
      ''
    )::text
  END AS matching_keys
UNION ALL
SELECT
  'permissions' AS catalogue,
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN NULL
    ELSE query_to_xml(
      $query$
        SELECT COALESCE(to_jsonb(permission_row) ->> 'id', to_jsonb(permission_row) ->> 'key') AS permission_key
        FROM public.permissions permission_row
        WHERE COALESCE(to_jsonb(permission_row) ->> 'id', to_jsonb(permission_row) ->> 'key') LIKE 'finance.%'
           OR COALESCE(to_jsonb(permission_row) ->> 'id', to_jsonb(permission_row) ->> 'key') LIKE 'storage.%'
        ORDER BY permission_key
      $query$,
      true,
      false,
      ''
    )::text
  END AS matching_keys
UNION ALL
SELECT
  'teams' AS catalogue,
  CASE
    WHEN to_regclass('public.teams') IS NULL THEN NULL
    ELSE query_to_xml(
      $query$
        SELECT COALESCE(to_jsonb(team_row) ->> 'key', to_jsonb(team_row) ->> 'id') AS team_key
        FROM public.teams team_row
        WHERE COALESCE(to_jsonb(team_row) ->> 'key', to_jsonb(team_row) ->> 'id') IN ('finance', 'storage')
        ORDER BY team_key
      $query$,
      true,
      false,
      ''
    )::text
  END AS matching_keys;

ROLLBACK;
