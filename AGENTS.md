# AGENTS.md

## Project Overview

This is the St. Mary's Scouts Dubai React/Vite website and private dashboard.

The public website is for parents, scouts, visitors, and the church/community. It includes public pages for Home, About, Calendar, Blogs/News, Blog detail, Gallery, Album detail, Login, and fallback Not Found routing.

The private dashboard is a protected React route used by admins, chiefs, coordinators, and users with permissions. It manages scouts, attendance, attendance sheets, equipes, forms/evaluations, approvals, posts/blogs, gallery/albums, calendar events, contact messages, website content, documents, reports, archived years, users, roles, and permissions.

Main stack:

- React 18 and Vite.
- React Router with `HashRouter` in `src/main.jsx`.
- Supabase REST/Auth/Storage helpers through `src/services/supabaseClient.js`.
- Supabase Edge Functions for secure dashboard user actions.
- TipTap rich text editor.
- Lucide React icons.
- Playwright available for dashboard visual testing.

The app uses a GitHub Pages base path in `vite.config.js`: `/Scouts_Website/`.

## Current Project Structure

- `src/App.jsx`: lazy route definitions, protected routes, layout wrapper, recovery prompt, toasts, branded loading fallback.
- `src/main.jsx`: React entry point, `HashRouter`, root `ErrorBoundary`, global CSS import.
- `src/pages`: public pages and major dashboard pages:
  - `HomePage.jsx`
  - `AboutPage.jsx`
  - `CalendarPage.jsx`
  - `BlogsPage.jsx`
  - `BlogDetailPage.jsx`
  - `GalleryPage.jsx`
  - `AlbumDetailPage.jsx`
  - `LoginPage.jsx`
  - `AdminDashboardPage.jsx`
  - `AttendancePage.jsx`
  - `AdminChiefAttendancePage.jsx`
  - `ChiefContentDashboardPage.jsx`
  - `NotFoundPage.jsx`
- `src/components`: shared UI such as `Layout`, `RichTextEditor`, `FormattedText`, `SafeImage`, `UserAvatar`, `AvatarCropModal`, `WebsiteContentEditor`, loaders, toasts, recovery prompt, and error boundaries.
- `src/features/forms`: forms builder, posted forms, drafts, submissions, previews, and form response flows.
- `src/features/attendance`: scout attendance, chief attendance, and attendance sheets.
- `src/features/calendar`: dashboard calendar event management.
- `src/services`: Supabase and domain services for auth, users, scouts, attendance, calendar, content, gallery, forms, notifications, permissions, realtime, storage, website content, site errors, documents/settings, and audit logs.
- `src/api`: dashboard bootstrap/client operations and lightweight public data loading.
- `src/auth`: `AuthProvider` and `ProtectedRoute`.
- `src/data`: fallback/demo/generated data used when Supabase is unavailable or for local support.
- `src/utils`: rich text and image preload helpers.
- `src/styles.css`: large global stylesheet for public pages, dashboard shell, dark mode, forms, calendar, gallery, tables, and responsive styling.
- `database`: local SQLite schema/seed and Supabase SQL files:
  - `supabase-schema.sql`
  - `supabase-upload-fix.sql`
  - `supabase-performance-indexes.sql`
  - `supabase-attendance-sheets.sql`
  - `supabase-profile-repair.sql`
- `supabase/functions`: Edge Functions:
  - `create-dashboard-user`
  - `delete-dashboard-user`
  - `admin-reset-user-password`
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow.
- `.codex/skills`: local project skill folders are present.
- `DESIGN.md`: premium design system guidance for public and dashboard UI.

There is no `.agents` folder in the current repo inspection.

## Local Development

Commands from the current `package.json`:

- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server.
- `npm run api`: start local Node API server (`server.mjs`).
- `npm run dev:full`: start the combined local dev workflow.
- `npm run build`: production Vite build.
- `npm run preview`: preview the production build.
- `npm run start`: build then run `server.mjs`.
- `npm run db:reset`: reset local SQLite database.
- `npm run db:tables`: list local SQLite tables.
- `npm run test:dark-mode`: run the Playwright dark mode audit.

There is currently no `npm run lint` script, even though `eslint` is installed.

Vite local dev URL is usually:

- `http://localhost:5173`

## Public Routes

Routes defined in `src/App.jsx`:

- `/`
- `/about`
- `/calendar`
- `/blogs`
- `/blogs/:slug`
- `/gallery`
- `/gallery/:albumId`
- `/login`
- `*`

Legacy redirects:

- `/chiefs` redirects to `/dashboard`.
- `/admin` redirects to `/dashboard`.

Public pages should use lightweight public data services from `src/api/publicClient.js` and should not load full dashboard bootstrap data.

## Protected Routes

Protected routes in `src/App.jsx`:

- `/dashboard`: unified dashboard for `chief` and `admin`.
- `/chiefs/attendance`: protected attendance route for `chief` and `admin`.
- `/chiefs/content`: protected content route for `chief` and `admin` with publisher permission.
- `/admin/chief-attendance`: protected admin chief attendance route.

`ProtectedRoute.jsx` waits for auth/profile loading before redirecting. Do not simplify it in a way that reintroduces blank screens or premature redirects.

## Environment And Secrets

Current frontend env names:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY` as a fallback alias
- `VITE_SUPABASE_STORAGE_BUCKET`

Rules:

- Do not expose secrets.
- Do not commit real `.env` values.
- Do not put Supabase service-role keys, database passwords, or private backend secrets in frontend code.
- Service-role operations belong in Supabase Edge Functions or another protected backend.
- Do not edit `.env` values unless the user explicitly asks.

## Important Project Rules

- Do not change authentication, Supabase logic, database behavior, RLS expectations, permissions, routes, form submission logic, attendance logic, or notification behavior unless explicitly asked.
- Do not remove existing features unless explicitly asked.
- Preserve role-based and permission-based behavior.
- Preserve existing public and dashboard routes.
- Preserve public/dashboard data separation.
- Keep UI responsive for desktop and mobile.
- Follow existing visual direction, components, styles, and `DESIGN.md` unless the user asks for a redesign.
- Avoid adding new libraries unless already used in the project or explicitly requested.
- For UI changes, improve the existing implementation instead of rewriting large areas unnecessarily.
- Do not edit `open-design/` if present; it is reference-only.
- Do not make destructive database or storage changes without explicit approval.
- Do not hide errors by returning `null`; use clear loading, empty, and error states.

## Current Dashboard Areas

From `AdminDashboardPage.jsx` and feature files, current dashboard areas include:

- Overview and pending work.
- AI Assistant placeholder.
- Notifications.
- My Group.
- Scout Attendance.
- Attendance Sheets.
- Chief Attendance.
- Scouts.
- Equipe Management.
- Calendar Events.
- Posts / Blogs.
- Gallery / Albums.
- My Forms.
- Manage Forms.
- Approval Requests.
- Contact Messages.
- Settings.
- People & Access (internal section ID remains `usersPermissions` for compatibility).
- Website Content.
- Registered Scout Upload.
- Groups & Sorting Rules.
- Documents.
- Reports.
- Archived Years.

Access depends on role, chief level, assigned groups, coordinator group assignments, and permission flags.

## Current Services And Workflows

Important service areas:

- `authService.js`, `AuthProvider.jsx`, `ProtectedRoute.jsx`: auth/session/profile flow.
- `userService.js`: profiles, profile changes, dashboard user creation/deletion/reset via functions.
- `permissions.js`, `permissionService.js`, `supabaseMappers.js`: role and permission mapping.
- `scoutService.js`, `equipeService.js`: scout/group/equipe data.
- `attendanceService.js`: attendance sessions, sheets, edits/deletes, audit logging.
- `formService.js`: templates, posted forms, drafts/submissions, closing/reopening, review.
- `contentService.js`: posts/blog/news and revisions.
- `galleryService.js`: albums/photos/upload batches.
- `calendarService.js`, `calendarExportService.js`: events and calendar export.
- `siteContentService.js`, `websiteContentRevisionService.js`: website content and approvals.
- `notificationService.js`: notifications and completion/read state.
- `settingsWorkspaceService.js`: documents, reports, archived years.
- `auditService.js`: audit logs.
- `publicEngagementService.js`: FAQ/contact/public engagement.
- `imageOptimizationService.js`, `storageService.js`: image conversion/upload/storage.
- `publicClient.js`: lightweight public page data.
- `client.js`, `useBootstrap.js`: dashboard bootstrap and dashboard actions.

When changing a workflow, inspect the relevant service and mapper before changing UI.

## Supabase And Database Rules

- Inspect SQL and service files before changing table or column names.
- Respect RLS and existing policies.
- Avoid destructive migrations unless explicitly requested.
- Do not delete data unless asked.
- Use pagination, limits, filters, and targeted queries for large datasets.
- Public pages should query approved/public content only.
- Dashboard pages should query permission-aware data.
- Storage deletes should remove related files only through the intended service/policy flow.
- Edge Functions require Supabase environment secrets and should not be replaced with frontend-only service-role logic.

## Design And UI Rules

Use `DESIGN.md` for detailed design guidance.

Durable UI rules:

- Public pages should feel premium, modern, clean, and trustworthy.
- Dashboard should feel like a polished admin system, not a generic template.
- Mobile behavior matters as much as desktop behavior.
- Dark mode should be a darker version of light mode, not a collection of random dark panels.
- Only clickable elements should have hover effects.
- Buttons must be visibly clickable and keep pointer behavior.
- Tables, forms, modals, and cards must remain readable in light and dark mode.
- Rich text editor output must match public rendering as closely as possible.
- Image/avatar cropping and display must match what users actually see.

CSS warning:

- `src/styles.css` is large and has accumulated duplicate/conflicting rules.
- Search for existing selectors before adding new CSS.
- Prefer fixing the winning existing rule over layering broad `!important` overrides.
- If an override is necessary, scope it narrowly and explain why.

## Forms And Evaluations Rules

- Forms are split into My Forms and Manage Forms.
- My Forms includes open forms, drafts, and submissions.
- Manage Forms includes create form, templates, posted forms, and form responses where permitted.
- Form filling must support drafts, review-before-submit, validation, progress feedback, and multiple languages.
- Builder behavior should remain Google-Forms-style but premium.
- Admin previews should match what chiefs see.
- Posted forms, notifications, submissions, exports, and approval behavior must not be broken.

## Attendance Rules

- Attendance is a core workflow.
- Preserve group/year/date filtering.
- Do not load huge attendance datasets unnecessarily.
- Deleting or editing attendance sessions must preserve database consistency and audit expectations.
- Head chiefs, vice chiefs, coordinators, admins, and normal chiefs may have different access.
- Mobile attendance views must remain usable.

## Installed Skills And When To Use Them

Visible local project skills in `.codex/skills`:

- `superpowers`: umbrella/process skills for careful workflows.
- `using-superpowers`: use to choose the right Superpowers process before starting risky work.
- `brainstorming`: use for unclear product/feature direction before implementation.
- `writing-plans`: use when a detailed implementation plan should be created before editing.
- `executing-plans`: use to implement an approved plan step by step.
- `systematic-debugging`: use for bugs, regressions, and "why is this happening?" investigations.
- `test-driven-development`: use when tests should define or protect behavior before implementation.
- `verification-before-completion`: use to verify fixes before claiming completion when available.
- `subagent-driven-development`: use for large plan execution when subagents are available.
- `dispatching-parallel-agents`: use when independent investigation/work can safely happen in parallel and supporting tools are available.
- `requesting-code-review` / `receiving-code-review`: use for review workflows when a task calls for review-quality checks.
- `ui-ux-pro-max`: use for dashboard UI, admin pages, forms UI, settings, permissions, data-heavy pages, layout, spacing, responsive polish, and premium app-style screens.
- `ui-styling`: use for focused CSS/component visual fixes, responsive styling, state styling, and style consistency.
- `design-system`: use for tokens, reusable component specs, visual systems, and design consistency work.
- `design`: use for broader visual concepts, public page polish, icon/logo/banner-oriented design references, and design routing.
- `brand`: use for brand identity, colors, voice, logo usage, asset organization, and brand consistency.
- `design-taste-frontend` / `design-taste-frontend-v1`: use for public website pages, landing sections, Home/About/Gallery/Blog polish, and making public pages less generic.
- `gpt-taste` / `stitch-design-taste`: use for taste checks and public-facing visual judgment when available.
- `emil-design-eng`: use for interaction design, motion feel, animation judgment, and high-quality frontend design engineering.
- `animation-vocabulary` / `review-animations`: use for transitions, hover states, modal animations, sidebar animations, card interactions, and motion review.
- `impeccable`: use for final frontend polish, spacing, typography, hierarchy, consistency, and removing generic AI-looking UI.
- `high-end-visual-design`: use when the task asks for a premium, expensive, high-end visual direction.
- `redesign-existing-projects`: use when restyling existing pages without breaking behavior.
- `image-to-code`: use when converting a provided image/mockup into code, while preserving existing app behavior.
- `minimalist-ui` / `industrial-brutalist-ui`: use only if the user asks for those specific visual styles.
- `brandkit`: use for brand asset systems or brand kit work.
- `banner-design`: use for banner/hero sizing and banner-specific design guidance.
- `browser-use`: project-local skill for Browser Use workflows; pair with the installed `browser-use` CLI when CDP is reachable.
- `playwright-cli`: use for Playwright workflow guidance and browser regression checks.
- `slides`: use only for presentation/slides tasks.
- `finishing-a-development-branch`, `using-git-worktrees`, `full-output-enforcement`, `writing-skills`: use only for their matching git/worktree/output/skill-authoring workflows when explicitly relevant.

Relevant built-in/session skills and tools:

- Browser/Codex browser: use for visual inspection of local pages, screenshots, and obvious visual regressions when available.
- Chrome control: use when an existing Chrome session, login state, or browser-specific behavior matters.
- `browser-use` CLI: installed at `C:\Users\dania\.local\bin\browser-use.exe`. Use for CDP-based browser inspection when Chrome remote debugging is enabled and reachable. `browser-use doctor` works; a simple `page_info()` test requires an active CDP endpoint such as `127.0.0.1:9222`.
- Playwright CLI: installed through `@playwright/test`; use for route checks, clicks, screenshots, form behavior, dark mode checks, and end-to-end regressions.
- `imagegen`: use only when a task needs generated or edited bitmap visuals.
- GitHub skills/plugins: use only for GitHub PR/issues/actions/deployment tasks.
- Google Drive skills/plugins: use only when the user asks to inspect or work with Drive files.

Not verified under these exact names:

- `taste-skill` as a separate skill name. Use `design-taste-frontend`, `design-taste-frontend-v1`, `gpt-taste`, or `stitch-design-taste` when available.
- "Emil Kowalski design/animation skills" as that exact folder name. Use verified local skills `emil-design-eng`, `animation-vocabulary`, and `review-animations`.

Do not invent or claim use of skills that are not visible/callable in the active session.

## Skill Selection Rules

- For large, risky, unclear, or multi-step tasks, use Superpowers first: `brainstorming` for unclear direction, `writing-plans` for implementation plans, `executing-plans` for approved plans, and `systematic-debugging` for bugs.
- Use `test-driven-development` when behavior can be protected or clarified by tests before implementation.
- For public-facing pages, prefer `design-taste-frontend` / `design-taste-frontend-v1`, then `brand`, `design`, and `design-system`; use `impeccable` for final polish.
- For dashboard/admin/settings/forms/permissions/data-heavy UI, use `ui-ux-pro-max` first, then `ui-styling` and `design-system`; use `impeccable` for final polish.
- For focused CSS fixes, use `ui-styling` when available.
- For tokens and reusable patterns, use `design-system`.
- For animation and interaction feel, use `emil-design-eng`, `animation-vocabulary`, or `review-animations`.
- For restyling existing pages, use `redesign-existing-projects` and preserve current behavior.
- For visual UI changes, inspect the running page with Browser/Codex browser, Chrome control, `browser-use`, or Playwright when possible.
- Use `browser-use` only when its Chrome/CDP connection is working; otherwise fall back to Codex browser, Chrome control, or Playwright screenshots.
- Use Playwright after UI, route, or form changes when repeatable interaction testing is needed.
- For backend, Supabase, database, auth, permissions, or service logic, do not use design-only skills as the primary guide.

## Verification Rules

After code changes:

- Run `npm run build`.
- Run `npm run lint` only if a lint script is added in the future; currently no lint script exists.
- If UI changed, visually inspect the relevant page when possible.
- If routes changed, verify the affected route loads.
- If forms changed, verify inputs, drafts, submissions, permissions, and existing flow as much as possible.
- If dashboard permissions changed, verify role-based behavior is preserved.
- If dark mode/dashboard shell changed, consider `npm run test:dark-mode`.
- If the change is documentation-only, build is not required unless requested.

Do not claim a command or visual check was run unless it actually was.

## Browser / Testing Notes

- Use Vite at `http://localhost:5173` for local browser checks.
- Use `npm run dev` for frontend-only testing.
- Use `npm run dev:full` when local API behavior is needed.
- Use Playwright for repeatable route/UI checks, especially dashboard shell, forms, and dark mode.
- Use browser screenshots for visual regressions when the user is reporting layout or styling problems.

## Output Expectations

At the end of future tasks, report:

- Which skills were used, if any.
- What files changed.
- What was tested.
- Whether `npm run build` passed.
- Whether lint was run or skipped.
- Any risks, manual checks, SQL steps, or deployment steps left.

Keep final reports concise but specific.
# Finance and Storage workspace notes

- Keep the public website shell separate from authenticated `/dashboard/*`, `/admin*`, and `/chiefs*` routes.
- Workspace switchers are navigation only; effective permissions, RLS, and trusted database functions are authoritative.
- Do not add Finance or Storage data to the global dashboard bootstrap. Load it only inside the selected workspace.
- Preserve immutable posted Finance journals, movement-derived Storage availability, workflow history, self-approval prevention, and private attachment access.
- New operational workspaces should follow `docs/workspaces.md` and reuse the shared workflow and My Work contracts.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- Before any large dashboard, Forms, or Supabase change, run `/graphify .` when available (or `graphify update .` when an existing graph only needs refreshing), read `graphify-out/GRAPH_REPORT.md`, and use `graphify query`, `graphify path`, or `graphify explain` to understand the affected dependencies before editing.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
