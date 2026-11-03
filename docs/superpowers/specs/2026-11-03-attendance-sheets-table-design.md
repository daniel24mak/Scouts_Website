# Attendance Sheets Table Design

## Goal

Restore a clear, compact attendance-review workflow for chiefs while preserving all existing attendance permissions, mutations, and CSV export behavior.

## Group Scope

- Keep the upper dashboard group selector rendered by `renderCoordinatorGroupSwitcher`.
- Remove the group selector and static group card from `AttendanceSheetsManager`.
- Treat the scoped `userOverride` supplied by the dashboard as the single group source.
- The upper selector must continue to update `scopedUser`, causing the table and CSV export to use the selected accessible group.
- Do not broaden group access. Admins and multi-group chiefs may only select groups already exposed by the existing dashboard scope logic.

## Search

- A scout-field match filters scout rows while retaining all session columns.
- A session date, label, or topic match filters session columns while retaining all scout rows.
- If the query matches both categories, show both matching rows and matching columns.
- If it matches neither category, show a clear no-results state rather than an apparently empty attendance dataset.
- CSV export continues to export the currently visible group dataset, independent of the dashboard search filter.

## Table Presentation

- Use a compact toolbar containing group context, session/scout counts, and Download CSV.
- Keep scout names sticky on the left and attendance percentages sticky on the right where space permits.
- Replace the tall stacked session controls with compact, structured headers that distinguish the session label, date, and permitted actions.
- Preserve label editing for existing authorized users and preserve date/delete controls for admins and head/vice chiefs.
- Retain text labels inside status chips so meaning is not color-only.
- Improve row hover, alignment, focus visibility, horizontal overflow, and narrow-screen behavior using the existing dashboard tokens.
- Avoid new dependencies, decorative effects, or unrelated component refactors.

## Verification

- Regression coverage proves the page no longer renders its own group selector and still consumes the dashboard-scoped group.
- Search tests cover scout-only, session-only, combined, and no-match queries.
- Existing attendance access, save-reliability, and workspace-navigation tests remain green.
- Run the production build and visually inspect the attendance table at desktop and narrow widths.
