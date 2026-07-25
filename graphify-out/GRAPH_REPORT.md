# Graph Report - C:\Users\dania\OneDrive\Desktop\Scouts\Web_App\Website  (2026-07-23)

## Corpus Check
- 240 files · ~216,739 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1360 nodes · 3612 edges · 87 communities (64 shown, 23 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.71)
- Token cost: 64,094 input · 21,297 output

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
- Website Content Editor
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
- TipTap Color Extension
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

## God Nodes (most connected - your core abstractions)
1. `AdminDashboardPage()` - 92 edges
2. `getSupabaseRows()` - 71 edges
3. `getCurrentSupabaseUserId()` - 63 edges
4. `patchSupabaseRows()` - 56 edges
5. `insertSupabaseRow()` - 49 edges
6. `useAuth()` - 31 edges
7. `callSupabaseRpc()` - 31 edges
8. `deleteSupabaseRows()` - 31 edges
9. `uploadSupabaseFile()` - 28 edges
10. `optimizeImageForUpload()` - 27 edges

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

## Communities (87 total, 23 thin omitted)

### Community 0 - "Content Admin Workflows"
Cohesion: 0.06
Nodes (71): activateScoutingYear(), addAlbumPhotos(), addChief(), addEquipe(), addFaq(), addLeader(), addRegisteredScout(), assignEquipeScouts() (+63 more)

### Community 1 - "Forms Builder System"
Cohesion: 0.07
Nodes (63): closeDashboardPostedForm(), deleteDashboardFormTemplate(), deleteDashboardPostedForm(), reopenDashboardPostedForm(), saveDashboardFormTemplate(), saveDashboardPostedForm(), saveDashboardReimbursementDraft(), submitDashboardReimbursement() (+55 more)

### Community 2 - "Authentication and MFA"
Cohesion: 0.07
Nodes (52): AboutPage, AcceptInvitationPage, AdminChiefAttendancePage, AdminDashboardPage, AlbumDetailPage, App(), AttendancePage, BlogDetailPage (+44 more)

### Community 3 - "Workspace Access Control"
Cohesion: 0.07
Nodes (48): ACCOUNT_STATUSES, PERMISSIONS, ROLE_KEYS, SCOPE_TYPES, TEAM_KEYS, APPROVED_SCOPE_TYPES, compareLegacyAndNormalized(), getAccessibleGroupIds() (+40 more)

### Community 4 - "Local API Server"
Cohesion: 0.09
Nodes (63): addAlbumPhotos(), addRegisteredScout(), columnIndexFromCellRef(), countPattern(), createAlbum(), createBlog(), createChief(), createEvent() (+55 more)

### Community 5 - "Calendar Management"
Cohesion: 0.07
Nodes (54): deleteCalendarEvent(), CalendarManagement(), canSeeEvent(), formatDateKey(), formatEventDateRange(), formatEventTime(), fullDateFormatter, getEventsForDay() (+46 more)

### Community 6 - "Dashboard Attendance Bootstrap"
Cohesion: 0.06
Nodes (44): collectionKeys, normalizeBootstrapData(), objectOrEmpty(), createCalendarEvent(), deleteAttendanceSession(), loadingData, saveChiefAttendance(), saveScoutAttendance() (+36 more)

### Community 7 - "Dashboard Audit Utilities"
Cohesion: 0.05
Nodes (35): arrayBufferToBase64(), auditChangedFields(), auditMetaValue(), auditTitleFromMeta(), chiefDefaults(), contentStatuses, dashboardSectionSearchPlaceholders, downloadCsvFile() (+27 more)

### Community 8 - "Supabase Data Operations"
Cohesion: 0.15
Nodes (38): updatePhoto(), updatePhotoBatch(), deleteSupabaseAttendanceSession(), saveSupabaseChiefAttendance(), saveSupabaseScoutAttendance(), updateSupabaseAttendanceSessionDate(), updateSupabaseAttendanceSessionLabel(), logAuditEvent() (+30 more)

### Community 9 - "Public Data Services"
Cohesion: 0.12
Nodes (32): createScoutingYear(), getBootstrap(), getPublicAlbumPage(), getAttendanceData(), deleteSupabaseCalendarEvent(), getCalendarEvents(), getPublicCalendarEvents(), getEquipeData() (+24 more)

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
Cohesion: 0.15
Nodes (21): TransactionTable(), getStorageLeafData(), getStorageOverview(), getStorageSectionData(), manageStorageRecord(), recordStorageMovement(), getStoragePermissionKeys(), getVisibleStorageNavigation() (+13 more)

### Community 14 - "Site Content Storage"
Cohesion: 0.20
Nodes (23): saveWebsiteContent(), prepareEventImage(), createGalleryPhotos(), prepareAlbumData(), optimizedImagePath(), optimizeImageForUpload(), createLeader(), deleteLeader() (+15 more)

### Community 15 - "Finance Workspace Core"
Cohesion: 0.17
Nodes (15): FINANCE_NAVIGATION, FINANCE_SECTION_TABS, formatFinanceAmount(), getFinancePermissionKeys(), getVisibleFinanceNavigation(), normalizeFinanceOverview(), financeFields, FinanceWorkspace() (+7 more)

### Community 16 - "Scouting Workspace Integration"
Cohesion: 0.16
Nodes (17): aed, ScoutingBudgetSummary(), dateLabel(), emptyRequest, itemNames(), ScoutingStoragePanel(), tabs, linkFinanceStorageResource() (+9 more)

### Community 17 - "User Profile Management"
Cohesion: 0.21
Nodes (18): removeDashboardUser(), resetUserPassword(), requestPrivateDownload(), requestPrivateUpload(), invokeSupabaseFunction(), normalizeProfile(), adminResetUserPassword(), createDashboardUser() (+10 more)

### Community 18 - "Rich Text Rendering"
Cohesion: 0.20
Nodes (19): FormattedText(), isSafeHref(), renderInline(), allowedAttributes, allowedCssProperties, allowedTags, cleanStyle(), escapeHtml() (+11 more)

### Community 19 - "Image Crop Processing"
Cohesion: 0.19
Nodes (17): AvatarCropModal(), clamp(), coverGeometry(), cropToFile(), loadImage(), readFileAsDataUrl(), canvasToWebp(), convertHeicToJpeg() (+9 more)

### Community 20 - "Finance Workflow Modules"
Cohesion: 0.16
Nodes (6): createFinanceWorkflowRecord(), transitionFinanceWorkflow(), amount(), configs, FinanceWorkflowPanel(), labelFor()

### Community 21 - "Storage Workflow Modules"
Cohesion: 0.16
Nodes (4): createStorageWorkflowRecord(), configs, StorageWorkflowPanel(), titleFor()

### Community 22 - "Albums and Rich Editing"
Cohesion: 0.17
Nodes (14): deletePhotos(), colorOptions, fontOptions, FontSize, fontSizes, highlightOptions, RichTextEditor(), AlbumDetailPage() (+6 more)

### Community 23 - "Public Content Fallbacks"
Cohesion: 0.18
Nodes (9): approved(), fallbackWebsiteData(), getPublicGalleryPage(), getPublicHomeData(), plannedEvents, registeredScouts, demoUsers, getPublicGalleryAlbums() (+1 more)

### Community 24 - "Error Recovery System"
Cohesion: 0.22
Nodes (11): ErrorBoundary, readReloadAttempts(), reloadWithRecoveryLimit(), SiteRecoveryPrompt(), writeReloadAttempts(), getErrorSignature(), limitText(), logSiteError() (+3 more)

### Community 25 - "Blog Content Services"
Cohesion: 0.25
Nodes (17): applyAuthorProfile(), createPost(), createUniqueSlug(), enrichPostsWithAuthors(), getPosts(), getPublicPostBySlug(), getPublicPosts(), insertPostRow() (+9 more)

### Community 26 - "Frontend Dependencies"
Cohesion: 0.12
Nodes (17): heic2any, lucide-react, dependencies, heic2any, lucide-react, react-router-dom, @tiptap/extension-placeholder, @tiptap/extension-text-align (+9 more)

### Community 27 - "Settings and Archives"
Cohesion: 0.22
Nodes (16): loadDashboardReports(), allowedDocumentExtensions, createArchivedYearSnapshot(), deleteArchivedYearSnapshot(), extensionFromFileName(), getDocumentsWorkspaceData(), getReportsWorkspaceData(), normalizeArchivedYear() (+8 more)

### Community 28 - "Public Data Caching"
Cohesion: 0.24
Nodes (16): delay(), getCachedEntry(), getFreshCachedData(), getStaleCachedData(), loadPublicData(), loadWithRetry(), makeCacheKey(), publicDataCache (+8 more)

### Community 29 - "Blog Detail Experience"
Cohesion: 0.21
Nodes (11): updateBlog(), getPublicBlogDetailPage(), icons, inferToastVariant(), ToastContext, ToastProvider(), useToast(), BlogDetailPage() (+3 more)

### Community 30 - "Finance Ledger Services"
Cohesion: 0.30
Nodes (13): createFinanceTransaction(), getFinanceLeafData(), getFinanceLedgerAccounts(), getFinanceOverview(), getFinanceSectionData(), getFinanceTransactionLines(), manageFinanceRecord(), postFinanceTransaction() (+5 more)

### Community 31 - "Legacy Permission Helpers"
Cohesion: 0.37
Nodes (14): canOpenSection(), hasChiefAccess(), isSectionAllowed(), canEditScouts(), canManageFormTemplates(), canManageSystem(), canPostForms(), canPublishContent() (+6 more)

### Community 32 - "Edge Function Authorization"
Cohesion: 0.34
Nodes (9): configuredOrigins(), corsHeaders(), jsonResponse(), AuthorizationError, AuthorizedContext, parseUuid(), requireDashboardPermission(), requireSystemAdministrator() (+1 more)

### Community 33 - "Project Tooling"
Cohesion: 0.14
Nodes (13): eslint, devDependencies, eslint, @playwright/test, prettier, supabase, name, private (+5 more)

### Community 34 - "Notifications and Submissions"
Cohesion: 0.23
Nodes (13): completeDashboardEntityNotifications(), deleteDashboardNotification(), readAllDashboardNotifications(), readDashboardNotification(), saveDashboardFormSubmission(), saveFormSubmission(), deleteNotification(), getNotifications() (+5 more)

### Community 35 - "About Page Content"
Cohesion: 0.24
Nodes (13): getPublicAboutData(), scoutGroups, AboutPage(), goals, groupRange(), initials(), parseHistoryMilestones(), parseManagedList() (+5 more)

### Community 36 - "Website Content Editor"
Cohesion: 0.20
Nodes (10): aboutSections, getSiteImageCropConfig(), homeSections, ImageField(), imageUrlToFile(), makeId(), move(), parseList() (+2 more)

### Community 37 - "Authorization Architecture"
Cohesion: 0.19
Nodes (13): Access Control Foundation, Deny Precedence and Fail-Closed Resolution, Normalized Scoped Authorization, Shadow-Mode Authorization Authority, Access Control Foundation Implementation Plan, Authorization Compatibility Comparison Report, Effective Access Resolver, Idempotent Legacy Authorization Backfill (+5 more)

### Community 38 - "Public Desktop Navigation"
Cohesion: 0.17
Nodes (12): About Us, Blogs / News, Faith, Service, Leadership, Calendar, Empty Main Content Area, Gallery, Home, Log In (+4 more)

### Community 39 - "Homepage Public Content"
Cohesion: 0.29
Nodes (10): sendContactMessage(), FadeInSection(), activityCards, formatEventDate(), formatEventTime(), getUpcomingEvents(), HomePage(), isApproved() (+2 more)

### Community 40 - "Development Scripts"
Cohesion: 0.18
Nodes (11): scripts, api, build, db:reset, db:tables, dev, dev:full, preview (+3 more)

### Community 41 - "Public Listing Pages"
Cohesion: 0.31
Nodes (8): getPublicBlogsPage(), SafeImage(), withRetryParam(), BlogsPage(), formatPostCategory(), getPostCategory(), getPostDate(), GalleryPage()

### Community 42 - "Shared UI Components"
Cohesion: 0.29
Nodes (7): BlogPostPreview(), formatPostCategory(), formatPostDate(), getInitials(), UserAvatar(), FocusedWorkspaceShell(), WorkspaceSwitcher()

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
Cohesion: 0.25
Nodes (9): canAccessGroup(), canManageEquipesForGroup(), canSeeDashboardEvent(), getAssignableGroupIds(), getCoordinatorGroupIds(), getPrimaryRole(), getProfileAssignedGroupIds(), getUserRoles() (+1 more)

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

## Knowledge Gaps
- **206 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sanitizeRichHtml()` connect `Rich Text Rendering` to `Albums and Rich Editing`, `DOMPurify Dependency`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Dependencies` to `React Core Dependency`, `Project Tooling`, `TipTap Color Extension`, `React DOM Dependency`, `TipTap Font Extension`, `TipTap Highlight Extension`, `TipTap Link Extension`, `TipTap Text Styles`, `TipTap Underline Extension`, `TipTap ProseMirror Core`, `TipTap Starter Kit`, `DOMPurify Dependency`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dompurify` connect `DOMPurify Dependency` to `Frontend Dependencies`, `Rich Text Rendering`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `AdminDashboardPage()` (e.g. with `query()` and `isRecentOrPendingApproval()`) actually correct?**
  _`AdminDashboardPage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _206 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Content Admin Workflows` be split into smaller, more focused modules?**
  _Cohesion score 0.06050228310502283 - nodes in this community are weakly interconnected._
- **Should `Forms Builder System` be split into smaller, more focused modules?**
  _Cohesion score 0.07243195785776997 - nodes in this community are weakly interconnected._