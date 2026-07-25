# Premium UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the public website and every dashboard workspace into one responsive, premium visual system while preserving routes, permissions, Supabase behavior, and existing workflows.

**Architecture:** Establish one authoritative dashboard-shell stylesheet and a small shared set of UI tokens before touching page-specific presentation. Keep existing React behavior and route ownership intact; reuse current class names and component boundaries, remove obsolete competing shell rules, and verify each phase in the running Vite app with Playwright.

**Tech Stack:** React 18, React Router 6, Vite 6, plain CSS, Lucide React, Playwright.

## Global Constraints

- Do not change Supabase schema, RLS, authentication, permissions, routes, or submission behavior.
- Do not remove features or replace dynamic content with placeholders.
- Preserve the public-header/dashboard-shell separation.
- Use the existing white, deep-blue, and restrained gold brand palette.
- Support light and dark themes from the same components.
- Keep touch targets at least 44 by 44 pixels and respect safe-area insets.
- Use transform and opacity for motion; respect `prefers-reduced-motion`.
- Do not add a new dependency.
- Do not commit or push without explicit user approval.

---

### Task 1: Consolidate The Shared Dashboard Shell

**Files:**
- Create: `src/workspaces/dashboardShell.css`
- Modify: `src/main.jsx`
- Modify: `src/styles.css`
- Modify: `src/workspaces/focusedWorkspaceShell.css`
- Modify: `src/workspaces/FocusedWorkspaceShell.jsx`
- Verify only: `src/pages/AdminDashboardPage.jsx`

**Interfaces:**
- Consumes: existing shell classes such as `.admin-cms-shell`, `.dashboard-topbar`, `.admin-sidebar`, `.dashboard-bottom-tabs`, and `.dashboard-more-sheet`.
- Produces: one authoritative responsive shell contract used by Scouting, Admin, Finance, Storage, Forms, and My Work.

- [ ] **Step 1: Record current shell behavior**

Run:

```powershell
rg -n "\.dashboard-topbar|\.admin-sidebar|\.dashboard-bottom-tabs|\.dashboard-more-sheet" src/styles.css src/workspaces/*.css
```

Expected: multiple shell definitions are listed, confirming the competing-style baseline.

- [ ] **Step 2: Create the authoritative shell stylesheet**

Create `src/workspaces/dashboardShell.css` with:

```css
.admin-cms-shell {
  --dashboard-topbar-height: 68px;
  --dashboard-sidebar-width: 260px;
  --dashboard-shell-gap: 12px;
  --dashboard-motion-fast: 140ms;
  --dashboard-motion-base: 220ms;
}

.dashboard-topbar,
.admin-sidebar,
.dashboard-bottom-tabs {
  font-family: inherit;
  color: var(--dashboard-text);
  background: color-mix(in srgb, var(--dashboard-surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--dashboard-line) 82%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
```

Expand this same file with the complete desktop grid, fixed/sticky positioning, expanded and collapsed sidebar states, viewport-aware flyouts, topbar controls, mobile bottom navigation, More sheet, safe-area spacing, dark-mode translation, hover/press/focus states, and reduced-motion rules. The shell stylesheet must own these selectors after consolidation.

- [ ] **Step 3: Remove competing shell correction blocks**

Delete obsolete shell-specific blocks from `src/styles.css` and `src/workspaces/focusedWorkspaceShell.css` after moving their intended declarations into `dashboardShell.css`. Preserve page-level selectors and workflow styling.

- [ ] **Step 4: Load the shared stylesheet once**

Add after the main stylesheet import in `src/main.jsx`:

```jsx
import "./workspaces/dashboardShell.css";
```

- [ ] **Step 5: Align focused workspace interactions**

Keep the existing `FocusedWorkspaceShell` callbacks and permissions untouched. Add Escape dismissal and focus-safe close behavior for the profile dropdown and mobile More sheet, and ensure active mobile navigation derives from the current section without route reloads.

- [ ] **Step 6: Verify the shell**

Run:

```powershell
npm run build
```

Expected: Vite completes successfully.

Use Playwright at 1440x900, 390x844, and 375x812. Verify the topbar, sidebar, mobile nav, theme toggle, profile dropdown, notifications, workspace switcher, collapsed flyout placement, safe areas, and absence of horizontal overflow.

### Task 2: Normalize Public Layout And Navigation

**Files:**
- Modify: `src/components/Layout.jsx`
- Modify: `src/styles.css`
- Verify: public page components under `src/pages`

**Interfaces:**
- Consumes: current public routes and dynamic page content.
- Produces: consistent public header, mobile menu, page container, and footer presentation.

- [ ] **Step 1: Capture public baselines**

Use Playwright screenshots for `/`, `/about`, `/calendar`, `/blogs`, `/gallery`, and `/login` at desktop and mobile widths.

- [ ] **Step 2: Consolidate public tokens and primitives**

Keep existing variable names, but normalize page widths, section spacing, heading scale, button dimensions, focus rings, card radii, shadows, and image treatment in the first token section of `src/styles.css`.

- [ ] **Step 3: Refine the shared public shell**

Keep `Layout.jsx` routing and auth links unchanged. Make the desktop header quieter and more balanced, the mobile menu single-column and viewport-safe, and the footer denser on small screens.

- [ ] **Step 4: Verify routing and responsiveness**

Navigate every public route using header and footer links. Expected: no route reload loops, no clipped controls, no horizontal overflow, and no dashboard chrome on public pages.

### Task 3: Refine Public Page Hierarchy

**Files:**
- Modify only where markup is needed: `src/pages/HomePage.jsx`
- Modify only where markup is needed: `src/pages/AboutPage.jsx`
- Modify only where markup is needed: `src/pages/CalendarPage.jsx`
- Modify only where markup is needed: `src/pages/BlogsPage.jsx`
- Modify only where markup is needed: `src/pages/BlogDetailPage.jsx`
- Modify only where markup is needed: `src/pages/GalleryPage.jsx`
- Modify only where markup is needed: `src/pages/AlbumDetailPage.jsx`
- Modify only where markup is needed: `src/pages/LoginPage.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing service calls, loading flags, rich text rendering, route parameters, event modals, and image fallbacks.
- Produces: consistent page intros, content grids, empty/loading states, readable detail views, and mobile-safe controls.

- [ ] **Step 1: Reduce mobile hero and title dominance**

Use `clamp()` with fixed min/max sizes rather than viewport-width font scaling. Keep the next section visible on the home page and prevent inner-page titles from consuming most of a phone viewport.

- [ ] **Step 2: Normalize list and detail views**

Apply one card language to blogs, albums, and events. Only clickable cards receive hover lift. Keep rich text output, links, dates, and modal behavior unchanged.

- [ ] **Step 3: Improve states**

Replace broad empty areas with compact inline empty states and use existing loading flags to show skeleton-shaped placeholders in the content region.

- [ ] **Step 4: Verify public pages**

Use Playwright to load each route, open an event, open a blog, open an album, exercise filters, and dismiss overlays by close button and backdrop.

### Task 4: Refine Dashboard Workflow Surfaces

**Files:**
- Modify: `src/styles.css`
- Modify: `src/workspaces/focusedWorkspaceShell.css`
- Modify page JSX only when semantic wrappers are missing.

**Interfaces:**
- Consumes: current dashboard sections, permissions, forms, tables, dialogs, status values, and workspace services.
- Produces: shared panels, tabs, forms, tables, dialogs, loaders, empty states, and status styling across all workspaces.

- [ ] **Step 1: Create shared dashboard primitives**

Consolidate selectors for panel surfaces, section headers, segmented tabs, fields, tables, status badges, action rows, dialogs, and empty/loading/error states. Dark mode must translate the light hierarchy without adding decorative borders to every container.

- [ ] **Step 2: Refine dense workflows**

Apply the primitives to Overview, My Group, Attendance, Forms, Approvals, Contact Messages, Users & Permissions, Settings, Finance, Storage, Reports, and Notifications without changing their data or permission logic.

- [ ] **Step 3: Restrict motion to meaningful interactions**

Use 140–180ms hover/press transitions, 180–220ms tab changes, 220–280ms dialogs, and 250–320ms shell transitions. Do not animate static tables, rows, panels, or non-clickable cards on hover.

- [ ] **Step 4: Verify workflow rendering**

Run access-control tests:

```powershell
npm run test:access-control
```

Expected: all tests pass.

Run dark-mode tests:

```powershell
npm run test:dark-mode
```

Expected: Playwright completes without hardcoded-light-surface failures.

### Task 5: Final Cross-Route Verification

**Files:**
- Modify only regressions found by verification.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a verified production build and visual regression evidence.

- [ ] **Step 1: Run static verification**

Run:

```powershell
npm run build
npm run test:access-control
```

Expected: all commands pass. There is no configured `lint` script, so report lint as skipped rather than inventing a command.

- [ ] **Step 2: Run visual verification**

Use Playwright for public and authenticated routes at 1440x900, 768x1024, 390x844, and 375x812 in light and dark themes.

- [ ] **Step 3: Check interaction regressions**

Verify sidebar collapse/expand, collapsed flyouts, workspace switching, mobile More navigation, profile and notification dismissal, dialogs, forms, tables, loading states, event details, blog details, album details, and browser back navigation.

- [ ] **Step 4: Review the final diff**

Run:

```powershell
git diff -- src docs/superpowers
git status --short
```

Expected: only intentional UI files and the approved design/plan documents are changed; unrelated user changes remain untouched.

