# Attendance Sheet Density Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove excess vertical space, keep session-management functions available without crowding the table header, and prevent sticky cells from becoming transparent or overlapping content.

**Architecture:** Use native `details`/`summary` disclosure inside each session header, avoiding additional React state. Add attendance-specific rules after the dashboard's global table rules so opaque theme surfaces win only for sticky attendance cells.

**Tech Stack:** React, semantic HTML, CSS, Node test runner.

## Global Constraints

- Add no dependency and no new component state.
- Preserve all existing label, date, delete, search, group-selection, and CSV behavior.
- Keep light and dark themes readable.

---

### Task 1: Compact session controls and repair sticky layers

**Files:**
- Modify: `tests/access-control/attendanceSheetsUi.test.js`
- Modify: `src/features/attendance/AttendanceSheetsManager.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Existing session edit handlers and dashboard theme variables.
- Produces: Native `.attendance-session-editor` disclosure and opaque sticky table cells.

- [ ] **Step 1: Write failing UI contract assertions**

Assert the manager uses `details`/`summary`, and the late dashboard CSS defines attendance-specific opaque sticky backgrounds and compact page spacing.

- [ ] **Step 2: Run the focused UI test and verify RED**

Run: `node --test tests/access-control/attendanceSheetsUi.test.js`

Expected: FAIL because disclosure markup and late scoped sticky rules do not exist.

- [ ] **Step 3: Implement the minimal markup and CSS**

Wrap existing fields/actions in `<details className="attendance-session-editor">`, add an accessible `<summary>Edit session</summary>`, tighten the attendance page stack, and override sticky cell backgrounds using `var(--dashboard-surface)` / `var(--dashboard-surface-2)` in the late dashboard style layer.

- [ ] **Step 4: Verify focused and attendance regression tests**

Run: `node --test tests/access-control/attendanceSheetsUi.test.js tests/access-control/attendanceSheetsModel.test.js tests/access-control/attendanceManagerIntegration.test.js tests/access-control/attendanceMfaIsolation.test.js tests/access-control/workspaceNavigation.test.js`

Expected: all tests pass.

- [ ] **Step 5: Verify production build and whitespace**

Run: `npm run build`

Expected: Vite exits successfully.

Run: `git diff --check`

Expected: no whitespace errors.
