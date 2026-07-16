# Access Control Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the normalized, scoped authorization foundation and compatibility reporting without changing which existing users are currently allowed to use any module.

**Architecture:** This first release is additive. It upgrades the existing role, permission, and audit tables; adds normalized assignments and secure SQL resolvers; backfills legacy profiles idempotently; and exposes an effective-access snapshot to the frontend in shadow mode. Legacy authorization remains authoritative for application behavior until later module-specific plans pass comparison and RLS gates.

**Tech Stack:** React 18, Vite 6, JavaScript ES modules, Supabase Auth, PostgreSQL, RLS, PL/pgSQL, Supabase REST/RPC, Node's built-in test runner, Supabase CLI where available.

## Global Constraints

- Preserve all existing users, authentication, routes, dashboards, forms, submissions, attendance, content, media, documents, notifications, approvals, and group assignments.
- Do not delete, rename, or stop writing legacy authorization columns in this release.
- Do not switch any current module from legacy authorization to normalized authorization in this release.
- Do not silently grant broader access or remove existing access.
- Do not trust Auth user metadata as an authorization source.
- Do not expose or log service-role keys, access tokens, refresh tokens, passwords, or raw sessions.
- Seed the full Finance and Storage permission catalogues, protected roles, and organizational teams in Release 1. Keep those roles unassigned by default, never infer them from team membership, and require matching resource-level backend authorization before any data is exposed.
- Do not apply production SQL until a recoverable Supabase backup and live-schema preflight have been confirmed.
- Do not commit or push changes unless the user explicitly approves that Git operation.
- Use `npm run build` after frontend changes. The project currently has no lint script.

---

## Delivery Roadmap

This plan implements Releases 0 and 1. Later releases require separate implementation plans after this foundation is deployed and its compatibility report is reviewed.

1. **Release 0: Preflight and test harness** - live schema inventory, backup gate, repository baseline, pure resolver tests.
2. **Release 1: Additive foundation** - normalized tables, current-module plus Finance and Storage permission catalogues, protected role and team seeds, assignments, helpers, backfill, effective-access RPC, compatibility report.
3. **Release 2: Frontend centralization** - authorization context, centralized navigation, permission gates, Access Denied route, metadata fallback removal.
4. **Release 3: Forms and Content/Media RLS** - scoped RLS and service checks, creator/approver separation.
5. **Release 4: Scouts, Attendance, Equipes, Documents, and Website Content RLS** - resource-scoped policies and correction/delete rules.
6. **Release 5: Finance and Storage enforcement** - separately approved module resources, scoped RLS, private receipts/files, MFA, Finance self-approval prevention, inventory invariants, and isolation tests.
7. **Release 6: People & Access and Edge Functions** - invitations, roles, teams, access reviews, MFA, session revocation, last-administrator protection, strict CORS, trusted auditing.
8. **Release 7: Legacy retirement** - only after all comparisons, tests, rollback drills, and production account reviews pass.

## File Map

### Create in this release

- `database/supabase-access-control-preflight.sql`: read-only live schema and access inventory.
- `database/supabase-access-control-foundation.sql`: additive schema, constraints, indexes, RLS, and helper functions.
- `database/supabase-access-control-seed.sql`: idempotent current-module, Finance, and Storage permission, protected-role, and team seeds.
- `database/supabase-access-control-backfill.sql`: idempotent legacy-to-normalized assignment migration.
- `database/supabase-access-control-rollback.sql`: disables normalized authority and execute grants without deleting migrated data.
- `database/tests/access-control-foundation.sql`: transactional SQL helper and isolation tests.
- `src/services/accessControlCatalog.js`: stable permission and scope constants shared by frontend code.
- `src/services/accessControlResolver.js`: pure effective-access normalization and compatibility comparison helpers.
- `src/services/accessControlService.js`: Supabase RPC access snapshot loader.
- `tests/access-control/accessControlResolver.test.js`: Node tests for pure access resolution.

### Modify in this release

- `package.json`: add the non-browser authorization unit-test command.
- `src/services/supabaseMappers.js`: attach a shadow-mode effective-access snapshot without changing legacy fields.
- `src/api/client.js`: load effective access during dashboard bootstrap and expose migration differences to admins.
- `src/pages/AdminDashboardPage.jsx`: add an admin-only read-only migration comparison panel under Reports.
- `database/supabase-schema.sql`: append the additive foundation include-equivalent for clean installations.
- `database/supabase-upload-fix.sql`: append the idempotent foundation include-equivalent for existing installations.
- `docs/security/access-control.md`: document schema, resolution, migration, rollback, and developer rules.

## Interfaces

```js
// src/services/accessControlCatalog.js
export const SCOPE_TYPES = Object.freeze(["global", "group", "team", "event", "own_records"]);
export const ACCOUNT_STATUSES = Object.freeze(["invited", "active", "disabled", "suspended", "archived"]);
export const ROLE_KEYS = Object.freeze({
  CHIEF: "chief",
  MEDIA_CONTRIBUTOR: "media_contributor",
  MEDIA_MANAGER: "media_manager",
  FINANCE_VIEWER: "finance_viewer",
  FINANCE_CONTRIBUTOR: "finance_contributor",
  FINANCE_APPROVER: "finance_approver",
  STORAGE_ASSISTANT: "storage_assistant",
  STORAGE_MANAGER: "storage_manager",
  FORMS_MANAGER: "forms_manager",
  CONTENT_APPROVER: "content_approver",
  ACCESS_ADMINISTRATOR: "access_administrator",
  SYSTEM_ADMINISTRATOR: "system_administrator"
});
export const TEAM_KEYS = Object.freeze({
  MEDIA: "media",
  FORMS: "forms",
  EVENTS: "events",
  WEBSITE: "website",
  FINANCE: "finance",
  STORAGE: "storage"
});
export const PERMISSIONS = Object.freeze({
  DASHBOARD_ACCESS: "dashboard.access",
  NOTIFICATIONS_VIEW: "notifications.view",
  AI_USE: "ai.use",
  GROUPS_VIEW_ASSIGNED: "groups.view_assigned",
  GROUPS_MANAGE: "groups.manage",
  SCOUTS_VIEW: "scouts.view",
  SCOUTS_CREATE: "scouts.create",
  SCOUTS_UPDATE: "scouts.update",
  SCOUTS_MOVE_GROUP: "scouts.move_group",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_RECORD: "attendance.record",
  ATTENDANCE_CORRECT: "attendance.correct",
  ATTENDANCE_DELETE_SESSION: "attendance.delete_session",
  FORMS_FILL: "forms.fill",
  FORMS_CREATE: "forms.create",
  FORMS_TEMPLATES_MANAGE: "forms.templates.manage",
  FORMS_POST_REQUEST: "forms.post.request",
  FORMS_POST_APPROVE: "forms.post.approve",
  FORMS_RESPONSES_VIEW_GROUP: "forms.responses.view_group",
  FORMS_RESPONSES_VIEW_ALL: "forms.responses.view_all",
  CALENDAR_VIEW: "calendar.view",
  CALENDAR_CREATE_GROUP_EVENT: "calendar.create_group_event",
  CONTENT_CREATE: "content.create",
  CONTENT_SUBMIT: "content.submit",
  CONTENT_APPROVE: "content.approve",
  CONTENT_PUBLISH: "content.publish",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_APPROVE: "media.approve",
  MEDIA_PUBLISH: "media.publish",
  FINANCE_VIEW: "finance.view",
  FINANCE_CREATE_TRANSACTION: "finance.create_transaction",
  FINANCE_EDIT_OWN_TRANSACTION: "finance.edit_own_transaction",
  FINANCE_EDIT_ALL_TRANSACTIONS: "finance.edit_all_transactions",
  FINANCE_UPLOAD_RECEIPT: "finance.upload_receipt",
  FINANCE_APPROVE_TRANSACTION: "finance.approve_transaction",
  FINANCE_EXPORT: "finance.export",
  FINANCE_MANAGE_CATEGORIES: "finance.manage_categories",
  FINANCE_MANAGE_SETTINGS: "finance.manage_settings",
  STORAGE_VIEW: "storage.view",
  STORAGE_CREATE_ITEM: "storage.create_item",
  STORAGE_UPDATE_ITEM: "storage.update_item",
  STORAGE_ISSUE_ITEMS: "storage.issue_items",
  STORAGE_RECORD_RETURNS: "storage.record_returns",
  STORAGE_ADJUST_QUANTITY: "storage.adjust_quantity",
  STORAGE_WRITE_OFF: "storage.write_off",
  STORAGE_AUDIT: "storage.audit",
  STORAGE_EXPORT: "storage.export",
  STORAGE_MANAGE_CATEGORIES: "storage.manage_categories",
  DOCUMENTS_VIEW: "documents.view",
  REPORTS_VIEW: "reports.view",
  CONTACT_MESSAGES_VIEW: "contact_messages.view",
  WEBSITE_CONTENT_EDIT: "website_content.edit",
  USERS_VIEW: "users.view",
  USERS_INVITE: "users.invite",
  USERS_ASSIGN_ROLES: "users.assign_roles",
  USERS_ASSIGN_GROUPS: "users.assign_groups",
  ROLES_VIEW: "roles.view",
  AUDIT_LOGS_VIEW: "audit_logs.view",
  SYSTEM_SETTINGS_MANAGE: "system_settings.manage"
});
```

```js
// src/services/accessControlResolver.js
export function normalizeEffectiveAccess(payload = {}) {}
export function hasEffectivePermission(access, permissionKey, scope = null) {}
export function getAccessibleGroupIds(access) {}
export function compareLegacyAndNormalized({ legacyAllowed, normalizedAllowed, permissionKey, scope }) {}
```

```js
// src/services/accessControlService.js
export function createAccessControlService(dependencies = {}) {}
export async function getMyEffectiveAccess() {}
export async function getAuthorizationMigrationDifferences({ limit = 200 } = {}) {}
```

The database RPC `public.get_my_effective_access()` returns one JSON object:

```json
{
  "accountStatus": "active",
  "roles": [{ "key": "chief", "scopeType": "group", "scopeId": "louvetoux", "expiresAt": null }],
  "permissions": [{ "key": "attendance.record", "scopeType": "group", "scopeId": "louvetoux", "source": "chief" }],
  "groupAssignments": [{ "groupId": "louvetoux", "position": "head_chief", "isPrimary": true, "expiresAt": null }],
  "teamMemberships": [],
  "restrictions": [],
  "generatedAt": "2026-07-15T00:00:00Z"
}
```

---

### Task 1: Add the read-only production preflight

**Files:**
- Create: `database/supabase-access-control-preflight.sql`

**Interfaces:**
- Consumes: live PostgreSQL catalog and current Supabase tables.
- Produces: read-only result sets covering schema, RLS, policies, functions, buckets, legacy account distribution, and migration conflicts.

- [ ] **Step 1: Add the read-only preflight SQL**

The script must begin with a read-only transaction and include these exact checks:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name, now() AS inspected_at;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles', 'roles', 'permissions', 'role_permissions',
    'user_permissions', 'audit_logs', 'groups'
  )
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin', 'is_coordinator_for_group', 'can_manage_group',
    'can_take_equipe_attendance', 'can_manage_form_templates',
    'can_post_forms', 'can_view_all_forms'
  )
ORDER BY routine_name;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT role, chief_level, account_status, count(*) AS users
FROM public.user_profiles
GROUP BY role, chief_level, account_status
ORDER BY role, chief_level, account_status;

SELECT
  count(*) FILTER (WHERE is_coordinator) AS coordinator_flags,
  count(*) FILTER (WHERE cardinality(coordinator_group_ids) > 1) AS multi_group_profiles,
  count(*) FILTER (WHERE can_publish) AS can_publish_profiles,
  count(*) FILTER (WHERE can_create_group_meetings) AS meeting_profiles,
  count(*) FILTER (WHERE can_edit_scouts) AS scout_edit_profiles,
  count(*) FILTER (WHERE manage_form_templates) AS form_template_profiles,
  count(*) FILTER (WHERE post_forms) AS form_post_profiles,
  count(*) FILTER (WHERE view_all_forms) AS all_form_response_profiles
FROM public.user_profiles;

ROLLBACK;
```

- [ ] **Step 2: Run the preflight against a local Supabase database**

Run:

```powershell
supabase db reset
supabase db query --file database/supabase-access-control-preflight.sql
```

Expected: all statements return result sets and the script ends with `ROLLBACK`; no rows or schemas are changed.

- [ ] **Step 3: Stop at the production backup gate**

Before any production migration, record confirmation in the task notes that a recoverable Supabase backup exists and save the live preflight output outside Git because it may contain operational account counts.

Suggested commit after approval:

```powershell
git add database/supabase-access-control-preflight.sql
git commit -m "docs: add access control preflight"
```

---

### Task 2: Add pure authorization tests and catalogue constants

**Files:**
- Create: `src/services/accessControlCatalog.js`
- Create: `src/services/accessControlResolver.js`
- Create: `tests/access-control/accessControlResolver.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: normalized effective-access payloads.
- Produces: stable permission constants, pure permission checks, group extraction, and compatibility comparisons.

- [ ] **Step 1: Add the failing resolver tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  compareLegacyAndNormalized,
  getAccessibleGroupIds,
  hasEffectivePermission,
  normalizeEffectiveAccess
} from "../../src/services/accessControlResolver.js";

test("normalizes an empty payload to denied access", () => {
  const access = normalizeEffectiveAccess();
  assert.equal(access.accountStatus, "missing");
  assert.deepEqual(access.permissions, []);
  assert.equal(hasEffectivePermission(access, "dashboard.access"), false);
});

test("requires active account status", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "disabled",
    permissions: [{ key: "dashboard.access", scopeType: "global", scopeId: null }]
  });
  assert.equal(hasEffectivePermission(access, "dashboard.access"), false);
});

test("matches a permission only inside its group scope", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [{ key: "attendance.record", scopeType: "group", scopeId: "louvetoux" }]
  });
  assert.equal(hasEffectivePermission(access, "attendance.record", { type: "group", id: "louvetoux" }), true);
  assert.equal(hasEffectivePermission(access, "attendance.record", { type: "group", id: "jeannettes" }), false);
});

test("a deny restriction wins over an allow", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    permissions: [{ key: "media.upload", scopeType: "global", scopeId: null }],
    restrictions: [{ key: "media.upload", effect: "deny", scopeType: "global", scopeId: null }]
  });
  assert.equal(hasEffectivePermission(access, "media.upload"), false);
});

test("returns unique active group assignments", () => {
  const access = normalizeEffectiveAccess({
    accountStatus: "active",
    groupAssignments: [
      { groupId: "louvetoux", position: "chief" },
      { groupId: "louvetoux", position: "head_chief" },
      { groupId: "jeannettes", position: "coordinator" }
    ]
  });
  assert.deepEqual(getAccessibleGroupIds(access), ["jeannettes", "louvetoux"]);
});

test("reports legacy and normalized mismatches", () => {
  assert.deepEqual(compareLegacyAndNormalized({
    legacyAllowed: true,
    normalizedAllowed: false,
    permissionKey: "forms.responses.view_all",
    scope: { type: "global", id: null }
  }), {
    matches: false,
    legacyAllowed: true,
    normalizedAllowed: false,
    permissionKey: "forms.responses.view_all",
    scopeType: "global",
    scopeId: null
  });
});

test("catalogue exposes independent Finance and Storage roles", async () => {
  const { ROLE_KEYS, TEAM_KEYS, PERMISSIONS } = await import("../../src/services/accessControlCatalog.js");
  assert.equal(ROLE_KEYS.FINANCE_VIEWER, "finance_viewer");
  assert.equal(ROLE_KEYS.FINANCE_CONTRIBUTOR, "finance_contributor");
  assert.equal(ROLE_KEYS.FINANCE_APPROVER, "finance_approver");
  assert.equal(ROLE_KEYS.STORAGE_ASSISTANT, "storage_assistant");
  assert.equal(ROLE_KEYS.STORAGE_MANAGER, "storage_manager");
  assert.equal(TEAM_KEYS.FINANCE, "finance");
  assert.equal(TEAM_KEYS.STORAGE, "storage");
  assert.equal(PERMISSIONS.FINANCE_APPROVE_TRANSACTION, "finance.approve_transaction");
  assert.equal(PERMISSIONS.STORAGE_ADJUST_QUANTITY, "storage.adjust_quantity");
});
```

- [ ] **Step 2: Add the test command**

Add to `package.json` scripts:

```json
"test:access-control": "node --test tests/access-control/*.test.js"
```

- [ ] **Step 3: Run the test and verify failure**

Run:

```powershell
npm run test:access-control
```

Expected: FAIL because `accessControlResolver.js` does not exist or its exports are missing.

- [ ] **Step 4: Implement the catalogue and pure resolver**

Use the constants from the Interfaces section and implement these rules:

```js
export function normalizeEffectiveAccess(payload = {}) {
  return {
    accountStatus: payload.accountStatus ?? "missing",
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    groupAssignments: Array.isArray(payload.groupAssignments) ? payload.groupAssignments : [],
    teamMemberships: Array.isArray(payload.teamMemberships) ? payload.teamMemberships : [],
    restrictions: Array.isArray(payload.restrictions) ? payload.restrictions : [],
    generatedAt: payload.generatedAt ?? null
  };
}

function scopeMatches(candidate, scope) {
  if (candidate.scopeType === "global") return true;
  if (!scope) return candidate.scopeType === "own_records";
  return candidate.scopeType === scope.type && String(candidate.scopeId ?? "") === String(scope.id ?? "");
}

export function hasEffectivePermission(accessValue, permissionKey, scope = null) {
  const access = normalizeEffectiveAccess(accessValue);
  if (access.accountStatus !== "active") return false;
  const denied = access.restrictions.some((item) => item.effect === "deny" && item.key === permissionKey && scopeMatches(item, scope));
  if (denied) return false;
  return access.permissions.some((item) => item.key === permissionKey && scopeMatches(item, scope));
}

export function getAccessibleGroupIds(accessValue) {
  const access = normalizeEffectiveAccess(accessValue);
  return [...new Set(access.groupAssignments.map((item) => item.groupId).filter(Boolean))].sort();
}

export function compareLegacyAndNormalized({ legacyAllowed, normalizedAllowed, permissionKey, scope = null }) {
  return {
    matches: Boolean(legacyAllowed) === Boolean(normalizedAllowed),
    legacyAllowed: Boolean(legacyAllowed),
    normalizedAllowed: Boolean(normalizedAllowed),
    permissionKey,
    scopeType: scope?.type ?? "global",
    scopeId: scope?.id ?? null
  };
}
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test:access-control
npm run build
```

Expected: all six authorization tests pass and Vite completes successfully.

Suggested commit after approval:

```powershell
git add package.json src/services/accessControlCatalog.js src/services/accessControlResolver.js tests/access-control/accessControlResolver.test.js
git commit -m "test: define effective access resolution"
```

---

### Task 3: Add the normalized schema additively

**Files:**
- Create: `database/supabase-access-control-foundation.sql`
- Create: `database/supabase-access-control-rollback.sql`
- Modify: `database/supabase-schema.sql`
- Modify: `database/supabase-upload-fix.sql`

**Interfaces:**
- Consumes: existing `roles`, `permissions`, `role_permissions`, `user_profiles`, `groups`, and `audit_logs` tables.
- Produces: normalized assignment, team, override, migration, review, and module-mode tables.

- [ ] **Step 1: Write a schema smoke test that references missing tables**

Add the first section of `database/tests/access-control-foundation.sql`:

```sql
BEGIN;

DO $$
BEGIN
  ASSERT to_regclass('public.user_role_assignments') IS NOT NULL, 'user_role_assignments missing';
  ASSERT to_regclass('public.user_group_assignments') IS NOT NULL, 'user_group_assignments missing';
  ASSERT to_regclass('public.teams') IS NOT NULL, 'teams missing';
  ASSERT to_regclass('public.user_team_memberships') IS NOT NULL, 'user_team_memberships missing';
  ASSERT to_regclass('public.user_permission_overrides') IS NOT NULL, 'user_permission_overrides missing';
  ASSERT to_regclass('public.authorization_migration_differences') IS NOT NULL, 'migration differences missing';
  ASSERT to_regclass('public.authorization_module_modes') IS NOT NULL, 'module modes missing';
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the smoke test and verify failure**

Run:

```powershell
supabase db reset
supabase db query --file database/tests/access-control-foundation.sql
```

Expected: FAIL with `user_role_assignments missing`.

- [ ] **Step 3: Implement the additive schema**

The migration must:

- use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for `roles`, `permissions`, `role_permissions`, `user_profiles`, and `audit_logs`;
- add constraints through guarded `DO` blocks;
- create assignment tables with UUID primary keys and foreign keys;
- add partial unique indexes for one active primary group per user and duplicate active assignments;
- enable RLS on every new table;
- grant no anonymous privileges;
- permit active users to read only their own assignments and effective access;
- permit legacy active admins to read migration differences during shadow mode;
- keep all writes restricted to trusted functions or later Edge Functions.

Upgrade the existing catalogue, profile, and audit tables without replacing them:

```sql
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
```

Add guarded check constraints for `roles.risk_level`, `permissions.risk_level`, and `user_profiles.account_status`. Add the account-status constraint as `NOT VALID` first; validate it only after the preflight confirms every existing status belongs to `invited`, `active`, `disabled`, `suspended`, or `archived`.

Use these exact table names and key constraints:

```sql
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
  CHECK ((scope_type IN ('global','own_records') AND scope_id IS NULL) OR (scope_type IN ('group','team','event') AND scope_id IS NOT NULL))
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
  key text NOT NULL UNIQUE,
  name text NOT NULL,
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
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);
```

Create the migration and review tables with these definitions:

```sql
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
  CHECK (legacy_allowed IS DISTINCT FROM normalized_allowed)
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
  ('people_access', 'shadow')
ON CONFLICT (module) DO NOTHING;
```

No module may default to `normalized`.

Create these indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_current_unique
  ON public.user_role_assignments (user_id, role_id, scope_type, COALESCE(scope_id, ''))
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_current_unique
  ON public.user_group_assignments (user_id, group_id, position)
  WHERE expires_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_group_assignments_primary_unique
  ON public.user_group_assignments (user_id)
  WHERE is_primary AND expires_at IS NULL;
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
```

Enable RLS on every new table. Add own-record SELECT policies for assignments, group assignments, memberships, and overrides. Add active-authenticated catalogue SELECT policies for active roles and permissions. During shadow mode, add legacy-active-admin SELECT policies for migration differences, module modes, access reviews, and audit logs. Do not add client INSERT, UPDATE, or DELETE policies to the normalized access tables in this release.

- [ ] **Step 4: Add non-destructive rollback controls**

`database/supabase-access-control-rollback.sql` must:

```sql
BEGIN;

UPDATE public.authorization_module_modes
SET mode = 'legacy', updated_at = now();

REVOKE EXECUTE ON FUNCTION public.get_my_effective_access() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_effective_access() FROM authenticated;

COMMIT;
```

Do not drop assignment, audit, migration, role, permission, or backfill data.

- [ ] **Step 5: Mirror the additive migration for clean and existing installations**

Append clearly marked, idempotent access-control foundation sections to `supabase-schema.sql` and `supabase-upload-fix.sql`. The standalone foundation file remains the reviewable source for this release.

- [ ] **Step 6: Reset local Supabase and rerun the smoke test**

Run:

```powershell
supabase db reset
supabase db query --file database/tests/access-control-foundation.sql
```

Expected: schema assertions pass and transaction rolls back.

---

### Task 4: Seed permissions, protected roles, and operational teams

**Files:**
- Create: `database/supabase-access-control-seed.sql`
- Modify: `database/tests/access-control-foundation.sql`

**Interfaces:**
- Consumes: upgraded `roles`, `permissions`, and `role_permissions`.
- Produces: deterministic protected roles, organizational teams, current-module permissions, and the complete Finance and Storage permission catalogues.

- [ ] **Step 1: Add failing seed assertions**

```sql
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'chief' AND is_system_role), 'chief role missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'system_administrator' AND is_system_role), 'system administrator missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_viewer' AND is_system_role), 'finance viewer missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_contributor' AND is_system_role), 'finance contributor missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'finance_approver' AND is_system_role), 'finance approver missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'storage_assistant' AND is_system_role), 'storage assistant missing';
  ASSERT EXISTS (SELECT 1 FROM public.roles WHERE id = 'storage_manager' AND is_system_role), 'storage manager missing';
  ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE id = 'dashboard.access'), 'dashboard.access missing';
  ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE id = 'forms.post.request'), 'forms.post.request missing';
  ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE id = 'finance.approve_transaction'), 'finance permissions missing';
  ASSERT EXISTS (SELECT 1 FROM public.permissions WHERE id = 'storage.adjust_quantity'), 'storage permissions missing';
  ASSERT EXISTS (SELECT 1 FROM public.teams WHERE key = 'finance' AND is_active), 'finance team missing';
  ASSERT EXISTS (SELECT 1 FROM public.teams WHERE key = 'storage' AND is_active), 'storage team missing';
  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments
    WHERE role_id IN ('finance_viewer','finance_contributor','finance_approver','storage_assistant','storage_manager')
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
  ), 'finance and storage roles must not be assigned automatically';
END $$;
```

- [ ] **Step 2: Run and verify failure**

Expected: FAIL on the first missing protected role or action permission.

- [ ] **Step 3: Add idempotent role and permission seeds**

Seed the roles, teams, and permission catalogues listed in the approved design using `INSERT ... ON CONFLICT ... DO UPDATE`. Keep existing `admin` and `chief` rows. Mark `admin` as a legacy compatibility role; seed `system_administrator` as the normalized high-risk role. Seed Finance and Storage roles without creating any user assignments.

The seed must assign:

- Chief: dashboard, notifications, assigned-group view, attendance view/record, forms fill/own submissions, calendar view, document view, archive view.
- Forms Manager: create/templates/request/group-response permissions, never posting approval by default.
- Media Contributor: upload/edit-own/create/submit, never approve or publish.
- Media Manager: media and album management including approval/publish.
- Finance Viewer: `finance.view` only. Broader report access requires a separate role or explicit scoped assignment.
- Finance Contributor: view, create transactions, edit own unapproved transactions, and upload receipts; never approve transactions.
- Finance Approver: view, approve, and export; it does not receive category/settings management by default, and resource policies must prevent self-approval.
- Storage Assistant: view, issue items, and record returns.
- Storage Manager: all seeded Storage permissions, including quantity adjustments, write-offs, audits, exports, and category management.
- Content Approver: content/media approval and publish, with separation-of-duty enforced later in resource policies.
- Access Administrator: user view/invite/disable/reactivate, normal role/group/team assignment, role view, scoped audit view; never system settings by default.
- System Administrator: every seeded permission, including Finance and Storage. Existing administrators keep legacy authority during shadow mode; normalized Finance/Storage access is not used by application modules until their backend cutover is separately reviewed.

Seed active `finance` and `storage` teams alongside Media, Forms, Events, and Website teams. Team membership grants no role or permission.

Mark at least `finance.approve_transaction`, `finance.export`, `finance.manage_categories`, `finance.manage_settings`, `storage.adjust_quantity`, `storage.write_off`, `storage.audit`, `storage.export`, and `storage.manage_categories` as `requires_mfa = true`. Role-bundle assertions must compare exact permission sets, not only test for one representative permission.

- [ ] **Step 4: Apply twice and verify idempotency**

Run the seed twice, then run:

```sql
SELECT id, count(*) FROM public.roles GROUP BY id HAVING count(*) > 1;
SELECT id, count(*) FROM public.permissions GROUP BY id HAVING count(*) > 1;
SELECT role_id, permission_id, count(*) FROM public.role_permissions GROUP BY role_id, permission_id HAVING count(*) > 1;
```

Expected: all three queries return zero rows.

---

### Task 5: Add secure effective-access SQL helpers

**Files:**
- Modify: `database/supabase-access-control-foundation.sql`
- Modify: `database/tests/access-control-foundation.sql`

**Interfaces:**
- Consumes: current authenticated user, active profile, role assignments, role permissions, group/team assignments, and overrides.
- Produces: safe boolean helpers and `get_my_effective_access()` JSON.

- [ ] **Step 1: Add failing SQL behavior tests**

Add transactional fixtures for an active Chief, disabled Chief, expired role, group-scoped permission, team-scoped Finance role, Storage role, high-risk permission, and direct deny. Team membership without a role must also be represented. Set the simulated caller with:

```sql
SELECT set_config('request.jwt.claim.sub', test_user_id::text, true);
SELECT set_config('request.jwt.claims', json_build_object('sub', test_user_id, 'aal', 'aal1')::text, true);
```

Assert:

```sql
ASSERT public.is_active_dashboard_user(), 'active user rejected';
ASSERT public.has_permission('dashboard.access'), 'dashboard permission rejected';
ASSERT public.has_permission_for_group('attendance.record', 'louvetoux'), 'assigned group rejected';
ASSERT NOT public.has_permission_for_group('attendance.record', 'jeannettes'), 'unassigned group allowed';
ASSERT NOT public.has_permission('media.upload'), 'direct deny ignored';
ASSERT NOT public.has_permission('finance.view'), 'team-scoped Finance role leaked into an unscoped check';
ASSERT public.has_permission_for_team('finance.view', finance_team_id), 'assigned Finance team rejected';
ASSERT NOT public.has_permission_for_team('finance.view', storage_team_id), 'Finance access crossed into Storage team';
ASSERT NOT public.has_permission_for_team('storage.view', finance_team_id), 'Storage access crossed into Finance team';
ASSERT NOT public.has_permission_for_team('finance.view', membership_only_team_id), 'team membership granted permission without a role';
ASSERT NOT public.has_required_aal('finance.approve_transaction'), 'aal1 accepted for high-risk Finance approval';
```

- [ ] **Step 2: Verify tests fail before helpers exist**

Expected: FAIL with `function public.is_active_dashboard_user() does not exist`.

- [ ] **Step 3: Implement helpers with fixed security settings**

Every helper must use:

```sql
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
```

Every referenced table must be fully qualified. Revoke public execution, then grant only required helpers to `authenticated`. Helpers must use `auth.uid()` and must not accept a user ID parameter.

Create `has_required_aal(target_permission)` before any helper that calls it, even though its reference implementation is shown later in this section. Use these implementations as the migration body:

```sql
CREATE OR REPLACE FUNCTION public.is_active_dashboard_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(target_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
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
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
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
LANGUAGE sql STABLE SECURITY DEFINER
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
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND upo.scope_type = 'global'
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND upo.scope_type = 'global'
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_group_access(target_group_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user() AND EXISTS (
    SELECT 1 FROM public.user_group_assignments uga
    WHERE uga.user_id = auth.uid()
      AND uga.group_id = target_group_id
      AND uga.starts_at <= now()
      AND (uga.expires_at IS NULL OR uga.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_team_access(target_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user() AND EXISTS (
    SELECT 1 FROM public.user_team_memberships utm
    JOIN public.teams t ON t.id = utm.team_id AND t.is_active
    WHERE utm.user_id = auth.uid()
      AND utm.team_id = target_team_id
      AND utm.starts_at <= now()
      AND (utm.expires_at IS NULL OR utm.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_group(target_permission text, target_group_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
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
          AND (ura.scope_type = 'global' OR (ura.scope_type = 'group' AND ura.scope_id = target_group_id))
          AND ura.starts_at <= now()
          AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid()
          AND upo.permission_id = target_permission
          AND upo.effect = 'allow'
          AND (upo.scope_type = 'global' OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id))
          AND upo.starts_at <= now()
          AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid()
        AND upo.permission_id = target_permission
        AND upo.effect = 'deny'
        AND (upo.scope_type = 'global' OR (upo.scope_type = 'group' AND upo.scope_id = target_group_id))
        AND upo.starts_at <= now()
        AND (upo.expires_at IS NULL OR upo.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_team(target_permission text, target_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid() AND rp.permission_id = target_permission
          AND (ura.scope_type = 'global' OR (ura.scope_type = 'team' AND ura.scope_id = target_team_id::text))
          AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid() AND upo.permission_id = target_permission AND upo.effect = 'allow'
          AND (upo.scope_type = 'global' OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text))
          AND upo.starts_at <= now() AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid() AND upo.permission_id = target_permission AND upo.effect = 'deny'
        AND (upo.scope_type = 'global' OR (upo.scope_type = 'team' AND upo.scope_id = target_team_id::text))
        AND upo.starts_at <= now() AND (upo.expires_at IS NULL OR upo.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission_for_event(target_permission text, target_event_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_active_dashboard_user()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id AND r.is_active
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
        WHERE ura.user_id = auth.uid() AND rp.permission_id = target_permission
          AND (ura.scope_type = 'global' OR (ura.scope_type = 'event' AND ura.scope_id = target_event_id))
          AND ura.starts_at <= now() AND (ura.expires_at IS NULL OR ura.expires_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_permission_overrides upo
        WHERE upo.user_id = auth.uid() AND upo.permission_id = target_permission AND upo.effect = 'allow'
          AND (upo.scope_type = 'global' OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id))
          AND upo.starts_at <= now() AND (upo.expires_at IS NULL OR upo.expires_at > now())
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permission_overrides upo
      WHERE upo.user_id = auth.uid() AND upo.permission_id = target_permission AND upo.effect = 'deny'
        AND (upo.scope_type = 'global' OR (upo.scope_type = 'event' AND upo.scope_id = target_event_id))
        AND upo.starts_at <= now() AND (upo.expires_at IS NULL OR upo.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_required_aal(target_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    NOT p.requires_mfa
    OR COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'aal') = 'aal2', false),
    false
  )
  FROM public.permissions p
  WHERE p.id = target_permission AND p.is_active;
$$;
```

`has_permission(target_permission)` and `has_global_permission(target_permission)` are global-only checks. Every scoped helper (`has_permission_for_group`, `has_permission_for_team`, and `has_permission_for_event`) must preserve its target-resource scope matching and add `AND public.has_required_aal(target_permission)` to the final authorization decision. No unscoped helper may authorize a group-, team-, event-, or own-record assignment.

Implement `get_my_effective_access()` as a `SECURITY DEFINER` PL/pgSQL function that first rejects a missing or inactive profile, then builds JSON arrays from active assignments only. Its permission array is the union of active role grants and active direct allows, excluding every permission/scope matched by an active direct deny. The snapshot is descriptive and must preserve each permission's scope and MFA requirement; consumers must still call a resource-aware backend helper for protected actions. Return the exact camelCase object in this plan's Interfaces section. Use `COALESCE(jsonb_agg(...), '[]'::jsonb)` for every array and `now()` for `generatedAt`.

After all functions are created:

```sql
REVOKE ALL ON FUNCTION public.is_active_dashboard_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_global_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_group_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_team_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_group(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_team(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission_for_event(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_required_aal(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_effective_access() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_dashboard_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_global_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_group_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_team_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_group(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_team(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_for_event(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_required_aal(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_access() TO authenticated;
```

Effective permission queries include only assignments where `starts_at <= now()` and `(expires_at IS NULL OR expires_at > now())`. Applicable active deny overrides exclude permission results. Account status must be `active`.

- [ ] **Step 4: Run SQL behavior tests**

Expected: active and scoped assertions pass; disabled, expired, cross-group, and denied cases remain false.

- [ ] **Step 5: Inspect query plans**

Run `EXPLAIN (ANALYZE, BUFFERS)` for `has_permission_for_group` with representative assignment volumes. Expected: indexes on user, role, permission, group, scope, and expiry paths are used; no sequential scan over large resource tables is introduced.

---

### Task 6: Backfill existing users idempotently

**Files:**
- Create: `database/supabase-access-control-backfill.sql`
- Modify: `database/tests/access-control-foundation.sql`

**Interfaces:**
- Consumes: legacy profile role, chief level, group fields, coordinator fields, and permission booleans.
- Produces: normalized role and group assignments plus migration-review differences.

- [ ] **Step 1: Add legacy fixture backfill tests**

Create fixtures for:

- one admin with no group;
- one regular Chief with one group;
- one Head Chief;
- one Vice Chief;
- one multi-group coordinator;
- one Chief with `manage_form_templates`;
- one Chief with `post_forms`;
- one Chief with `view_all_forms`.

Assert exact assignments:

```sql
ASSERT (SELECT count(*) FROM public.user_role_assignments WHERE user_id = admin_id AND role_id = 'system_administrator') = 1;
ASSERT (SELECT position FROM public.user_group_assignments WHERE user_id = head_id AND group_id = 'louvetoux') = 'head_chief';
ASSERT (SELECT count(*) FROM public.user_group_assignments WHERE user_id = coordinator_id) = 2;
ASSERT EXISTS (SELECT 1 FROM public.user_role_assignments WHERE user_id = forms_manager_id AND role_id = 'forms_manager');
```

- [ ] **Step 2: Implement deterministic backfill**

The script must use stable `INSERT ... SELECT ... WHERE NOT EXISTS` or conflict keys so rerunning it never duplicates assignments.

Mapping:

- `role = 'admin'` -> `system_administrator`, global.
- `role = 'chief'` -> one group-scoped `chief` role assignment per active group assignment. A Chief with no valid group receives an `own_records` Chief assignment and a migration difference requiring review.
- primary `group_id` -> one primary group assignment.
- `chief_level = 'head'` -> `head_chief` position.
- `chief_level = 'vice'` -> `vice_chief` position.
- all other Chief positions -> `chief`.
- additional `coordinator_group_ids` -> `coordinator` group assignments and matching group-scoped Chief role assignments.
- `manage_form_templates` -> `forms_manager` with assigned-group scopes where groups exist.
- `post_forms` -> compatibility difference requiring review; do not grant posting approval.
- `view_all_forms` -> compatibility difference requiring review before global response access.
- `can_publish` -> compatibility difference requiring review; do not grant blanket approval and publish roles.

The System Administrator backfill is the only intentional automatic source of Finance and Storage permissions because that protected role is platform-wide by definition. Do not create direct Finance/Storage role assignments or team memberships during legacy backfill. Record this exception explicitly in the migration report.

- [ ] **Step 3: Run the backfill twice**

Expected: normalized assignment counts are unchanged after the second run.

- [ ] **Step 4: Verify no legacy data changed**

Capture a checksum-style projection of legacy authorization fields before and after backfill. Expected: every profile's legacy values remain identical.

---

### Task 7: Add the frontend shadow access service

**Files:**
- Create: `src/services/accessControlService.js`
- Create: `tests/access-control/accessControlService.test.js`
- Modify: `src/services/supabaseMappers.js`
- Modify: `src/api/client.js`

**Interfaces:**
- Consumes: `get_my_effective_access` and admin-only migration-difference REST rows.
- Produces: `data.effectiveAccess` and `data.authorizationMigrationDifferences` without changing existing authorization decisions.

- [ ] **Step 1: Add failing service tests with injected request adapters**

Test that:

- RPC payload is normalized;
- RPC failure returns a denied shadow snapshot plus a safe `loadError` field;
- non-admin bootstrap does not request migration differences;
- no service reads role or permission values from Auth user metadata.

- [ ] **Step 2: Implement the service**

```js
import { callSupabaseRpc, getSupabaseRows } from "./supabaseClient.js";
import { normalizeEffectiveAccess } from "./accessControlResolver.js";

export function createAccessControlService({ callRpc = callSupabaseRpc, getRows = getSupabaseRows } = {}) {
  return {
    async getMyEffectiveAccess() {
      try {
        return normalizeEffectiveAccess(await callRpc("get_my_effective_access"));
      } catch {
        return { ...normalizeEffectiveAccess(), loadError: "Effective access could not be loaded." };
      }
    },
    getAuthorizationMigrationDifferences({ limit = 200 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
      return getRows(
        "authorization_migration_differences",
        `select=*&resolved_at=is.null&order=created_at.desc&limit=${safeLimit}`
      );
    }
  };
}

const accessControlService = createAccessControlService();
export const getMyEffectiveAccess = accessControlService.getMyEffectiveAccess;
export const getAuthorizationMigrationDifferences = accessControlService.getAuthorizationMigrationDifferences;
```

- [ ] **Step 3: Attach the snapshot to bootstrap data**

Load effective access after authentication. Load differences only for a current legacy admin during shadow mode. Do not change `permissions.js`, `isSectionAllowed`, `ProtectedRoute`, RLS authority, or section visibility in this release.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npm run test:access-control
npm run build
```

Expected: authorization tests and production build pass.

---

### Task 8: Add the admin-only migration comparison report

**Files:**
- Modify: `src/pages/AdminDashboardPage.jsx`
- Modify: `src/styles.css`
- Modify: `tests/dashboard-dark-mode-audit.spec.js`

**Interfaces:**
- Consumes: `data.authorizationMigrationDifferences`.
- Produces: a read-only Reports subsection showing mismatches, reasons, scope, age, and resolution status.

- [ ] **Step 1: Add a failing Playwright assertion**

For an admin fixture with migration differences, assert the Reports page contains:

- `Authorization migration review`
- permission key
- legacy result
- normalized result
- scope
- created timestamp

For a Chief fixture, assert that heading is absent.

- [ ] **Step 2: Implement the read-only panel**

The panel must not include approve, delete, resolve, or cutover actions in this release. It may filter by module, match state, permission, and user. It must show a clear empty state when there are no unresolved differences.

- [ ] **Step 3: Style with existing dashboard tokens**

Search existing report/table selectors before editing. Add no broad global overrides. Ensure light/dark readability and mobile horizontal overflow only inside the comparison table.

- [ ] **Step 4: Run visual and build checks**

Run:

```powershell
npm run test:dark-mode
npm run build
```

Expected: dark-mode audit passes and Vite build succeeds.

---

### Task 9: Document operation and rollback

**Files:**
- Create: `docs/security/access-control.md`

**Interfaces:**
- Consumes: final foundation schema and services.
- Produces: operator and developer documentation.

- [ ] **Step 1: Document the schema and resolver**

Include:

- identity versus authorization fields;
- roles, permissions, assignments, scopes, teams, overrides;
- deny precedence;
- expiry behavior;
- MFA field semantics;
- group-position derivation;
- current shadow-mode authority.

- [ ] **Step 2: Document migration and rollback commands**

Include exact local commands:

```powershell
supabase db reset
supabase db query --file database/supabase-access-control-preflight.sql
supabase db query --file database/supabase-access-control-foundation.sql
supabase db query --file database/supabase-access-control-seed.sql
supabase db query --file database/supabase-access-control-backfill.sql
supabase db query --file database/tests/access-control-foundation.sql
```

Production instructions must use the Supabase SQL editor or the project's approved migration deployment process and require backup confirmation first.

- [ ] **Step 3: Add the developer security rule**

Quote exactly:

> Never authorize an action only because a component, button, or route is hidden. Every protected action must also be authorized by the database or trusted server-side code.

---

### Task 10: Foundation verification checkpoint

**Files:**
- No source changes.

**Interfaces:**
- Consumes: all Release 0 and Release 1 deliverables.
- Produces: evidence for deciding whether Release 2 planning may begin.

- [ ] **Step 1: Run repository checks**

```powershell
npm run test:access-control
npm run test:dark-mode
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 2: Run database checks**

```powershell
supabase db reset
supabase db query --file database/supabase-access-control-seed.sql
supabase db query --file database/supabase-access-control-backfill.sql
supabase db query --file database/supabase-access-control-backfill.sql
supabase db query --file database/tests/access-control-foundation.sql
```

Expected: reset succeeds, duplicate backfill is idempotent, and all SQL assertions pass.

- [ ] **Step 3: Verify representative effective-access snapshots**

Verify active Admin, Chief, Head Chief, Vice Chief, coordinator, permissioned Chief, Finance Viewer, Finance Contributor, Finance Approver, Storage Assistant, Storage Manager, team-membership-only, disabled account, expired assignment, and direct-deny fixtures. Confirm:

- Finance and Storage catalogues contain every approved key;
- each protected role has the exact intended bundle and no cross-module permissions;
- team membership alone grants nothing;
- team-scoped access is denied for the wrong team and by unscoped helpers;
- `aal1` fails high-risk Finance/Storage permission checks;
- no non-administrator receives Finance/Storage assignments during backfill;
- the documented System Administrator exception is the only inherited Finance/Storage access;
- legacy dashboard behavior remains unchanged because no module mode is normalized.

- [ ] **Step 4: Inspect the frontend bundle for secrets**

Search `dist` for service-role variable names and known secret prefixes without printing secret values:

```powershell
rg -l "SUPABASE_SERVICE_ROLE_KEY|service_role|DATABASE_PASSWORD" dist
```

Expected: no files returned.

- [ ] **Step 5: Produce the checkpoint report**

Report:

- files changed;
- SQL added;
- roles and permissions seeded;
- tests and exact results;
- unresolved compatibility differences grouped by permission;
- live-schema conflicts;
- backup confirmation;
- rollback test result;
- whether Release 2 is safe to plan.

Do not begin Release 2 if any test fails, the live schema conflicts with migration assumptions, the backup is unconfirmed, or unexplained access differences remain.

## Plan Self-Review

- The plan covers the approved design's additive foundation, current-module plus Finance and Storage catalogues, protected Finance and Storage roles and teams, backfill, central SQL resolution, frontend shadow snapshot, comparison report, documentation, performance check, and rollback gate.
- It intentionally defers module cutovers, Finance transaction/inventory resources, People & Access mutation UI, invitation Edge Functions, resource-level MFA enforcement, Supabase object-storage policy changes, and legacy deletion to separately reviewed releases. Seeded high-risk permissions still fail `has_required_aal` at the foundation helper layer.
- All new production behavior remains shadow-only; current authorization remains unchanged.
- Function names, table names, service exports, and test commands are consistent throughout this plan.
- No placeholder implementation steps remain.
