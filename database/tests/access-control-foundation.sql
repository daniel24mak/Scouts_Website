BEGIN;

DO $$
DECLARE
  helper_signature text;
BEGIN
  ASSERT to_regclass('public.user_role_assignments') IS NOT NULL, 'user_role_assignments missing';
  ASSERT to_regclass('public.user_group_assignments') IS NOT NULL, 'user_group_assignments missing';
  ASSERT to_regclass('public.teams') IS NOT NULL, 'teams missing';
  ASSERT to_regclass('public.user_team_memberships') IS NOT NULL, 'user_team_memberships missing';
  ASSERT to_regclass('public.user_permission_overrides') IS NOT NULL, 'user_permission_overrides missing';
  ASSERT to_regclass('public.authorization_migration_differences') IS NOT NULL, 'migration differences missing';
  ASSERT to_regclass('public.authorization_module_modes') IS NOT NULL, 'module modes missing';
  ASSERT to_regclass('public.access_reviews') IS NOT NULL, 'access_reviews missing';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.authorization_module_modes WHERE mode = 'normalized'
  ), 'foundation must not enable normalized authority';
  ASSERT NOT has_table_privilege('anon', 'public.user_role_assignments', 'SELECT'), 'anonymous role assignment access';
  ASSERT has_table_privilege('authenticated', 'public.user_role_assignments', 'SELECT'), 'authenticated role assignment read missing';
  ASSERT NOT has_table_privilege('authenticated', 'public.user_role_assignments', 'INSERT'), 'client role assignment writes enabled';
  ASSERT has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), 'append-only audit privilege missing';
  ASSERT NOT has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'), 'audit update privilege enabled';
  ASSERT NOT has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'), 'audit delete privilege enabled';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_role_assignments'
      AND policyname = 'users read own role assignments' AND cmd = 'SELECT'
  ), 'own role assignment policy missing';
  FOREACH helper_signature IN ARRAY ARRAY[
    'public.is_active_dashboard_user()',
    'public.has_required_aal(text)',
    'public.has_permission(text)',
    'public.has_global_permission(text)',
    'public.has_group_access(text)',
    'public.has_team_access(uuid)',
    'public.has_permission_for_group(text,text)',
    'public.has_permission_for_team(text,uuid)',
    'public.has_permission_for_event(text,text)',
    'public.get_my_effective_access()'
  ] LOOP
    ASSERT NOT has_function_privilege('anon', helper_signature, 'EXECUTE'), helper_signature || ' executable by anon';
    ASSERT has_function_privilege('authenticated', helper_signature, 'EXECUTE'), helper_signature || ' unavailable to authenticated';
  END LOOP;
END $$;

DO $$
BEGIN
  ASSERT NOT EXISTS (
    SELECT user_id, role_id, scope_type, scope_id
    FROM public.user_role_assignments
    WHERE starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
    GROUP BY user_id, role_id, scope_type, scope_id
    HAVING count(*) > 1
  ), 'backfill created duplicate current role assignments';

  ASSERT NOT EXISTS (
    SELECT user_id, group_id
    FROM public.user_group_assignments
    WHERE starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
    GROUP BY user_id, group_id
    HAVING count(*) > 1
  ), 'backfill created duplicate current group assignments';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.role = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        WHERE ura.user_id = p.id
          AND ura.role_id = 'system_administrator'
          AND ura.scope_type = 'global'
          AND ura.scope_id IS NULL
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
  ), 'legacy administrator was not backfilled';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN public.groups g ON g.id = p.group_id
    WHERE p.role = 'chief'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_group_assignments uga
        WHERE uga.user_id = p.id
          AND uga.group_id = p.group_id
          AND uga.position = CASE p.chief_level
            WHEN 'head' THEN 'head_chief'
            WHEN 'vice' THEN 'vice_chief'
            ELSE 'chief'
          END
          AND uga.starts_at <= now()
          AND (uga.expires_at IS NULL OR uga.expires_at > now())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.authorization_migration_differences d
        WHERE d.user_id = p.id
          AND d.permission_key = 'groups.assignment.primary'
          AND d.scope_type = 'group'
          AND d.scope_id = p.group_id
      )
  ), 'legacy Chief primary group or position was not backfilled';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    CROSS JOIN LATERAL unnest(COALESCE(p.coordinator_group_ids, '{}'::text[])) coordinator(group_id)
    JOIN public.groups g ON g.id = coordinator.group_id
    WHERE p.role = 'chief'
      AND coordinator.group_id IS DISTINCT FROM p.group_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_group_assignments uga
        WHERE uga.user_id = p.id
          AND uga.group_id = coordinator.group_id
          AND uga.position = 'coordinator'
          AND uga.starts_at <= now()
          AND (uga.expires_at IS NULL OR uga.expires_at > now())
      )
  ), 'legacy coordinator group was not backfilled';

  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN public.user_group_assignments uga ON uga.user_id = p.id
    WHERE p.manage_form_templates = true
      AND uga.starts_at <= now()
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        WHERE ura.user_id = p.id
          AND ura.role_id = 'forms_manager'
          AND ura.scope_type = 'group'
          AND ura.scope_id = uga.group_id
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
  ), 'legacy Forms Manager scope was not backfilled';
END $$;

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  chief_id uuid := gen_random_uuid();
  head_id uuid := gen_random_uuid();
  vice_id uuid := gen_random_uuid();
  coordinator_id uuid := gen_random_uuid();
  forms_manager_id uuid := gen_random_uuid();
  post_forms_id uuid := gen_random_uuid();
  view_forms_id uuid := gen_random_uuid();
  fixture_ids uuid[];
  legacy_before jsonb;
  legacy_after jsonb;
  role_count bigint;
  group_count bigint;
  difference_count bigint;
  team_count bigint;
BEGIN
  fixture_ids := ARRAY[
    admin_id, chief_id, head_id, vice_id, coordinator_id,
    forms_manager_id, post_forms_id, view_forms_id
  ];

  INSERT INTO public.groups (
    id, name, sort_order, assignment_basis, grade_range, age_range,
    grade_start, grade_end, age_start, age_end, gender_filter
  ) VALUES
    ('access-backfill-a', 'Access Backfill A', 9997, 'age', NULL, 'Test', 1, 12, 1, 99, 'mixed'),
    ('access-backfill-b', 'Access Backfill B', 9998, 'age', NULL, 'Test', 1, 12, 1, 99, 'mixed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
  SELECT id, 'authenticated', 'authenticated', id::text || '@backfill.invalid', now(), now()
  FROM unnest(fixture_ids) id;

  INSERT INTO public.user_profiles (
    id, full_name, email, role, group_id, chief_level, is_coordinator,
    coordinator_group_ids, account_status, manage_form_templates,
    post_forms, view_all_forms, can_publish
  ) VALUES
    (admin_id, 'Backfill Admin', admin_id::text || '@backfill.invalid', 'admin', NULL, NULL, false, '{}', 'active', false, false, false, false),
    (chief_id, 'Backfill Chief', chief_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'chief', false, '{}', 'active', false, false, false, false),
    (head_id, 'Backfill Head', head_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'head', false, '{}', 'active', false, false, false, false),
    (vice_id, 'Backfill Vice', vice_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'vice', false, '{}', 'active', false, false, false, false),
    (coordinator_id, 'Backfill Coordinator', coordinator_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'chief', true, ARRAY['access-backfill-b'], 'active', false, false, false, false),
    (forms_manager_id, 'Backfill Forms Manager', forms_manager_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'chief', false, '{}', 'active', true, false, false, false),
    (post_forms_id, 'Backfill Poster', post_forms_id::text || '@backfill.invalid', 'chief', 'access-backfill-a', 'chief', false, '{}', 'active', false, true, false, true),
    (view_forms_id, 'Backfill Viewer', view_forms_id::text || '@backfill.invalid', 'chief', NULL, 'chief', false, '{}', 'active', false, false, true, false);

  SELECT jsonb_object_agg(
    p.id::text,
    jsonb_build_object(
      'role', p.role, 'group_id', p.group_id, 'chief_level', p.chief_level,
      'is_coordinator', p.is_coordinator, 'coordinator_group_ids', p.coordinator_group_ids,
      'can_publish', p.can_publish, 'manage_form_templates', p.manage_form_templates,
      'post_forms', p.post_forms, 'view_all_forms', p.view_all_forms
    )
  ) INTO legacy_before
  FROM public.user_profiles p
  WHERE p.id = ANY(fixture_ids);

  PERFORM public.backfill_legacy_access_control();

  ASSERT (SELECT count(*) FROM public.user_role_assignments WHERE user_id = admin_id AND role_id = 'system_administrator' AND scope_type = 'global') = 1,
    'administrator mapping incorrect';
  ASSERT (SELECT position FROM public.user_group_assignments WHERE user_id = chief_id AND group_id = 'access-backfill-a' AND expires_at IS NULL) = 'chief',
    'Chief position mapping incorrect';
  ASSERT (SELECT position FROM public.user_group_assignments WHERE user_id = head_id AND group_id = 'access-backfill-a' AND expires_at IS NULL) = 'head_chief',
    'Head Chief position mapping incorrect';
  ASSERT (SELECT position FROM public.user_group_assignments WHERE user_id = vice_id AND group_id = 'access-backfill-a' AND expires_at IS NULL) = 'vice_chief',
    'Vice Chief position mapping incorrect';
  ASSERT (SELECT count(*) FROM public.user_group_assignments WHERE user_id = coordinator_id AND expires_at IS NULL) = 2,
    'coordinator groups mapping incorrect';
  ASSERT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = coordinator_id AND role_id = 'chief'
      AND scope_type = 'group' AND scope_id = 'access-backfill-b' AND expires_at IS NULL
  ), 'coordinator Chief scope missing';
  ASSERT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = forms_manager_id AND role_id = 'forms_manager'
      AND scope_type = 'group' AND scope_id = 'access-backfill-a' AND expires_at IS NULL
  ), 'Forms Manager scope missing';
  ASSERT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences
    WHERE user_id = post_forms_id AND permission_key = 'forms.post.approve'
  ), 'post_forms review difference missing';
  ASSERT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences
    WHERE user_id = view_forms_id AND permission_key = 'forms.responses.view_all'
  ), 'view_all_forms review difference missing';
  ASSERT EXISTS (
    SELECT 1 FROM public.authorization_migration_differences
    WHERE user_id = post_forms_id AND permission_key = 'content.publish'
  ), 'can_publish review difference missing';
  ASSERT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = view_forms_id AND role_id = 'chief' AND scope_type = 'own_records'
  ), 'group-less Chief own-record mapping missing';

  SELECT count(*) INTO role_count FROM public.user_role_assignments WHERE user_id = ANY(fixture_ids);
  SELECT count(*) INTO group_count FROM public.user_group_assignments WHERE user_id = ANY(fixture_ids);
  SELECT count(*) INTO difference_count FROM public.authorization_migration_differences WHERE user_id = ANY(fixture_ids);
  SELECT count(*) INTO team_count FROM public.user_team_memberships WHERE user_id = ANY(fixture_ids);

  ASSERT NOT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = ANY(fixture_ids)
      AND (role_id LIKE 'finance_%' OR role_id LIKE 'storage_%')
  ), 'backfill directly assigned a Finance or Storage role';
  ASSERT team_count = 0, 'backfill created a team membership';

  PERFORM public.backfill_legacy_access_control();

  ASSERT role_count = (SELECT count(*) FROM public.user_role_assignments WHERE user_id = ANY(fixture_ids)),
    'second backfill changed role assignment count';
  ASSERT group_count = (SELECT count(*) FROM public.user_group_assignments WHERE user_id = ANY(fixture_ids)),
    'second backfill changed group assignment count';
  ASSERT difference_count = (SELECT count(*) FROM public.authorization_migration_differences WHERE user_id = ANY(fixture_ids)),
    'second backfill changed migration difference count';
  ASSERT team_count = (SELECT count(*) FROM public.user_team_memberships WHERE user_id = ANY(fixture_ids)),
    'second backfill changed team membership count';

  SELECT jsonb_object_agg(
    p.id::text,
    jsonb_build_object(
      'role', p.role, 'group_id', p.group_id, 'chief_level', p.chief_level,
      'is_coordinator', p.is_coordinator, 'coordinator_group_ids', p.coordinator_group_ids,
      'can_publish', p.can_publish, 'manage_form_templates', p.manage_form_templates,
      'post_forms', p.post_forms, 'view_all_forms', p.view_all_forms
    )
  ) INTO legacy_after
  FROM public.user_profiles p
  WHERE p.id = ANY(fixture_ids);

  ASSERT legacy_before = legacy_after, 'backfill changed legacy authorization fields';
END $$;

DO $$
DECLARE
  actual text[];
BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'chief' AND is_system_role), 'chief role missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'system_administrator' AND is_system_role), 'system administrator missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_viewer' AND is_system_role), 'finance viewer missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_contributor' AND is_system_role), 'finance contributor missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_approver' AND is_system_role), 'finance approver missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'storage_assistant' AND is_system_role), 'storage assistant missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'storage_manager' AND is_system_role), 'storage manager missing';
  ASSERT EXISTS (SELECT 1 FROM public.teams WHERE key = 'finance' AND is_active), 'finance team missing';
  ASSERT EXISTS (SELECT 1 FROM public.teams WHERE key = 'storage' AND is_active), 'storage team missing';
  ASSERT (SELECT count(*) FROM public.permissions WHERE id LIKE 'finance.%') = 9, 'finance catalogue incomplete';
  ASSERT (SELECT count(*) FROM public.permissions WHERE id LIKE 'storage.%') = 10, 'storage catalogue incomplete';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE id IN (
      'finance.approve_transaction','finance.export','finance.manage_categories','finance.manage_settings',
      'storage.adjust_quantity','storage.write_off','storage.audit','storage.export','storage.manage_categories'
    ) AND NOT requires_mfa
  ), 'high-risk finance/storage permission missing MFA';

  SELECT array_agg(permission_id ORDER BY permission_id) INTO actual
  FROM public.role_permissions WHERE role_id = 'finance_contributor';
  ASSERT actual = ARRAY[
    'finance.create_transaction','finance.edit_own_transaction','finance.upload_receipt','finance.view'
  ]::text[], 'finance contributor bundle mismatch';

  SELECT array_agg(permission_id ORDER BY permission_id) INTO actual
  FROM public.role_permissions WHERE role_id = 'finance_approver';
  ASSERT actual = ARRAY['finance.approve_transaction','finance.export','finance.view']::text[], 'finance approver bundle mismatch';

  SELECT array_agg(permission_id ORDER BY permission_id) INTO actual
  FROM public.role_permissions WHERE role_id = 'storage_assistant';
  ASSERT actual = ARRAY['storage.issue_items','storage.record_returns','storage.view']::text[], 'storage assistant bundle mismatch';

END $$;

DO $$
DECLARE
  active_user_id uuid := gen_random_uuid();
  disabled_user_id uuid := gen_random_uuid();
  finance_team_id uuid;
  storage_team_id uuid;
  membership_only_team_id uuid;
  inactive_team_id uuid;
  snapshot jsonb;
BEGIN
  SELECT id INTO STRICT finance_team_id FROM public.teams WHERE key = 'finance';
  SELECT id INTO STRICT storage_team_id FROM public.teams WHERE key = 'storage';
  SELECT id INTO STRICT membership_only_team_id FROM public.teams WHERE key = 'events';
  INSERT INTO public.teams (key, name, description, team_type, is_active)
  VALUES ('access-control-inactive-test', 'Inactive Access Test', 'Transactional SQL fixture', 'committee', false)
  ON CONFLICT (key) DO UPDATE SET is_active = false, updated_at = now()
  RETURNING id INTO inactive_team_id;

  INSERT INTO public.groups (
    id, name, sort_order, assignment_basis, grade_range, age_range,
    grade_start, grade_end, age_start, age_end, gender_filter
  ) VALUES (
    'access-control-test-group', 'Access Control Test Group', 9999, 'age', NULL, 'Test',
    1, 12, 1, 99, 'mixed'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
  VALUES
    (active_user_id, 'authenticated', 'authenticated', active_user_id::text || '@example.invalid', now(), now()),
    (disabled_user_id, 'authenticated', 'authenticated', disabled_user_id::text || '@example.invalid', now(), now());

  INSERT INTO public.user_profiles (id, full_name, email, role, group_id, chief_level, account_status)
  VALUES
    (active_user_id, 'Access Active', active_user_id::text || '@example.invalid', 'chief', 'access-control-test-group', 'chief', 'active'),
    (disabled_user_id, 'Access Disabled', disabled_user_id::text || '@example.invalid', 'chief', 'access-control-test-group', 'chief', 'disabled');

  INSERT INTO public.user_group_assignments (user_id, group_id, position, is_primary, assigned_by)
  VALUES (active_user_id, 'access-control-test-group', 'chief', true, active_user_id);

  INSERT INTO public.user_team_memberships (user_id, team_id, position, added_by)
  VALUES
    (active_user_id, finance_team_id, 'member', active_user_id),
    (active_user_id, membership_only_team_id, 'member', active_user_id);

  INSERT INTO public.roles (
    id, name, description, category, is_system_role, is_active, risk_level
  ) VALUES (
    'access_control_test_inactive_role',
    'Access Control Test Inactive Role',
    'Disposable rollback-only SQL verification role',
    'test',
    false,
    true,
    'standard'
  )
  ON CONFLICT (id) DO UPDATE SET
    is_system_role = false,
    is_active = true,
    updated_at = now();

  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES ('access_control_test_inactive_role', 'calendar.create_public_event')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.user_role_assignments (
    user_id, role_id, scope_type, scope_id, starts_at, expires_at, assigned_by, assignment_reason
  ) VALUES
    (active_user_id, 'chief', 'group', 'access-control-test-group', now() - interval '1 day', NULL, active_user_id, 'SQL behavior fixture'),
    (active_user_id, 'media_contributor', 'global', NULL, now() - interval '1 day', NULL, active_user_id, 'SQL behavior fixture'),
    (active_user_id, 'access_control_test_inactive_role', 'global', NULL, now() - interval '1 day', NULL, active_user_id, 'Inactive role SQL behavior fixture'),
    (active_user_id, 'finance_approver', 'team', finance_team_id::text, now() - interval '1 day', NULL, active_user_id, 'SQL behavior fixture'),
    (active_user_id, 'storage_manager', 'team', storage_team_id::text, now() - interval '1 day', NULL, active_user_id, 'SQL behavior fixture'),
    (active_user_id, 'finance_approver', 'team', inactive_team_id::text, now() - interval '1 day', NULL, active_user_id, 'Inactive team SQL behavior fixture'),
    (active_user_id, 'forms_manager', 'global', NULL, now() - interval '2 days', now() - interval '1 day', active_user_id, 'Expired SQL behavior fixture'),
    (active_user_id, 'forms_manager', 'global', NULL, now() + interval '1 day', NULL, active_user_id, 'Future SQL behavior fixture'),
    (active_user_id, 'forms_manager', 'event', 'access-control-event-a', now() - interval '1 day', NULL, active_user_id, 'Event SQL behavior fixture'),
    (disabled_user_id, 'chief', 'global', NULL, now() - interval '1 day', NULL, active_user_id, 'Disabled SQL behavior fixture');

  INSERT INTO public.user_permission_overrides (
    user_id, permission_id, effect, scope_type, scope_id, reason, assigned_by
  ) VALUES
    (active_user_id, 'dashboard.access', 'allow', 'global', NULL, 'SQL behavior fixture allow', active_user_id),
    (active_user_id, 'media.upload', 'deny', 'global', NULL, 'SQL behavior fixture deny', active_user_id);

  INSERT INTO public.user_permission_overrides (
    user_id, permission_id, effect, scope_type, scope_id, reason, starts_at, expires_at, assigned_by
  ) VALUES (
    active_user_id, 'dashboard.access', 'deny', 'global', NULL, 'Expired SQL behavior deny',
    now() - interval '2 days', now() - interval '1 day', active_user_id
  );

  INSERT INTO public.user_permission_overrides (
    user_id, permission_id, effect, scope_type, scope_id, reason, starts_at, expires_at, assigned_by
  ) VALUES
    (
      active_user_id, 'calendar.view', 'allow', 'global', NULL, 'Expired SQL behavior allow',
      now() - interval '2 days', now() - interval '1 day', active_user_id
    ),
    (
      active_user_id, 'calendar.view', 'allow', 'global', NULL, 'Future SQL behavior allow',
      now() + interval '1 day', NULL, active_user_id
    );

  PERFORM set_config('request.jwt.claim.sub', active_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', active_user_id, 'role', 'authenticated', 'aal', 'aal1')::text,
    true
  );

  ASSERT public.is_active_dashboard_user(), 'active user rejected';
  ASSERT public.has_permission('dashboard.access'), 'dashboard permission rejected';
  ASSERT public.has_global_permission('dashboard.access'), 'global dashboard permission rejected';
  ASSERT public.has_permission_for_group('attendance.record', 'access-control-test-group'), 'assigned group rejected';
  ASSERT NOT public.has_permission_for_group('attendance.record', 'unassigned-test-group'), 'unassigned group allowed';
  ASSERT NOT public.has_permission('media.upload'), 'direct deny ignored';
  ASSERT NOT public.has_permission('forms.create'), 'expired role accepted';
  ASSERT public.has_permission_for_event('forms.create', 'access-control-event-a'), 'event-scoped grant rejected';
  ASSERT NOT public.has_permission_for_event('forms.create', 'access-control-event-b'), 'event grant crossed event scope';
  ASSERT public.has_permission('calendar.view') IS FALSE, 'expired or future allow override accepted';
  ASSERT NOT public.has_permission('finance.view'), 'team-scoped Finance role leaked into an unscoped check';
  ASSERT public.has_permission_for_team('finance.view', finance_team_id), 'assigned Finance team rejected';
  ASSERT public.has_permission_for_team('storage.view', storage_team_id), 'active Storage Manager rejected';
  ASSERT NOT public.has_permission_for_team('finance.view', storage_team_id), 'Finance access crossed into Storage team';
  ASSERT NOT public.has_permission_for_team('storage.view', finance_team_id), 'Storage access crossed into Finance team';
  ASSERT NOT public.has_permission_for_team('finance.view', membership_only_team_id), 'team membership granted permission without a role';
  ASSERT public.has_permission_for_team('finance.view', inactive_team_id) IS FALSE, 'inactive team retained permission';
  ASSERT public.has_required_aal('finance.approve_transaction') IS FALSE, 'aal1 accepted for high-risk Finance approval';
  ASSERT public.has_required_aal('missing.permission') IS FALSE, 'missing permission returned true';
  ASSERT NOT public.has_permission_for_team('finance.approve_transaction', finance_team_id), 'aal1 authorized Finance approval';
  ASSERT public.has_permission_for_group('media.upload', 'unassigned-test-group') IS FALSE, 'global deny failed on scoped authorization';

  UPDATE public.permissions SET is_active = false WHERE id = 'storage.view';
  ASSERT public.has_required_aal('storage.view') IS FALSE, 'inactive permission AAL returned true';
  ASSERT public.has_permission_for_team('storage.view', storage_team_id) IS FALSE, 'inactive permission returned true';

  UPDATE public.roles SET is_active = false WHERE id = 'access_control_test_inactive_role';
  ASSERT public.has_permission('calendar.create_public_event') IS FALSE, 'inactive role retained permission';

  INSERT INTO public.user_role_assignments (
    user_id, role_id, scope_type, scope_id, starts_at, assigned_by, assignment_reason
  ) VALUES
    (active_user_id, 'chief', 'global', NULL, now() - interval '1 day', active_user_id, 'Scoped deny SQL fixture'),
    (active_user_id, 'finance_viewer', 'global', NULL, now() - interval '1 day', active_user_id, 'Team deny SQL fixture');

  INSERT INTO public.user_permission_overrides (
    user_id, permission_id, effect, scope_type, scope_id, reason, assigned_by
  ) VALUES
    (active_user_id, 'attendance.record', 'deny', 'group', 'access-control-test-group', 'Matching group deny fixture', active_user_id),
    (active_user_id, 'finance.view', 'deny', 'team', finance_team_id::text, 'Matching team deny fixture', active_user_id);

  ASSERT public.has_permission_for_group('attendance.record', 'access-control-test-group') IS FALSE, 'group deny ignored';
  ASSERT public.has_permission_for_group('attendance.record', 'unassigned-test-group'), 'group deny leaked to another group';
  ASSERT public.has_permission_for_team('finance.view', finance_team_id) IS FALSE, 'team deny ignored';
  ASSERT public.has_permission_for_team('finance.view', storage_team_id), 'team deny leaked to another team';

  snapshot := public.get_my_effective_access();
  ASSERT snapshot ->> 'accountStatus' = 'active', 'effective access omitted active status';
  ASSERT jsonb_typeof(snapshot -> 'roles') = 'array', 'effective roles are not an array';
  ASSERT jsonb_typeof(snapshot -> 'permissions') = 'array', 'effective permissions are not an array';
  ASSERT jsonb_typeof(snapshot -> 'groupAssignments') = 'array', 'effective groups are not an array';
  ASSERT jsonb_typeof(snapshot -> 'teamMemberships') = 'array', 'effective teams are not an array';
  ASSERT jsonb_typeof(snapshot -> 'restrictions') = 'array', 'effective restrictions are not an array';
  ASSERT NOT jsonb_path_exists(snapshot, '$.permissions[*] ? (@.key == "media.upload")'), 'denied permission remained effective';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'roles') item
    WHERE item ->> 'key' = 'access_control_test_inactive_role'
  ), 'snapshot retained inactive role';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'roles') item
    WHERE item ->> 'key' = 'forms_manager' AND item ->> 'scopeType' = 'global'
  ), 'snapshot retained expired or future role';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'roles') item
    WHERE item ->> 'scopeType' = 'team' AND item ->> 'scopeId' = inactive_team_id::text
  ), 'snapshot retained inactive-team role';
  ASSERT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'permissions') item
    WHERE item ->> 'key' = 'storage.view'
  ), 'snapshot retained inactive permission';
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'permissions') item
    WHERE item ->> 'key' = 'attendance.record' AND item ->> 'scopeType' = 'global'
  ), 'scoped deny incorrectly removed unrelated global permission';
  ASSERT EXISTS (
    SELECT 1 FROM jsonb_array_elements(snapshot -> 'restrictions') item
    WHERE item ->> 'key' = 'attendance.record'
      AND item ->> 'scopeType' = 'group'
      AND item ->> 'scopeId' = 'access-control-test-group'
  ), 'snapshot omitted scoped restriction';

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', active_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  ASSERT public.has_required_aal('finance.approve_transaction'), 'aal2 rejected for high-risk Finance approval';
  ASSERT public.has_permission_for_team('finance.approve_transaction', finance_team_id), 'aal2 Finance approval rejected';
  PERFORM public.get_my_effective_access();
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', disabled_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', disabled_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
  ASSERT NOT public.is_active_dashboard_user(), 'disabled user accepted';
  ASSERT NOT public.has_permission('dashboard.access'), 'disabled user received permission';
END $$;

ROLLBACK;
