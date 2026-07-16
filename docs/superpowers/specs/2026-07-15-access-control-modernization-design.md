# Access Control Modernization Design

**Date:** 2026-07-15

**Status:** Proposed for implementation planning

## Purpose

Modernize the St. Mary's Scouts Dubai dashboard authorization system into a normalized, scoped, auditable access-control model without interrupting current users or removing legacy authorization until the replacement has been verified.

The system will follow one rule:

> A role determines what a user can do. Assignments and scopes determine where they can do it.

Frontend visibility remains a usability feature. PostgreSQL RLS, secure RPC functions, and Supabase Edge Functions remain the authoritative security boundary.

## Constraints

- Preserve all current users, routes, dashboards, forms, submissions, attendance, content, media, documents, notifications, approvals, and group assignments.
- Do not remove legacy profile columns during the initial migration.
- Do not broaden an existing user's access silently.
- Do not remove existing access silently.
- Do not expose the Supabase service-role key or other private credentials to the browser.
- Seed Finance and Storage roles, teams, and permission keys in the authorization catalogue from Release 1, but do not fabricate module screens, records, or broad data policies where those modules do not yet exist.
- Do not assign Finance or Storage roles to existing users automatically. Access remains denied unless an authorized administrator explicitly assigns an active role with an applicable scope and the target resource has matching backend authorization.
- Do not claim that the result is immune to cyberattacks.
- Do not apply destructive SQL until a current Supabase backup and live-schema preflight have been confirmed.

## Current Architecture

### Identity and session

- Supabase Auth provides user identity and sessions.
- `AuthProvider` loads the authenticated user and the matching `user_profiles` row.
- `authService` currently falls back to Auth user metadata when profile loading fails.
- Sessions are stored in browser local storage by the custom Supabase client.
- `ProtectedRoute` currently accepts broad `chief` and `admin` role names.

### Legacy authorization sources

`user_profiles` currently contains identity and authorization fields:

- `role`
- `chief_level`
- `group_id`
- `is_coordinator`
- `coordinator_group_ids`
- `can_publish`
- `can_create_group_meetings`
- `can_edit_scouts`
- `manage_form_templates`
- `post_forms`
- `view_all_forms`

The database already contains minimal `roles`, `permissions`, `role_permissions`, and `user_permissions` tables. These tables must be evolved in place.

### Frontend access

- `src/services/permissions.js` resolves broad role and boolean checks.
- `AdminDashboardPage.jsx` maintains a navigation configuration with broad access labels.
- Several features repeat direct role, chief-level, coordinator, and permission checks.
- Desktop and mobile navigation derive from dashboard sections but do not use action-based permissions.

### Database access

- RLS policies rely primarily on `is_admin()`, `is_coordinator_for_group()`, `can_manage_group()`, profile columns, ownership, and broad authenticated checks.
- Forms have dedicated boolean-based SQL authorization helpers.
- Existing audit logs use `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, and `created_at`.
- Existing automatic audit triggers must continue operating while the schema is extended.

### Sensitive operations

The current Edge Functions create users, delete users, and assign temporary passwords. They verify an active legacy admin profile but do not yet use granular permissions, scopes, MFA requirements, last-administrator protection, strict origin allowlists, or complete security audit records.

## Target Model

### User profiles

`user_profiles` remains the identity and account record. Add identity fields only when they are needed by active workflows:

- `preferred_language`
- `notification_preferences`
- `last_active_at`

Valid account statuses will be centrally constrained to:

- `invited`
- `active`
- `disabled`
- `suspended`
- `archived`

Legacy authorization columns remain during compatibility mode and become read-only mirrors after the normalized model becomes authoritative.

### Roles and permissions

Upgrade the existing tables rather than creating replacements.

`roles` gains:

- stable `key` semantics using the existing primary key where possible
- `description`
- `category`
- `is_system_role`
- `is_active`
- `risk_level`
- `created_at`
- `updated_at`

`permissions` gains:

- stable action-based key semantics using the existing primary key where possible
- `module`
- `action`
- `risk_level`
- `requires_mfa`
- `created_at`
- `updated_at`

`role_permissions` remains the reusable role-to-permission join and gains audit timestamps if required.

### User role assignments

Add `user_role_assignments`:

- `id uuid`
- `user_id uuid`
- `role_id text`
- `scope_type text`
- `scope_id text nullable`
- `starts_at timestamptz`
- `expires_at timestamptz nullable`
- `assigned_by uuid`
- `assignment_reason text`
- `created_at timestamptz`
- `updated_at timestamptz`

Supported scope types are initially limited to scopes used by current modules:

- `global`
- `group`
- `team`
- `event`
- `own_records`

Scope validation requires `scope_id` for `group`, `team`, and `event`, and requires it to be null for `global` and `own_records`.

### Group assignments

Add `user_group_assignments`:

- `id uuid`
- `user_id uuid`
- `group_id text`
- `position text`
- `is_primary boolean`
- `starts_at timestamptz`
- `expires_at timestamptz nullable`
- `assigned_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Supported initial positions:

- `chief`
- `vice_chief`
- `head_chief`
- `coordinator`
- `equipe_leader`
- `assistant`

Only one active primary group assignment is permitted per user. A user may hold different positions in different groups.

Coordinator status is derived from active assignments. It is true when the user has an active `coordinator` position or active authorized assignments to more than one group.

### Teams

Add `teams` and `user_team_memberships` for organizational membership. Team membership never grants permissions by itself.

Initial teams include Media, Forms, Events, Website, Finance, and Storage. Finance and Storage teams are active organizational containers from Release 1, but membership alone grants no permissions.

### Permission overrides

Add `user_permission_overrides` for rare exceptions:

- `allow` or `deny`
- permission
- scope
- reason
- start and optional expiry
- assigning administrator
- audit timestamps

An applicable active deny overrides role-derived allows. Overrides cannot bypass account status, MFA requirements, separation-of-duty rules, or last-System-Administrator protections.

### Audit logs

Extend the existing `audit_logs` table in place with nullable structured fields:

- `module`
- `resource_type`
- `resource_id`
- `target_user_id`
- `previous_values`
- `new_values`
- `outcome`
- `reason`
- `request_id`
- `ip_address_hash`
- `user_agent_summary`

Existing `actor_id`, `entity_type`, `entity_id`, and `metadata` remain available during compatibility mode. Existing records and triggers are preserved.

Client-side audit writes are informational only. Security-sensitive audit entries are written by trusted SQL or Edge Function code and cannot be edited or deleted by normal dashboard users.

## Initial Permission Catalogue

Permissions for current modules plus the complete Finance and Storage catalogues are seeded initially. Seeding a permission key does not expose data: an active scoped role assignment and matching RLS or trusted server-side authorization are still required. Finance and Storage roles are unassigned by default.

### Core dashboard

- `dashboard.access`
- `notifications.view`
- `ai.use`

### Scouts and groups

- `groups.view_assigned`
- `groups.manage`
- `scouts.view`
- `scouts.create`
- `scouts.update`
- `scouts.move_group`
- `scouts.archive`
- `scouts.export`
- `registered_scouts.upload`

### Attendance and equipes

- `attendance.view`
- `attendance.record`
- `attendance.correct`
- `attendance.delete_session`
- `attendance.export`
- `chief_attendance.view`
- `chief_attendance.manage`
- `equipes.view`
- `equipes.create`
- `equipes.update`
- `equipes.assign_scouts`
- `equipes.delete`

### Forms

- `forms.fill`
- `forms.view_own_submissions`
- `forms.create`
- `forms.templates.view`
- `forms.templates.manage`
- `forms.post.request`
- `forms.post.approve`
- `forms.close`
- `forms.reopen`
- `forms.responses.view_group`
- `forms.responses.view_all`
- `forms.responses.export`
- `forms.delete_posted`

### Calendar

- `calendar.view`
- `calendar.create_group_event`
- `calendar.create_public_event`
- `calendar.update_own`
- `calendar.update_all`
- `calendar.approve`
- `calendar.delete`

### Content and media

- `content.create`
- `content.submit`
- `content.edit_own`
- `content.edit_all`
- `content.approve`
- `content.publish`
- `content.delete`
- `media.view`
- `media.upload`
- `media.edit_own`
- `media.edit_all`
- `media.approve`
- `media.publish`
- `media.delete`
- `albums.create`
- `albums.manage`

### Finance

- `finance.view`
- `finance.create_transaction`
- `finance.edit_own_transaction`
- `finance.edit_all_transactions`
- `finance.upload_receipt`
- `finance.approve_transaction`
- `finance.export`
- `finance.manage_categories`
- `finance.manage_settings`

Finance approval enforces separation of duties: a user cannot approve a transaction they created, even if they hold the approver role.

### Storage

- `storage.view`
- `storage.create_item`
- `storage.update_item`
- `storage.issue_items`
- `storage.record_returns`
- `storage.adjust_quantity`
- `storage.write_off`
- `storage.audit`
- `storage.export`
- `storage.manage_categories`

### Documents, reports, and archives

- `documents.view`
- `documents.upload`
- `documents.edit`
- `documents.delete`
- `documents.manage_permissions`
- `reports.view`
- `reports.generate`
- `reports.export`
- `archived_years.view`
- `archived_years.manage`

### Contact and website content

- `contact_messages.view`
- `contact_messages.respond`
- `contact_messages.archive`
- `contact_messages.delete`
- `website_content.view`
- `website_content.edit`
- `website_content.approve`

### People and system access

- `users.view`
- `users.invite`
- `users.update_profile`
- `users.disable`
- `users.reactivate`
- `users.delete`
- `users.revoke_sessions`
- `users.assign_roles`
- `users.assign_groups`
- `users.assign_teams`
- `roles.view`
- `roles.create`
- `roles.update`
- `roles.delete`
- `permissions.manage`
- `audit_logs.view`
- `system_settings.view`
- `system_settings.manage`

Finance and Storage permissions are first-class catalogue entries in Release 1. They grant no access merely by existing: role assignment, scope matching, active account status, and backend resource authorization are all mandatory.

## Default Roles

Initial protected roles:

- Chief
- Media Contributor
- Media Manager
- Finance Viewer
- Finance Contributor
- Finance Approver
- Storage Assistant
- Storage Manager
- Forms Manager
- Content Approver
- Access Administrator
- System Administrator

Head Chief, Vice Chief, Coordinator, Equipe Leader, and Assistant are group positions rather than global system roles. A user with a group position receives the Chief baseline role plus position-aware scoped permissions.

Legacy `admin` maps to System Administrator during backfill but must be reviewed before legacy fields are retired. Legacy `chief` maps to Chief.

Finance Viewer, Finance Contributor, Finance Approver, Storage Assistant, and Storage Manager are protected reusable system roles. They are not assigned during legacy backfill unless a verified legacy source explicitly proves the responsibility. Finance and Storage team membership never substitutes for these role assignments.

System Administrator is the documented exception: it intentionally contains every seeded permission, including Finance and Storage. Legacy administrators backfilled to System Administrator therefore retain platform-wide authority, but no Finance or Storage module may rely on that authority until its resource-level policies and separation-of-duty tests pass.

## Effective Authorization Resolution

The central resolver evaluates in this order:

1. Require an authenticated Supabase user.
2. Require a matching profile.
3. Require `account_status = 'active'` for protected actions.
4. Load active, started, unexpired role assignments.
5. Resolve role permissions.
6. Resolve active group and team assignments.
7. Match the permission scope to the target resource.
8. Apply active direct allows and denies; deny wins.
9. Require the configured authentication assurance level for high-risk permissions.
10. Apply separation-of-duty and last-administrator invariants.
11. Deny by default.

Expired assignments never authorize an action, even if the frontend cache is stale.

## SQL Authorization Functions

Introduce non-recursive, narrowly scoped helpers:

- `is_active_dashboard_user()`
- `has_permission(permission_key)`
- `has_global_permission(permission_key)`
- `has_group_access(group_id)`
- `has_team_access(team_id)`
- `has_permission_for_group(permission_key, group_id)`
- `has_permission_for_team(permission_key, team_id)`
- `has_permission_for_event(permission_key, event_id)`
- `has_required_aal(permission_key)`

`has_permission(permission_key)` and `has_global_permission(permission_key)` authorize only globally scoped grants and matching globally scoped overrides. They must never treat a group-, team-, event-, or own-record assignment as global. Resource-aware code must call the matching `has_permission_for_*` helper with the target scope. Every permission helper also enforces `has_required_aal(permission_key)`; the effective-access snapshot may describe a grant, but it is not proof that a sensitive operation is currently authorized.

Finance transaction approval additionally requires a resource-aware invariant that rejects approval when `created_by = auth.uid()`. That helper and its RLS/service tests are mandatory before the Finance module can be enabled.

Functions use fully qualified table names, a fixed safe `search_path`, no dynamic SQL, and restricted execute privileges. They are designed to avoid selecting through policies that invoke the same helper recursively.

## React Authorization Layer

Replace broad helpers with a normalized authorization snapshot containing:

- active roles and assignment sources
- effective permission keys
- accessible group IDs and group positions
- accessible team IDs and team positions
- active scope records
- restrictions and expiries
- compatibility differences during migration

The React API provides:

- `hasPermission`
- `hasAnyPermission`
- `hasAllPermissions`
- `canAccessGroup`
- `canAccessTeam`
- `canAccessEvent`
- `canEditResource`
- `getEffectiveRoles`
- `getEffectivePermissions`
- `getAccessibleGroupIds`
- `getAccessibleTeamIds`

Reusable gates provide consistent UI behavior, but never replace backend checks.

Dashboard navigation becomes one centralized configuration shared by desktop, collapsed sidebar, mobile navigation, search, and direct-section access. Each entry declares permission, optional scope, grouping, and mobile visibility.

## People and Access

Rename Users & Permissions to People & Access after the normalized APIs are available.

Tabs:

- Users
- Roles
- Teams
- Access Reviews
- Audit Log

The user editor separates identity, scouting assignments, teams, system roles, and effective access. It removes administrator-entered passwords and uses invitation, password-reset email, session revocation, account disable/reactivate, and MFA status actions.

Normal administrators assign reusable roles. Direct permission overrides are placed behind an advanced workflow requiring a reason and expiry review.

The effective access panel explains the permission source and scope rather than presenting an unstructured grid of booleans.

## Edge Function Security

Sensitive user and role operations use shared server-side authorization logic. Every function:

1. validates method and allowed origin;
2. verifies the JWT;
3. reloads current profile and effective access;
4. checks account status;
5. checks the exact permission and scope;
6. checks MFA where required;
7. validates request fields with strict allowlists;
8. applies last-administrator and separation-of-duty rules;
9. performs the operation;
10. writes a trusted audit event;
11. returns a safe minimal response.

The new flow uses Supabase invitations and password-reset emails. Administrators never create, view, or transmit another user's password.

## RLS Migration Order

Policies migrate module by module while legacy policies remain available through an explicit compatibility helper:

1. Forms
2. Content and Media
3. Scouts, Attendance, and Equipes
4. Documents, Reports, and Archives
5. Contact Messages and Website Content
6. People, Roles, Teams, and System Settings

Each module migration adds targeted SELECT, INSERT, UPDATE, and DELETE tests. UPDATE policies use both `USING` and `WITH CHECK` when records have a group, team, owner, or visibility scope.

## Compatibility Mode

During migration, a server-side comparison function computes:

- `legacy_allowed`
- `normalized_allowed`
- permission key
- scope
- resource type and identifier when safe
- user
- timestamp

Differences are recorded in an admin-only migration report.

Runtime behavior initially remains legacy-authoritative. A module becomes normalized-authoritative only after:

- backfill is complete;
- expected differences are reviewed;
- RLS and service tests pass;
- existing representative accounts pass manual verification;
- rollback SQL is available.

Compatibility fallback must never turn a normalized explicit deny into an allow.

## Backfill Rules

- Legacy admins receive System Administrator assignments and are flagged for review.
- Legacy chiefs receive the Chief role.
- `group_id` becomes the primary group assignment.
- `chief_level` becomes that group's position.
- `coordinator_group_ids` become additional group assignments.
- `is_coordinator` is compared with derived coordinator status and logged when inconsistent.
- Legacy booleans map to the narrowest current permission bundles or scoped compatibility roles.
- `can_publish` is not mapped to every content and media approval permission automatically.
- `post_forms` initially maps to posting request capability, not approval, unless current reviewed authority proves otherwise.
- `view_all_forms` is reviewed before any global response permission is assigned.

Backfill scripts are deterministic and idempotent.

## Account and Session Security

- A missing profile cannot inherit dashboard authorization from user metadata.
- Disabled, suspended, and archived profiles fail database and Edge Function checks even with an older JWT.
- High-risk access changes trigger session revocation or mandatory refresh where appropriate.
- MFA is required for System Administrator, Access Administrator, role assignment, user deletion, session revocation, permission changes, and sensitive exports.
- The last active System Administrator cannot be disabled, deleted, demoted, or stripped of the recovery role.

## Storage, Inventory, and Rich Text

The `storage.*` permission family governs the scouting inventory/equipment module and its Storage Team; it does not grant access to Supabase Storage buckets. Supabase object storage is audited bucket by bucket under separate bucket/object policies. Public assets remain public only where the application intentionally exposes them. Private documents, Finance receipts, and other sensitive module files use private buckets and signed URLs.

The current DOMPurify allowlist remains the shared rich-text boundary. Save-time normalization and render-time sanitization are retained. Unsafe URLs, event handlers, scripts, dangerous CSS, and unsupported embeds remain blocked.

## AI Assistant

The AI Assistant receives only data already authorized for the current user and scope. Each tool declares required permission, scope, read/write behavior, confirmation, MFA, and approval requirements. Write actions reauthorize outside the model and create trusted audit events.

The current placeholder does not justify introducing service-role AI access during the authorization migration.

## Performance

- Add indexes for assignment user IDs, role IDs, group IDs, team IDs, scope fields, and expiry lookups.
- Load one effective authorization snapshot during authenticated bootstrap.
- Avoid permission queries in individual components.
- Refresh the snapshot after role, group, team, override, account-status, or session changes.
- Keep backend checks authoritative regardless of frontend caching.
- Use `EXPLAIN ANALYZE` for high-volume RLS paths before enabling them in production.

## Error Handling

The UI receives safe errors such as access denied, expired group access, MFA required, disabled account, or second approver required. SQL details, policy names, stack traces, secrets, and service-role information remain server-side.

## Migration Phases

### Phase 0: Production preflight

- Confirm a recoverable Supabase database backup.
- Export the live schema and compare it with repository SQL.
- Inventory live users, legacy assignments, policies, buckets, and Edge Function deployments.
- Record baseline access for representative account types.

### Phase 1: Additive authorization foundation

- Extend existing catalog and audit tables.
- Add assignment, team, override, migration-difference, and access-review tables.
- Add indexes, constraints, RLS, and read-only helper functions.
- Seed current-module permissions, the complete Finance and Storage permission catalogues, all protected default roles, and the Finance and Storage teams.

### Phase 2: Backfill and comparison

- Backfill all current users idempotently.
- Build effective authorization RPCs.
- Add compatibility comparison logging.
- Add an admin-only migration report.
- Keep legacy decisions authoritative.

### Phase 3: Frontend centralization

- Load the effective authorization snapshot with the profile.
- Remove metadata-based authorization fallback.
- Centralize navigation, routes, feature gates, and resource checks.
- Keep compatibility helpers while module migration is incomplete.

### Phase 4: Module RLS conversion

- Migrate Forms.
- Migrate Content and Media.
- Migrate Scouts, Attendance, and Equipes.
- Migrate Documents, Reports, Archives, Contact Messages, and Website Content.
- Enable normalized authority per module only after its gate passes.

### Phase 5: Finance and Storage enforcement

- Add Finance and inventory resources only from separately approved module plans.
- Add scoped RLS and trusted service checks for every Finance and `storage.*` inventory action.
- Enforce MFA for sensitive exports, approvals, quantity adjustments, write-offs, audits, and settings.
- Enforce Finance creator/approver separation and private receipt access.
- Test team membership without role denial, cross-team denial, Finance/Storage isolation, and System Administrator behavior.
- Keep each module disabled until its resource-level gate passes.

### Phase 6: People and Access and Edge Functions

- Introduce Users, Roles, Teams, Access Reviews, and Audit Log interfaces.
- Replace temporary-password flows with invitations and reset emails.
- Add session revocation, MFA checks, last-administrator protection, strict CORS, validation, and trusted auditing.

### Phase 7: Legacy retirement

- Confirm no production module reads legacy authorization fields.
- Review all comparison differences and mixed-role users.
- Produce and test rollback scripts.
- Stop writing legacy mirrors.
- Remove legacy policies and columns only in a separately approved destructive migration.

## Verification Gates

Every phase must pass relevant checks before the next begins:

- production build;
- authorization unit tests;
- SQL helper tests;
- RLS tests using anonymous, Chief, Head Chief, Vice Chief, coordinator, mixed-role, disabled, expired, Access Administrator, and System Administrator identities;
- Edge Function missing-JWT, invalid-JWT, disabled-user, missing-permission, invalid-scope, invalid-input, MFA, audit, and success tests;
- direct URL and direct REST request tests;
- forms, attendance, content, media, document, notification, and approval regression checks;
- desktop and mobile navigation checks;
- confirmation that no secret appears in the frontend bundle.

## Rollback

Each SQL phase has a paired rollback that disables new authority without deleting backfilled data. Module cutovers use flags or compatibility configuration so authority can return to the prior verified policy set. Legacy columns and policies remain intact until final retirement approval.

No rollback deletes audit logs, user assignments, submissions, attendance, content, media, or profile data.

## Known Conflicts Requiring Explicit Handling

- Existing catalog tables use a smaller schema than the requested model.
- Existing audit logs and triggers must be extended rather than replaced.
- Current administrator workflows expose temporary-password assignment.
- Current Edge Functions use wildcard CORS and broad admin checks.
- Current auth mapping can use user metadata when profile loading fails.
- Current navigation and feature code contain many direct legacy checks.
- Current storage policy treats several buckets as public.
- The repository SQL may differ from the live Supabase schema.
- There is no current automated authorization/RLS test harness.
- There is no lint script in `package.json`.

These conflicts are addressed by additive migrations, compatibility comparison, per-module authority gates, secure invitation flows, and an explicit live-schema preflight.

## Future Developer Rule

> Never authorize an action only because a component, button, or route is hidden. Every protected action must also be authorized by the database or trusted server-side code.
