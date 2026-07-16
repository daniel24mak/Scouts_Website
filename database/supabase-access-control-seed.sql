-- Idempotent protected role, permission, and operational team seed.
-- Finance and Storage are catalogued but never assigned to users by this script.

BEGIN;

-- BEGIN PERMISSION CATALOGUE
WITH desired_access_control_permissions (permission_id, risk_level, requires_mfa) AS (
VALUES
  ('dashboard.access', 'standard', false),
  ('notifications.view', 'standard', false),
  ('ai.use', 'standard', false),
  ('groups.view_assigned', 'standard', false),
  ('groups.manage', 'elevated', false),
  ('scouts.view', 'standard', false),
  ('scouts.create', 'standard', false),
  ('scouts.update', 'standard', false),
  ('scouts.move_group', 'elevated', false),
  ('scouts.archive', 'elevated', false),
  ('scouts.export', 'elevated', false),
  ('registered_scouts.upload', 'elevated', false),
  ('attendance.view', 'standard', false),
  ('attendance.record', 'standard', false),
  ('attendance.correct', 'elevated', false),
  ('attendance.delete_session', 'high', true),
  ('attendance.export', 'elevated', false),
  ('chief_attendance.view', 'standard', false),
  ('chief_attendance.manage', 'elevated', false),
  ('equipes.view', 'standard', false),
  ('equipes.create', 'standard', false),
  ('equipes.update', 'standard', false),
  ('equipes.assign_scouts', 'elevated', false),
  ('equipes.delete', 'high', true),
  ('forms.fill', 'standard', false),
  ('forms.view_own_submissions', 'standard', false),
  ('forms.create', 'standard', false),
  ('forms.templates.view', 'standard', false),
  ('forms.templates.manage', 'elevated', false),
  ('forms.post.request', 'standard', false),
  ('forms.post.approve', 'elevated', false),
  ('forms.close', 'elevated', false),
  ('forms.reopen', 'elevated', false),
  ('forms.responses.view_group', 'elevated', false),
  ('forms.responses.view_all', 'high', true),
  ('forms.responses.export', 'high', true),
  ('forms.delete_posted', 'high', true),
  ('calendar.view', 'standard', false),
  ('calendar.create_group_event', 'standard', false),
  ('calendar.create_public_event', 'elevated', false),
  ('calendar.update_own', 'standard', false),
  ('calendar.update_all', 'elevated', false),
  ('calendar.approve', 'elevated', false),
  ('calendar.delete', 'high', true),
  ('content.create', 'standard', false),
  ('content.submit', 'standard', false),
  ('content.edit_own', 'standard', false),
  ('content.edit_all', 'elevated', false),
  ('content.approve', 'elevated', false),
  ('content.publish', 'elevated', false),
  ('content.delete', 'high', true),
  ('media.view', 'standard', false),
  ('media.upload', 'standard', false),
  ('media.edit_own', 'standard', false),
  ('media.edit_all', 'elevated', false),
  ('media.approve', 'elevated', false),
  ('media.publish', 'elevated', false),
  ('media.delete', 'high', true),
  ('albums.create', 'standard', false),
  ('albums.manage', 'elevated', false),
  ('finance.view', 'standard', false),
  ('finance.create_transaction', 'standard', false),
  ('finance.edit_own_transaction', 'standard', false),
  ('finance.edit_all_transactions', 'elevated', false),
  ('finance.upload_receipt', 'standard', false),
  ('finance.approve_transaction', 'high', true),
  ('finance.export', 'high', true),
  ('finance.manage_categories', 'high', true),
  ('finance.manage_settings', 'high', true),
  ('storage.view', 'standard', false),
  ('storage.create_item', 'standard', false),
  ('storage.update_item', 'standard', false),
  ('storage.issue_items', 'standard', false),
  ('storage.record_returns', 'standard', false),
  ('storage.adjust_quantity', 'high', true),
  ('storage.write_off', 'high', true),
  ('storage.audit', 'high', true),
  ('storage.export', 'high', true),
  ('storage.manage_categories', 'high', true),
  ('documents.view', 'standard', false),
  ('documents.upload', 'standard', false),
  ('documents.edit', 'standard', false),
  ('documents.delete', 'high', true),
  ('documents.manage_permissions', 'high', true),
  ('reports.view', 'standard', false),
  ('reports.generate', 'standard', false),
  ('reports.export', 'high', true),
  ('archived_years.view', 'standard', false),
  ('archived_years.manage', 'high', true),
  ('contact_messages.view', 'standard', false),
  ('contact_messages.respond', 'standard', false),
  ('contact_messages.archive', 'standard', false),
  ('contact_messages.delete', 'high', true),
  ('website_content.view', 'standard', false),
  ('website_content.edit', 'standard', false),
  ('website_content.approve', 'elevated', false),
  ('users.view', 'standard', false),
  ('users.invite', 'elevated', false),
  ('users.update_profile', 'elevated', false),
  ('users.reset_password', 'high', true),
  ('users.disable', 'high', true),
  ('users.reactivate', 'high', true),
  ('users.delete', 'high', true),
  ('users.revoke_sessions', 'high', true),
  ('users.assign_roles', 'high', true),
  ('users.assign_groups', 'elevated', false),
  ('users.assign_teams', 'elevated', false),
  ('roles.view', 'standard', false),
  ('roles.create', 'high', true),
  ('roles.update', 'high', true),
  ('roles.delete', 'high', true),
  ('permissions.manage', 'high', true),
  ('audit_logs.view', 'elevated', false),
  ('system_settings.view', 'standard', false),
  ('system_settings.manage', 'high', true)
)
-- END PERMISSION CATALOGUE

INSERT INTO public.permissions (
  id, description, module, action, risk_level, requires_mfa, is_active, updated_at
)
SELECT
  permission_id,
  initcap(replace(replace(permission_id, '.', ' '), '_', ' ')),
  split_part(permission_id, '.', 1),
  substring(permission_id from position('.' in permission_id) + 1),
  risk_level,
  requires_mfa,
  true,
  now()
FROM desired_access_control_permissions
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  risk_level = EXCLUDED.risk_level,
  requires_mfa = EXCLUDED.requires_mfa,
  is_active = true,
  updated_at = now();

INSERT INTO public.roles (
  id, name, description, category, is_system_role, is_active, risk_level, updated_at
) VALUES
  ('admin', 'Admin', 'Legacy administrator compatibility role', 'legacy', true, true, 'high', now()),
  ('chief', 'Chief', 'Baseline access for active group chiefs', 'scouting', true, true, 'standard', now()),
  ('media_contributor', 'Media Contributor', 'Creates and submits owned content and media', 'content', true, true, 'standard', now()),
  ('media_manager', 'Media Manager', 'Manages media and gallery publishing', 'content', true, true, 'elevated', now()),
  ('finance_viewer', 'Finance Viewer', 'Read-only Finance module access', 'finance', true, true, 'standard', now()),
  ('finance_contributor', 'Finance Contributor', 'Creates and maintains owned Finance transactions', 'finance', true, true, 'elevated', now()),
  ('finance_approver', 'Finance Approver', 'Approves and exports Finance transactions', 'finance', true, true, 'high', now()),
  ('storage_assistant', 'Storage Assistant', 'Issues and records returns of inventory items', 'storage', true, true, 'standard', now()),
  ('storage_manager', 'Storage Manager', 'Manages the complete inventory lifecycle', 'storage', true, true, 'high', now()),
  ('forms_manager', 'Forms Manager', 'Creates templates and requests form posting', 'forms', true, true, 'elevated', now()),
  ('content_approver', 'Content Approver', 'Approves and publishes content and media', 'content', true, true, 'high', now()),
  ('access_administrator', 'Access Administrator', 'Manages normal users and scoped access assignments', 'system', true, true, 'high', now()),
  ('system_administrator', 'System Administrator', 'Protected recovery role with every seeded permission', 'system', true, true, 'high', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_system_role = EXCLUDED.is_system_role,
  is_active = EXCLUDED.is_active,
  risk_level = EXCLUDED.risk_level,
  updated_at = now();

INSERT INTO public.teams (key, name, description, team_type, is_active, updated_at) VALUES
  ('media', 'Media Team', 'Coordinates approved media work', 'committee', true, now()),
  ('forms', 'Forms Team', 'Coordinates reusable and posted forms', 'committee', true, now()),
  ('events', 'Events Team', 'Coordinates event planning and calendar work', 'committee', true, now()),
  ('website', 'Website Team', 'Coordinates public website content', 'committee', true, now()),
  ('finance', 'Finance Team', 'Organizational Finance team; membership grants no access', 'committee', true, now()),
  ('storage', 'Storage Team', 'Inventory and equipment team; membership grants no access', 'committee', true, now())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  team_type = EXCLUDED.team_type,
  is_active = true,
  updated_at = now();

-- BEGIN ROLE PERMISSION BUNDLES
DO $$
BEGIN
  DELETE FROM public.role_permissions
  WHERE role_id IN (
    'chief','media_contributor','media_manager','finance_viewer','finance_contributor',
    'finance_approver','storage_assistant','storage_manager','forms_manager',
    'content_approver','access_administrator','system_administrator'
  );

  INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('chief', 'dashboard.access'),
  ('chief', 'notifications.view'),
  ('chief', 'groups.view_assigned'),
  ('chief', 'attendance.view'),
  ('chief', 'attendance.record'),
  ('chief', 'forms.fill'),
  ('chief', 'forms.view_own_submissions'),
  ('chief', 'calendar.view'),
  ('chief', 'documents.view'),
  ('chief', 'archived_years.view'),
  ('forms_manager', 'forms.create'),
  ('forms_manager', 'forms.templates.view'),
  ('forms_manager', 'forms.templates.manage'),
  ('forms_manager', 'forms.post.request'),
  ('forms_manager', 'forms.responses.view_group'),
  ('media_contributor', 'content.create'),
  ('media_contributor', 'content.submit'),
  ('media_contributor', 'content.edit_own'),
  ('media_contributor', 'media.view'),
  ('media_contributor', 'media.upload'),
  ('media_contributor', 'media.edit_own'),
  ('media_contributor', 'albums.create'),
  ('media_manager', 'media.view'),
  ('media_manager', 'media.upload'),
  ('media_manager', 'media.edit_own'),
  ('media_manager', 'media.edit_all'),
  ('media_manager', 'media.approve'),
  ('media_manager', 'media.publish'),
  ('media_manager', 'media.delete'),
  ('media_manager', 'albums.create'),
  ('media_manager', 'albums.manage'),
  ('finance_viewer', 'finance.view'),
  ('finance_contributor', 'finance.view'),
  ('finance_contributor', 'finance.create_transaction'),
  ('finance_contributor', 'finance.edit_own_transaction'),
  ('finance_contributor', 'finance.upload_receipt'),
  ('finance_approver', 'finance.view'),
  ('finance_approver', 'finance.approve_transaction'),
  ('finance_approver', 'finance.export'),
  ('storage_assistant', 'storage.view'),
  ('storage_assistant', 'storage.issue_items'),
  ('storage_assistant', 'storage.record_returns'),
  ('storage_manager', 'storage.view'),
  ('storage_manager', 'storage.create_item'),
  ('storage_manager', 'storage.update_item'),
  ('storage_manager', 'storage.issue_items'),
  ('storage_manager', 'storage.record_returns'),
  ('storage_manager', 'storage.adjust_quantity'),
  ('storage_manager', 'storage.write_off'),
  ('storage_manager', 'storage.audit'),
  ('storage_manager', 'storage.export'),
  ('storage_manager', 'storage.manage_categories'),
  ('content_approver', 'content.approve'),
  ('content_approver', 'content.publish'),
  ('content_approver', 'media.approve'),
  ('content_approver', 'media.publish'),
  ('access_administrator', 'users.view'),
  ('access_administrator', 'users.invite'),
  ('access_administrator', 'users.reset_password'),
  ('access_administrator', 'users.disable'),
  ('access_administrator', 'users.reactivate'),
  ('access_administrator', 'users.assign_roles'),
  ('access_administrator', 'users.assign_groups'),
  ('access_administrator', 'users.assign_teams'),
  ('access_administrator', 'roles.view'),
  ('access_administrator', 'audit_logs.view')
  ON CONFLICT (role_id, permission_id) DO NOTHING;
-- END ROLE PERMISSION BUNDLES

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT 'system_administrator', id
  FROM public.permissions
  WHERE is_active
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END;
$$;

COMMIT;
