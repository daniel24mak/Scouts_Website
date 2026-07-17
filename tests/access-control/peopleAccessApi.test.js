import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../database/supabase-people-access-api.sql", import.meta.url), "utf8");

test("People and Access API exposes aggregated reads without opening normalized tables", () => {
  assert.match(sql, /FUNCTION public\.get_people_access_workspace\(\)/i);
  assert.match(sql, /FUNCTION public\.get_user_access_details\(target_user_id uuid\)/i);
  assert.match(sql, /require_people_access_permission\('users\.view'\)/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:TABLE\s+)?public\.(?:user_role_assignments|user_group_assignments|user_team_memberships|user_permission_overrides)/i);
});

test("user activity lookup qualifies the audit target column", () => {
  assert.match(sql, /FROM public\.audit_logs\s+activity_log\s+WHERE activity_log\.target_user_id = p\.id/i);
  assert.doesNotMatch(sql, /FROM public\.audit_logs\s+WHERE target_user_id = p\.id/i);
});

test("workspace and user details expose legacy coordinator groups during migration", () => {
  const occurrences = sql.match(/'coordinator_group_ids',\s*COALESCE\(p\.coordinator_group_ids,\s*ARRAY\[\]::text\[\]\)/gi) ?? [];
  assert.equal(occurrences.length, 2);
});

test("every normalized mutation is permission checked, audited, and security definer scoped", () => {
  for (const [name, permission] of [
    ["save_user_role_assignment", "users.assign_roles"], ["save_user_group_assignment", "users.assign_groups"],
    ["save_user_team_membership", "users.assign_teams"], ["save_user_permission_override", "permissions.manage"],
    ["save_access_role", "roles.create"], ["save_access_team", "users.assign_teams"]
  ]) {
    const start = sql.search(new RegExp(`FUNCTION public\\.${name}\\(`, "i"));
    assert.ok(start >= 0, `${name} must exist`);
    const body = sql.slice(start, start + 6000);
    assert.match(body, /SECURITY DEFINER/i, `${name} must be security definer`);
    assert.match(body, /SET search_path = pg_catalog, public/i, `${name} must fix search_path`);
    if (name === "save_access_role") {
      assert.match(body, /require_people_access_permission\(CASE WHEN creating THEN 'roles\.create' ELSE 'roles\.update' END\)/i);
    } else {
      assert.match(body, new RegExp(`require_people_access_permission\\('${permission.replaceAll(".", "\\.")}'\\)`, "i"), `${name} must check ${permission}`);
    }
    assert.match(body, /write_people_access_audit/i, `${name} must audit`);
  }
});

test("system administrator and high-risk changes have defense in depth", () => {
  assert.match(sql, /final active System Administrator cannot be removed/i);
  assert.match(sql, /risk_level = 'high'[\s\S]*auth\.jwt\(\) ->> 'aal'/i);
  assert.match(sql, /is_system_role[\s\S]*Protected system roles cannot be deleted/i);
});

test("RPC execution is authenticated-only and direct table authority remains revoked", () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_people_access_workspace\(\) FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_people_access_workspace\(\) TO authenticated/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+(?:TABLE\s+)?public\./i);
});

test("composite rows are never mixed with scalar INTO targets", () => {
  assert.doesNotMatch(
    sql,
    /SELECT\s+to_jsonb\([^)]*\)\s*,\s*\w+\s+INTO\s+previous\s*,\s*saved/i,
    "PL/pgSQL rejects a composite saved row when it is mixed with a scalar INTO target"
  );
  assert.doesNotMatch(
    sql,
    /SELECT\s+(?:x|r)\s+INTO\s+saved\s+FROM/i,
    "typed row variables must receive expanded columns, not a single composite value"
  );
});

test("custom roles and teams can be deleted while built-in catalogs remain protected", () => {
  assert.match(sql, /FUNCTION public\.delete_access_role\(target_role_id text, reason text\)/i);
  assert.match(sql, /FUNCTION public\.delete_access_team\(target_team_id uuid, reason text\)/i);
  assert.match(sql, /saved\.is_system_role[\s\S]*Protected system roles cannot be deleted/i);
  assert.match(sql, /saved\.key\s*=\s*ANY\s*\(ARRAY\['media','forms','events','website','finance','storage'\]/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.delete_access_team\(uuid,text\) TO authenticated/i);
});

test("removing a user assignment deletes the membership while preserving audit history", () => {
  for (const [functionName, table] of [
    ["revoke_user_role_assignment", "user_role_assignments"],
    ["revoke_user_group_assignment", "user_group_assignments"],
    ["revoke_user_team_membership", "user_team_memberships"]
  ]) {
    const start = sql.search(new RegExp(`FUNCTION public\\.${functionName}\\(`, "i"));
    const body = sql.slice(start, start + 2600);
    assert.match(body, new RegExp(`DELETE FROM public\\.${table}`, "i"));
    assert.match(body, /write_people_access_audit/i);
  }
});

test("retiring an account revokes access without deleting contribution attribution", () => {
  const start = sql.search(/FUNCTION public\.retire_dashboard_user\(target_user_id uuid, reason text\)/i);
  assert.ok(start >= 0, "retire_dashboard_user must exist");
  const body = sql.slice(start, start + 7000);
  assert.match(body, /require_people_access_permission\('users\.delete'\)/i);
  assert.match(body, /DELETE FROM public\.user_role_assignments WHERE user_id=target_user_id/i);
  assert.match(body, /DELETE FROM public\.user_group_assignments WHERE user_id=target_user_id/i);
  assert.match(body, /DELETE FROM public\.user_team_memberships WHERE user_id=target_user_id/i);
  assert.match(body, /account_status\s*=\s*'archived'/i);
  assert.doesNotMatch(body, /DELETE FROM public\.user_profiles/i);
  assert.match(body, /write_people_access_audit\(\s*'user_retired'/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.retire_dashboard_user\(uuid,text\) TO authenticated/i);
});
