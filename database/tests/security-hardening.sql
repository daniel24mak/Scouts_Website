-- Read-only post-deployment assertions for supabase-security-hardening.sql.
BEGIN TRANSACTION READ ONLY;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE id = 'users.reset_password' AND requires_mfa AND is_active
  ), 'users.reset_password permission is missing or not MFA protected';

  ASSERT EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.user_profiles up ON up.id = ura.user_id
    WHERE ura.role_id = 'system_administrator'
      AND ura.scope_type = 'global'
      AND ura.scope_id IS NULL
      AND up.account_status = 'active'
      AND ura.starts_at <= now()
      AND (ura.expires_at IS NULL OR ura.expires_at > now())
  ), 'no active System Administrator remains';

  ASSERT NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id IN ('scouts-files', 'dashboard-documents') AND public
  ), 'a sensitive storage bucket is still public';

  ASSERT NOT has_function_privilege(
    'authenticated',
    'public.notify_admin_users(text,text,text,text,text,text)',
    'EXECUTE'
  ), 'authenticated users can execute notify_admin_users';

  ASSERT NOT has_function_privilege(
    'authenticated',
    'public.mark_entity_notifications_done(text,text,uuid)',
    'EXECUTE'
  ), 'authenticated users can execute mark_entity_notifications_done';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'attendance_record_scope_guard' AND NOT tgisinternal
  ), 'attendance scope guard is missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'protect_last_system_admin_assignment' AND NOT tgisinternal
  ), 'final System Administrator assignment guard is missing';

  ASSERT NOT EXISTS (
    SELECT 1 FROM public.authorization_module_modes
    WHERE module IN ('people_access', 'forms', 'documents', 'archives')
      AND mode <> 'normalized'
  ), 'hardened modules are not normalized';
END $$;

ROLLBACK;
