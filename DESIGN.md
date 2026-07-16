---
name: St. Mary's Scouts
description: Premium responsive design system for the St. Mary's Scouts Dubai public website and private dashboard.
---

# St. Mary's Scouts Dubai Design System

## Purpose

This document defines the desired visual direction for the St. Mary's Scouts Dubai public website and private dashboard. It is intended for future design work, Open Design references, and Codex sessions.

The product has two connected experiences:

- A public website for parents, scouts, visitors, and church/community members.
- A private dashboard for admins, chiefs, coordinators, and permitted users.

The design should feel premium, clean, modern, trustworthy, organized, and expensive-looking. It should not feel childish, generic, cramped, or like a default school website.

Do not edit `open-design/`. It is only a design/reference folder.

## Product Personality

The brand should communicate:

- Trust and responsibility.
- Faith-connected community.
- Youth development and leadership.
- Professional organization.
- Warmth without childish visuals.
- Clear operational confidence in the dashboard.

Use a serious, polished scout organization feel. Avoid cartoonish scouting clipart, loud colors, cluttered layouts, and generic dashboard patterns.

## Color Tokens

Use these tokens as the future design source of truth.

```css
:root {
  --color-white: #ffffff;
  --color-off-white: #f8fafc;
  --color-soft-blue-white: #f4f8ff;
  --color-navy: #0b2a5b;
  --color-scout-blue: #1d4ed8;
  --color-soft-blue: #eaf2ff;
  --color-gold: #f4b400;
  --color-soft-gold: #fff4cc;
  --color-text-main: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;
  --color-border-soft: #e5e7eb;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-error: #dc2626;
  --color-info: #2563eb;
}
```

### Color Usage

- White is the main base color.
- Off-white and soft blue-white are page backgrounds and section bands.
- Navy is for strong headings, premium surfaces, and dark accents.
- Scout blue is the primary action color.
- Gold is an accent only. Use it sparingly for highlights, small badges, active details, or celebratory emphasis.
- Gray text is for metadata and helper text.
- Do not create one-note blue pages; use whitespace, hierarchy, and restrained accents.

### Dark Mode

Dashboard dark mode should be a darker version of the light dashboard, not a separate visual language.

Rules:

- Do not add random dark rectangular backgrounds behind every grid, card, or table row.
- Avoid visible borders around every section.
- Cards may have subtle dark surfaces, but they should not look like stacked blocks.
- Buttons in shell areas should be transparent by default and only show hover/focus/active states when interactive.
- Only clickable elements should visually react on hover.
- Text must remain readable in all sections.

## Typography

The current app uses Inter/system sans-serif. Continue that direction.

Recommended scale:

- Display/Hero: 48-72px desktop, 34-44px mobile.
- Page title: 36-48px desktop, 28-34px mobile.
- Section title: 26-34px desktop, 22-28px mobile.
- Card title: 18-22px.
- Body: 16-18px.
- Helper/meta: 13-15px.
- Buttons: 14-16px, 700 weight.

Rules:

- Use strong hierarchy.
- Keep letter spacing normal.
- Do not use viewport-width-based font sizing.
- Avoid oversized text inside compact dashboard cards.
- Keep reading widths comfortable on blog and content pages.

## Layout And Spacing

Use an 8px spacing rhythm.

Recommended spacing:

- Page horizontal padding: 20px mobile, 32-56px desktop.
- Public section vertical padding: 64-96px desktop, 40-56px mobile.
- Dashboard section gap: 20-28px.
- Card padding: 20-28px desktop, 16-20px mobile.
- Form field gap: 14-18px.

Rules:

- Use full-width bands or clean constrained layouts.
- Avoid nested cards unless the inner card is a true repeated item or modal.
- Leave enough room for mobile touch targets.
- Avoid huge blank gaps caused by fixed headers/sidebars.
- Dashboard pages need a small, consistent breathing gap below the topbar.

## Cards

Cards should feel polished and quiet.

Default card:

- Background: white.
- Border: 1px solid soft border only where useful.
- Radius: 12-18px for public content cards, 10-14px for dashboard cards.
- Shadow: soft and subtle.
- Padding: generous but not wasteful.

Hover:

- Only clickable cards should lift or tint.
- Non-clickable stat cards, grids, tables, and panels should not have hover effects.
- In dark mode, avoid hover effects on non-buttons and non-links.

## Buttons

Button hierarchy:

- Primary: scout blue background, white text.
- Secondary: white or transparent background, scout blue text, soft border.
- Gold accent: use only for special CTA or hover accent.
- Danger: error red for destructive actions.
- Ghost/icon: transparent default, subtle hover fill.

Rules:

- All clickable buttons must have `cursor: pointer`.
- Disabled buttons must look disabled and not clickable.
- Icon buttons should be square/circular with consistent dimensions.
- Mobile touch target should be at least 44px.
- Do not put visible hover effects on non-clickable elements.

## Inputs And Form Fields

Inputs should feel premium, calm, and clear.

Fields:

- White background in light mode.
- Dark readable field surfaces in dark mode.
- Soft border.
- 10-12px radius.
- Clear label above field.
- Helper text below when useful.
- Error text below with clear red color.
- Focus ring in scout blue.

Rules:

- Do not rely on placeholder as the only label.
- Support all languages and long text.
- Textareas should resize or provide comfortable height.
- Multi-select controls should clearly show selected values.
- Rich text areas must preserve formatting accurately.

## Rich Text Editor

The editor is used for posts, calendar events, album descriptions, form descriptions, and website content.

Requirements:

- Toolbar should be professional and compact.
- Support bold, italic, underline, links, lists, alignment, headings, font size where implemented, and pasted formatting where safely supported.
- Editing view must match public rendering as closely as possible.
- Public view must show saved formatting accurately.
- Links must be visible and accessible.
- Pasted text must support multiple languages.

## Form Builder UI

The form builder should feel like a premium Google Forms-style builder.

Builder components:

- Form title and description editor.
- Question cards.
- Question type selector.
- Required toggle.
- Helper text and placeholder fields.
- Option list editor for choice questions.
- Duplicate and delete controls.
- Section/review preview.
- Posting settings and target group controls.
- Save template, save as new template, post, and submit for approval actions.

Rules:

- Never auto-submit when the user expects a review step.
- Review should show exactly what chiefs will see.
- Drafts must be easy to reopen and edit.
- Editing an existing template should save the same template unless the user explicitly chooses "Save as new template".

## Form Filling UI

The user-facing form fill experience should look polished, not plain.

Requirements:

- Clear form title, description, status, and deadline where present.
- Section cards with readable spacing.
- Rich text instructions.
- Clear question numbers that remain readable in both themes.
- Helper text and placeholders.
- Validation messages beside the affected fields.
- Save draft and review-before-submit flows.
- Submission progress feedback.
- Mobile-first layout.

States:

- Open.
- Draft.
- Submitted.
- Closed.
- Pending approval.
- Approved.
- Rejected.

## Tables

Tables are used for attendance, users, reports, submissions, scouts, documents, and settings.

Requirements:

- Clean headers.
- Stable row height.
- Clear columns.
- Soft dividers, not heavy borders.
- Sticky headers where helpful.
- Horizontal scroll on mobile when needed.
- Card transformation on mobile for dense datasets when horizontal scrolling is not ideal.

Avoid:

- Raw browser table styling.
- Hardcoded white cells in dark mode.
- Hover effects on non-clickable rows.
- Low contrast table text.

## Sidebar

The dashboard sidebar should be modern, responsive, and reliable.

Requirements:

- Left side on desktop.
- Collapsible and expandable where implemented.
- Active item must be clear.
- Grouped sections should behave predictably.
- Back to Website must not break when collapsed.
- Logout should sit at the bottom where possible.
- Flyouts in collapsed mode should appear close to their related icon and avoid viewport overflow.
- Sidebar must not scroll with the main page if intended to be fixed/sticky.

Rules:

- Icon spacing should fit the viewport height without overlapping.
- Collapsed view should not show clipped labels.
- Mobile should use a drawer or bottom navigation instead of a cramped sidebar.
- Do not let sidebar overlays cover content except intentional drawers/flyouts.

## Dashboard Header

The dashboard topbar should feel like a premium app shell.

Elements may include:

- Brand/logo.
- Current section title.
- Search.
- Theme toggle.
- Notifications.
- Profile/avatar menu.

Requirements:

- Desktop: logo/title/search/actions should be aligned in one clean row.
- Mobile: logo on the left, actions on the right, no overlap.
- Search may collapse into an icon on mobile.
- Notification/profile popovers should close when clicking away.
- Topbar should not create large gaps or push pages too far down.

## Public Website Header

The public header should be polished and simple.

Requirements:

- Logo and brand name.
- Main navigation.
- Login/dashboard action.
- Mobile hamburger menu as one clean column.
- Slight transparent/blurred background is acceptable.
- No giant close icon on desktop.
- Mobile menu should be full-width or intentional, readable, and touch-friendly.

## Public Home Page

Home should be welcoming and premium.

Sections may include:

- Hero with strong headline, short subtitle, and quality image treatment.
- About preview.
- Upcoming events.
- Latest blogs/news.
- Gallery moments.
- FAQ and contact.

Rules:

- Event cards must have fixed/stable height and not expand from long text.
- Gallery images must fill containers without strange borders or stretching.
- Cards should be clickable only when they navigate.
- Public content must load with proper loading states.

## Blog UI

Blog listing:

- Clean page title.
- Search input.
- Category pills.
- Responsive card grid: 3 desktop, 2 tablet, 1 mobile.
- Thumbnail at top.
- Category badge.
- Title, date, author, excerpt.
- Entire card clickable.

Blog detail:

- Featured image/banner.
- Title and metadata.
- Share icons.
- Centered readable content column.
- Rich text formatting preserved.
- Related posts section where implemented.

Rules:

- Do not hardcode posts.
- Do not break filtering, search, pagination, routing, or sharing.
- Real author name should show when available.

## Gallery And Album UI

Gallery:

- Clean album grid.
- Consistent card sizes.
- Correct thumbnail aspect ratio.
- No odd borders or image stretching.
- Lazy-loaded images with stable dimensions.

Album detail:

- Album title, date, location, category, description.
- Rich text description where implemented.
- Responsive photo grid.
- Image preview/lightbox where present.

Rules:

- Keep image optimization and storage behavior working.
- Avoid loading all photos unnecessarily.

## Calendar UI

Calendar should be readable and mobile-friendly.

Requirements:

- Month and agenda/list views where implemented.
- Clear selected date.
- Event pills/cards with status or visibility cues.
- Event detail modal that fits the viewport.
- Click outside modal closes it where implemented.
- Add to Calendar options should remain clear.
- Past events should remain visible if current product behavior requires it.

Dashboard event builder:

- Multi-step wizard should include review.
- Review must match final/approval preview.
- Group visibility controls must be clear.
- Linked blog/gallery selection should be understandable.

## Attendance UI

Attendance screens must support large data.

Requirements:

- Group/year/date filters.
- Clear default date, normally today unless user changes it.
- Present/absent controls.
- Attendance percentage visible.
- Sticky headers or clean scroll containers for large sheets.
- Edit/delete attendance session controls for permitted users.
- Mobile card layout or controlled horizontal scroll.

Use status badges:

- Present: success green.
- Absent: muted/error depending on context.
- Pending or missing: warning/neutral.

## Approval Screens

Approval screens should show exactly what is being reviewed.

Requirements:

- Newest first.
- Clear status badges.
- Submitted by, created at, updated at where relevant.
- Dubai time formatting when specified.
- Preview should match public/dashboard final output.
- Approve, reject, send back, edit, and delete actions must be clear.
- Rejection/comment fields should be easy to use.

## Settings And Permissions

Settings and permissions screens should be structured and calm.

Sections may include:

- People & Access.
- Website Content.
- Registered Scout Upload.
- Groups & Sorting Rules.
- Documents.
- Reports.
- Archived Years.

People & Access:

- List users with avatar, name, email, role, groups, level, and status.
- Side actions: edit user, reset password, delete user.
- Edit panel should include name, email, role, groups, chief level, status, and permissions.
- Avatars must match the shared profile/avatar component and remain circular when expected.

## Modals And Popovers

Requirements:

- Centered or intentionally anchored.
- Mobile-first sizing.
- Max-height with internal scrolling.
- Close on escape/click-away where appropriate.
- Clear title and actions.
- Destructive confirmations should be explicit.
- Crop/image modals must be visible and usable on phones first.

## Badges And Status Labels

Use consistent badge colors:

- Approved / active / present: success.
- Pending / draft / in review: warning or info.
- Rejected / error / deleted: error.
- Closed / archived / muted: neutral.
- Public / group / logged-in visibility: info or neutral.

Badges should be readable, compact, and not overly bright.

## Empty States

Empty states should:

- Explain what is missing.
- Offer the next action if the user can act.
- Avoid looking like an error.
- Use calm text and optional icon.
- Work in both dark and light mode.

Examples:

- "No pending work right now."
- "No forms are open for you."
- "No albums have been published yet."
- "No attendance sessions for this date."

## Loading States

Use loading states where content will appear.

Requirements:

- Public gallery, blogs, and calendar should show loading inside the content area.
- Dashboard sections should load layout first and data separately.
- Avoid blank white screens.
- Use `BrandedLoader` for full-page auth/route loading.
- Use skeletons or inline loaders for cards/tables.
- If images fail to load, show a useful recovery notification with reload action where implemented.

## Mobile Responsiveness

Mobile must be treated as a primary experience.

Rules:

- Topbar items must not overlap.
- Bottom navigation should be touch-friendly.
- More menus and parent/child dropdowns must be tappable.
- Tables should scroll or convert to cards.
- Modals should fit within the viewport and not hide actions under bottom bars.
- Forms should be one column.
- Image cropper must be usable on phones.
- Public navigation should be one column when opened.
- Test at 375px and 390px widths.

## Accessibility

Requirements:

- Sufficient contrast in light and dark modes.
- Keyboard-accessible buttons, menus, modals, and forms.
- Visible focus states.
- Semantic headings.
- Labels connected to inputs.
- Alt text for meaningful images.
- Buttons must have accessible names.
- Do not rely on color alone for statuses.
- Respect reduced-motion preferences.

## Motion And Hover Effects

Motion should be subtle and purposeful.

Allowed:

- Button hover/focus tint.
- Clickable card lift.
- Menu open/close transitions.
- Loader pulse.
- Modal fade/scale.

Avoid:

- Hover effects on non-clickable cards/grids/tables.
- Aggressive animations.
- Layout shifts.
- Hover-only interactions that do not work on touch devices.

## Scouts Group Context

Use these labels consistently:

- Louvetoux: boys, grades 4 to 6.
- Jeanettes: girls, grades 4 to 6.
- Scout & Guide: mixed boys/girls, grades 7 to 8.
- Pioneer: mixed, grades 9 to 10.
- Routier: mixed, grade 11.
- Patrols: mixed, grade 12, trained to become chiefs through hands-on experience.

When displaying group metadata, show either age or grade according to current sorting/settings behavior. Do not duplicate both unless the active configuration requires both.

## Technical Rules

Do not break:

- Supabase auth.
- Permissions and RLS expectations.
- Dashboard routes.
- Public routes.
- Attendance logic.
- Forms/evaluations logic.
- Approval flows.
- Gallery/blog/calendar behavior.
- Rich text persistence and public rendering.
- Image upload/crop/optimization behavior.
- Mobile responsiveness.
- Dark mode readability.

Do not:

- Edit `open-design/`.
- Hardcode public content.
- Hardcode dashboard data.
- Expose secrets.
- Add service-role keys to frontend code.
- Rewrite unrelated code for visual changes.
- Add dependencies without a strong reason.

## Open Design Usage

Open Design may use this file to generate premium visual concepts and design systems.

Rules:

- Use `open-design/` only as reference.
- Do not edit `open-design/`.
- Do not copy code blindly into this app.
- Translate ideas into this project's real React, Supabase, and CSS structure only after inspection.

## Future Redesign Checklist

Before any redesign task:

1. Confirm the app root is the main Scouts website folder, not `open-design/`.
2. Read `AGENTS.md` and this `DESIGN.md`.
3. Inspect the actual component, service, and CSS selectors involved.
4. Check whether the change affects public pages, dashboard pages, auth, permissions, forms, attendance, or Supabase.
5. Check both light and dark mode.
6. Check mobile first, then desktop.
7. Keep public pages lightweight.
8. Preserve existing data fetching and routing.
9. Use existing components when possible.
10. Avoid broad CSS overrides unless the stylesheet is being intentionally consolidated.
11. Keep hover effects only on interactive elements.
12. Verify rich text and images still render correctly.
13. Run the appropriate checks from `package.json`.
14. Report what changed, what was tested, and what needs manual review.
