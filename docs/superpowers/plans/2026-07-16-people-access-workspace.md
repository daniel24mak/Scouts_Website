# People & Access Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Users & Permissions card editor with a professional, permission-aware People & Access workspace backed by the existing normalized access-control model.

**Architecture:** Keep `AdminDashboardPage` as the dashboard shell and extract the feature into `src/features/people-access`. Read and mutate normalized access only through trusted permission-checked SQL RPCs or existing Edge Functions. Keep legacy profile authorization fields visible only as compatibility information while normalized access remains authoritative.

**Tech Stack:** React 18, Vite 6, Supabase Postgres/RLS/RPC, existing REST client, Lucide icons, CSS theme variables, Node test runner, Playwright.

## Global Constraints

- Preserve existing Auth users, profile images, invitation flow, recovery-email flow, RLS, Edge Functions, routes, roles, groups, teams, and dashboard behavior.
- Never reintroduce temporary passwords.
- Never calculate or authorize effective access only in React.
- Never expose service keys, tokens, raw Auth metadata, SQL errors, or policy internals.
- High-risk mutations require their normalized permission and AAL2 through existing `has_permission` enforcement.
- The final active global System Administrator remains protected by database triggers.
- New database work is additive. No destructive migration or replacement of the working authorization model is included.
- Mobile controls use 44px minimum touch targets and must not overlap the dashboard bottom navigation.
- Light and dark themes use existing dashboard tokens; no hardcoded white surfaces.

---

## Audit Findings

### Existing normalized foundation

- `roles`, `permissions`, and `role_permissions` contain the active catalog and protected system roles.
- `user_role_assignments` supports global, group, team, event, and own-record scopes with start/expiry and reason.
- `user_group_assignments` supports per-group position, primary assignment, start, and expiry.
- `teams` and `user_team_memberships` separate organizational membership from permission roles.
- `user_permission_overrides` supports scoped allow/deny entries with required reasons.
- `access_reviews`, `authorization_migration_differences`, and expanded `audit_logs` already exist.
- `get_my_effective_access()` securely resolves only the current user.
- Existing Edge Functions securely invite, delete, and send recovery emails.

### Missing backend capabilities

- Administrators cannot securely read another user's normalized assignments/effective access.
- No trusted mutation API exists for role, group, team, override, role catalog, team catalog, or access-review changes.
- Profile RLS still makes complete user listing effectively System Administrator-only.
- MFA enrollment, active-session count, and password-reset history are not available as trusted bulk profile fields.
- `teams.view` and `access_reviews.view` are not seeded permission keys; tab visibility must use the nearest existing secure permission until an additive catalog expansion is approved.

### Legacy classification

- **Required identity/account compatibility:** profile ID, name, email, picture, account status, pending profile changes, last login/activity.
- **Display-only migration compatibility:** legacy `role`, `chief_level`, `group_id`, `is_coordinator`, and coordinator group IDs.
- **Security-sensitive legacy dependencies:** dashboard navigation and several existing modules still read legacy role/group/boolean permission fields; do not remove them in this feature.
- **Obsolete as the primary editor:** Admin/Chief-only role dropdown and the six boolean permission toggles.
- **Candidate for removal after migration verification:** `can_publish`, `can_create_group_meetings`, `can_edit_scouts`, `manage_form_templates`, `post_forms`, and `view_all_forms` as direct administrator controls.

---

### Task 1: Secure People & Access API

**Files:**
- Create: `database/supabase-people-access-api.sql`
- Modify: `database/supabase-schema.sql`
- Modify: `database/supabase-upload-fix.sql`
- Test: `tests/access-control/peopleAccessApi.test.js`

**Produces:** Permission-checked read RPCs for workspace/user details and narrowly scoped mutation RPCs for assignments, memberships, overrides, roles, teams, and reviews.

- [ ] Write static security tests proving every RPC is `SECURITY DEFINER`, has a fixed search path, checks the exact normalized permission, validates scope/date/reason inputs, writes an audit event, and grants execution only to `authenticated`.
- [ ] Run `npm run test:access-control` and verify the new tests fail because the API does not exist.
- [ ] Add `get_people_access_workspace()` returning profiles, role/permission catalogs, role-permission links, groups, teams, assignments, overrides, reviews, migration differences, and summary audit rows only when the caller has the matching view permission.
- [ ] Add `get_user_effective_access(target_user_id uuid)` using the same server-side resolver semantics as `get_my_effective_access()` and requiring `users.view`.
- [ ] Add assignment/membership/override save and revoke RPCs with exact permission checks, AAL enforcement, overlap protection, server-owned actor IDs, and audit rows.
- [ ] Add custom-role/team save and safe-disable/delete RPCs. Protected system roles remain immutable and used roles cannot be deleted.
- [ ] Add access-review and migration-difference decision RPCs with reviewer identity, reason, timestamp, and audit rows.
- [ ] Strengthen last-System-Administrator assignment protection for changes to `user_id`, `starts_at`, expiry, and concurrent removal using a transaction-scoped advisory lock.
- [ ] Run access-control tests and confirm all pass.

### Task 2: People & Access Service Layer

**Files:**
- Create: `src/services/peopleAccessService.js`
- Create: `src/features/people-access/peopleAccessModel.js`
- Test: `tests/access-control/peopleAccessService.test.js`

**Consumes:** RPCs from Task 1 and existing invitation/delete/recovery methods from `userService.js`.

**Produces:** `loadPeopleAccessWorkspace`, `loadPersonAccessDetails`, assignment/team/role/override/review mutations, normalized display models, filters, risk warnings, and human-readable labels.

- [ ] Write tests for profile/assignment normalization, status calculations, combined filters, effective-access explanations, workspace summaries, expired/expiring warnings, and deny precedence.
- [ ] Run the focused tests and verify failure.
- [ ] Implement batched workspace loading without N+1 requests.
- [ ] Implement target-user lazy detail loading and trusted effective-access mapping.
- [ ] Implement mutation wrappers that preserve server errors as safe user messages and never fall back to direct table writes.
- [ ] Implement role/permission labels from database descriptions and technical keys only as secondary details.
- [ ] Run the service and authorization tests.

### Task 3: Extracted People & Access Workspace

**Files:**
- Create: `src/features/people-access/PeopleAccessWorkspace.jsx`
- Create: `src/features/people-access/PeopleAccessWorkspace.css`
- Create: `src/features/people-access/PeopleAccessTabs.jsx`
- Create: `src/features/people-access/PeopleAccessSummary.jsx`
- Create: `src/features/people-access/PeopleAccessStates.jsx`
- Test: `tests/people-access.spec.js`

**Produces:** Accessible Users, Roles, Teams, Access Reviews, and Audit Log tabs with permission-aware visibility.

- [ ] Write Playwright assertions for accessible tab semantics, permission-hidden tabs/actions, loading/error/empty states, theme behavior, and mobile overflow.
- [ ] Build the workspace header, description, summary metrics, primary Invite User action, and permitted secondary actions.
- [ ] Use URL search parameters for active tab and filters while retaining `/dashboard` compatibility.
- [ ] Implement skeleton loading, permission-denied, empty, stale-data, and safe error states.
- [ ] Add responsive full-width desktop layout and mobile card/bottom-sheet patterns.

### Task 4: Users And Invite Flow

**Files:**
- Create: `src/features/people-access/PeopleTable.jsx`
- Create: `src/features/people-access/PeopleFilters.jsx`
- Create: `src/features/people-access/InviteUserWizard.jsx`
- Create: `src/features/people-access/UserDetailsDrawer.jsx`
- Create: `src/features/people-access/UserOverview.jsx`
- Create: `src/features/people-access/UserProfileAccount.jsx`

**Produces:** Searchable/filterable people list, guided invitation, responsive detail drawer, and profile/account actions.

- [ ] Add combined status/role/team/group/position/expiry/override/migration/risk filters and reset behavior.
- [ ] Show compact role/team chips, warnings, last activity, invitation status, and action menus without unstructured lists.
- [ ] Implement a six-step invitation wizard that uses the existing secure invitation and applies normalized assignments only after server confirmation; never request a password.
- [ ] Keep authorization edits outside Profile & Account.
- [ ] Expose active/invited/disabled/suspended/archived states with explanations and permission-checked actions.
- [ ] Keep unsupported session/MFA facts labeled `Not available` rather than `No`.

### Task 5: User Assignments, Effective Access, Security, And Activity

**Files:**
- Create: `src/features/people-access/UserScoutingAssignments.jsx`
- Create: `src/features/people-access/UserTeamMemberships.jsx`
- Create: `src/features/people-access/UserRoleAssignments.jsx`
- Create: `src/features/people-access/EffectiveAccessPanel.jsx`
- Create: `src/features/people-access/PermissionOverridesPanel.jsx`
- Create: `src/features/people-access/UserSecurityPanel.jsx`
- Create: `src/features/people-access/UserActivityPanel.jsx`

**Produces:** Normalized per-user access management and explainable effective access.

- [ ] Implement per-group position/primary/start/expiry editing with coordinator status derived from assignments.
- [ ] Implement team membership independently from role assignment and show optional recommended roles as explicit suggestions only.
- [ ] Implement the five-step Add Role flow with scope, duration, effective-access preview, risk/MFA warnings, reason, and confirmation.
- [ ] Group effective permissions by module and show source role, scope, validity, MFA requirement, and deny overrides.
- [ ] Keep direct overrides in a warned Advanced section with mandatory reason.
- [ ] Show only backend-confirmed security information and access-related audit history.
- [ ] Label the six legacy booleans under `Legacy Access Compatibility`; do not expose them as normal switches.

### Task 6: Roles, Teams, Reviews, And Audit Tabs

**Files:**
- Create: `src/features/people-access/RolesTab.jsx`
- Create: `src/features/people-access/RoleEditor.jsx`
- Create: `src/features/people-access/PermissionMatrix.jsx`
- Create: `src/features/people-access/TeamsTab.jsx`
- Create: `src/features/people-access/TeamDetailsDrawer.jsx`
- Create: `src/features/people-access/AccessReviewsTab.jsx`
- Create: `src/features/people-access/AuditLogTab.jsx`

**Produces:** Catalog management, team membership visibility, actionable reviews/migration differences, and immutable audit browsing.

- [ ] Build role search/filter/detail views from actual database records, including risk, MFA, scopes, counts, protected state, and safe custom-role actions.
- [ ] Build permission matrix grouped by module with descriptions, technical keys, risk, MFA, and high-risk warnings.
- [ ] Build team summaries/details while clearly separating membership, role, and workspace access.
- [ ] Merge access-review records and migration differences into one review queue without removing the existing Reports view.
- [ ] Build searchable immutable audit log with safe detail drawer and no edit/delete actions.

### Task 7: Dashboard Integration And Legacy Removal From Primary UI

**Files:**
- Modify: `src/pages/AdminDashboardPage.jsx`
- Modify: `src/services/permissions.js`
- Modify: `src/api/client.js`
- Modify: `src/styles.css` only for shell-level integration if required

**Produces:** Visible People & Access naming and one extracted dispatch path.

- [ ] Rename visible navigation metadata, breadcrumbs, mobile labels, notifications, and descriptions from Users & Permissions to People & Access while retaining the internal section ID for route compatibility.
- [ ] Replace `renderChiefs()` dispatch with `PeopleAccessWorkspace` and pass current user, groups, theme, toast callback, invitation/recovery/delete handlers, and refresh callback.
- [ ] Remove the old inline add/edit card UI and obsolete local state only after the extracted flow passes tests.
- [ ] Use normalized effective permissions for tab/action visibility and retain legacy checks only where unrelated dashboard modules still require compatibility.

### Task 8: Verification

**Files:**
- Modify: `tests/dashboard-dark-mode-audit.spec.js`
- Modify: `tests/people-access.spec.js`
- Update: `docs/security/access-control.md`

- [ ] Run `npm run test:access-control`.
- [ ] Run `npm run build`.
- [ ] Run lint only if a lint script exists; otherwise report it as unavailable.
- [ ] Start the Vite server and visually verify People & Access at desktop 1440px, tablet 768px, mobile 390px, light and dark themes.
- [ ] Verify tab permissions, filters, drawer focus/escape/outside-click behavior, invite/recovery flows, multiple/scoped/expired roles, team membership independence, deny overrides, last-admin protection, migration differences, and mobile safe areas.
- [ ] Report the additive Supabase SQL file and any Edge Functions requiring deployment. Do not claim unsupported Auth session or MFA administration features.

---

## Intentionally Deferred Unless Backed By Supabase

- Active session counts and target-user session revocation until Supabase exposes a secure user-targeted administrative operation.
- Failed/suspicious sign-in summaries without a trusted Auth audit source.
- Last password-reset timestamp unless recorded server-side.
- Per-user MFA enrollment unless returned by a secure lazy-loaded admin endpoint.
- Independent approval workflows for high-risk access until a durable approval table/transaction flow is explicitly added.

