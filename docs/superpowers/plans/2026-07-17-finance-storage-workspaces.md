# Finance and Storage Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permission-driven Finance and Storage workspaces to the existing shared Scouts dashboard, including secure accounting, inventory, approvals, tasks, files, reports, and cross-workspace workflows.

**Architecture:** Keep the existing dashboard shell and Scouting/Admin behavior while adding URL-synchronized workspace configuration and isolated Finance/Storage feature modules. Add normalized PostgreSQL schemas protected by RLS and trusted functions, then expose narrow React services and route-level pages without extending the global bootstrap.

**Tech Stack:** React 18, React Router 6, Vite 6, Supabase Auth/PostgreSQL/RLS/Storage/Edge Functions, Node test runner, Playwright.

## Global Constraints

- Preserve all existing authentication, roles, groups, forms, attendance, notifications, approvals, documents, media, calendar, dashboard navigation, themes, routes, and records.
- Do not expose service-role credentials in frontend code.
- Workspace selection never grants authority; server-calculated permissions and RLS remain authoritative.
- Finance posted entries are immutable and balanced.
- Storage availability derives from traceable records.
- Do not load Finance or Storage data in the general dashboard bootstrap.
- Keep desktop and mobile behavior accessible in light and dark mode.

---

### Task 1: Workspace Catalog and Access Resolution

**Files:**
- Create: `src/workspaces/workspaceCatalog.js`
- Create: `src/workspaces/workspaceAccess.js`
- Test: `tests/access-control/workspaceAccess.test.js`

**Produces:** `WORKSPACE_CATALOG`, `getAvailableWorkspaces`, `resolveWorkspaceDestination`, and `isWorkspaceRouteAllowed`.

- [ ] Write tests for single/multiple workspace users, stale saved workspaces, direct unauthorized URLs, expired access, direct denies, and legacy Admin/Chief compatibility.
- [ ] Run `node --test tests/access-control/workspaceAccess.test.js` and confirm the tests fail before implementation.
- [ ] Implement pure permission-driven catalog and resolver functions.
- [ ] Run the focused test and `npm run test:access-control`.

### Task 2: URL-Synchronized Shared Workspace Shell

**Files:**
- Create: `src/workspaces/DashboardWorkspaceRoute.jsx`
- Create: `src/workspaces/WorkspaceSwitcher.jsx`
- Create: `src/workspaces/workspaceShell.css`
- Modify: `src/App.jsx`
- Modify: `src/pages/AdminDashboardPage.jsx`
- Test: `tests/workspaces/workspace-shell.spec.js`

**Consumes:** Workspace catalog and resolver from Task 1.

**Produces:** Canonical `/dashboard/:workspace/*` routes and validated workspace switching.

- [ ] Add Playwright coverage for legacy `/dashboard`, direct nested URLs, switcher visibility, last-route restoration, mobile switching, and unauthorized fallback.
- [ ] Add nested protected routes while retaining legacy redirects.
- [ ] Synchronize existing section IDs with Scouting/Admin routes without changing existing feature behavior.
- [ ] Add desktop and mobile workspace switchers, unsaved-change guard support, and valid-route persistence.
- [ ] Verify Scouting and Admin navigation in desktop/mobile light/dark modes.

### Task 3: Global My Work Contract

**Files:**
- Create: `src/workspaces/myWorkModel.js`
- Create: `src/workspaces/MyWorkPage.jsx`
- Create: `src/workspaces/myWorkService.js`
- Test: `tests/access-control/myWorkModel.test.js`

**Produces:** Normalized task providers and permission-revalidated deep links.

- [ ] Test normalization, urgency ordering, workspace filtering, completed-task removal, and unauthorized deep links.
- [ ] Implement an initially empty provider registry plus adapters for existing forms, approvals, and attendance tasks.
- [ ] Render loading, empty, error, due-soon, overdue, and action-required states.
- [ ] Verify opening tasks preserves global shell state.

### Task 4: Workspace Permission Migration

**Files:**
- Create: `database/supabase-workspace-access.sql`
- Modify: `src/services/accessControlCatalog.js`
- Test: `tests/access-control/workspacePermissions.test.js`

**Produces:** Workspace permissions and granular Finance/Storage permission catalog entries.

- [ ] Add catalog parity tests covering every permission in the migration and frontend constants.
- [ ] Add idempotent permission and built-in-role grants without changing existing assignments.
- [ ] Mark high-risk Finance permissions as MFA-required.
- [ ] Add direct SQL assertions for default-deny and built-in role boundaries.

### Task 5: Shared Approval and Task Schema

**Files:**
- Create: `database/supabase-workflow-engine.sql`
- Create: `src/services/workflowService.js`
- Test: `tests/access-control/workflowEngine.test.js`

**Produces:** Versioned workflow templates, stages, instances, decisions, assignments, comments, escalation, and task records.

- [ ] Define and test legal transitions, ordered/parallel stages, conditions, deadlines, and immutable history.
- [ ] Enforce authentication, permission, scope, self-approval prevention, and assignment validity in trusted functions.
- [ ] Add RLS and indexes for requester, assignee, status, due date, and source resource.
- [ ] Add notification/task completion triggers with canonical workspace links.

### Task 6: Finance Core Database

**Files:**
- Create: `database/supabase-finance-core.sql`
- Test: `tests/access-control/financeLedger.test.js`

**Produces:** Ledger accounts, operational accounts, funds, categories, journal entries/lines, source links, and accounting periods.

- [ ] Test balanced posting, account/fund separation, transfer reporting, reversals, closed periods, permissions, and scoped reads.
- [ ] Add constraints, indexes, generated reference numbers, RLS, and audit triggers.
- [ ] Add trusted posting/reversal functions using transactions and row locking.
- [ ] Verify direct REST attempts cannot forge posted states or unbalanced entries.

### Task 7: Finance Core UI and Services

**Files:**
- Create: `src/features/finance/FinanceWorkspace.jsx`
- Create: `src/features/finance/financeService.js`
- Create: `src/features/finance/financeModel.js`
- Create: `src/features/finance/financeWorkspace.css`
- Test: `tests/workspaces/finance-workspace.spec.js`

**Produces:** Overview, transactions, accounts/cashboxes, funds, and period views.

- [ ] Build server-paginated queries and summarized overview RPC calls.
- [ ] Implement simple income, expense, transfer, adjustment, posting, and reversal flows gated by granular permissions.
- [ ] Add accessible tables, filters, status states, currency formatting, loading/error/empty states, and mobile layouts.
- [ ] Verify no Finance requests occur when another workspace loads.

### Task 8: Finance Workflow Database and UI

**Files:**
- Create: `database/supabase-finance-workflows.sql`
- Create: `src/features/finance/FinanceBudgets.jsx`
- Create: `src/features/finance/FinancePurchaseRequests.jsx`
- Create: `src/features/finance/FinanceReimbursements.jsx`
- Create: `src/features/finance/FinanceCollections.jsx`
- Create: `src/features/finance/FinanceReconciliation.jsx`
- Create: `src/features/finance/FinanceReports.jsx`
- Test: `tests/access-control/financeWorkflows.test.js`
- Test: `tests/workspaces/finance-workflows.spec.js`

**Produces:** Versioned budgets, commitments, purchases, reimbursements, collections, reconciliation, and reports.

- [ ] Test every workflow transition, separation-of-duty rule, budget calculation, payment/refund/waiver treatment, and report boundary.
- [ ] Integrate workflows with the shared approval engine and existing form templates through stable references.
- [ ] Implement permission-aware UI and private attachment handling.
- [ ] Verify AED formatting, exports, approval history, and mobile review flows.

### Task 9: Storage Core Database

**Files:**
- Create: `database/supabase-storage-core.sql`
- Test: `tests/access-control/storageInventory.test.js`

**Produces:** Categories, items, assets, kits/components, locations, balances, movements, conditions, and identifiers.

- [ ] Test consumable, bulk, asset, and kit behavior; movement-derived availability; unique tags; restricted locations; and safety blocks.
- [ ] Add constraints, indexes, QR/barcode references, RLS, trusted movement functions, and audit events.
- [ ] Prevent direct quantity mutation and retired-tag reuse.
- [ ] Verify scoped access through direct Supabase requests.

### Task 10: Storage Core UI and Services

**Files:**
- Create: `src/features/storage/StorageWorkspace.jsx`
- Create: `src/features/storage/inventoryService.js`
- Create: `src/features/storage/storageModel.js`
- Create: `src/features/storage/storageWorkspace.css`
- Test: `tests/workspaces/storage-workspace.spec.js`

**Produces:** Overview, inventory, assets, kits, locations, and movement history views.

- [ ] Implement server pagination, filters, inventory summaries, and narrow detail queries.
- [ ] Add accessible item/asset editors, movement dialogs, condition states, identifier display, and mobile scanning fallback.
- [ ] Gate sensitive value fields by Finance permissions.
- [ ] Verify no Storage requests occur outside the workspace.

### Task 11: Storage Workflow Database and UI

**Files:**
- Create: `database/supabase-storage-workflows.sql`
- Create: `src/features/storage/StorageRequests.jsx`
- Create: `src/features/storage/StorageLoans.jsx`
- Create: `src/features/storage/StorageRestocking.jsx`
- Create: `src/features/storage/StorageDeliveries.jsx`
- Create: `src/features/storage/StorageMaintenance.jsx`
- Create: `src/features/storage/StorageAudits.jsx`
- Create: `src/features/storage/StorageReports.jsx`
- Test: `tests/access-control/storageWorkflows.test.js`
- Test: `tests/workspaces/storage-workflows.spec.js`

**Produces:** Requests, reservations, handovers, loans/returns, restocking, suppliers, deliveries, maintenance, audits, and reports.

- [ ] Test reservation conflicts, partial returns, overdue states, inspection authority, strict-audit separation, and delivery acceptance.
- [ ] Integrate shared approvals, tasks, notifications, and existing form templates.
- [ ] Implement permission-aware mobile preparation, handover, return, count, and inspection flows.
- [ ] Verify restricted and private records remain inaccessible by URL manipulation.

### Task 12: Private File Infrastructure

**Files:**
- Create: `database/supabase-workspace-storage.sql`
- Create: `supabase/functions/workspace-private-files/index.ts`
- Create: `src/services/privateWorkspaceFileService.js`
- Test: `tests/access-control/privateFiles.test.js`

**Produces:** Authorized uploads, signed downloads, scoped paths, validation, and audit records.

- [ ] Test missing/invalid JWTs, wrong workspace/scope, guessed paths, disallowed types, oversized files, and expired signed URLs.
- [ ] Add private buckets or paths and Storage policies.
- [ ] Validate authorization and metadata before issuing upload/download access.
- [ ] Integrate Finance and Storage attachments without exposing public URLs.

### Task 13: Finance and Storage Integration

**Files:**
- Create: `database/supabase-finance-storage-integration.sql`
- Create: `src/services/financeStorageIntegrationService.js`
- Test: `tests/access-control/financeStorageIntegration.test.js`

**Produces:** Restock purchasing, delivery/inventory, invoice/expense, damage/replacement, borrower charge, and asset purchase links.

- [ ] Test every cross-domain transition and authority boundary.
- [ ] Use immutable source references and idempotency keys.
- [ ] Prevent either workspace from changing the other's authoritative fields.
- [ ] Add audit events and My Work tasks for unresolved cross-domain steps.

### Task 14: Reports, Documentation, and Hardening

**Files:**
- Create: `docs/workspaces.md`
- Create: `docs/finance.md`
- Create: `docs/storage.md`
- Create: `docs/workspace-security.md`
- Create: `tests/workspaces/workspace-regression.spec.js`
- Modify: `AGENTS.md`

**Produces:** Operational documentation, migration/rollback guidance, future-workspace guidance, and final verification evidence.

- [ ] Run all access-control and workflow tests.
- [ ] Validate migrations in order and validate rollback procedures.
- [ ] Run Edge Function and private-file tests.
- [ ] Run `npm run build`; document that no lint script exists unless one is added separately.
- [ ] Use Playwright for Admin, Chief, Finance-only, Storage-only, and multi-workspace users across desktop/mobile light/dark modes.
- [ ] Verify existing public routes, forms, attendance, content, notifications, documents, reports, People & Access, and legacy `/dashboard` behavior.
