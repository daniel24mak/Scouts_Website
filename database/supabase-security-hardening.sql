-- Security hardening after the normalized access-control foundation.
-- Run only after foundation, seed, and backfill have completed successfully.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_system_administrator(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id AND r.is_active
      JOIN public.user_profiles up ON up.id = ura.user_id AND up.account_status = 'active'
      WHERE ura.user_id = target_user_id
        AND ura.role_id = 'system_administrator'
        AND ura.scope_type = 'global'
        AND ura.scope_id IS NULL
        AND ura.starts_at <= now()
        AND (ura.expires_at IS NULL OR ura.expires_at > now())
    );
$$;

REVOKE ALL ON FUNCTION public.is_system_administrator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_system_administrator(uuid) TO authenticated;

-- Compatibility wrapper used by older policies. It now resolves only from the
-- protected normalized assignment model and never trusts JWT user metadata.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_system_administrator(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Password recovery is a separate high-risk capability.
INSERT INTO public.permissions (
  id, description, module, action, risk_level, requires_mfa, is_active, updated_at
)
VALUES (
  'users.reset_password',
  'Send a secure password-recovery email to a dashboard user',
  'users', 'reset_password', 'high', true, true, now()
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  requires_mfa = EXCLUDED.requires_mfa,
  is_active = true,
  updated_at = now();

INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
  ('access_administrator', 'users.reset_password'),
  ('system_administrator', 'users.reset_password')
ON CONFLICT DO NOTHING;

-- Notification helpers are trigger-internal, not public RPC endpoints.
REVOKE ALL ON FUNCTION public.notify_admin_users(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_entity_notifications_done(text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Some resources (for example a form template) do not carry a group column even
-- though the user's role is group-scoped. This helper proves the permission in
-- at least one currently assigned group without widening it to a global grant.
CREATE OR REPLACE FUNCTION public.has_permission_in_any_assigned_group(target_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.has_permission(target_permission)
    OR EXISTS (
      SELECT 1
      FROM public.user_group_assignments uga
      WHERE uga.user_id = auth.uid()
        AND uga.starts_at <= now()
        AND (uga.expires_at IS NULL OR uga.expires_at > now())
        AND public.has_permission_for_group(target_permission, uga.group_id)
    );
$$;

REVOKE ALL ON FUNCTION public.has_permission_in_any_assigned_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission_in_any_assigned_group(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_fill_posted_form(target_posted_form_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.has_permission_in_any_assigned_group('forms.fill')
    AND EXISTS (
      SELECT 1
      FROM public.posted_forms pf
      WHERE pf.id = target_posted_form_id
        AND pf.status = 'open'
        AND (
          pf.target_type = 'all_chiefs'
          OR (pf.target_type = 'users' AND auth.uid() = ANY(pf.target_user_ids))
          OR (
            pf.target_type = 'groups'
            AND EXISTS (
              SELECT 1
              FROM unnest(pf.target_group_ids) target_group_id
              WHERE public.has_group_access(target_group_id)
                AND public.has_permission_for_group('forms.fill', target_group_id)
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_fill_posted_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_fill_posted_form(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_assigned_posted_form(target_posted_form_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.has_permission_in_any_assigned_group('forms.fill')
    AND EXISTS (
      SELECT 1
      FROM public.posted_forms pf
      WHERE pf.id = target_posted_form_id
        AND pf.status IN ('open', 'closed')
        AND (
          pf.target_type = 'all_chiefs'
          OR (pf.target_type = 'users' AND auth.uid() = ANY(pf.target_user_ids))
          OR (
            pf.target_type = 'groups'
            AND EXISTS (
              SELECT 1
              FROM unnest(pf.target_group_ids) target_group_id
              WHERE public.has_group_access(target_group_id)
                AND public.has_permission_for_group('forms.fill', target_group_id)
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_assigned_posted_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_assigned_posted_form(uuid) TO authenticated;

-- Sensitive files must never be served through public object URLs.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY[
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
WHERE id = 'scouts-files';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
WHERE id = 'dashboard-documents';

DROP POLICY IF EXISTS "public read scouts files" ON storage.objects;
DROP POLICY IF EXISTS "logged in users upload scouts files" ON storage.objects;
DROP POLICY IF EXISTS "admins upload scouts files" ON storage.objects;
DROP POLICY IF EXISTS "authorized users upload scouts files" ON storage.objects;
DROP POLICY IF EXISTS "authorized users read scouts files" ON storage.objects;
DROP POLICY IF EXISTS "authorized users delete scouts files" ON storage.objects;
CREATE POLICY "authorized users upload scouts files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scouts-files'
    AND public.has_permission('registered_scouts.upload')
    AND owner = auth.uid()
  );
CREATE POLICY "authorized users read scouts files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scouts-files' AND public.has_permission('registered_scouts.upload'));
CREATE POLICY "authorized users delete scouts files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'scouts-files' AND public.has_permission('registered_scouts.upload'));

DROP POLICY IF EXISTS "admins upload dashboard documents" ON storage.objects;
DROP POLICY IF EXISTS "admins delete dashboard documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated read dashboard documents" ON storage.objects;
DROP POLICY IF EXISTS "authorized users upload dashboard documents" ON storage.objects;
DROP POLICY IF EXISTS "authorized users read dashboard documents" ON storage.objects;
DROP POLICY IF EXISTS "authorized users delete dashboard documents" ON storage.objects;
CREATE POLICY "authorized users upload dashboard documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dashboard-documents' AND public.has_permission('documents.upload') AND owner = auth.uid());
CREATE POLICY "authorized users read dashboard documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dashboard-documents'
    AND public.has_permission_in_any_assigned_group('documents.view')
  );
CREATE POLICY "authorized users delete dashboard documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dashboard-documents' AND public.has_permission('documents.delete'));

DROP POLICY IF EXISTS "logged in users read registration uploads" ON public.registration_uploads;
DROP POLICY IF EXISTS "authorized users read registration uploads" ON public.registration_uploads;
CREATE POLICY "authorized users read registration uploads" ON public.registration_uploads
  FOR SELECT TO authenticated
  USING (public.has_permission('registered_scouts.upload'));

DROP POLICY IF EXISTS "authenticated read documents" ON public.documents;
DROP POLICY IF EXISTS "authorized users read documents" ON public.documents;
CREATE POLICY "authorized users read documents" ON public.documents
  FOR SELECT TO authenticated
  USING (public.has_permission_in_any_assigned_group('documents.view'));

DROP POLICY IF EXISTS "authenticated read document categories" ON public.document_categories;
DROP POLICY IF EXISTS "authorized users read document categories" ON public.document_categories;
CREATE POLICY "authorized users read document categories" ON public.document_categories
  FOR SELECT TO authenticated
  USING (public.has_permission_in_any_assigned_group('documents.view'));

DROP POLICY IF EXISTS "authenticated read archived years" ON public.archived_years;
DROP POLICY IF EXISTS "authorized users read archived years" ON public.archived_years;
CREATE POLICY "authorized users read archived years" ON public.archived_years
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.has_permission_in_any_assigned_group('archived_years.view')
  );

-- Form ownership is not itself an administrative permission.
DROP POLICY IF EXISTS "form templates visible" ON public.form_templates;
CREATE POLICY "form templates visible" ON public.form_templates
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_permission('forms.templates.view')
    OR public.has_permission('forms.templates.manage')
  );

DROP POLICY IF EXISTS "form templates managed" ON public.form_templates;
DROP POLICY IF EXISTS "form templates insert authorized" ON public.form_templates;
DROP POLICY IF EXISTS "form templates update authorized" ON public.form_templates;
DROP POLICY IF EXISTS "form templates delete authorized" ON public.form_templates;
CREATE POLICY "form templates insert authorized" ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.create'));
CREATE POLICY "form templates update authorized" ON public.form_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  )
  WITH CHECK (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  );
CREATE POLICY "form templates delete authorized" ON public.form_templates
  FOR DELETE TO authenticated
  USING (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  );

DROP POLICY IF EXISTS "form template versions managed" ON public.form_template_versions;
DROP POLICY IF EXISTS "form template versions visible" ON public.form_template_versions;
CREATE POLICY "form template versions visible" ON public.form_template_versions
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_permission('forms.templates.view')
    OR public.has_permission('forms.templates.manage')
  );

DROP POLICY IF EXISTS "form template versions insert authorized" ON public.form_template_versions;
DROP POLICY IF EXISTS "form template versions update authorized" ON public.form_template_versions;
DROP POLICY IF EXISTS "form template versions delete authorized" ON public.form_template_versions;
CREATE POLICY "form template versions insert authorized" ON public.form_template_versions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.create'));
CREATE POLICY "form template versions update authorized" ON public.form_template_versions
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  )
  WITH CHECK (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  );
CREATE POLICY "form template versions delete authorized" ON public.form_template_versions
  FOR DELETE TO authenticated
  USING (
    public.has_permission('forms.templates.manage')
    OR (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.templates.manage'))
  );

DROP POLICY IF EXISTS "posted forms managed" ON public.posted_forms;
DROP POLICY IF EXISTS "posted forms visible" ON public.posted_forms;
CREATE POLICY "posted forms visible" ON public.posted_forms
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_permission('forms.post.approve')
    OR public.has_permission('forms.responses.view_all')
    OR public.can_view_assigned_posted_form(id)
  );

DROP POLICY IF EXISTS "posted forms insert authorized" ON public.posted_forms;
DROP POLICY IF EXISTS "posted forms update authorized" ON public.posted_forms;
DROP POLICY IF EXISTS "posted forms delete authorized" ON public.posted_forms;
CREATE POLICY "posted forms insert authorized" ON public.posted_forms
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_permission_in_any_assigned_group('forms.post.request'));
CREATE POLICY "posted forms update authorized" ON public.posted_forms
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('forms.post.approve')
    OR public.has_permission('forms.close')
    OR public.has_permission('forms.reopen')
    OR (created_by = auth.uid() AND status IN ('draft', 'pending') AND public.has_permission_in_any_assigned_group('forms.post.request'))
  )
  WITH CHECK (
    public.has_permission('forms.post.approve')
    OR public.has_permission('forms.close')
    OR public.has_permission('forms.reopen')
    OR (created_by = auth.uid() AND status IN ('draft', 'pending') AND public.has_permission_in_any_assigned_group('forms.post.request'))
  );
CREATE POLICY "posted forms delete authorized" ON public.posted_forms
  FOR DELETE TO authenticated
  USING (public.has_permission('forms.delete_posted'));

DROP POLICY IF EXISTS "form submissions visible" ON public.form_submissions;
DROP POLICY IF EXISTS "form submissions visible authorized" ON public.form_submissions;
CREATE POLICY "form submissions visible authorized" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.has_permission('forms.responses.view_all')
    OR (
      public.has_permission_for_group('forms.responses.view_group', group_id)
      AND public.has_group_access(group_id)
    )
  );

DROP POLICY IF EXISTS "form submissions insert own open forms" ON public.form_submissions;
CREATE POLICY "form submissions insert own open forms" ON public.form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.can_fill_posted_form(posted_form_id)
  );

DROP POLICY IF EXISTS "form submissions update own open forms" ON public.form_submissions;
CREATE POLICY "form submissions update own open forms" ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    AND public.can_fill_posted_form(posted_form_id)
    AND (
      status = 'draft'
      OR EXISTS (
        SELECT 1
        FROM public.posted_forms pf
        WHERE pf.id = posted_form_id
          AND pf.allow_edits
      )
    )
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.can_fill_posted_form(posted_form_id)
  );

-- Prevent cross-group/equipe attendance associations even through direct REST calls.
CREATE OR REPLACE FUNCTION public.validate_attendance_record_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  session_row public.attendance_sessions%ROWTYPE;
  scout_row public.scouts%ROWTYPE;
BEGIN
  SELECT * INTO session_row FROM public.attendance_sessions WHERE id = NEW.session_id;
  SELECT * INTO scout_row FROM public.scouts WHERE id = NEW.scout_id;
  IF session_row.id IS NULL OR scout_row.id IS NULL THEN
    RAISE EXCEPTION 'Attendance session or scout does not exist';
  END IF;
  IF scout_row.group_id IS DISTINCT FROM session_row.group_id THEN
    RAISE EXCEPTION 'Scout does not belong to the attendance session group';
  END IF;
  IF session_row.scope = 'equipe' AND scout_row.equipe_id IS DISTINCT FROM session_row.equipe_id THEN
    RAISE EXCEPTION 'Scout does not belong to the attendance session equipe';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_record_scope_guard ON public.attendance_records;
CREATE TRIGGER attendance_record_scope_guard
BEFORE INSERT OR UPDATE OF session_id, scout_id ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_record_scope();

REVOKE ALL ON FUNCTION public.validate_attendance_record_scope() FROM PUBLIC, anon, authenticated;

-- Protected roles cannot be disabled or deleted.
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.is_system_role AND (TG_OP = 'DELETE' OR NEW.id IS DISTINCT FROM OLD.id OR NOT NEW.is_active) THEN
    RAISE EXCEPTION 'Protected system roles cannot be deleted, renamed, or disabled';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS protect_system_roles_guard ON public.roles;
CREATE TRIGGER protect_system_roles_guard
BEFORE UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- Preserve at least one active global System Administrator.
CREATE OR REPLACE FUNCTION public.protect_last_system_administrator()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  removes_access boolean := false;
  remaining_count integer;
  target_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'user_role_assignments' THEN
    target_user_id := OLD.user_id;
    removes_access := OLD.role_id = 'system_administrator'
      AND OLD.scope_type = 'global'
      AND OLD.scope_id IS NULL
      AND OLD.starts_at <= now()
      AND (OLD.expires_at IS NULL OR OLD.expires_at > now())
      AND (
        TG_OP = 'DELETE'
        OR NEW.role_id IS DISTINCT FROM OLD.role_id
        OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
        OR NEW.scope_id IS DISTINCT FROM OLD.scope_id
        OR (NEW.expires_at IS NOT NULL AND NEW.expires_at <= now())
      );
  ELSE
    target_user_id := OLD.id;
    removes_access := OLD.account_status = 'active'
      AND (TG_OP = 'DELETE' OR NEW.account_status <> 'active')
      AND EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        WHERE ura.user_id = OLD.id AND ura.role_id = 'system_administrator'
          AND ura.scope_type = 'global' AND ura.scope_id IS NULL
          AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now())
      );
  END IF;

  IF removes_access THEN
    SELECT count(*) INTO remaining_count
    FROM public.user_role_assignments ura
    JOIN public.user_profiles up ON up.id = ura.user_id AND up.account_status = 'active'
    WHERE ura.role_id = 'system_administrator'
      AND ura.scope_type = 'global' AND ura.scope_id IS NULL
      AND ura.user_id <> target_user_id
      AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now());
    IF remaining_count = 0 THEN
      RAISE EXCEPTION 'The final active System Administrator cannot be removed or disabled';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_system_admin_assignment ON public.user_role_assignments;
CREATE TRIGGER protect_last_system_admin_assignment
BEFORE UPDATE OR DELETE ON public.user_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.protect_last_system_administrator();

DROP TRIGGER IF EXISTS protect_last_system_admin_profile ON public.user_profiles;
CREATE TRIGGER protect_last_system_admin_profile
BEFORE UPDATE OF account_status OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_system_administrator();

REVOKE ALL ON FUNCTION public.protect_system_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_last_system_administrator() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS scouts_scope_lookup_idx
  ON public.scouts (scout_year_id, group_id, equipe_id);
CREATE INDEX IF NOT EXISTS scout_equipe_assignments_scope_idx
  ON public.scout_equipe_assignments (scout_id, equipe_id, group_id);
CREATE INDEX IF NOT EXISTS equipe_leaders_chief_idx
  ON public.equipe_leaders (chief_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS registration_uploads_year_uploader_idx
  ON public.registration_uploads (scout_year_id, uploaded_by);
CREATE INDEX IF NOT EXISTS user_group_assignments_user_active_idx
  ON public.user_group_assignments (user_id, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS authorization_migration_user_unresolved_idx
  ON public.authorization_migration_differences (user_id, created_at DESC)
  WHERE resolved_at IS NULL;

UPDATE public.authorization_module_modes
SET mode = 'normalized', updated_at = now()
WHERE module IN ('people_access', 'forms', 'documents', 'archives');

COMMIT;
