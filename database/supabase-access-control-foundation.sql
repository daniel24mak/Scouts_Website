-- Additive normalized access-control foundation.
-- This release is shadow-only: existing authorization remains authoritative.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS is_system_role boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS requires_mfa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS ip_address_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_summary text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_risk_level_check' AND conrelid = 'public.roles'::regclass) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_risk_level_check CHECK (risk_level IN ('standard', 'elevated', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'permissions_risk_level_check' AND conrelid = 'public.permissions'::regclass) THEN
    ALTER TABLE public.permissions
      ADD CONSTRAINT permissions_risk_level_check CHECK (risk_level IN ('standard', 'elevated', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_account_status_check' AND conrelid = 'public.user_profiles'::regclass) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_account_status_check
      CHECK (account_status IN ('invited', 'active', 'disabled', 'suspended', 'archived')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assignment_reason text NOT NULL DEFAULT 'Legacy migration',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.user_group_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('chief','vice_chief','head_chief','coordinator','equipe_leader','assistant')),
  is_primary boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (length(btrim(key)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  team_type text NOT NULL DEFAULT 'committee',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('member','assistant','coordinator','manager')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  added_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permissions(id) ON DELETE RESTRICT,
  effect text NOT NULL CHECK (effect IN ('allow','deny')),
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  assigned_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.authorization_migration_differences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  permission_key text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('global','group','team','event','own_records')),
  scope_id text,
  resource_type text,
  resource_id text,
  legacy_allowed boolean NOT NULL,
  normalized_allowed boolean NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolution_note text,
  CHECK (legacy_allowed IS DISTINCT FROM normalized_allowed),
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND length(scope_id) > 0 AND scope_id = btrim(scope_id)))
);

CREATE TABLE IF NOT EXISTS public.authorization_module_modes (
  module text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode IN ('legacy','shadow','normalized')),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  review_type text NOT NULL,
  status text NOT NULL DEFAULT 'review_required'
    CHECK (status IN ('review_required','confirmed','remove_access','pending_clarification')),
  findings jsonb NOT NULL DEFAULT '{}',
  due_at timestamptz,
  reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.authorization_module_modes (module, mode)
VALUES
  ('dashboard', 'shadow'),
  ('forms', 'shadow'),
  ('content', 'shadow'),
  ('media', 'shadow'),
  ('scouts', 'shadow'),
  ('attendance', 'shadow'),
  ('equipes', 'shadow'),
  ('documents', 'shadow'),
  ('reports', 'shadow'),
  ('archives', 'shadow'),
  ('contact_messages', 'shadow'),
  ('website_content', 'shadow'),
  ('people_access', 'shadow'),
  ('finance', 'shadow'),
  ('storage', 'shadow')
ON CONFLICT (module) DO UPDATE
SET mode = 'shadow', updated_by = NULL, updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_assignments_no_overlap' AND conrelid = 'public.user_role_assignments'::regclass) THEN
    ALTER TABLE public.user_role_assignments
      ADD CONSTRAINT user_role_assignments_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        role_id WITH =,
        scope_type WITH =,
        (COALESCE(scope_id, '')) WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_group_assignments_no_overlap' AND conrelid = 'public.user_group_assignments'::regclass) THEN
    ALTER TABLE public.user_group_assignments
      ADD CONSTRAINT user_group_assignments_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        group_id WITH =,
        position WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_group_assignments_primary_no_overlap' AND conrelid = 'public.user_group_assignments'::regclass) THEN
    ALTER TABLE public.user_group_assignments
      ADD CONSTRAINT user_group_assignments_primary_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      ) WHERE (is_primary);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_team_memberships_no_overlap' AND conrelid = 'public.user_team_memberships'::regclass) THEN
    ALTER TABLE public.user_team_memberships
      ADD CONSTRAINT user_team_memberships_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        team_id WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_permission_overrides_no_overlap' AND conrelid = 'public.user_permission_overrides'::regclass) THEN
    ALTER TABLE public.user_permission_overrides
      ADD CONSTRAINT user_permission_overrides_no_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        permission_id WITH =,
        effect WITH =,
        scope_type WITH =,
        (COALESCE(scope_id, '')) WITH =,
        tstzrange(starts_at, COALESCE(expires_at, 'infinity'::timestamptz), '[)') WITH &&
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_current_unique
  ON public.user_role_assignments (user_id, role_id, scope_type, COALESCE(scope_id, ''))
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_current_unique
  ON public.user_group_assignments (user_id, group_id, position)
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_primary_unique
  ON public.user_group_assignments (user_id)
  WHERE is_primary AND expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_team_memberships_current_unique
  ON public.user_team_memberships (user_id, team_id)
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_current_unique
  ON public.user_permission_overrides (user_id, permission_id, effect, scope_type, COALESCE(scope_id, ''))
  WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS user_role_assignments_user_active_idx
  ON public.user_role_assignments (user_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS user_role_assignments_scope_idx
  ON public.user_role_assignments (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON public.role_permissions (permission_id, role_id);
CREATE INDEX IF NOT EXISTS user_group_assignments_group_idx
  ON public.user_group_assignments (group_id, user_id);
CREATE INDEX IF NOT EXISTS user_team_memberships_user_idx
  ON public.user_team_memberships (user_id, team_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx
  ON public.user_permission_overrides (user_id, permission_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS authorization_migration_unresolved_idx
  ON public.authorization_migration_differences (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_migration_differences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_module_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_dashboard_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_required_aal(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (
      SELECT NOT p.requires_mfa
        OR COALESCE(
          auth.jwt() ->> 'aal' = 'aal2',
          false
        )
      FROM public.permissions p
      WHERE p.id = target_permission
        AND p.is_active
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND ura.scope_type = 'global'
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND upo.scope_type = 'global'
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_global_permission(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND ura.scope_type = 'global'
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND upo.scope_type = 'global'
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_group_access(target_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_group_assignments uga
      WHERE uga.user_id = auth.uid()
        AND uga.group_id = target_group_id
        AND uga.starts_at <= now()
        AND (uga.expires_at IS NULL OR uga.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_team_access(target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.user_team_memberships utm
      JOIN public.teams t ON t.id = utm.team_id AND t.is_active
      WHERE utm.user_id = auth.uid()
        AND utm.team_id = target_team_id
        AND utm.starts_at <= now()
        AND (utm.expires_at IS NULL OR utm.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_group(target_permission text, target_group_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'group' AND ura.scope_id = target_group_id)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_team(target_permission text, target_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = target_team_id
        AND t.is_active
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'team' AND ura.scope_id = target_team_id::text)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_event(target_permission text, target_event_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND rp.permission_id = target_permission
          AND (
            ura.scope_type = 'global'
            OR (ura.scope_type = 'event' AND ura.scope_id = target_event_id)
          )
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (
            upo.scope_type = 'global'
            OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id)
          )
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (
          upo.scope_type = 'global'
          OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id)
        )
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    )
    AND public.has_required_aal(target_permission);
$$;

CREATE OR REPLACE FUNCTION public.get_my_effective_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  account_status_value text;
  role_items jsonb := '[]'::jsonb;
  permission_items jsonb := '[]'::jsonb;
  group_items jsonb := '[]'::jsonb;
  team_items jsonb := '[]'::jsonb;
  restriction_items jsonb := '[]'::jsonb;
BEGIN
  SELECT p.account_status
  INTO account_status_value
  FROM public.user_profiles p
  WHERE p.id = auth.uid();

  IF account_status_value IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object(
      'accountStatus', COALESCE(account_status_value, 'missing'),
      'roles', role_items,
      'permissions', permission_items,
      'groupAssignments', group_items,
      'teamMemberships', team_items,
      'restrictions', restriction_items,
      'generatedAt', now()
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', ura.role_id,
        'scopeType', ura.scope_type,
        'scopeId', ura.scope_id,
        'expiresAt', ura.expires_at
      )
      ORDER BY ura.role_id, ura.scope_type, COALESCE(ura.scope_id, '')
    ),
    '[]'::jsonb
  )
  INTO role_items
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id AND r.is_active
  WHERE ura.user_id = auth.uid()
    AND ura.starts_at <= now()
    AND (ura.expires_at IS NULL OR ura.expires_at > now())
    AND (
      ura.scope_type <> 'team'
      OR EXISTS (
        SELECT 1 FROM public.teams scoped_team
        WHERE scoped_team.id::text = ura.scope_id AND scoped_team.is_active
      )
    );

  WITH candidates AS (
    SELECT
      rp.permission_id AS permission_key,
      ura.scope_type,
      ura.scope_id,
      ura.role_id AS source,
      ura.expires_at,
      p.requires_mfa
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active
    WHERE ura.user_id = auth.uid()
      AND ura.starts_at <= now()
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
      AND (
        ura.scope_type <> 'team'
        OR EXISTS (
          SELECT 1 FROM public.teams scoped_team
          WHERE scoped_team.id::text = ura.scope_id AND scoped_team.is_active
        )
      )

    UNION ALL

    SELECT
      upo.permission_id,
      upo.scope_type,
      upo.scope_id,
      'override'::text,
      upo.expires_at,
      p.requires_mfa
    FROM public.user_permission_overrides upo
    JOIN public.permissions p ON p.id = upo.permission_id AND p.is_active
    WHERE upo.user_id = auth.uid()
      AND upo.effect = 'allow'
      AND upo.starts_at <= now()
      AND (upo.expires_at IS NULL OR upo.expires_at > now())
      AND (
        upo.scope_type <> 'team'
        OR EXISTS (
          SELECT 1 FROM public.teams scoped_team
          WHERE scoped_team.id::text = upo.scope_id AND scoped_team.is_active
        )
      )
  ), effective AS (
    SELECT DISTINCT
      candidate.permission_key,
      candidate.scope_type,
      candidate.scope_id,
      candidate.source,
      candidate.expires_at,
      candidate.requires_mfa
    FROM candidates candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides denied
      WHERE denied.user_id = auth.uid()
        AND denied.permission_id = candidate.permission_key
        AND denied.effect = 'deny'
        AND denied.starts_at <= now()
        AND (denied.expires_at IS NULL OR denied.expires_at > now())
        AND (
          denied.scope_type = 'global'
          OR (
            denied.scope_type = candidate.scope_type
            AND denied.scope_id IS NOT DISTINCT FROM candidate.scope_id
          )
        )
    )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', effective.permission_key,
        'scopeType', effective.scope_type,
        'scopeId', effective.scope_id,
        'source', effective.source,
        'expiresAt', effective.expires_at,
        'requiresMfa', effective.requires_mfa
      )
      ORDER BY effective.permission_key, effective.scope_type, COALESCE(effective.scope_id, ''), effective.source
    ),
    '[]'::jsonb
  )
  INTO permission_items
  FROM effective;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'groupId', uga.group_id,
        'position', uga.position,
        'isPrimary', uga.is_primary,
        'expiresAt', uga.expires_at
      )
      ORDER BY uga.is_primary DESC, uga.group_id, uga.position
    ),
    '[]'::jsonb
  )
  INTO group_items
  FROM public.user_group_assignments uga
  WHERE uga.user_id = auth.uid()
    AND uga.starts_at <= now()
    AND (uga.expires_at IS NULL OR uga.expires_at > now());

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'teamId', utm.team_id,
        'key', t.key,
        'position', utm.position,
        'expiresAt', utm.expires_at
      )
      ORDER BY t.key, utm.position
    ),
    '[]'::jsonb
  )
  INTO team_items
  FROM public.user_team_memberships utm
  JOIN public.teams t ON t.id = utm.team_id AND t.is_active
  WHERE utm.user_id = auth.uid()
    AND utm.starts_at <= now()
    AND (utm.expires_at IS NULL OR utm.expires_at > now());

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', upo.permission_id,
        'effect', upo.effect,
        'scopeType', upo.scope_type,
        'scopeId', upo.scope_id,
        'expiresAt', upo.expires_at
      )
      ORDER BY upo.permission_id, upo.scope_type, COALESCE(upo.scope_id, '')
    ),
    '[]'::jsonb
  )
  INTO restriction_items
  FROM public.user_permission_overrides upo
  JOIN public.permissions p ON p.id = upo.permission_id AND p.is_active
  WHERE upo.user_id = auth.uid()
    AND upo.effect = 'deny'
    AND upo.starts_at <= now()
    AND (upo.expires_at IS NULL OR upo.expires_at > now())
    AND (
      upo.scope_type <> 'team'
      OR EXISTS (
        SELECT 1 FROM public.teams scoped_team
        WHERE scoped_team.id::text = upo.scope_id AND scoped_team.is_active
      )
    );

  RETURN jsonb_build_object(
    'accountStatus', account_status_value,
    'roles', role_items,
    'permissions', permission_items,
    'groupAssignments', group_items,
    'teamMemberships', team_items,
    'restrictions', restriction_items,
    'generatedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM anon;
REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM anon;

REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_required_aal(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_global_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_group_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_group(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_team(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_event(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_legacy_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_legacy_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_legacy_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_legacy_admin() TO authenticated;

DROP POLICY IF EXISTS "active users read active roles" ON public.roles;
CREATE POLICY "active users read active roles" ON public.roles
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read active permissions" ON public.permissions;
CREATE POLICY "active users read active permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read role permissions" ON public.role_permissions;
CREATE POLICY "active users read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.is_active_dashboard_user());

DROP POLICY IF EXISTS "active users read active teams" ON public.teams;
CREATE POLICY "active users read active teams" ON public.teams
  FOR SELECT TO authenticated
  USING (is_active AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own role assignments" ON public.user_role_assignments;
CREATE POLICY "users read own role assignments" ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own group assignments" ON public.user_group_assignments;
CREATE POLICY "users read own group assignments" ON public.user_group_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own team memberships" ON public.user_team_memberships;
CREATE POLICY "users read own team memberships" ON public.user_team_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "users read own permission overrides" ON public.user_permission_overrides;
CREATE POLICY "users read own permission overrides" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_dashboard_user());

DROP POLICY IF EXISTS "legacy admins read migration differences" ON public.authorization_migration_differences;
CREATE POLICY "legacy admins read migration differences" ON public.authorization_migration_differences
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "legacy admins read authorization modes" ON public.authorization_module_modes;
CREATE POLICY "legacy admins read authorization modes" ON public.authorization_module_modes
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "legacy admins read access reviews" ON public.access_reviews;
CREATE POLICY "legacy admins read access reviews" ON public.access_reviews
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "admins manage audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "legacy admins read audit logs" ON public.audit_logs;
CREATE POLICY "legacy admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_active_legacy_admin());

DROP POLICY IF EXISTS "active users append own audit logs" ON public.audit_logs;
CREATE POLICY "active users append own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.is_active_dashboard_user());

REVOKE ALL ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
FROM anon;

REVOKE ALL ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
FROM authenticated;

GRANT SELECT ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_role_assignments,
  public.user_group_assignments,
  public.teams,
  public.user_team_memberships,
  public.user_permission_overrides,
  public.authorization_migration_differences,
  public.authorization_module_modes,
  public.access_reviews,
  public.audit_logs
TO authenticated;

GRANT INSERT ON TABLE public.audit_logs TO authenticated;

COMMIT;
