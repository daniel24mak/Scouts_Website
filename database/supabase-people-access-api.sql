-- Additive, permission-checked API for the People & Access dashboard workspace.
-- Run after supabase-access-control-foundation.sql, seed, backfill, and security-hardening.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.require_people_access_permission(target_permission text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_permission(target_permission) THEN
    IF public.is_system_administrator(auth.uid()) AND EXISTS (
      SELECT 1
      FROM public.permissions p
      WHERE p.id = target_permission
        AND p.is_active
        AND p.requires_mfa
    ) AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
      RAISE EXCEPTION 'This People & Access action requires an MFA-verified session. Enroll and verify MFA, then try again.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'You do not have permission to perform this People & Access action.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_people_access_audit(
  target_action text,
  target_resource_type text,
  target_resource_id text,
  target_user_id uuid,
  previous_data jsonb,
  new_data jsonb,
  target_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata, module, resource_type,
    resource_id, target_user_id, previous_values, new_values, outcome, reason, created_at
  ) VALUES (
    auth.uid(), target_action, target_resource_type, target_resource_id,
    jsonb_build_object('source', 'people_access_rpc'), 'people_access', target_resource_type,
    target_resource_id, target_user_id, previous_data, new_data, 'success', NULLIF(btrim(target_reason), ''), now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_people_access_workspace()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.view');

  SELECT jsonb_build_object(
    'users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'email', p.email,
        'profile_picture_url', p.profile_picture_url, 'account_status', p.account_status,
        'invitation_status', CASE WHEN p.account_status = 'invited' THEN 'pending' ELSE 'accepted' END,
        'scouting_position', p.chief_level, 'primary_group', primary_group.name,
        'last_active', p.last_active_at,
        'role_assignments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', ura.id, 'role_key', r.id, 'role_name', r.name, 'scope_type', ura.scope_type,
          'scope_id', ura.scope_id, 'starts_at', ura.starts_at, 'expires_at', ura.expires_at,
          'status', CASE WHEN ura.starts_at > now() THEN 'scheduled' WHEN ura.expires_at <= now() THEN 'expired' ELSE 'active' END
        ) ORDER BY r.name) FROM public.user_role_assignments ura JOIN public.roles r ON r.id = ura.role_id WHERE ura.user_id = p.id), '[]'::jsonb),
        'group_assignments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', uga.id, 'group_key', g.id, 'group_name', g.name, 'position', uga.position,
          'is_primary', uga.is_primary, 'starts_at', uga.starts_at, 'expires_at', uga.expires_at
        ) ORDER BY uga.is_primary DESC, g.name) FROM public.user_group_assignments uga JOIN public.groups g ON g.id = uga.group_id WHERE uga.user_id = p.id), '[]'::jsonb),
        'team_memberships', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', utm.id, 'team_key', t.key, 'team_name', t.name, 'position', utm.position,
          'starts_at', utm.starts_at, 'expires_at', utm.expires_at
        ) ORDER BY t.name) FROM public.user_team_memberships utm JOIN public.teams t ON t.id = utm.team_id WHERE utm.user_id = p.id), '[]'::jsonb),
        'mfa_status', 'unavailable',
        'has_temporary_access', EXISTS (SELECT 1 FROM public.user_role_assignments x WHERE x.user_id = p.id AND x.expires_at > now()),
        'has_direct_overrides', EXISTS (SELECT 1 FROM public.user_permission_overrides x WHERE x.user_id = p.id AND x.starts_at <= now() AND (x.expires_at IS NULL OR x.expires_at > now())),
        'has_migration_differences', EXISTS (SELECT 1 FROM public.authorization_migration_differences x WHERE x.user_id = p.id AND x.resolved_at IS NULL),
        'legacy_access', jsonb_build_object(
          'role', p.role,
          'chief_level', p.chief_level,
          'group_id', p.group_id,
          'is_coordinator', p.is_coordinator,
          'coordinator_group_ids', COALESCE(p.coordinator_group_ids, ARRAY[]::text[])
        )
      ) ORDER BY p.full_name, p.email)
      FROM public.user_profiles p
      LEFT JOIN public.groups primary_group ON primary_group.id = p.group_id
    ), '[]'::jsonb),
    'roles', CASE WHEN public.has_permission('roles.view') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'key', r.id, 'name', r.name, 'description', r.description,
        'category', r.category, 'risk_level', r.risk_level, 'is_active', r.is_active,
        'is_system', r.is_system_role, 'requires_mfa', EXISTS (
          SELECT 1 FROM public.role_permissions rp JOIN public.permissions pm ON pm.id = rp.permission_id
          WHERE rp.role_id = r.id AND pm.requires_mfa
        ),
        'permission_count', (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id),
        'member_count', (SELECT count(DISTINCT ura.user_id) FROM public.user_role_assignments ura WHERE ura.role_id = r.id AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now())),
        'supported_scopes', COALESCE((SELECT jsonb_agg(DISTINCT ura.scope_type) FROM public.user_role_assignments ura WHERE ura.role_id = r.id), '[]'::jsonb)
      ) ORDER BY r.category, r.name) FROM public.roles r
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'teams', CASE WHEN public.has_permission('users.assign_teams') OR public.has_permission('roles.view') THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'key', t.key, 'name', t.name, 'description', t.description,
        'team_type', t.team_type, 'is_active', t.is_active,
        'is_system', t.key = ANY (ARRAY['media','forms','events','website','finance','storage']),
        'member_count', (SELECT count(*) FROM public.user_team_memberships utm WHERE utm.team_id = t.id AND utm.starts_at <= now() AND (utm.expires_at IS NULL OR utm.expires_at > now()))
      ) ORDER BY t.name) FROM public.teams t
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'permissions', CASE WHEN public.has_permission('roles.view') THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', pm.id, 'key', pm.id, 'name', initcap(replace(pm.id, '_', ' ')), 'description', pm.description,
      'module', pm.module, 'action', pm.action, 'risk_level', pm.risk_level,
      'requires_mfa', pm.requires_mfa, 'is_active', pm.is_active
    ) ORDER BY pm.module, pm.id) FROM public.permissions pm), '[]'::jsonb) ELSE '[]'::jsonb END,
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'key', g.id, 'name', g.name) ORDER BY g.name) FROM public.groups g), '[]'::jsonb),
    'access_reviews', CASE WHEN public.has_permission('audit_logs.view') THEN COALESCE((SELECT jsonb_agg(to_jsonb(ar) || jsonb_build_object('target_name', p.full_name) ORDER BY ar.created_at DESC) FROM public.access_reviews ar JOIN public.user_profiles p ON p.id = ar.target_user_id WHERE ar.status IN ('review_required','pending_clarification')), '[]'::jsonb) ELSE '[]'::jsonb END,
    'migration_differences', CASE WHEN public.has_permission('audit_logs.view') THEN COALESCE((SELECT jsonb_agg(to_jsonb(d) || jsonb_build_object('user_name', p.full_name) ORDER BY d.created_at DESC) FROM public.authorization_migration_differences d JOIN public.user_profiles p ON p.id = d.user_id WHERE d.resolved_at IS NULL), '[]'::jsonb) ELSE '[]'::jsonb END,
    'audit_logs', CASE WHEN public.has_permission('audit_logs.view') THEN COALESCE((SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('actor_name', actor.full_name, 'target_name', target.full_name) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.audit_logs WHERE module = 'people_access' ORDER BY created_at DESC LIMIT 250) a LEFT JOIN public.user_profiles actor ON actor.id = a.actor_id LEFT JOIN public.user_profiles target ON target.id = a.target_user_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'summary', jsonb_build_object(
      'active_users', (SELECT count(*) FROM public.user_profiles WHERE account_status = 'active'),
      'invited_users', (SELECT count(*) FROM public.user_profiles WHERE account_status = 'invited'),
      'disabled_users', (SELECT count(*) FROM public.user_profiles WHERE account_status IN ('disabled','suspended','archived')),
      'users_without_mfa', NULL,
      'high_risk_assignments', (SELECT count(*) FROM public.user_role_assignments ura JOIN public.roles r ON r.id = ura.role_id WHERE r.risk_level = 'high' AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now())),
      'expiring_access', (SELECT count(*) FROM public.user_role_assignments WHERE expires_at BETWEEN now() AND now() + interval '30 days'),
      'migration_differences', (SELECT count(*) FROM public.authorization_migration_differences WHERE resolved_at IS NULL),
      'direct_overrides', (SELECT count(*) FROM public.user_permission_overrides WHERE starts_at <= now() AND (expires_at IS NULL OR expires_at > now()))
    )
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_access_details(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.view');
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'The selected user no longer exists.' USING ERRCODE = 'P0002';
  END IF;
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id', p.id,
      'name', p.full_name,
      'email', p.email,
      'profile_picture_url', p.profile_picture_url,
      'account_status', p.account_status,
      'role', p.role,
      'group_id', p.group_id,
      'chief_level', p.chief_level,
      'is_coordinator', p.is_coordinator,
      'coordinator_group_ids', COALESCE(p.coordinator_group_ids, ARRAY[]::text[]),
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ),
    'role_assignments', COALESCE((SELECT jsonb_agg(to_jsonb(ura) || jsonb_build_object('role_name', r.name, 'role_key', r.id) ORDER BY r.name) FROM public.user_role_assignments ura JOIN public.roles r ON r.id = ura.role_id WHERE ura.user_id = p.id), '[]'::jsonb),
    'group_assignments', COALESCE((SELECT jsonb_agg(to_jsonb(uga) || jsonb_build_object('group_name', g.name) ORDER BY uga.is_primary DESC, g.name) FROM public.user_group_assignments uga JOIN public.groups g ON g.id = uga.group_id WHERE uga.user_id = p.id), '[]'::jsonb),
    'team_memberships', COALESCE((SELECT jsonb_agg(to_jsonb(utm) || jsonb_build_object('team_name', t.name, 'team_key', t.key) ORDER BY t.name) FROM public.user_team_memberships utm JOIN public.teams t ON t.id = utm.team_id WHERE utm.user_id = p.id), '[]'::jsonb),
    'permission_overrides', COALESCE((SELECT jsonb_agg(to_jsonb(upo) || jsonb_build_object('permission_name', initcap(replace(pm.id, '_', ' '))) ORDER BY pm.module, pm.id) FROM public.user_permission_overrides upo JOIN public.permissions pm ON pm.id = upo.permission_id WHERE upo.user_id = p.id), '[]'::jsonb),
    'effective_access', jsonb_build_object(
      'accountStatus', p.account_status,
      'permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', rp.permission_id, 'scopeType', ura.scope_type, 'scopeId', ura.scope_id, 'source', r.name, 'expiresAt', ura.expires_at, 'requiresMfa', pm.requires_mfa) ORDER BY rp.permission_id) FROM public.user_role_assignments ura JOIN public.roles r ON r.id = ura.role_id AND r.is_active JOIN public.role_permissions rp ON rp.role_id = ura.role_id JOIN public.permissions pm ON pm.id = rp.permission_id AND pm.is_active WHERE ura.user_id = p.id AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now()) AND NOT EXISTS (SELECT 1 FROM public.user_permission_overrides denied WHERE denied.user_id = p.id AND denied.permission_id = rp.permission_id AND denied.effect = 'deny' AND denied.starts_at <= now() AND (denied.expires_at IS NULL OR denied.expires_at > now()) AND (denied.scope_type = 'global' OR (denied.scope_type = ura.scope_type AND denied.scope_id IS NOT DISTINCT FROM ura.scope_id)))), '[]'::jsonb)
    ),
    'migration_differences', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC) FROM public.authorization_migration_differences d WHERE d.user_id = p.id AND d.resolved_at IS NULL), '[]'::jsonb),
    'activity', CASE WHEN public.has_permission('audit_logs.view') THEN COALESCE((SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('actor_name', actor.full_name) ORDER BY a.created_at DESC) FROM (SELECT activity_log.* FROM public.audit_logs activity_log WHERE activity_log.target_user_id = p.id OR activity_log.entity_id = p.id::text ORDER BY activity_log.created_at DESC LIMIT 100) a LEFT JOIN public.user_profiles actor ON actor.id = a.actor_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'security', jsonb_build_object('mfa_status', 'unavailable', 'mfa_required', NULL, 'assurance_level', NULL, 'last_sign_in', NULL, 'last_password_reset', NULL, 'active_sessions', NULL)
  ) INTO result FROM public.user_profiles p WHERE p.id = target_user_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_user_role_assignment(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE row_id uuid := NULLIF(payload->>'id','')::uuid; saved public.user_role_assignments; previous jsonb; role_row public.roles;
BEGIN
  PERFORM public.require_people_access_permission('users.assign_roles');
  SELECT * INTO role_row FROM public.roles WHERE id = payload->>'roleId' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active role.' USING ERRCODE = '22023'; END IF;
  IF role_row.risk_level = 'high' AND COALESCE(auth.jwt() ->> 'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Recent multi-factor authentication is required for this high-risk role.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(payload->>'reason',''))) < 8 THEN RAISE EXCEPTION 'An assignment reason of at least 8 characters is required.' USING ERRCODE = '22023'; END IF;
  IF row_id IS NOT NULL THEN SELECT to_jsonb(x) INTO previous FROM public.user_role_assignments x WHERE id = row_id FOR UPDATE; END IF;
  IF row_id IS NULL THEN
    INSERT INTO public.user_role_assignments(user_id,role_id,scope_type,scope_id,starts_at,expires_at,assigned_by,assignment_reason)
    VALUES ((payload->>'userId')::uuid,payload->>'roleId',payload->>'scopeType',NULLIF(payload->>'scopeId',''),COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,now()),NULLIF(payload->>'expiresAt','')::timestamptz,auth.uid(),btrim(payload->>'reason')) RETURNING * INTO saved;
  ELSE
    UPDATE public.user_role_assignments SET role_id=payload->>'roleId',scope_type=payload->>'scopeType',scope_id=NULLIF(payload->>'scopeId',''),starts_at=COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,starts_at),expires_at=NULLIF(payload->>'expiresAt','')::timestamptz,assignment_reason=btrim(payload->>'reason'),updated_at=now() WHERE id=row_id RETURNING * INTO saved;
  END IF;
  PERFORM public.write_people_access_audit(CASE WHEN row_id IS NULL THEN 'role_assignment_created' ELSE 'role_assignment_updated' END,'User role assignment',saved.id::text,saved.user_id,previous,to_jsonb(saved),payload->>'reason');
  RETURN to_jsonb(saved);
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_user_role_assignment(target_assignment_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.user_role_assignments; previous jsonb; active_admins bigint;
BEGIN
  PERFORM public.require_people_access_permission('users.assign_roles');
  IF length(btrim(COALESCE(reason,''))) < 8 THEN RAISE EXCEPTION 'A revocation reason of at least 8 characters is required.' USING ERRCODE='22023'; END IF;
  SELECT x.* INTO saved FROM public.user_role_assignments x WHERE id=target_assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The role assignment no longer exists.' USING ERRCODE='P0002'; END IF;
  previous := to_jsonb(saved);
  IF saved.role_id='system_administrator' AND saved.starts_at<=now() AND (saved.expires_at IS NULL OR saved.expires_at>now()) THEN
    SELECT count(*) INTO active_admins FROM public.user_role_assignments x JOIN public.user_profiles p ON p.id=x.user_id WHERE x.role_id='system_administrator' AND p.account_status='active' AND x.starts_at<=now() AND (x.expires_at IS NULL OR x.expires_at>now());
    IF active_admins<=1 THEN RAISE EXCEPTION 'The final active System Administrator cannot be removed.' USING ERRCODE='P0001'; END IF;
  END IF;
  DELETE FROM public.user_role_assignments WHERE id=target_assignment_id RETURNING * INTO saved;
  PERFORM public.write_people_access_audit('role_assignment_revoked','User role assignment',saved.id::text,saved.user_id,previous,NULL,reason);
  RETURN to_jsonb(saved);
END; $$;

CREATE OR REPLACE FUNCTION public.save_user_group_assignment(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE row_id uuid:=NULLIF(payload->>'id','')::uuid; saved public.user_group_assignments; previous jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.assign_groups');
  IF row_id IS NOT NULL THEN SELECT to_jsonb(x) INTO previous FROM public.user_group_assignments x WHERE id=row_id FOR UPDATE; END IF;
  IF row_id IS NULL THEN INSERT INTO public.user_group_assignments(user_id,group_id,position,is_primary,starts_at,expires_at,assigned_by) VALUES((payload->>'userId')::uuid,payload->>'groupId',payload->>'position',COALESCE((payload->>'isPrimary')::boolean,false),COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,now()),NULLIF(payload->>'expiresAt','')::timestamptz,auth.uid()) RETURNING * INTO saved;
  ELSE UPDATE public.user_group_assignments SET group_id=payload->>'groupId',position=payload->>'position',is_primary=COALESCE((payload->>'isPrimary')::boolean,false),starts_at=COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,starts_at),expires_at=NULLIF(payload->>'expiresAt','')::timestamptz,updated_at=now() WHERE id=row_id RETURNING * INTO saved; END IF;
  PERFORM public.write_people_access_audit(CASE WHEN row_id IS NULL THEN 'group_assignment_created' ELSE 'group_assignment_updated' END,'User group assignment',saved.id::text,saved.user_id,previous,to_jsonb(saved),payload->>'reason'); RETURN to_jsonb(saved);
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_user_group_assignment(target_assignment_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.user_group_assignments; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('users.assign_groups'); SELECT x.* INTO saved FROM public.user_group_assignments x WHERE id=target_assignment_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'The group assignment no longer exists.' USING ERRCODE='P0002'; END IF; previous:=to_jsonb(saved); DELETE FROM public.user_group_assignments WHERE id=target_assignment_id RETURNING * INTO saved; PERFORM public.write_people_access_audit('group_assignment_revoked','User group assignment',saved.id::text,saved.user_id,previous,NULL,reason); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.revoke_legacy_user_group_assignment(target_user_id uuid, target_group_id text, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE previous jsonb; saved jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.assign_groups');
  SELECT to_jsonb(p) INTO previous FROM public.user_profiles p WHERE p.id=target_user_id FOR UPDATE;
  IF previous IS NULL THEN RAISE EXCEPTION 'The user no longer exists.' USING ERRCODE='P0002'; END IF;

  DELETE FROM public.user_group_assignments WHERE user_id=target_user_id AND group_id=target_group_id;
  UPDATE public.user_profiles AS profile
  SET group_id = CASE WHEN group_id=target_group_id THEN NULL ELSE group_id END,
      chief_level = CASE WHEN group_id=target_group_id THEN NULL ELSE chief_level END,
      coordinator_group_ids = array_remove(COALESCE(coordinator_group_ids, ARRAY[]::text[]), target_group_id),
      is_coordinator = cardinality(array_remove(COALESCE(coordinator_group_ids, ARRAY[]::text[]), target_group_id)) > 0,
      updated_at = now()
  WHERE id=target_user_id
  RETURNING to_jsonb(profile.*) INTO saved;

  PERFORM public.write_people_access_audit('group_assignment_revoked','Legacy user group assignment',target_user_id::text || ':' || target_group_id,target_user_id,previous,saved,reason);
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.save_user_team_membership(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE row_id uuid:=NULLIF(payload->>'id','')::uuid; saved public.user_team_memberships; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('users.assign_teams'); IF row_id IS NOT NULL THEN SELECT to_jsonb(x) INTO previous FROM public.user_team_memberships x WHERE id=row_id FOR UPDATE; END IF; IF row_id IS NULL THEN INSERT INTO public.user_team_memberships(user_id,team_id,position,starts_at,expires_at,added_by) VALUES((payload->>'userId')::uuid,(payload->>'teamId')::uuid,payload->>'position',COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,now()),NULLIF(payload->>'expiresAt','')::timestamptz,auth.uid()) RETURNING * INTO saved; ELSE UPDATE public.user_team_memberships SET team_id=(payload->>'teamId')::uuid,position=payload->>'position',starts_at=COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,starts_at),expires_at=NULLIF(payload->>'expiresAt','')::timestamptz WHERE id=row_id RETURNING * INTO saved; END IF; PERFORM public.write_people_access_audit(CASE WHEN row_id IS NULL THEN 'team_membership_created' ELSE 'team_membership_updated' END,'User team membership',saved.id::text,saved.user_id,previous,to_jsonb(saved),payload->>'reason'); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.revoke_user_team_membership(target_membership_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.user_team_memberships; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('users.assign_teams'); SELECT x.* INTO saved FROM public.user_team_memberships x WHERE id=target_membership_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'The team membership no longer exists.' USING ERRCODE='P0002'; END IF; previous:=to_jsonb(saved); DELETE FROM public.user_team_memberships WHERE id=target_membership_id RETURNING * INTO saved; PERFORM public.write_people_access_audit('team_membership_revoked','User team membership',saved.id::text,saved.user_id,previous,NULL,reason); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.save_user_permission_override(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE row_id uuid:=NULLIF(payload->>'id','')::uuid; saved public.user_permission_overrides; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('permissions.manage'); IF length(btrim(COALESCE(payload->>'reason','')))<8 THEN RAISE EXCEPTION 'An override reason of at least 8 characters is required.' USING ERRCODE='22023'; END IF; IF row_id IS NOT NULL THEN SELECT to_jsonb(x) INTO previous FROM public.user_permission_overrides x WHERE id=row_id FOR UPDATE; END IF; IF row_id IS NULL THEN INSERT INTO public.user_permission_overrides(user_id,permission_id,effect,scope_type,scope_id,reason,starts_at,expires_at,assigned_by) VALUES((payload->>'userId')::uuid,payload->>'permissionId',payload->>'effect',payload->>'scopeType',NULLIF(payload->>'scopeId',''),btrim(payload->>'reason'),COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,now()),NULLIF(payload->>'expiresAt','')::timestamptz,auth.uid()) RETURNING * INTO saved; ELSE UPDATE public.user_permission_overrides SET permission_id=payload->>'permissionId',effect=payload->>'effect',scope_type=payload->>'scopeType',scope_id=NULLIF(payload->>'scopeId',''),reason=btrim(payload->>'reason'),starts_at=COALESCE(NULLIF(payload->>'startsAt','')::timestamptz,starts_at),expires_at=NULLIF(payload->>'expiresAt','')::timestamptz WHERE id=row_id RETURNING * INTO saved; END IF; PERFORM public.write_people_access_audit(CASE WHEN row_id IS NULL THEN 'permission_override_created' ELSE 'permission_override_updated' END,'User permission override',saved.id::text,saved.user_id,previous,to_jsonb(saved),payload->>'reason'); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.revoke_user_permission_override(target_override_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.user_permission_overrides; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('permissions.manage'); SELECT x.* INTO saved FROM public.user_permission_overrides x WHERE id=target_override_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'The permission override no longer exists.' USING ERRCODE='P0002'; END IF; previous:=to_jsonb(saved); UPDATE public.user_permission_overrides SET expires_at=now(),reason=COALESCE(NULLIF(btrim(reason),''),reason) WHERE id=target_override_id RETURNING * INTO saved; PERFORM public.write_people_access_audit('permission_override_revoked','User permission override',saved.id::text,saved.user_id,previous,to_jsonb(saved),reason); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.save_access_role(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE role_key text:=btrim(payload->>'id'); saved public.roles; previous jsonb; creating boolean; permission_key text;
BEGIN
  creating := NOT EXISTS(SELECT 1 FROM public.roles WHERE id=role_key);
  PERFORM public.require_people_access_permission(CASE WHEN creating THEN 'roles.create' ELSE 'roles.update' END);
  IF role_key !~ '^[a-z][a-z0-9_]{2,63}$' THEN RAISE EXCEPTION 'Role key must use lowercase letters, numbers, and underscores.' USING ERRCODE='22023'; END IF;
  SELECT to_jsonb(r) INTO previous FROM public.roles r WHERE r.id=role_key FOR UPDATE;
  IF NOT creating AND (previous->>'is_system_role')::boolean THEN RAISE EXCEPTION 'Protected system roles cannot be deleted, renamed, or disabled.' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.roles(id,name,description,category,is_system_role,is_active,risk_level,updated_at)
  VALUES(role_key,btrim(payload->>'name'),COALESCE(payload->>'description',''),COALESCE(NULLIF(payload->>'category',''),'custom'),false,COALESCE((payload->>'isActive')::boolean,true),COALESCE(NULLIF(payload->>'riskLevel',''),'standard'),now())
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,is_active=excluded.is_active,risk_level=excluded.risk_level,updated_at=now() RETURNING * INTO saved;
  IF payload ? 'permissionIds' THEN
    DELETE FROM public.role_permissions WHERE role_id=role_key;
    FOR permission_key IN SELECT jsonb_array_elements_text(COALESCE(payload->'permissionIds','[]'::jsonb)) LOOP
      INSERT INTO public.role_permissions(role_id,permission_id) SELECT role_key,p.id FROM public.permissions p WHERE p.id=permission_key AND p.is_active ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  PERFORM public.write_people_access_audit(CASE WHEN creating THEN 'role_created' ELSE 'role_updated' END,'Role',saved.id,NULL,previous,to_jsonb(saved),payload->>'reason'); RETURN to_jsonb(saved);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_access_role(target_role_id text, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.roles; previous jsonb; removed_assignments bigint;
BEGIN
  PERFORM public.require_people_access_permission('roles.delete');
  IF length(btrim(COALESCE(reason,''))) < 8 THEN RAISE EXCEPTION 'A deletion reason of at least 8 characters is required.' USING ERRCODE='22023'; END IF;
  SELECT r.* INTO saved FROM public.roles r WHERE id=target_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The role no longer exists.' USING ERRCODE='P0002'; END IF;
  previous:=to_jsonb(saved);
  IF saved.is_system_role THEN RAISE EXCEPTION 'Protected system roles cannot be deleted, renamed, or disabled.' USING ERRCODE='P0001'; END IF;
  SELECT count(*) INTO removed_assignments FROM public.user_role_assignments WHERE role_id=target_role_id;
  DELETE FROM public.user_role_assignments WHERE role_id=target_role_id;
  DELETE FROM public.role_permissions WHERE role_id=target_role_id;
  DELETE FROM public.roles WHERE id=target_role_id;
  PERFORM public.write_people_access_audit('role_deleted','Role',target_role_id,NULL,previous,jsonb_build_object('deleted',true,'removed_assignments',removed_assignments),reason);
  RETURN previous;
END; $$;

CREATE OR REPLACE FUNCTION public.save_access_team(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE team_id uuid:=NULLIF(payload->>'id','')::uuid; saved public.teams; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('users.assign_teams'); IF team_id IS NOT NULL THEN SELECT to_jsonb(t) INTO previous FROM public.teams t WHERE id=team_id FOR UPDATE; END IF; IF team_id IS NULL THEN INSERT INTO public.teams(key,name,description,team_type,is_active) VALUES(btrim(payload->>'key'),btrim(payload->>'name'),COALESCE(payload->>'description',''),COALESCE(NULLIF(payload->>'teamType',''),'committee'),COALESCE((payload->>'isActive')::boolean,true)) RETURNING * INTO saved; ELSE UPDATE public.teams SET key=btrim(payload->>'key'),name=btrim(payload->>'name'),description=COALESCE(payload->>'description',''),team_type=COALESCE(NULLIF(payload->>'teamType',''),'committee'),is_active=COALESCE((payload->>'isActive')::boolean,is_active),updated_at=now() WHERE id=team_id RETURNING * INTO saved; END IF; PERFORM public.write_people_access_audit(CASE WHEN team_id IS NULL THEN 'team_created' ELSE 'team_updated' END,'Team',saved.id::text,NULL,previous,to_jsonb(saved),payload->>'reason'); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.disable_access_team(target_team_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.teams; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('users.assign_teams'); SELECT to_jsonb(t) INTO previous FROM public.teams t WHERE id=target_team_id FOR UPDATE; UPDATE public.teams SET is_active=false,updated_at=now() WHERE id=target_team_id RETURNING * INTO saved; IF NOT FOUND THEN RAISE EXCEPTION 'The team no longer exists.' USING ERRCODE='P0002'; END IF; PERFORM public.write_people_access_audit('team_disabled','Team',saved.id::text,NULL,previous,to_jsonb(saved),reason); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.delete_access_team(target_team_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.teams; previous jsonb; removed_memberships bigint;
BEGIN
  PERFORM public.require_people_access_permission('users.assign_teams');
  IF length(btrim(COALESCE(reason,''))) < 8 THEN RAISE EXCEPTION 'A deletion reason of at least 8 characters is required.' USING ERRCODE='22023'; END IF;
  SELECT t.* INTO saved FROM public.teams t WHERE id=target_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The team no longer exists.' USING ERRCODE='P0002'; END IF;
  previous:=to_jsonb(saved);
  IF saved.key = ANY (ARRAY['media','forms','events','website','finance','storage']) THEN RAISE EXCEPTION 'Built-in teams cannot be deleted.' USING ERRCODE='P0001'; END IF;
  SELECT count(*) INTO removed_memberships FROM public.user_team_memberships WHERE team_id=target_team_id;
  DELETE FROM public.user_team_memberships WHERE team_id=target_team_id;
  DELETE FROM public.teams WHERE id=target_team_id;
  PERFORM public.write_people_access_audit('team_deleted','Team',target_team_id::text,NULL,previous,jsonb_build_object('deleted',true,'removed_memberships',removed_memberships),reason);
  RETURN previous;
END; $$;

CREATE OR REPLACE FUNCTION public.retire_dashboard_user(target_user_id uuid, reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  previous jsonb;
  saved jsonb;
BEGIN
  PERFORM public.require_people_access_permission('users.delete');
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove the account you are currently using.' USING ERRCODE='22023';
  END IF;
  IF length(btrim(COALESCE(reason,''))) < 8 THEN
    RAISE EXCEPTION 'An account-removal reason of at least 8 characters is required.' USING ERRCODE='22023';
  END IF;

  SELECT to_jsonb(profile) INTO previous
  FROM public.user_profiles profile
  WHERE profile.id=target_user_id
  FOR UPDATE;
  IF previous IS NULL THEN
    RAISE EXCEPTION 'The user no longer exists.' USING ERRCODE='P0002';
  END IF;

  DELETE FROM public.user_permission_overrides WHERE user_id=target_user_id;
  DELETE FROM public.user_team_memberships WHERE user_id=target_user_id;
  DELETE FROM public.user_group_assignments WHERE user_id=target_user_id;
  DELETE FROM public.user_role_assignments WHERE user_id=target_user_id;
  DELETE FROM public.user_permissions WHERE user_id=target_user_id;
  UPDATE public.equipe_leaders SET is_active=false WHERE chief_id=target_user_id AND is_active;

  IF to_regclass('storage.objects') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='storage' AND table_name='objects' AND column_name='owner'
    ) THEN
    EXECUTE 'UPDATE storage.objects SET owner = NULL WHERE owner = $1'
      USING target_user_id;
  END IF;

  UPDATE public.user_profiles AS profile
  SET account_status='archived',
      auth_user_id=target_user_id,
      group_id=NULL,
      chief_level=NULL,
      is_coordinator=false,
      coordinator_group_ids=ARRAY[]::text[],
      can_publish=false,
      can_create_group_meetings=false,
      can_edit_scouts=false,
      manage_form_templates=false,
      view_all_forms=false,
      post_forms=false,
      updated_at=now()
  WHERE profile.id=target_user_id
  RETURNING to_jsonb(profile.*) INTO saved;

  PERFORM public.write_people_access_audit(
    'user_deleted',
    'User account',
    target_user_id::text,
    target_user_id,
    previous,
    saved,
    reason
  );
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.decide_access_review(target_review_id uuid, decision text, notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.access_reviews; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('audit_logs.view'); IF decision NOT IN ('confirmed','remove_access','pending_clarification','review_required') THEN RAISE EXCEPTION 'Choose a valid access-review decision.' USING ERRCODE='22023'; END IF; IF length(btrim(COALESCE(notes,'')))<3 THEN RAISE EXCEPTION 'Add a reason for the review decision.' USING ERRCODE='22023'; END IF; SELECT to_jsonb(ar) INTO previous FROM public.access_reviews ar WHERE id=target_review_id FOR UPDATE; UPDATE public.access_reviews SET status=decision,reviewed_by=auth.uid(),reviewed_at=now(),decision_reason=btrim(notes),updated_at=now() WHERE id=target_review_id RETURNING * INTO saved; IF NOT FOUND THEN RAISE EXCEPTION 'The access review no longer exists.' USING ERRCODE='P0002'; END IF; PERFORM public.write_people_access_audit('access_review_decided','Access review',saved.id::text,saved.target_user_id,previous,to_jsonb(saved),notes); RETURN to_jsonb(saved); END; $$;

CREATE OR REPLACE FUNCTION public.resolve_authorization_difference(target_difference_id uuid, resolution text, notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE saved public.authorization_migration_differences; previous jsonb;
BEGIN PERFORM public.require_people_access_permission('audit_logs.view'); IF length(btrim(COALESCE(notes,'')))<3 THEN RAISE EXCEPTION 'Add a reason for resolving this difference.' USING ERRCODE='22023'; END IF; SELECT to_jsonb(d) INTO previous FROM public.authorization_migration_differences d WHERE id=target_difference_id FOR UPDATE; UPDATE public.authorization_migration_differences SET resolved_at=now(),resolved_by=auth.uid(),resolution_note=btrim(resolution || ': ' || notes) WHERE id=target_difference_id RETURNING * INTO saved; IF NOT FOUND THEN RAISE EXCEPTION 'The migration difference no longer exists.' USING ERRCODE='P0002'; END IF; PERFORM public.write_people_access_audit('migration_difference_resolved','Authorization migration difference',saved.id::text,saved.user_id,previous,to_jsonb(saved),notes); RETURN to_jsonb(saved); END; $$;

REVOKE ALL ON FUNCTION public.require_people_access_permission(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_people_access_audit(text,text,text,uuid,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_people_access_workspace() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_access_details(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_user_role_assignment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_role_assignment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_user_group_assignment(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_group_assignment(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_legacy_user_group_assignment(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_user_team_membership(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_team_membership(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_user_permission_override(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_user_permission_override(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_access_role(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_access_role(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_access_team(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disable_access_team(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_access_team(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retire_dashboard_user(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_access_review(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_authorization_difference(uuid,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_people_access_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_access_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_role_assignment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_role_assignment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_group_assignment(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_group_assignment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_legacy_user_group_assignment(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_team_membership(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_team_membership(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_permission_override(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_permission_override(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_access_role(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_access_role(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_access_team(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_access_team(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_access_team(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retire_dashboard_user(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_access_review(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_authorization_difference(uuid,text,text) TO authenticated;

COMMIT;
