# Attendance Sheets Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the upper dashboard group selector as the only selector, make attendance search behave predictably, and deliver a compact, accessible attendance table.

**Architecture:** The dashboard remains responsible for selecting an authorized group and passes a `scopedUser` to `AttendanceSheetsManager`. A small pure model function will decide whether a query filters scout rows, session columns, both, or neither; the React component will render those results. Attendance-specific CSS will compact the header controls and improve sticky columns, row scanning, focus states, and narrow-screen overflow without changing persistence or permissions.

**Tech Stack:** React 18, Vite 6, JavaScript, Node test runner, existing CSS tokens, Lucide icons.

## Global Constraints

- Keep the upper `renderCoordinatorGroupSwitcher("View attendance for group")` selector.
- Remove the selector and static group card inside `AttendanceSheetsManager`.
- Preserve current attendance permissions, mutation functions, confirmations, and CSV behavior.
- Use existing dashboard tokens and dependencies only.
- Meet WCAG 2.1 AA contrast and keyboard expectations; status meaning cannot depend on color alone.

---

### Task 1: Attendance Search Model

**Files:**
- Create: `src/features/attendance/attendanceSheetsModel.js`
- Create: `tests/access-control/attendanceSheetsModel.test.js`
- Modify: `src/features/attendance/AttendanceSheetsManager.jsx`

**Interfaces:**
- Produces: `filterAttendanceSheet({ scouts, sessions, query }) -> { scouts, sessions, hasMatches }`.
- Consumes: scout fields `name`, `schoolGrade`, `school`, `age`, `groupId`; session fields `date`, `topic`, and the visible session label.

- [ ] **Step 1: Write the failing search tests**

```js
test("scout searches filter rows without removing session columns", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "Alex" });
  assert.deepEqual(result.scouts.map(({ id }) => id), ["alex"]);
  assert.deepEqual(result.sessions.map(({ id }) => id), ["oct-09", "oct-16"]);
  assert.equal(result.hasMatches, true);
});

test("session searches filter columns without removing scout rows", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "Camp" });
  assert.deepEqual(result.scouts.map(({ id }) => id), ["alex", "maya"]);
  assert.deepEqual(result.sessions.map(({ id }) => id), ["oct-16"]);
});

test("queries matching neither category return an explicit no-match result", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "not-found" });
  assert.deepEqual(result.scouts, []);
  assert.deepEqual(result.sessions, []);
  assert.equal(result.hasMatches, false);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `node --test tests/access-control/attendanceSheetsModel.test.js`

Expected: FAIL because `attendanceSheetsModel.js` and `filterAttendanceSheet` do not exist.

- [ ] **Step 3: Implement the pure search model**

```js
export function getSessionLabel(session) {
  const label = String(session.topic ?? "").trim();
  return label && label !== "Meeting" ? label : session.date;
}

export function filterAttendanceSheet({ scouts = [], sessions = [], query = "" }) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return { scouts, sessions, hasMatches: true };

  const matchingScouts = scouts.filter((scout) =>
    [scout.name, scout.schoolGrade, scout.school, scout.age, scout.groupId]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(term))
  );
  const matchingSessions = sessions.filter((session) =>
    [session.date, session.topic, getSessionLabel(session)]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(term))
  );

  if (matchingScouts.length && matchingSessions.length) return { scouts: matchingScouts, sessions: matchingSessions, hasMatches: true };
  if (matchingScouts.length) return { scouts: matchingScouts, sessions, hasMatches: true };
  if (matchingSessions.length) return { scouts, sessions: matchingSessions, hasMatches: true };
  return { scouts: [], sessions: [], hasMatches: false };
}
```

- [ ] **Step 4: Wire the component to the pure result**

Build unfiltered `allGroupSessions` and `allGroupScouts`, then derive:

```js
const visibleAttendance = useMemo(
  () => filterAttendanceSheet({ scouts: allGroupScouts, sessions: allGroupSessions, query: searchQuery }),
  [allGroupScouts, allGroupSessions, searchQuery]
);
const groupScouts = visibleAttendance.scouts;
const groupSessions = visibleAttendance.sessions;
```

Pass `allGroupScouts` and `allGroupSessions` to `downloadCsv` so dashboard search never silently truncates an export.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/access-control/attendanceSheetsModel.test.js`

Expected: all search-model tests PASS.

```bash
git add src/features/attendance/attendanceSheetsModel.js src/features/attendance/AttendanceSheetsManager.jsx tests/access-control/attendanceSheetsModel.test.js
git commit -m "Fix attendance sheet search behavior"
```

---

### Task 2: Single Dashboard Group Selector

**Files:**
- Modify: `src/features/attendance/AttendanceSheetsManager.jsx`
- Create: `tests/access-control/attendanceSheetsUi.test.js`
- Verify: `src/pages/AdminDashboardPage.jsx:5216`

**Interfaces:**
- Consumes: `userOverride.groupId`, already supplied by the dashboard's `scopedUser`.
- Produces: one selected group and no group-selection control inside the table component.

- [ ] **Step 1: Write a failing UI contract test**

```js
test("attendance sheets rely on the dashboard selector and render no internal group select", () => {
  assert.match(dashboard, /renderCoordinatorGroupSwitcher\("View attendance for group"\)/);
  assert.doesNotMatch(manager, /setSelectedGroupId|<select[^>]*selectedGroup/);
  assert.match(manager, /data\.groups\.find\(\(group\) => group\.id === user\?\.groupId\)/);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/access-control/attendanceSheetsUi.test.js`

Expected: FAIL because `AttendanceSheetsManager` still owns `selectedGroupId` and renders an internal selector.

- [ ] **Step 3: Remove internal selection state and markup**

Replace `accessibleGroups`, `selectedGroupId`, and the selection effect with:

```js
const assignedGroupIds = Array.from(new Set([
  user?.groupId,
  ...(user?.assignedGroupIds ?? []),
  ...(user?.coordinatorGroupIds ?? [])
].filter(Boolean)));
const selectedGroup = data.groups.find((group) => group.id === user?.groupId)
  ?? data.groups.find((group) => assignedGroupIds.includes(group.id));
```

Remove both the internal `<select>` and `.attendance-sheet-group-card`. Keep the upper dashboard selector unchanged.

- [ ] **Step 4: Add clear group context to the compact toolbar**

```jsx
<div className="attendance-sheet-context">
  <span>Selected group</span>
  <strong>{selectedGroup?.name}</strong>
  <small>{allGroupScouts.length} scouts · {allGroupSessions.length} sessions</small>
</div>
```

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/access-control/attendanceSheetsUi.test.js tests/access-control/workspaceNavigation.test.js`

Expected: all tests PASS.

```bash
git add src/features/attendance/AttendanceSheetsManager.jsx tests/access-control/attendanceSheetsUi.test.js
git commit -m "Use one group selector for attendance sheets"
```

---

### Task 3: Compact Operational Table Polish

**Files:**
- Modify: `src/features/attendance/AttendanceSheetsManager.jsx`
- Modify: `src/styles.css:7184-7338`
- Extend: `tests/access-control/attendanceSheetsUi.test.js`

**Interfaces:**
- Consumes: existing `canManageColumns`, label/date edit state, and save/delete handlers.
- Produces: accessible `.attendance-session-summary`, `.attendance-session-fields`, `.attendance-session-actions`, and sticky percentage cells.

- [ ] **Step 1: Add failing structure assertions**

```js
test("attendance table exposes compact session controls and sticky percentage cells", () => {
  for (const className of ["attendance-session-summary", "attendance-session-fields", "attendance-session-actions", "attendance-percentage-column"]) {
    assert.match(manager, new RegExp(className));
  }
  assert.match(manager, /No attendance records match/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/access-control/attendanceSheetsUi.test.js`

Expected: FAIL because the compact structure is not rendered yet.

- [ ] **Step 3: Restructure each session header without changing handlers**

```jsx
<div className="attendance-session-heading">
  <div className="attendance-session-summary">
    <strong>{getSessionLabel(session)}</strong>
    <small>{session.date}</small>
  </div>
  <div className="attendance-session-fields">...</div>
  <div className="attendance-session-actions">...</div>
</div>
```

Use existing `handleLabelSave`, `handleDateSave`, and `handleDeleteSession` calls. Add `className="attendance-percentage-column"` to both percentage header and cells. Render a no-results row when `visibleAttendance.hasMatches` is false.

- [ ] **Step 4: Apply attendance-scoped CSS**

Use the existing `--dashboard-*` and `--brand-*` tokens. Required behavior:

```css
.attendance-sheet-table tbody tr:hover td { background: #f8faff; }
.attendance-sheet-table .attendance-percentage-column { position: sticky; right: 0; text-align: center; }
.attendance-session-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.attendance-session-actions button { min-height: 34px; }
.attendance-sheet-scroll { scrollbar-gutter: stable; }
```

Keep radii at 8-12px, maintain visible `:focus-visible`, avoid wide decorative shadows, and disable sticky percentage cells below 720px to preserve horizontal access.

- [ ] **Step 5: Run focused regression tests**

Run:

```bash
node --test tests/access-control/attendanceSheetsModel.test.js tests/access-control/attendanceSheetsUi.test.js tests/access-control/attendanceManagerIntegration.test.js tests/access-control/attendanceMfaIsolation.test.js tests/access-control/workspaceNavigation.test.js
```

Expected: all focused tests PASS with zero failures.

- [ ] **Step 6: Run the production build and visually inspect**

Run: `npm run build`

Expected: Vite exits 0.

Inspect desktop and 720px-or-narrower widths. Confirm one group selector, working search states, sticky scout names, readable status chips, compact session controls, and reachable horizontal content.

- [ ] **Step 7: Commit**

```bash
git add src/features/attendance/AttendanceSheetsManager.jsx src/styles.css tests/access-control/attendanceSheetsUi.test.js
git commit -m "Polish attendance sheets table"
```
