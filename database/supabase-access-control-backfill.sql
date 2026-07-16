-- Idempotent shadow backfill from legacy profile access fields.
-- Run after supabase-access-control-foundation.sql and supabase-access-control-seed.sql.
-- This migration never changes legacy user_profiles authorization fields.

BEGIN;

CREATE OR REPLACE FUNCTION public.backfill_legacy_access_control()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
DROP TABLE IF EXISTS pg_temp.legacy_access_control_snapshot;

CREATE TEMP TABLE legacy_access_control_snapshot ON COMMIT DROP AS
SELECT
  p.id,
  jsonb_build_object(
    'role', p.role,
    'group_id', p.group_id,
    'chief_level', p.chief_level,
    'is_coordinator', p.is_coordinator,
    'coordinator_group_ids', p.coordinator_group_ids,
    'account_status', p.account_status,
    'can_publish', p.can_publish,
    'can_create_group_meetings', p.can_create_group_meetings,
    'can_edit_scouts', p.can_edit_scouts,
    'manage_form_templates', p.manage_form_templates,
    'post_forms', p.post_forms,
    'view_all_forms', p.view_all_forms
  ) AS legacy_access
FROM public.user_profiles p;

-- Preserve each Chief's valid primary group and legacy position.
INSERT INTO public.user_group_assignments (
  user_id, group_id, position, is_primary
)
SELECT
  p.id,
  p.group_id,
  CASE p.chief_level
    WHEN 'head' THEN 'head_chief'
    WHEN 'vice' THEN 'vice_chief'
    ELSE 'chief'
  END,
  true
FROM public.user_profiles p
JOIN public.groups g ON g.id = p.group_id
WHERE p.role = 'chief'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_group_assignments uga
    WHERE uga.user_id = p.id
      AND uga.group_id = p.group_id
      AND uga.position = CASE p.chief_level
        WHEN 'head' THEN 'head_chief'
        WHEN 'vice' THEN 'vice_chief'
        ELSE 'chief'
      END
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_group_assignments primary_assignment
    WHERE primary_assignment.user_id = p.id
      AND primary_assignment.is_primary = true
      AND (primary_assignment.expires_at IS NULL OR primary_assignment.expires_at > now())
  );

-- Preserve every valid coordinator group as a separate scoped assignment.
INSERT INTO public.user_group_assignments (
  user_id, group_id, position, is_primary
)
SELECT DISTINCT
  p.id,
  coordinator.group_id,
  'coordinator',
  false
FROM public.user_profiles p
CROSS JOIN LATERAL unnest(COALESCE(p.coordinator_group_ids, '{}'::text[])) AS coordinator(group_id)
JOIN public.groups g ON g.id = coordinator.group_id
WHERE p.role = 'chief'
  AND (p.is_coordinator OR cardinality(COALESCE(p.coordinator_group_ids, '{}'::text[])) > 0)
  AND coordinator.group_id IS DISTINCT FROM p.group_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_group_assignments uga
    WHERE uga.user_id = p.id
      AND uga.group_id = coordinator.group_id
      AND uga.position = 'coordinator'
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  );

-- Legacy administrators receive the sole automatic platform-wide role.
INSERT INTO public.user_role_assignments (
  user_id, role_id, scope_type, scope_id, assignment_reason
)
SELECT p.id, 'system_administrator', 'global', NULL, 'Legacy administrator backfill'
FROM public.user_profiles p
WHERE p.role = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = p.id
      AND ura.role_id = 'system_administrator'
      AND ura.scope_type = 'global'
      AND ura.scope_id IS NULL
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
  );

-- Every active Chief group assignment receives matching group-scoped Chief access.
INSERT INTO public.user_role_assignments (
  user_id, role_id, scope_type, scope_id, assignment_reason
)
SELECT DISTINCT p.id, 'chief', 'group', uga.group_id, 'Legacy Chief group backfill'
FROM public.user_profiles p
JOIN public.user_group_assignments uga ON uga.user_id = p.id
WHERE p.role = 'chief'
  AND uga.starts_at <= now()
  AND (uga.expires_at IS NULL OR uga.expires_at > now())
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = p.id
      AND ura.role_id = 'chief'
      AND ura.scope_type = 'group'
      AND ura.scope_id = uga.group_id
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
  );

-- Chiefs without a valid group retain own-record access and are flagged for review.
INSERT INTO public.user_role_assignments (
  user_id, role_id, scope_type, scope_id, assignment_reason
)
SELECT p.id, 'chief', 'own_records', NULL, 'Legacy Chief without valid group'
FROM public.user_profiles p
WHERE p.role = 'chief'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_group_assignments uga
    WHERE uga.user_id = p.id
      AND uga.starts_at <= now()
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = p.id
      AND ura.role_id = 'chief'
      AND ura.scope_type = 'own_records'
      AND ura.scope_id IS NULL
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
  );

-- Legacy template managers receive Forms Manager only in their assigned groups.
INSERT INTO public.user_role_assignments (
  user_id, role_id, scope_type, scope_id, assignment_reason
)
SELECT DISTINCT p.id, 'forms_manager', 'group', uga.group_id, 'Legacy forms manager backfill'
FROM public.user_profiles p
JOIN public.user_group_assignments uga ON uga.user_id = p.id
WHERE p.manage_form_templates = true
  AND uga.starts_at <= now()
  AND (uga.expires_at IS NULL OR uga.expires_at > now())
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.user_id = p.id
      AND ura.role_id = 'forms_manager'
      AND ura.scope_type = 'group'
      AND ura.scope_id = uga.group_id
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
  );

INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT
  p.id, 'groups', 'groups.view_assigned', 'own_records', NULL,
  true, false, jsonb_build_object('source', 'chief_without_valid_group')
FROM public.user_profiles p
WHERE p.role = 'chief'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_group_assignments uga
    WHERE uga.user_id = p.id
      AND uga.starts_at <= now()
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id
      AND d.module = 'groups'
      AND d.permission_key = 'groups.view_assigned'
      AND d.scope_type = 'own_records'
      AND d.scope_id IS NULL
  );

-- Existing conflicting normalized assignments are preserved and made reviewable.
INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT
  p.id, 'groups', 'groups.assignment.primary', 'group', p.group_id,
  true, false,
  jsonb_build_object(
    'source', 'primary_group_assignment_conflict',
    'expected_position', CASE p.chief_level
      WHEN 'head' THEN 'head_chief'
      WHEN 'vice' THEN 'vice_chief'
      ELSE 'chief'
    END
  )
FROM public.user_profiles p
JOIN public.groups g ON g.id = p.group_id
WHERE p.role = 'chief'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_group_assignments uga
    WHERE uga.user_id = p.id
      AND uga.group_id = p.group_id
      AND uga.is_primary = true
      AND uga.position = CASE p.chief_level
        WHEN 'head' THEN 'head_chief'
        WHEN 'vice' THEN 'vice_chief'
        ELSE 'chief'
      END
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id
      AND d.module = 'groups'
      AND d.permission_key = 'groups.assignment.primary'
      AND d.scope_type = 'group'
      AND d.scope_id = p.group_id
  );

-- These broad legacy booleans are intentionally review-only, never auto-granted.
INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT p.id, 'forms', 'forms.post.approve', 'global', NULL, true, false,
       jsonb_build_object('source', 'post_forms')
FROM public.user_profiles p
WHERE p.post_forms = true
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id AND d.module = 'forms'
      AND d.permission_key = 'forms.post.approve'
      AND d.scope_type = 'global' AND d.scope_id IS NULL
  );

INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT p.id, 'forms', 'forms.responses.view_all', 'global', NULL, true, false,
       jsonb_build_object('source', 'view_all_forms')
FROM public.user_profiles p
WHERE p.view_all_forms = true
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id AND d.module = 'forms'
      AND d.permission_key = 'forms.responses.view_all'
      AND d.scope_type = 'global' AND d.scope_id IS NULL
  );

INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT p.id, 'content', 'content.publish', 'global', NULL, true, false,
       jsonb_build_object('source', 'can_publish')
FROM public.user_profiles p
WHERE p.can_publish = true
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id AND d.module = 'content'
      AND d.permission_key = 'content.publish'
      AND d.scope_type = 'global' AND d.scope_id IS NULL
  );

INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT p.id, 'calendar', 'calendar.create_group_event', 'group', uga.group_id, true, false,
       jsonb_build_object('source', 'can_create_group_meetings')
FROM public.user_profiles p
JOIN public.user_group_assignments uga ON uga.user_id = p.id
WHERE p.can_create_group_meetings = true
  AND uga.starts_at <= now()
  AND (uga.expires_at IS NULL OR uga.expires_at > now())
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id AND d.module = 'calendar'
      AND d.permission_key = 'calendar.create_group_event'
      AND d.scope_type = 'group' AND d.scope_id = uga.group_id
  );

INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT p.id, 'scouts', 'scouts.update', 'group', uga.group_id, true, false,
       jsonb_build_object('source', 'can_edit_scouts')
FROM public.user_profiles p
JOIN public.user_group_assignments uga ON uga.user_id = p.id
WHERE p.can_edit_scouts = true
  AND uga.starts_at <= now()
  AND (uga.expires_at IS NULL OR uga.expires_at > now())
  AND NOT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences d
    WHERE d.user_id = p.id AND d.module = 'scouts'
      AND d.permission_key = 'scouts.update'
      AND d.scope_type = 'group' AND d.scope_id = uga.group_id
  );

-- Preserve explicit legacy overrides as review items. The old table has no
-- scope model, so silently converting these rows to global grants is unsafe.
INSERT INTO public.authorization_migration_differences (
  user_id, module, permission_key, scope_type, scope_id,
  legacy_allowed, normalized_allowed, details
)
SELECT up.user_id, split_part(up.permission_id, '.', 1), up.permission_id,
       'global', NULL, true, false,
       jsonb_build_object('source', 'user_permissions', 'enabled', up.enabled)
FROM public.user_permissions up
JOIN public.permissions permission ON permission.id = up.permission_id
WHERE up.enabled = true
  AND NOT EXISTS (
  SELECT 1 FROM public.authorization_migration_differences d
  WHERE d.user_id = up.user_id
    AND d.permission_key = up.permission_id
    AND d.scope_type = 'global' AND d.scope_id IS NULL
);

-- Fail the call if any legacy authorization value changed.
  IF EXISTS (
    SELECT 1
    FROM legacy_access_control_snapshot before_state
    JOIN public.user_profiles p ON p.id = before_state.id
    WHERE before_state.legacy_access IS DISTINCT FROM jsonb_build_object(
      'role', p.role,
      'group_id', p.group_id,
      'chief_level', p.chief_level,
      'is_coordinator', p.is_coordinator,
      'coordinator_group_ids', p.coordinator_group_ids,
      'account_status', p.account_status,
      'can_publish', p.can_publish,
      'can_create_group_meetings', p.can_create_group_meetings,
      'can_edit_scouts', p.can_edit_scouts,
      'manage_form_templates', p.manage_form_templates,
      'post_forms', p.post_forms,
      'view_all_forms', p.view_all_forms
    )
  ) THEN
    RAISE EXCEPTION 'Legacy authorization fields changed during normalized access backfill';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_legacy_access_control() FROM PUBLIC, anon, authenticated;
SELECT public.backfill_legacy_access_control();

COMMIT;
