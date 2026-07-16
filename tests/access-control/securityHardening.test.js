import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function functionBody(sql, name) {
  const pattern = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${name}\\([^)]*\\)[\\s\\S]*?AS\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
    "i"
  );
  return sql.match(pattern)?.[1] ?? "";
}

test("admin compatibility functions never trust mutable JWT metadata", () => {
  for (const path of [
    "../../database/supabase-schema.sql",
    "../../database/supabase-upload-fix.sql",
    "../../database/supabase-security-hardening.sql"
  ]) {
    const body = functionBody(read(path), "is_admin");
    assert.ok(body, `is_admin missing from ${path}`);
    assert.doesNotMatch(body, /user_metadata|app_metadata|auth\.jwt/i);
  }
});

test("hardening migration makes sensitive storage private and permission-scoped", () => {
  const sql = read("../../database/supabase-security-hardening.sql");
  assert.match(sql, /WHERE id = 'scouts-files'[\s\S]*?SET public = false|SET public = false[\s\S]*?WHERE id = 'scouts-files'/i);
  assert.match(sql, /SET public = false[\s\S]*?WHERE id = 'dashboard-documents'/i);
  assert.match(sql, /bucket_id = 'scouts-files'[\s\S]*has_permission\('registered_scouts\.upload'\)/i);
  assert.match(sql, /bucket_id = 'dashboard-documents'[\s\S]*has_permission_in_any_assigned_group\('documents\.view'\)/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.notify_admin_users[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /attendance_record_scope_guard/i);
  assert.match(sql, /final active System Administrator cannot be removed or disabled/i);
});

test("high-risk user Edge Functions require exact normalized permissions", () => {
  const create = read("../../supabase/functions/create-dashboard-user/index.ts");
  const remove = read("../../supabase/functions/delete-dashboard-user/index.ts");
  const reset = read("../../supabase/functions/admin-reset-user-password/index.ts");
  const shared = read("../../supabase/functions/_shared/dashboardAuthorization.ts");

  assert.match(create, /requireDashboardPermission\(req, "users\.invite"\)/);
  assert.match(create, /inviteUserByEmail/);
  assert.doesNotMatch(create, /temporary_password|createUser\s*\(/i);
  assert.match(remove, /requireDashboardPermission\(req, "users\.delete"\)/);
  assert.match(reset, /requireDashboardPermission\(req, "users\.reset_password"\)/);
  assert.match(reset, /\/auth\/v1\/recover/);
  assert.doesNotMatch(reset, /password\s*:/i);
  assert.match(shared, /account_status !== "active"/);
  assert.match(shared, /rpc\("has_permission"/);
  assert.match(shared, /MFA-verified session/);
  assert.match(shared, /missing the required normalized permission/);
});

test("account Edge Functions use request-aware CORS for production and local development", () => {
  const cors = read("../../supabase/functions/_shared/cors.ts");
  for (const path of [
    "../../supabase/functions/create-dashboard-user/index.ts",
    "../../supabase/functions/delete-dashboard-user/index.ts",
    "../../supabase/functions/admin-reset-user-password/index.ts"
  ]) {
    const source = read(path);
    assert.match(source, /_shared\/cors\.ts/);
    assert.match(source, /corsHeaders\(req\)/);
    assert.match(source, /jsonResponse\(req,/);
  }
  assert.match(cors, /localhost\|127\\\.0\\\.0\\\.1/);
  assert.match(cors, /ALLOWED_ORIGINS/);
  assert.match(cors, /"Vary": "Origin"/);
});

test("frontend auth and bootstrap paths fail closed per authenticated user", () => {
  const auth = read("../../src/services/authService.js");
  const users = read("../../src/services/userService.js");
  const route = read("../../src/auth/ProtectedRoute.jsx");
  const cache = read("../../src/api/useBootstrap.js");
  const client = read("../../src/api/client.js");

  assert.doesNotMatch(auth, /user_metadata|app_metadata/);
  assert.match(auth, /accountStatus !== "active"/);
  assert.match(
    auth,
    /signInWithPassword[\s\S]*storeSupabaseSession\(response\)[\s\S]*getProfileById\(response\.user\.id\)/,
    "password login must establish the new session before the RLS-protected profile lookup"
  );
  assert.doesNotMatch(
    users,
    /getSupabaseRows\("profiles"/,
    "profile loading must not fall back to the nonexistent legacy profiles table"
  );
  assert.match(route, /accountStatus !== "active"/);
  assert.match(cache, /cachedBootstrapUserId/);
  assert.match(cache, /inFlightBootstrapUserId === userId/);
  assert.doesNotMatch(client, /\.catch\(\(\) => request\(/);
});

test("Supabase invitation hashes are bridged out of HashRouter and accepted safely", () => {
  const main = read("../../src/main.jsx");
  const app = read("../../src/App.jsx");
  const auth = read("../../src/services/authService.js");
  const invitePage = read("../../src/pages/AcceptInvitationPage.jsx");
  const edgeFunction = read("../../supabase/functions/create-dashboard-user/index.ts");

  assert.match(main, /scouts-supabase-auth-callback/);
  assert.match(main, /access_token/);
  assert.match(main, /#\/accept-invite/);
  assert.match(app, /path="accept-invite"/);
  assert.match(auth, /consumeInvitationCallback/);
  assert.match(auth, /storeSupabaseSession/);
  assert.match(invitePage, /updateCurrentUserPassword/);
  assert.match(invitePage, /Invitation links are single-use/);
  assert.match(edgeFunction, /redirectTo/);
});

test("legacy access backfill preserves omitted flags as review items", () => {
  const sql = read("../../database/supabase-access-control-backfill.sql");
  assert.match(sql, /'can_create_group_meetings', p\.can_create_group_meetings/);
  assert.match(sql, /'can_edit_scouts', p\.can_edit_scouts/);
  assert.match(sql, /calendar\.create_group_event[\s\S]*can_create_group_meetings/i);
  assert.match(sql, /scouts\.update[\s\S]*can_edit_scouts/i);
  assert.match(sql, /FROM public\.user_permissions up/i);
});
