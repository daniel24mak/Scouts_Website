import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PERMISSIONS } from "../../src/services/accessControlCatalog.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("foundation migration is additive, shadow-only, and RLS protected", () => {
  const sql = read("../../database/supabase-access-control-foundation.sql");
  const tables = [
    "user_role_assignments",
    "user_group_assignments",
    "teams",
    "user_team_memberships",
    "user_permission_overrides",
    "authorization_migration_differences",
    "authorization_module_modes",
    "access_reviews"
  ];

  for (const table of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  }

  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_primary_unique/i);
  assert.match(sql, /ADD CONSTRAINT user_profiles_account_status_check[\s\S]*NOT VALID/i);
  assert.doesNotMatch(sql, /SET\s+mode\s*=\s*'normalized'/i);
  assert.doesNotMatch(sql, /\('[^']+',\s*'normalized'\)/i);
  assert.match(sql, /\('finance',\s*'shadow'\)/i);
  assert.match(sql, /\('storage',\s*'shadow'\)/i);
  assert.match(sql, /REVOKE ALL ON[\s\S]*FROM anon/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*public\.audit_logs[\s\S]*FROM anon/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM authenticated/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_active_legacy_admin\(\)/i);
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]{0,240}USING \(public\.is_admin\(\)\)/i);
  assert.match(sql, /ON CONFLICT \(module\) DO UPDATE[\s\S]*'shadow'/i);
  const moduleUpsert = sql.match(/ON CONFLICT \(module\) DO UPDATE[\s\S]*?;/i);
  assert.ok(moduleUpsert, "module shadow upsert missing");
  assert.doesNotMatch(moduleUpsert[0], /\bWHERE\b/i);
  assert.match(sql, /scope_id = btrim\(scope_id\)/i);
  assert.match(sql, /ADD CONSTRAINT user_role_assignments_no_overlap[\s\S]*EXCLUDE USING gist/i);
  assert.match(sql, /ADD CONSTRAINT user_group_assignments_primary_no_overlap[\s\S]*EXCLUDE USING gist/i);
  assert.match(sql, /DROP POLICY IF EXISTS "admins manage audit logs"[\s\S]*FOR SELECT TO authenticated/i);
  assert.match(sql, /CREATE POLICY "active users append own audit logs"[\s\S]*FOR INSERT TO authenticated[\s\S]*actor_id = auth\.uid\(\)/i);
  assert.match(sql, /GRANT INSERT ON TABLE public\.audit_logs TO authenticated/i);
  const mutationPolicies = [...sql.matchAll(/CREATE POLICY "([^"]+)"[\s\S]{0,120}\bFOR\s+(INSERT|UPDATE|DELETE|ALL)\b/gi)]
    .map((match) => match[1]);
  assert.deepEqual(mutationPolicies, ["active users append own audit logs"]);
});

test("rollback preserves data and restores legacy module authority", () => {
  const sql = read("../../database/supabase-access-control-rollback.sql");

  assert.match(sql, /UPDATE public\.authorization_module_modes[\s\S]*SET mode = 'legacy'/i);
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE)\b/i);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.get_my_effective_access\(\)/i);
  assert.match(sql, /to_regprocedure\('public\.get_my_effective_access\(\)'\) IS NOT NULL/i);
});

test("clean and incremental schemas include the reviewed foundation", () => {
  const foundation = read("../../database/supabase-access-control-foundation.sql").trim();
  for (const path of ["../../database/supabase-schema.sql", "../../database/supabase-upload-fix.sql"]) {
    const sql = read(path);
    const match = sql.match(/-- BEGIN ACCESS CONTROL FOUNDATION\r?\n-- Mirrored from database\/supabase-access-control-foundation\.sql\.\r?\n([\s\S]*?)\r?\n-- END ACCESS CONTROL FOUNDATION/i);
    assert.ok(match, `${path} foundation markers missing`);
    assert.equal(match[1].trim(), foundation, `${path} foundation mirror drifted`);
  }
});

test("seed contains the complete catalogue, protected roles, teams, and exact bundles", () => {
  const sql = read("../../database/supabase-access-control-seed.sql");
  const permissionSection = sql.match(/-- BEGIN PERMISSION CATALOGUE([\s\S]*?)-- END PERMISSION CATALOGUE/i)?.[1] ?? "";
  const bundleSection = sql.match(/-- BEGIN ROLE PERMISSION BUNDLES([\s\S]*?)-- END ROLE PERMISSION BUNDLES/i)?.[1] ?? "";
  const seededPermissions = new Set([...permissionSection.matchAll(/\('([^']+)'\s*,/g)].map((match) => match[1]));
  const seededBundles = [...bundleSection.matchAll(/\('([^']+)'\s*,\s*'([^']+)'\)/g)];
  const bundlesByRole = new Map();

  for (const [, role, permission] of seededBundles) {
    const permissions = bundlesByRole.get(role) ?? [];
    permissions.push(permission);
    bundlesByRole.set(role, permissions);
  }
  if (/SELECT\s+'system_administrator'\s*,\s*(?:permission_id|id)\s+FROM\s+(?:public\.)?permissions/i.test(sql)) {
    bundlesByRole.set("system_administrator", Object.values(PERMISSIONS));
  }

  const expectedBundles = {
    chief: [
      "dashboard.access", "notifications.view", "groups.view_assigned", "attendance.view",
      "attendance.record", "forms.fill", "forms.view_own_submissions", "calendar.view",
      "documents.view", "archived_years.view"
    ],
    forms_manager: [
      "forms.create", "forms.templates.view", "forms.templates.manage", "forms.post.request",
      "forms.responses.view_group"
    ],
    media_contributor: [
      "content.create", "content.submit", "content.edit_own", "media.view", "media.upload",
      "media.edit_own", "albums.create"
    ],
    media_manager: [
      "media.view", "media.upload", "media.edit_own", "media.edit_all", "media.approve",
      "media.publish", "media.delete", "albums.create", "albums.manage"
    ],
    finance_viewer: ["finance.view"],
    finance_contributor: [
      "finance.view", "finance.create_transaction", "finance.edit_own_transaction", "finance.upload_receipt"
    ],
    finance_approver: ["finance.view", "finance.approve_transaction", "finance.export"],
    storage_assistant: ["storage.view", "storage.issue_items", "storage.record_returns"],
    storage_manager: Object.values(PERMISSIONS).filter((permission) => permission.startsWith("storage.")),
    content_approver: ["content.approve", "content.publish", "media.approve", "media.publish"],
    access_administrator: [
      "users.view", "users.invite", "users.reset_password", "users.disable", "users.reactivate", "users.assign_roles",
      "users.assign_groups", "users.assign_teams", "roles.view", "audit_logs.view"
    ],
    system_administrator: Object.values(PERMISSIONS)
  };

  assert.equal(Object.values(PERMISSIONS).length, 115);
  assert.deepEqual([...seededPermissions].sort(), Object.values(PERMISSIONS).sort());

  for (const [role, permissions] of Object.entries(expectedBundles)) {
    assert.deepEqual((bundlesByRole.get(role) ?? []).sort(), permissions.sort(), `${role} bundle mismatch`);
  }

  for (const role of Object.keys(expectedBundles)) {
    assert.match(sql, new RegExp(`\\('${role}'[\\s\\S]{0,180}true`, "i"), `${role} is not protected`);
  }

  for (const team of ["media", "forms", "events", "website", "finance", "storage"]) {
    assert.match(sql, new RegExp(`\\('${team}'[\\s\\S]{0,140}true`, "i"), `${team} team missing`);
  }

  for (const permission of [
    "finance.approve_transaction", "finance.export", "finance.manage_categories", "finance.manage_settings",
    "storage.adjust_quantity", "storage.write_off", "storage.audit", "storage.export", "storage.manage_categories"
  ]) {
    assert.match(permissionSection, new RegExp(`\\('${permission.replaceAll(".", "\\.")}'[\\s\\S]{0,220}true`, "i"), `${permission} must require MFA`);
  }

  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.(user_role_assignments|user_team_memberships)/i);
  assert.doesNotMatch(sql, /CREATE\s+TEMP(?:ORARY)?\s+TABLE/i);
  assert.doesNotMatch(sql, /CREATE\s+(?:SCHEMA|TABLE)\s+access_control_seed/i);
  assert.match(sql, /WITH desired_access_control_permissions[\s\S]*INSERT INTO public\.permissions/i);
  assert.match(sql, /DO \$\$[\s\S]*DELETE FROM public\.role_permissions[\s\S]*INSERT INTO public\.role_permissions/i);
  assert.doesNotMatch(
    sql,
    /DELETE\s+FROM\s+public\.role_permissions[\s\S]*?USING\s+desired_access_control_permissions/i,
    "protected-role cleanup must remove stale grants outside the current catalogue"
  );
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/i);
  assert.match(sql, /ON CONFLICT \(role_id, permission_id\) DO NOTHING/i);
});

test("effective-access SQL helpers are scoped, MFA-aware, and safely exposed", () => {
  const sql = read("../../database/supabase-access-control-foundation.sql");
  const behaviorSql = read("../../database/tests/access-control-foundation.sql");
  const getFunctionBlock = (name) => sql.match(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i")
  )?.[0] ?? "";
  const helpers = [
    "is_active_dashboard_user", "has_permission", "has_global_permission", "has_group_access",
    "has_team_access", "has_permission_for_group", "has_permission_for_team",
    "has_permission_for_event", "has_required_aal", "get_my_effective_access"
  ];

  for (const helper of helpers) {
    const block = getFunctionBlock(helper);
    assert.notEqual(block, "", `${helper} missing`);
    assert.match(
      block,
      /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public/i,
      `${helper} must use a fixed definer search path`
    );
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${helper}\\(`, "i"), `${helper} public revoke missing`);
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${helper}\\([^;]*?FROM anon`, "i"),
      `${helper} explicit anon revoke missing`
    );
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${helper}\\([^;]*?FROM authenticated`, "i"),
      `${helper} authenticated reset revoke missing`
    );
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${helper}\\([^;]*?TO authenticated`, "i"),
      `${helper} final authenticated grant missing`
    );
  }

  assert.doesNotMatch(sql, /FUNCTION public\.[a-z_]+\([^)]*user_id/i);
  assert.match(sql, /ura\.starts_at <= now\(\)[\s\S]*ura\.expires_at IS NULL OR ura\.expires_at > now\(\)/i);
  assert.match(sql, /upo\.effect = 'deny'/i);
  assert.match(sql, /ura\.scope_type = 'global'/i);
  assert.match(sql, /ura\.scope_type = 'group'[\s\S]*ura\.scope_id = target_group_id/i);
  assert.match(sql, /ura\.scope_type = 'team'[\s\S]*ura\.scope_id = target_team_id::text/i);
  assert.match(getFunctionBlock("has_permission_for_team"), /public\.teams[\s\S]*t\.is_active/i);
  assert.match(sql, /ura\.scope_type = 'event'[\s\S]*ura\.scope_id = target_event_id/i);

  for (const helper of [
    "has_permission", "has_global_permission", "has_permission_for_group",
    "has_permission_for_team", "has_permission_for_event"
  ]) {
    assert.match(
      getFunctionBlock(helper),
      /public\.has_required_aal\(target_permission\)/i,
      `${helper} must enforce AAL`
    );
  }

  for (const key of ["accountStatus", "roles", "permissions", "groupAssignments", "teamMemberships", "restrictions", "generatedAt"]) {
    assert.match(sql, new RegExp(`'${key}'`), `effective-access payload missing ${key}`);
  }
  assert.match(sql, /COALESCE\s*\(\s*jsonb_agg[\s\S]*?'\[\]'::jsonb/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.get_my_effective_access\(\) TO anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_my_effective_access\(\) TO authenticated/i);
  assert.match(getFunctionBlock("has_required_aal"), /COALESCE\s*\([\s\S]*false[\s\S]*\)/i);
  assert.match(behaviorSql, /inactive permission returned true/i);
  assert.match(behaviorSql, /inactive team retained permission/i);
});

test("legacy backfill is idempotent, reviewable, and never assigns finance or storage roles", () => {
  const sql = read("../../database/supabase-access-control-backfill.sql");

  assert.match(sql, /'admin'[\s\S]*'system_administrator'[\s\S]*'global'/i);
  assert.match(sql, /chief_level[\s\S]*'head'[\s\S]*'head_chief'/i);
  assert.match(sql, /chief_level[\s\S]*'vice'[\s\S]*'vice_chief'/i);
  assert.match(sql, /coordinator_group_ids[\s\S]*unnest/i);
  assert.match(sql, /manage_form_templates[\s\S]*'forms_manager'/i);
  assert.match(sql, /post_forms[\s\S]*forms\.post\.approve/i);
  assert.match(sql, /view_all_forms[\s\S]*forms\.responses\.view_all/i);
  assert.match(sql, /can_publish[\s\S]*content\.publish/i);
  assert.ok((sql.match(/\bNOT EXISTS\s*\(/gi) ?? []).length >= 10, "backfill must guard every generated row");
  assert.match(sql, /legacy_access_control_snapshot/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.user_profiles|DELETE\s+FROM\s+public\.user_profiles/i);
  assert.doesNotMatch(sql, /'finance_(viewer|contributor|approver)'|'storage_(assistant|manager)'/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.user_team_memberships/i);
});
