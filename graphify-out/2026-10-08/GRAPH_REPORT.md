# Graph Report - Website  (2026-10-08)

## Corpus Check
- 292 files · ~281,250 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1895 nodes · 4656 edges · 145 communities (116 shown, 29 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Content Admin Workflows
- Forms Builder System
- Authentication and MFA
- Workspace Access Control
- Local API Server
- Calendar Management
- Dashboard Attendance Bootstrap
- Dashboard Audit Utilities
- Supabase Data Operations
- Public Data Services
- People Access Workspace
- Shared Workspace Tasks
- Access Control Rollout
- Storage Workspace Core
- Site Content Storage
- Finance Workspace Core
- Scouting Workspace Integration
- User Profile Management
- Rich Text Rendering
- Image Crop Processing
- Finance Workflow Modules
- Storage Workflow Modules
- Albums and Rich Editing
- Public Content Fallbacks
- Error Recovery System
- Blog Content Services
- Frontend Dependencies
- Settings and Archives
- Public Data Caching
- Blog Detail Experience
- Finance Ledger Services
- Legacy Permission Helpers
- Edge Function Authorization
- Project Tooling
- Notifications and Submissions
- About Page Content
- package.json
- Authorization Architecture
- Public Desktop Navigation
- Homepage Public Content
- Development Scripts
- Public Listing Pages
- Shared UI Components
- Dashboard Shell Checks
- Project Design Guidance
- Public Mobile Error State
- Group Access Helpers
- Public Desktop Error State
- Finance Storage Architecture
- Workspace Routing Strategy
- Data Platform Architecture
- Private Finance Security
- Scouts Brand Identity
- People Access Architecture
- Scouting Service Tests
- Inventory Finance Controls
- Public Loading Screen
- Development Process Runner
- GitHub Pages Deployment
- React Application Entry
- Private Files Function
- Private Files Tests
- DOMPurify Dependency
- React Core Dependency
- React DOM Dependency
- scoutYearBackup.ts
- TipTap Font Extension
- TipTap Highlight Extension
- TipTap Link Extension
- TipTap Text Styles
- TipTap Underline Extension
- TipTap ProseMirror Core
- TipTap Starter Kit
- Finance Ledger Tests
- Finance Storage Integration Tests
- Finance Workflow Tests
- People Access API Tests
- Public Policy Tests
- Scouting Reimbursement Tests
- Storage Inventory Tests
- Storage Workflow Tests
- Workflow Engine Tests
- InteractiveIcon.jsx
- utils.ts
- Form Response Email Design
- Scout Registration System Implementation Plan
- CalendarPage.jsx
- ChiefsPortalPage.jsx
- Global Constraints
- Global Constraints
- Global Constraints
- Form Question Display Design
- instagram.tsx
- Global Constraints
- arrow-left.tsx
- arrow-right.tsx
- calendar-days.tsx
- home.tsx
- map-pin.tsx
- moon.tsx
- panel-left-close.tsx
- panel-left-open.tsx
- RegistrationCampaigns.jsx
- scoutYearBackupDeletion.test.js
- bell.tsx
- menu.tsx
- sun.tsx
- upload.tsx
- users.tsx
- x.tsx
- settings.tsx
- @dnd-kit/utilities
- heic2any
- libphonenumber-js
- motion
- react-router-dom
- financeService.js
- scout-registration/index.ts
- vite
- scoutRegistrationMigration.test.js
- Global Constraints
- myWorkModel.js
- Layout.jsx
- inventoryService.js
- ChiefContentDashboardPage.jsx
- external-link.tsx
- registrationImportConfirmation.test.js
- AuthProvider.jsx
- registrationImageService.js
- delete-scout-year/index.ts
- parse-registration-upload/index.ts
- mapDashboardActivityLog
- settings.tsx
- @tiptap/extension-link
- @tiptap/extension-text-style
- @tiptap/starter-kit
- @vitejs/plugin-react

## God Nodes (most connected - your core abstractions)
1. `AdminDashboardPage()` - 96 edges
2. `getSupabaseRows()` - 73 edges
3. `getCurrentSupabaseUserId()` - 64 edges
4. `patchSupabaseRows()` - 58 edges
5. `insertSupabaseRow()` - 49 edges
6. `callSupabaseRpc()` - 35 edges
7. `useAuth()` - 31 edges
8. `deleteSupabaseRows()` - 31 edges
9. `uploadSupabaseFile()` - 30 edges
10. `optimizeImageForUpload()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Public and Private Application Surface Separation` --semantically_similar_to--> `Dashboard Workspaces`  [INFERRED] [semantically similar]
  AGENTS.md → docs/workspaces.md
- `Responsive and Accessible Interface` --conceptually_related_to--> `Finance and Storage Workspaces Design`  [INFERRED]
  DESIGN.md → docs/superpowers/specs/2026-07-17-finance-storage-workspaces-design.md
- `SQLite-to-Supabase Migration` --semantically_similar_to--> `SQLite Local Fallback`  [INFERRED] [semantically similar]
  database/README.md → README.md
- `AdminDashboardPage()` --indirect_call--> `query()`  [INFERRED]
  src/pages/AdminDashboardPage.jsx → server.mjs
- `BlogsPage()` --indirect_call--> `query()`  [INFERRED]
  src/pages/BlogsPage.jsx → server.mjs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Public Homepage Experience** — artifacts_workspace_public_desktop_loaded_brand, artifacts_workspace_public_desktop_loaded_public_navigation, artifacts_workspace_public_desktop_loaded_scouting_mission, artifacts_workspace_public_desktop_loaded_catholic_scouting_community [INFERRED 0.85]
- **Public Navigation Destinations** — artifacts_workspace_public_desktop_home, artifacts_workspace_public_desktop_about_us, artifacts_workspace_public_desktop_calendar, artifacts_workspace_public_desktop_blogs_news, artifacts_workspace_public_desktop_gallery [EXTRACTED 1.00]
- **Mobile Page Recovery Flow** — artifacts_workspace_public_mobile_loaded_database_authorization_error, artifacts_workspace_public_mobile_loaded_page_recovery_prompt, artifacts_workspace_public_mobile_loaded_reload_page_action [INFERRED 0.85]
- **Access Control Foundation Delivery Sequence** — _superpowers_sdd_task_1_report_catalog_driven_preflight, _superpowers_sdd_task_2_report_fail_closed_access_resolver, _superpowers_sdd_task_3_report_shadow_access_control_foundation, _superpowers_sdd_task_4_report_exact_permission_and_role_seed, _superpowers_sdd_task_5_report_shadow_effective_access_helper_layer, _superpowers_sdd_task_6_report_legacy_to_normalized_backfill [EXTRACTED 1.00]
- **Finance and Storage Unassigned Safety Pattern** — _superpowers_sdd_task_2_brief_finance_storage_namespace_separation, _superpowers_sdd_task_3_brief_additive_shadow_migration, _superpowers_sdd_task_4_brief_non_authoritative_team_membership, _superpowers_sdd_task_6_brief_idempotent_legacy_access_backfill [INFERRED 0.95]
- **Fail-closed Authorization Chain** — _superpowers_sdd_task_2_report_strict_scope_and_timestamp_validation, _superpowers_sdd_task_3_report_shadow_access_control_foundation, _superpowers_sdd_task_5_brief_authenticated_identity_and_deny_precedence, _superpowers_sdd_task_5_report_descriptive_access_snapshot [INFERRED 0.85]
- **Normalized Authorization Foundation** — docs_superpowers_specs_2026_07_15_access_control_modernization_design_role_assignment_scope_model, docs_superpowers_plans_2026_07_15_access_control_foundation_effective_access_resolver, docs_security_access_control_normalized_scoped_authorization, docs_superpowers_plans_2026_07_16_people_access_workspace_trusted_people_access_api [INFERRED 0.95]
- **Finance and Storage Operational Workspaces** — docs_finance_finance_workspace, docs_storage_storage_workspace, docs_superpowers_specs_2026_07_17_finance_storage_workspaces_design_finance_and_storage_workspaces_design, docs_superpowers_plans_2026_07_17_finance_storage_workspaces_finance_and_storage_workspaces_implementation_plan, docs_workspaces_dashboard_workspaces [EXTRACTED 1.00]
- **Backend-Authoritative Workspace Security** — agents_supabase_security_rules, docs_superpowers_specs_2026_07_15_access_control_modernization_design_backend_authoritative_security, docs_workspace_security_workspace_selection_is_not_authorization, docs_workspace_security_secure_private_workspace_files, docs_security_access_control_deny_precedence_and_fail_closed [INFERRED 0.95]
- **St. Mary's Scouts Visual Identity** — src_assets_smscouts_logo_st_marys_scouts_logo, src_assets_smscouts_logo_fleur_de_lis, src_assets_smscouts_logo_cross, src_assets_smscouts_logo_scouting_and_christian_identity [INFERRED 0.95]
- **St. Mary's Scouts Bilingual Naming** — src_assets_smscouts_logo_st_marys_scouts_logo, src_assets_smscouts_logo_scout_of_saint_mary, src_assets_smscouts_logo_arabic_scout_name, src_assets_smscouts_logo_bilingual_identity [EXTRACTED 1.00]

## Communities (145 total, 29 thin omitted)

### Community 0 - "Content Admin Workflows"
Cohesion: 0.22
Nodes (13): removeDashboardDocument(), reviewDashboardWebsiteContentRevision(), updateSupabaseCalendarEvent(), updateGalleryAlbum(), deleteDashboardDocument(), deleteLeader(), deleteSupabaseFile(), upsertSupabaseRows() (+5 more)

### Community 1 - "Forms Builder System"
Cohesion: 0.08
Nodes (57): closeDashboardPostedForm(), deleteDashboardFormTemplate(), deleteDashboardPostedForm(), reopenDashboardPostedForm(), saveDashboardFormSubmission(), saveDashboardFormTemplate(), saveDashboardPostedForm(), saveDashboardReimbursementDraft() (+49 more)

### Community 2 - "Authentication and MFA"
Cohesion: 0.23
Nodes (18): changeOwnPassword(), MfaSecurityPanel(), AcceptInvitationPage(), challengeAndVerifyMfa(), consumeInvitationCallback(), consumeStoredInvitationCallback(), enrollTotpMfa(), getMfaStatus() (+10 more)

### Community 3 - "Workspace Access Control"
Cohesion: 0.07
Nodes (48): ACCOUNT_STATUSES, PERMISSIONS, ROLE_KEYS, SCOPE_TYPES, TEAM_KEYS, APPROVED_SCOPE_TYPES, compareLegacyAndNormalized(), getAccessibleGroupIds() (+40 more)

### Community 4 - "Local API Server"
Cohesion: 0.09
Nodes (63): addAlbumPhotos(), addRegisteredScout(), columnIndexFromCellRef(), countPattern(), createAlbum(), createBlog(), createChief(), createEvent() (+55 more)

### Community 5 - "Calendar Management"
Cohesion: 0.10
Nodes (38): updateCalendarEvent(), CalendarManagement(), canSeeEvent(), formatDateKey(), formatEventDateRange(), formatEventTime(), fullDateFormatter, getEventsForDay() (+30 more)

### Community 6 - "Dashboard Attendance Bootstrap"
Cohesion: 0.09
Nodes (33): collectionKeys, normalizeBootstrapData(), objectOrEmpty(), deleteAttendanceSession(), loadingData, updateAttendanceSessionDate(), updateAttendanceSessionLabel(), currentCache() (+25 more)

### Community 7 - "Dashboard Audit Utilities"
Cohesion: 0.18
Nodes (14): createCalendarEvent(), colorOptions, fontOptions, FontSize, fontSizes, highlightOptions, RichTextEditor(), ChiefsPortalPage() (+6 more)

### Community 8 - "Supabase Data Operations"
Cohesion: 0.20
Nodes (20): addEquipe(), assignEquipeScouts(), removeEquipe(), saveEquipe(), saveSupabaseChiefAttendance(), saveSupabaseScoutAttendance(), updateSupabaseAttendanceSessionDate(), updateSupabaseAttendanceSessionLabel() (+12 more)

### Community 9 - "Public Data Services"
Cohesion: 0.37
Nodes (14): canOpenSection(), hasChiefAccess(), isSectionAllowed(), canEditScouts(), canManageFormTemplates(), canManageSystem(), canPostForms(), canPublishContent() (+6 more)

### Community 10 - "People Access Workspace"
Cohesion: 0.14
Nodes (28): asArray(), assignmentIdentity(), filterPeopleAccessUsers(), firstDefined(), mergeAssignments(), mergeLegacyGroups(), mergePeopleAccessUserDetails(), normalizeAssignment() (+20 more)

### Community 11 - "Shared Workspace Tasks"
Cohesion: 0.12
Nodes (24): getWorkspaceAuditLogs(), normalizeWorkspaceAuditLog(), combineMyWorkTasks(), COMPLETE_STATUSES, filterTasksForAccess(), getUrgency(), normalizeMyWorkTask(), URGENCY_RANK (+16 more)

### Community 12 - "Access Control Rollout"
Cohesion: 0.08
Nodes (29): Access Control Foundation Checkpoint, Normalized Access Foundation, Release 2 Clearance Gates, Access Control Foundation Execution Ledger, Shadow Authorization Rollout, Aggregate-only Profile Inventory, Read-only Authorization Preflight, Catalog-driven Preflight Implementation (+21 more)

### Community 13 - "Storage Workspace Core"
Cohesion: 0.21
Nodes (12): TransactionTable(), manageStorageRecord(), buildStorageFields(), humanize(), icons, MovementTable(), Overview(), SectionData() (+4 more)

### Community 14 - "Site Content Storage"
Cohesion: 0.12
Nodes (38): saveWebsiteContent(), AvatarCropModal(), clamp(), coverGeometry(), cropToFile(), loadImage(), readFileAsDataUrl(), prepareEventImage() (+30 more)

### Community 15 - "Finance Workspace Core"
Cohesion: 0.19
Nodes (14): FINANCE_NAVIGATION, FINANCE_SECTION_TABS, formatFinanceAmount(), getFinancePermissionKeys(), getVisibleFinanceNavigation(), normalizeFinanceOverview(), financeFields, FinanceWorkspace() (+6 more)

### Community 16 - "Scouting Workspace Integration"
Cohesion: 0.26
Nodes (10): aed, ScoutingBudgetSummary(), dateLabel(), emptyRequest, itemNames(), ScoutingStoragePanel(), tabs, getScoutingGroupBudgetSummaries() (+2 more)

### Community 17 - "User Profile Management"
Cohesion: 0.16
Nodes (24): getOrderedFormQuestions(), classification(), formatAnswer(), formatBytes(), formatDate(), orderedSubmissionAnswers(), pendingStatuses, questionLabel() (+16 more)

### Community 18 - "Rich Text Rendering"
Cohesion: 0.20
Nodes (19): FormattedText(), isSafeHref(), renderInline(), allowedAttributes, allowedCssProperties, allowedTags, cleanStyle(), escapeHtml() (+11 more)

### Community 19 - "Image Crop Processing"
Cohesion: 0.05
Nodes (42): Authenticated application, Color, Components, Dashboard And Workflow Refinement, Data And Behavior, Design Direction, Forms, Header (+34 more)

### Community 20 - "Finance Workflow Modules"
Cohesion: 0.16
Nodes (6): createFinanceWorkflowRecord(), transitionFinanceWorkflow(), amount(), configs, FinanceWorkflowPanel(), labelFor()

### Community 21 - "Storage Workflow Modules"
Cohesion: 0.16
Nodes (4): createStorageWorkflowRecord(), configs, StorageWorkflowPanel(), titleFor()

### Community 22 - "Albums and Rich Editing"
Cohesion: 0.19
Nodes (25): canShareFormRow(), comparableAnswer(), forcedFullWidthTypes, formatPhoneAnswer(), getAnswerScalar(), getCountryName(), getFormWidthUnits(), moveFormQuestion() (+17 more)

### Community 23 - "Public Content Fallbacks"
Cohesion: 0.16
Nodes (20): getQuestionPlaceholder(), QuestionInput(), RegistrationCampaignSettings(), asBoolean(), asPositiveInteger(), calculateAgeOnDate(), classifyDuplicateCandidate(), getRegistrationAvailability() (+12 more)

### Community 24 - "Error Recovery System"
Cohesion: 0.22
Nodes (11): ErrorBoundary, readReloadAttempts(), reloadWithRecoveryLimit(), SiteRecoveryPrompt(), writeReloadAttempts(), getErrorSignature(), limitText(), logSiteError() (+3 more)

### Community 25 - "Blog Content Services"
Cohesion: 0.18
Nodes (18): getPublicAboutData(), AboutPage(), goals, groupRange(), initials(), parseHistoryMilestones(), parseManagedList(), titleForLeader() (+10 more)

### Community 26 - "Frontend Dependencies"
Cohesion: 0.11
Nodes (19): @dnd-kit/core, @dnd-kit/sortable, lucide-react, dependencies, @dnd-kit/core, @dnd-kit/sortable, lucide-react, react-dom (+11 more)

### Community 27 - "Settings and Archives"
Cohesion: 0.15
Nodes (21): loadDashboardReports(), removeArchivedYearSnapshot(), saveArchivedYearSnapshot(), saveDashboardDocument(), saveDashboardDocumentCategory(), uploadDashboardDocumentFiles(), allowedDocumentExtensions, createArchivedYearSnapshot() (+13 more)

### Community 28 - "Public Data Caching"
Cohesion: 0.24
Nodes (16): delay(), getCachedEntry(), getFreshCachedData(), getStaleCachedData(), loadPublicData(), loadWithRetry(), makeCacheKey(), publicDataCache (+8 more)

### Community 29 - "Blog Detail Experience"
Cohesion: 0.14
Nodes (14): approved(), fallbackWebsiteData(), getPublicAlbumPage(), getPublicBlogDetailPage(), getPublicGalleryPage(), getPublicHomeData(), plannedEvents, scoutGroups (+6 more)

### Community 30 - "Finance Ledger Services"
Cohesion: 0.20
Nodes (10): aboutSections, getSiteImageCropConfig(), homeSections, ImageField(), imageUrlToFile(), makeId(), move(), parseList() (+2 more)

### Community 31 - "Legacy Permission Helpers"
Cohesion: 0.06
Nodes (46): addLeader(), createScoutYearBackup(), deleteScoutYear(), getScoutYearDeletionRecovery(), reviewDashboardPostedForm(), saveLeader(), submitDashboardWebsiteContentRevision(), AdminDashboardPage() (+38 more)

### Community 32 - "Edge Function Authorization"
Cohesion: 0.17
Nodes (24): asArray(), asRecord(), buildFormResponseEmail(), conditionMatches(), deliverFormResponseEmail(), DeliveryInput, EmailSourceType, formatAnswer() (+16 more)

### Community 33 - "Project Tooling"
Cohesion: 0.18
Nodes (11): eslint, fflate, devDependencies, eslint, fflate, @playwright/test, prettier, supabase (+3 more)

### Community 34 - "Notifications and Submissions"
Cohesion: 0.19
Nodes (13): addFaq(), removeFaq(), saveFaq(), cleanContactValue(), createFaq(), deactivateFaq(), defaultFaqs, getPublicEngagementData() (+5 more)

### Community 35 - "About Page Content"
Cohesion: 0.12
Nodes (32): activateScoutingYear(), deleteSupabaseAttendanceSession(), getAttendanceData(), createGalleryAlbum(), deleteGalleryAlbum(), deleteGalleryPhotos(), getGallery(), getPublicAlbumPhotos() (+24 more)

### Community 36 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 37 - "Authorization Architecture"
Cohesion: 0.19
Nodes (13): Access Control Foundation, Deny Precedence and Fail-Closed Resolution, Normalized Scoped Authorization, Shadow-Mode Authorization Authority, Access Control Foundation Implementation Plan, Authorization Compatibility Comparison Report, Effective Access Resolver, Idempotent Legacy Authorization Backfill (+5 more)

### Community 38 - "Public Desktop Navigation"
Cohesion: 0.17
Nodes (12): About Us, Blogs / News, Faith, Service, Leadership, Calendar, Empty Main Content Area, Gallery, Home, Log In (+4 more)

### Community 39 - "Homepage Public Content"
Cohesion: 0.09
Nodes (19): AboutPage, AcceptInvitationPage, AdminChiefAttendancePage, AdminDashboardPage, AlbumDetailPage, App(), AttendancePage, BlogDetailPage (+11 more)

### Community 40 - "Development Scripts"
Cohesion: 0.18
Nodes (11): scripts, api, build, db:reset, db:tables, dev, dev:full, preview (+3 more)

### Community 41 - "Public Listing Pages"
Cohesion: 0.16
Nodes (17): updateBlog(), getPublicBlogsPage(), BlogPostPreview(), formatPostCategory(), formatPostDate(), SafeImage(), withRetryParam(), getInitials() (+9 more)

### Community 42 - "Shared UI Components"
Cohesion: 0.32
Nodes (6): client, dashboard, deletionHarness(), functionSource(), optionalFunctionSource(), styles

### Community 43 - "Dashboard Shell Checks"
Cohesion: 0.18
Nodes (8): { chromium }, css, fs, logoPath, outDir, path, root, sidebarButtons

### Community 44 - "Project Design Guidance"
Cohesion: 0.22
Nodes (9): Dashboard Work Areas, St. Mary's Scouts Web Application Architecture, Supabase Security Rules, Repository Verification Rules, Dashboard Design Language, Form and Rich Content Fidelity, Premium Trustworthy Visual Direction, Responsive and Accessible Interface (+1 more)

### Community 45 - "Public Mobile Error State"
Cohesion: 0.28
Nodes (9): Database Authorization Error 42501, is_admin Function, Mobile Navigation Menu, Public Mobile Homepage Screenshot, Page Not Loading Properly Recovery Prompt, Public Mobile Homepage, Reload Page Action, Building Faith, Leadership, and Community Through Scouting (+1 more)

### Community 46 - "Group Access Helpers"
Cohesion: 0.21
Nodes (20): validateEmailAnswer(), clearRegistrationRecovery(), containsFile(), getSerializableRegistrationAnswers(), loadLocalFallback(), loadRegistrationRecovery(), openRecoveryDatabase(), recoveryKey() (+12 more)

### Community 47 - "Public Desktop Error State"
Cohesion: 0.25
Nodes (8): St. Mary's Scouts Dubai, Catholic Scouting Community in Dubai, Permission Denied for is_admin Function (42501), Public Site Navigation, Reload Page Action, Building Faith, Leadership, and Community Through Scouting, St. Mary's Scouts Dubai Public Desktop Homepage Screenshot, Page Recovery Prompt

### Community 48 - "Finance Storage Architecture"
Cohesion: 0.29
Nodes (8): Finance and Storage Cross-Workspace Integration, Finance and Storage Workspaces Implementation Plan, Permission-Driven Workspace Shell, Shared Approval and Task Engine, Finance and Storage Workspaces Design, Global My Work, Immutable Cross-Domain References, One Account, Multiple Workspaces

### Community 49 - "Workspace Routing Strategy"
Cohesion: 0.29
Nodes (7): Public and Private Application Surface Separation, Additive Authorization Migration, Centralized Workspace Registry, Canonical Workspace Routes, Dashboard Workspaces, Non-Destructive Workspace Rollback, Workspace Migration Order

### Community 50 - "Data Platform Architecture"
Cohesion: 0.29
Nodes (7): Approved Public Content Publication, Scouts Data Layer, SQLite-to-Supabase Migration, Scouts Group Web App, SQLite Local Fallback, Static Deployment Workflow, Supabase-First Platform

### Community 51 - "Private Finance Security"
Cohesion: 0.29
Nodes (7): Finance Workspace, Immutable Double-Entry Accounting, Private Finance Attachments, Private Workspace File Infrastructure, Secure Private Workspace Files, Workspace Security, Workspace Selection Is Not Authorization

### Community 52 - "Scouts Brand Identity"
Cohesion: 0.38
Nodes (7): Arabic Scout of Saint Mary Name, Bilingual Arabic and English Identity, Christian Cross, Scouting Fleur-de-lis, Scout of Saint Mary, Scouting and Christian Identity, St. Mary's Scouts Logo

### Community 53 - "People Access Architecture"
Cohesion: 0.33
Nodes (6): Explainable Effective Access, People and Access Tabs, People and Access Workspace Implementation Plan, Secure Invitation and Recovery Flow, Trusted People and Access API, Backend-Authoritative Security

### Community 54 - "Scouting Service Tests"
Cohesion: 0.33
Nodes (5): budgetSummary, dashboard, formsDashboard, sql, storagePanel

### Community 55 - "Inventory Finance Controls"
Cohesion: 0.40
Nodes (5): Finance Separation of Duties, Movement-Derived Inventory Availability, Storage Workspace, Strict Inventory Audits, Shared Approval Engine

### Community 56 - "Public Loading Screen"
Cohesion: 0.83
Nodes (4): Preparing Page State, Public Mobile Loading Screen, Scout of Saint Mary, Scout of Saint Mary Emblem

### Community 58 - "GitHub Pages Deployment"
Cohesion: 1.00
Nodes (3): Build Job, Deploy Job, GitHub Pages Deployment Workflow

### Community 59 - "React Application Entry"
Cohesion: 0.67
Nodes (3): Main JSX Module Entry, React Root Mount, Scouts Group HTML Shell

### Community 65 - "React DOM Dependency"
Cohesion: 0.14
Nodes (30): linkFinanceStorageResource(), blankFormSchema(), closePostedForm(), deleteFormTemplateCascade(), deletePostedFormCascade(), formQuestionTypes, getFormsData(), insertTemplateVersion() (+22 more)

### Community 66 - "scoutYearBackup.ts"
Cohesion: 0.19
Nodes (18): canonicalJson(), collectStorageReferences(), compare(), createBackupManifest(), createCsvExports(), createDeterministicZipEntries(), CsvExport, DeterministicZipEntry (+10 more)

### Community 67 - "TipTap Font Extension"
Cohesion: 0.22
Nodes (10): duplicateDecisions, reviewDecisions, configuredOrigins(), corsHeaders(), jsonResponse(), AuthorizationError, parseUuid(), requireDashboardPermission() (+2 more)

### Community 69 - "TipTap Link Extension"
Cohesion: 0.07
Nodes (51): addChief(), addRegisteredScout(), confirmRegistrationSheetImport(), createScoutingYear(), deleteAlbum(), deleteBlog(), deleteCalendarEvent(), destroyFaq() (+43 more)

### Community 70 - "TipTap Text Styles"
Cohesion: 0.22
Nodes (16): completeDashboardEntityNotifications(), deleteDashboardNotification(), getBootstrap(), readAllDashboardNotifications(), readDashboardNotification(), createSupabaseCalendarEvent(), getCalendarEvents(), deleteNotification() (+8 more)

### Community 73 - "TipTap Starter Kit"
Cohesion: 0.11
Nodes (18): Archive contents, Authorization, Backup receipt, Deleted operational data, Deployment, Error Handling, Objective, Parsing source (+10 more)

### Community 87 - "InteractiveIcon.jsx"
Cohesion: 0.15
Nodes (12): animatedIcons, ChevronDownIcon, ChevronDownIconHandle, ChevronDownIconProps, DEFAULT_TRANSITION, ARROW_VARIANTS, ExternalLinkIcon, ExternalLinkIconHandle (+4 more)

### Community 88 - "utils.ts"
Cohesion: 0.18
Nodes (10): FILE_TEXT, FileTextIconHandle, FileTextIconProps, PlusIcon, PlusIconHandle, PlusIconProps, SearchIcon, SearchIconHandle (+2 more)

### Community 89 - "Form Response Email Design"
Cohesion: 0.17
Nodes (11): Builder Experience, Data Model, Delivery Infrastructure, Deployment, Email Content, Error Handling, Form Response Email Design, Goal (+3 more)

### Community 90 - "Scout Registration System Implementation Plan"
Cohesion: 0.20
Nodes (9): Architecture, Deployment prerequisites, Phase 1: Domain and security foundation, Phase 2: Forms extension, Phase 3: Public registration, Phase 4: Dashboard operations, Phase 5: Compatibility and operations, Scout Registration System Implementation Plan (+1 more)

### Community 91 - "CalendarPage.jsx"
Cohesion: 0.20
Nodes (17): CalendarPage(), dateFormatter, formatDateKey(), formatEventDate(), formatEventRange(), formatEventTime(), getAvailableYears(), getEventColor() (+9 more)

### Community 92 - "ChiefsPortalPage.jsx"
Cohesion: 0.26
Nodes (16): applyAuthorProfile(), createPost(), createUniqueSlug(), enrichPostsWithAuthors(), getPosts(), getPublicPostBySlug(), insertPostRow(), isMissingPostMetadataColumns() (+8 more)

### Community 93 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Premium UI Refinement Implementation Plan, Task 1: Consolidate The Shared Dashboard Shell, Task 2: Normalize Public Layout And Navigation, Task 3: Refine Public Page Hierarchy, Task 4: Refine Dashboard Workflow Surfaces, Task 5: Final Cross-Route Verification

### Community 94 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Form Response Email Implementation Plan, Global Constraints, Task 1: Form model and validation, Task 2: Delivery formatter and database log, Task 3: Dashboard final-submission delivery, Task 4: Public registration delivery, Task 5: Full verification and deployment notes

### Community 95 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Form Question Display Implementation Plan, Global Constraints, Task 1: Normalize the display setting, Task 2: Add the builder control and renderer behavior, Task 3: Polish unboxed questions, Task 4: Verify

### Community 96 - "Form Question Display Design"
Cohesion: 0.29
Nodes (6): Behavior, Form Question Display Design, Goal, Rendering, Testing, Unboxed Questions

### Community 97 - "instagram.tsx"
Cohesion: 0.29
Nodes (6): InstagramIcon, InstagramIconHandle, InstagramIconProps, LINE_VARIANTS, PATH_VARIANTS, RECT_VARIANTS

### Community 98 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Lucide Animated Interactive Icons Implementation Plan, Task 1: Shared animated-icon foundation, Task 2: Shared public and dashboard controls, Task 3: Verification

### Community 99 - "arrow-left.tsx"
Cohesion: 0.33
Nodes (5): ArrowLeftIcon, ArrowLeftIconHandle, ArrowLeftIconProps, PATH_VARIANTS, SECOND_PATH_VARIANTS

### Community 100 - "arrow-right.tsx"
Cohesion: 0.33
Nodes (5): ArrowRightIcon, ArrowRightIconHandle, ArrowRightIconProps, PATH_VARIANTS, SECONDARY_PATH_VARIANTS

### Community 101 - "calendar-days.tsx"
Cohesion: 0.33
Nodes (5): CalendarDaysIcon, CalendarDaysIconHandle, CalendarDaysIconProps, DOTS, VARIANTS

### Community 102 - "home.tsx"
Cohesion: 0.33
Nodes (5): DEFAULT_TRANSITION, HomeIcon, HomeIconHandle, HomeIconProps, PATH_VARIANTS

### Community 103 - "map-pin.tsx"
Cohesion: 0.33
Nodes (5): CIRCLE_VARIANTS, MapPinIcon, MapPinIconHandle, MapPinIconProps, SVG_VARIANTS

### Community 104 - "moon.tsx"
Cohesion: 0.33
Nodes (5): MoonIcon, MoonIconHandle, MoonIconProps, SVG_TRANSITION, SVG_VARIANTS

### Community 105 - "panel-left-close.tsx"
Cohesion: 0.33
Nodes (5): DEFAULT_TRANSITION, PanelLeftCloseIcon, PanelLeftCloseIconHandle, PanelLeftCloseIconProps, PATH_VARIANTS

### Community 106 - "panel-left-open.tsx"
Cohesion: 0.33
Nodes (5): DEFAULT_TRANSITION, PanelLeftOpenIcon, PanelLeftOpenIconHandle, PanelLeftOpenIconProps, PATH_VARIANTS

### Community 107 - "RegistrationCampaigns.jsx"
Cohesion: 0.60
Nodes (5): copyLink(), downloadQr(), publicRegistrationUrl(), RegistrationCampaigns(), setRegistrationCampaignStatus()

### Community 108 - "scoutYearBackupDeletion.test.js"
Cohesion: 0.17
Nodes (14): body(), deletionHarness(), deletionUrl, edgeHarness(), fixtureSnapshot(), functionUrl, helpers(), helperUrl (+6 more)

### Community 109 - "bell.tsx"
Cohesion: 0.40
Nodes (4): BellIcon, BellIconHandle, BellIconProps, SVG_VARIANTS

### Community 110 - "menu.tsx"
Cohesion: 0.40
Nodes (4): LINE_VARIANTS, MenuIcon, MenuIconHandle, MenuIconProps

### Community 111 - "sun.tsx"
Cohesion: 0.40
Nodes (4): PATH_VARIANTS, SunIcon, SunIconHandle, SunIconProps

### Community 112 - "upload.tsx"
Cohesion: 0.40
Nodes (4): ARROW_VARIANTS, UploadIcon, UploadIconHandle, UploadIconProps

### Community 113 - "users.tsx"
Cohesion: 0.40
Nodes (4): PATH_VARIANTS, UsersIcon, UsersIconHandle, UsersIconProps

### Community 114 - "x.tsx"
Cohesion: 0.40
Nodes (4): PATH_VARIANTS, XIcon, XIconHandle, XIconProps

### Community 115 - "settings.tsx"
Cohesion: 0.29
Nodes (10): sendContactMessage(), FadeInSection(), activityCards, formatEventDate(), formatEventTime(), getUpcomingEvents(), HomePage(), isApproved() (+2 more)

### Community 121 - "financeService.js"
Cohesion: 0.30
Nodes (13): createFinanceTransaction(), getFinanceLeafData(), getFinanceLedgerAccounts(), getFinanceOverview(), getFinanceSectionData(), getFinanceTransactionLines(), manageFinanceRecord(), postFinanceTransaction() (+5 more)

### Community 122 - "scout-registration/index.ts"
Cohesion: 0.15
Nodes (5): ALLOWED_MIME_TYPES, cleanPhone(), detectDuplicates(), encoder, normalizeName()

### Community 128 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Global Constraints, Registration Import and Scouting-Year Backup Deletion Implementation Plan, Task 1: Repair hosted registration parsing, Task 2: Split parsing from confirmed import, Task 3: Add protected backup receipts and transactional year deletion, Task 4: Build the complete year backup Edge Function, Task 5: Add the deletion coordinator Edge Function and frontend service, Task 6: Add backup and delete controls to the dashboard (+1 more)

### Community 129 - "myWorkModel.js"
Cohesion: 0.35
Nodes (12): requestProfileChange(), normalizeProfile(), createDashboardUser(), createProfile(), getAssignedGroupIds(), getPrimaryGroupId(), getProfiles(), isMissingProfileColumns() (+4 more)

### Community 130 - "Layout.jsx"
Cohesion: 0.20
Nodes (10): useAuth(), ProtectedRoute(), BrandedLoader(), InteractiveIcon(), Layout(), navItems, isDashboardPath(), LoginPage() (+2 more)

### Community 131 - "inventoryService.js"
Cohesion: 0.28
Nodes (10): getStorageLeafData(), getStorageOverview(), getStorageSectionData(), recordStorageMovement(), getStoragePermissionKeys(), getVisibleStorageNavigation(), normalizeStorageOverview(), STORAGE_NAVIGATION (+2 more)

### Community 132 - "ChiefContentDashboardPage.jsx"
Cohesion: 0.24
Nodes (6): addAlbumPhotos(), createAlbum(), createBlog(), ChiefContentDashboardPage(), wizardSteps, ACCEPTED_IMAGE_INPUT

### Community 133 - "external-link.tsx"
Cohesion: 0.19
Nodes (14): deletePhotos(), updateAlbum(), icons, inferToastVariant(), ToastContext, ToastProvider(), useToast(), AlbumDetailPage() (+6 more)

### Community 135 - "AuthProvider.jsx"
Cohesion: 0.42
Nodes (9): AuthContext, AuthProvider(), logAuthStep(), authUserToProfile(), getCurrentAuthUser(), signInWithPassword(), signOut(), clearSupabaseSession() (+1 more)

### Community 136 - "registrationImageService.js"
Cohesion: 0.33
Nodes (9): browserImageFile(), canvasBlob(), decodeRegistrationImage(), detectFileKind(), loadImageElement(), pdfSignature, processRegistrationFile(), startsWith() (+1 more)

### Community 137 - "delete-scout-year/index.ts"
Cohesion: 0.29
Nodes (8): isObject(), JsonObject, reject(), rpcFailures, validatedCleanupInventory(), validateManifest(), AuthorizedContext, BackupSnapshot

### Community 138 - "parse-registration-upload/index.ts"
Cohesion: 0.33
Nodes (8): aliases, clean(), columnIndex(), genderFrom(), groupFor(), normalizedHeader(), numberFrom(), Rule

### Community 139 - "mapDashboardActivityLog"
Cohesion: 0.40
Nodes (6): auditChangedFields(), auditMetaValue(), auditTitleFromMeta(), formatAuditDetails(), formatDubaiDateTime(), mapDashboardActivityLog()

### Community 140 - "settings.tsx"
Cohesion: 0.50
Nodes (3): SettingsIcon, SettingsIconHandle, SettingsIconProps

## Knowledge Gaps
- **419 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+414 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Frontend Dependencies` to `React Core Dependency`, `package.json`, `TipTap Highlight Extension`, `TipTap Underline Extension`, `TipTap ProseMirror Core`, `@tiptap/extension-link`, `@tiptap/extension-text-style`, `@tiptap/starter-kit`, `@vitejs/plugin-react`, `@dnd-kit/utilities`, `heic2any`, `libphonenumber-js`, `motion`, `react-router-dom`, `vite`, `DOMPurify Dependency`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `sanitizeRichHtml()` connect `Rich Text Rendering` to `DOMPurify Dependency`, `Dashboard Audit Utilities`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `dompurify` connect `DOMPurify Dependency` to `Frontend Dependencies`, `Rich Text Rendering`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AdminDashboardPage()` (e.g. with `query()` and `isRecentOrPendingApproval()`) actually correct?**
  _`AdminDashboardPage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _419 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Forms Builder System` be split into smaller, more focused modules?**
  _Cohesion score 0.07595628415300547 - nodes in this community are weakly interconnected._
- **Should `Workspace Access Control` be split into smaller, more focused modules?**
  _Cohesion score 0.0662004662004662 - nodes in this community are weakly interconnected._