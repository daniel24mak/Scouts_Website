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
});
