# Premium UI Refinement Design

## Purpose

Refine the St. Mary's Scouts Dubai public website and authenticated workspaces into one polished, responsive product without changing routes, permissions, Supabase behavior, form submissions, attendance logic, or existing features.

The refinement preserves the current white, deep-blue, and restrained gold identity. It improves hierarchy, spacing, typography, component consistency, motion, responsive behavior, loading feedback, and accessibility.

## Scope

### Public website

- Shared public header and mobile menu
- Shared footer
- Home
- About
- Calendar
- Blogs and news listing
- Blog detail
- Gallery
- Album detail
- Login and invitation/authentication presentation
- Shared loading, empty, error, and recovery states

### Authenticated application

- Shared dashboard topbar
- Shared expanded and collapsed sidebar
- Shared mobile bottom navigation and overflow menu
- Workspace switcher
- Overview surfaces
- Tables, filters, tabs, forms, modals, drawers, popovers, badges, alerts, empty states, and loading states
- Scouting, Admin, Forms, Finance, Storage, People and Access, Settings, approval, attendance, content, and reporting surfaces

## Out Of Scope

- Authentication behavior
- Authorization and permission rules
- Supabase schema, functions, RLS, storage, or database behavior
- Route names or route ownership
- Form submission, draft, approval, attendance, notification, Finance, or Storage workflow behavior
- Replacing real content with placeholders
- Adding a heavy UI or animation library
- Rewriting the application or major feature modules

## Design Direction

The product should feel like a serious, modern scout and church organization: trustworthy, capable, welcoming, and operationally clear.

- White and neutral surfaces carry most public content.
- Deep blue provides identity and hierarchy.
- Gold is reserved for meaningful emphasis, selected dates, milestones, and small status accents.
- Photography remains the main emotional material on public pages.
- Dashboard surfaces are quieter and denser than public pages.
- Dark mode is a darker translation of the same hierarchy, not a separate visual language.
- Glass effects are limited to floating navigation surfaces where translucency communicates layering. Content cards do not become decorative glass panels.

## Visual Foundations

### Typography

- Preserve the existing brand-compatible font stack unless a locally available project font is already established.
- Use one shared application type scale.
- Public display headings remain expressive but are reduced on narrow screens.
- Dashboard titles are compact and work-focused.
- Body copy uses comfortable line height and a maximum readable width.
- Metadata, labels, and helper text retain sufficient contrast in both themes.

### Spacing

- Use a consistent 4px-based spacing scale.
- Public sections use generous vertical rhythm.
- Dashboard sections use tighter operational spacing.
- Mobile spacing is reduced without shrinking touch targets.
- Repeated components use the same internal padding across workspaces.

### Shape And Depth

- Dashboard controls: approximately 8-10px radius.
- Dashboard panels: approximately 10-14px radius.
- Public cards: approximately 12-16px radius.
- Pills are reserved for tags, statuses, and segmented selections.
- Avoid combining broad shadows with visible borders on the same component.
- Use elevation only where it explains layering: navigation, menus, dialogs, and floating actions.

### Color

- Consolidate repeated colors into semantic tokens for page, surface, elevated surface, text, muted text, line, primary, primary-hover, gold accent, success, warning, danger, and focus.
- Meet WCAG AA contrast for body copy and controls.
- Interactive state must not rely on color alone.
- Dark mode controls must remain readable without hard white borders or random panel shades.

## Shared Dashboard Shell

The dashboard shell is the first implementation phase and the visual source of truth for every authenticated workspace.

### Topbar

- Use one shared topbar component and shared styles across Scouting, Admin, Finance, Storage, Forms, and other workspaces.
- Keep the workspace title, logo/wordmark, theme control, notifications, profile menu, and workspace switcher aligned on one stable row.
- Do not show the public website header inside authenticated workspaces.
- Desktop topbar is fixed or sticky according to the existing shell behavior and spans the available workspace width without collisions.
- Use restrained translucency and backdrop blur only when content scrolls beneath the topbar.
- Buttons are transparent by default, gain a subtle state layer on hover/focus, and retain clear active states.
- Popovers close on outside click and Escape, stay inside the viewport, and use a shared elevation and motion pattern.
- Mobile topbar prioritizes logo, current title, and essential actions without overflow.

### Sidebar

- Use one navigation renderer and one style system for all workspaces; only navigation content and current workspace identity change.
- Keep the sidebar fixed within the authenticated shell and independent from page scrolling.
- Expanded mode shows icons, labels, group headings, and child items with consistent density.
- Collapsed mode shows the same primary icons with tooltips. Grouped items open a viewport-aware flyout beside the triggering icon.
- Flyouts align with their trigger, remain above the viewport bottom, and scroll internally only when necessary.
- Selected, hover, focus, and pressed states are distinct. Noninteractive containers never gain hover styling.
- Expanded sidebar scrolls internally when content exceeds its available height.
- Collapsed sidebar distributes icons predictably without an unnecessary scrollbar.
- The shell reserves the sidebar width so content never sits beneath it.

### Mobile Navigation

- Use one safe-area-aware floating bottom navigation across authenticated workspaces.
- Show no more than five primary actions; additional permitted destinations live in a structured More sheet.
- Navigation is icon-first with accessible labels available to assistive technology.
- The active indicator moves as one shared object between tabs.
- On downward scrolling, the bar subtly reduces height, spacing, and icon scale after a movement threshold.
- On upward scrolling, it restores its normal size immediately and smoothly.
- More-sheet parent and child navigation remains open until a destination is selected or the user dismisses it.
- The bar stays below modals and full-screen forms and never covers destructive or submission actions.
- Keyboard appearance and mobile safe areas must not push the navigation over active form controls.

### Shell Responsiveness

- Desktop, tablet, and mobile use the same component hierarchy.
- Layout changes through responsive CSS and state, not duplicate desktop/mobile components unless an existing platform-specific control requires it.
- Shared breakpoints and dimensions prevent workspace-specific drift.

## Public Website Refinement

### Header

- Keep the current brand mark, public navigation, active state, and login action.
- Improve spacing, alignment, focus states, and mobile menu hierarchy.
- On the home hero, the header may use a transparent or dark-overlay treatment when contrast is guaranteed.
- Inner pages use a stable light surface.
- Mobile menu is one column, viewport-safe, and closes on route selection, outside click, and Escape.

### Home

- Preserve the real hero photograph and core message.
- Reduce hero height and heading size on mobile so users can see the next content cue.
- Keep one clear primary action and quieter secondary actions.
- Improve content rhythm, image treatment, events, news, and gallery previews.
- Clamp variable-length card content to stable dimensions.

### Inner Pages

- Introduce a consistent page-introduction pattern with balanced title, supporting copy, and optional controls.
- Avoid oversized empty areas and oversized headings in operational views such as Calendar.
- Keep filters close to the content they affect.
- Empty states are compact, informative, and visually consistent.
- Blog and gallery cards reserve media dimensions and use hover motion only because the cards are clickable.
- Detail pages use a readable content width while allowing intentional media breakout.
- Calendar controls remain touch-friendly and avoid horizontal overflow.

### Login

- Keep the authentication implementation unchanged.
- Improve form hierarchy, field states, password affordances, loading feedback, and responsive sizing.
- Present the login surface as part of the same brand without using the dashboard shell.

## Dashboard And Workflow Refinement

### Overview

- Preserve real metrics and actions.
- Use a clear summary band and compact work queues.
- Avoid identical decorative card grids.
- Only actionable panels receive hover treatment.
- Skeletons reserve final dimensions to prevent layout shift.

### Tables And Lists

- Standardize headers, density, row actions, selection, filters, pagination, empty states, and mobile handling.
- Desktop tables favor scanability.
- Mobile uses horizontal scrolling only where comparison matters; otherwise records transform into structured rows/cards.
- Noninteractive rows do not lift or change background on hover.

### Forms

- Standardize labels, helper text, required markers, validation, focus, disabled, loading, and success states.
- Preserve TipTap, form-builder, draft, review, and submission behavior.
- Builder panels stack clearly on narrow screens.
- Full-screen form completion retains safe back navigation and stable bottom actions.

### Tabs And Segmented Controls

- Use one shared tab pattern with a moving active indicator where practical.
- Tabs scroll horizontally on narrow screens without wrapping.
- State remains obvious in both light and dark mode.

### Modals, Drawers, And Popovers

- Use a semantic z-index scale.
- Dialogs enter with a short opacity and scale transition.
- Drawers preserve spatial direction.
- Popovers align with their trigger and remain viewport-aware.
- Backdrops prevent accidental interaction without becoming visually heavy.
- Focus management, Escape dismissal, outside-click behavior, and scroll locking remain correct.

### Status And Feedback

- Consolidate status badges and alert styles.
- Success confirmations fade after the established timeout.
- Errors remain until acknowledged or resolved.
- Async buttons disable duplicate submission and communicate progress.

## Motion System

Motion explains state and hierarchy rather than decorating every surface.

- Press feedback: 80-120ms.
- Hover/focus transitions: 140-180ms.
- Icon and tab changes: 180-220ms.
- Popovers, drawers, and modals: 220-280ms.
- Shell expansion and mobile-nav resizing: 250-320ms.
- Use ease-out-quart or similar restrained curves.
- Prefer transform and opacity; avoid animating layout dimensions where possible.
- Interactive cards may translate up by no more than 2px.
- Page content may use a subtle initial fade/translate, but content is visible by default.
- Repeated list entrance staggering is limited and stops after the first small group.
- `prefers-reduced-motion` removes spatial travel and keeps immediate or crossfade state changes.

## Responsive Requirements

- Validate 375px, 390px, tablet, 1366px, and 1440px widths.
- No page-level horizontal overflow.
- Minimum interactive target is 44x44px.
- Long names, emails, titles, and localized content wrap or truncate deliberately.
- Inputs remain visible above mobile keyboards.
- Fixed navigation respects `env(safe-area-inset-*)`.
- Modals and full-screen workflows expose all actions without being covered by navigation.

## Implementation Architecture

### Shared styling

- Treat the existing workspace shell component and shell stylesheet as the authenticated application foundation.
- Consolidate shared workspace topbar, sidebar, mobile navigation, popover, button, field, table, panel, tab, and motion rules into shared workspace styles.
- Finance, Storage, Forms, and feature styles contain only feature-specific presentation.
- Public page styles continue using the public design system in `src/styles.css`, but affected selectors are consolidated rather than overridden repeatedly.
- Search for duplicate base selectors before editing and remove obsolete affected definitions when their ownership is clear.

### Components

- Reuse existing components and Lucide icons.
- Extract a shared component only when at least two active surfaces need identical behavior and the extraction reduces conflicting styles.
- Do not create parallel mobile and desktop feature implementations.
- Do not add a new UI or animation dependency.

### Data And Behavior

- Styling and presentation consume existing props, services, hooks, permissions, and route state.
- No visual component may bypass a permission check.
- No redesign changes data-fetch timing, mutation behavior, or source-of-truth rules.

## Implementation Phases

### Phase 1: Foundations and shared shell

- Semantic tokens and type scale
- Shared control, panel, table, tab, modal, and feedback primitives
- Dashboard topbar
- Dashboard sidebar and collapsed flyouts
- Dashboard mobile navigation and More sheet
- Public header and footer
- Reduced-motion baseline

### Phase 2: Public pages

- Home
- About
- Calendar
- Blogs and detail
- Gallery and album detail
- Login and auth presentation
- Public loading, empty, and error states

### Phase 3: Dashboard workflows

- Overview and notifications
- Forms
- Attendance and group management
- Content, gallery, calendar, approvals, and contact messages
- People and Access and Settings
- Finance and Storage feature surfaces

### Phase 4: Hardening and verification

- Responsive edge cases
- Light and dark mode
- Keyboard and focus behavior
- Reduced motion
- Playwright route and interaction checks
- Production build

## Verification

- Run `npm run build`.
- Run existing access-control tests when affected shared components touch permission-aware rendering.
- Run the existing dark-mode Playwright audit.
- Use Playwright screenshots for public and authenticated surfaces where a reusable session is available.
- Verify desktop and mobile navigation interactions, popover placement, outside-click dismissal, keyboard focus, route stability, and overflow.
- Verify that public routes remain public and dashboard routes retain their existing protection.
- Verify no Supabase, permission, form-submission, attendance, Finance, or Storage behavior changed.

## Success Criteria

- Public and authenticated surfaces clearly belong to the same organization.
- Every authenticated workspace uses the same topbar, sidebar, and mobile navigation system.
- Mobile layouts are deliberate rather than compressed desktop layouts.
- Motion is noticeable through quality, not quantity.
- Interactive and noninteractive surfaces are visually distinguishable.
- Light and dark mode preserve the same hierarchy.
- No existing route, permission, workflow, or feature is removed or altered.
