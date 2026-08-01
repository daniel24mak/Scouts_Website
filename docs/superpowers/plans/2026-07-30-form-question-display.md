# Form Question Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a form-wide question-number visibility setting and polish the existing unboxed question surface.

**Architecture:** Store the backward-compatible flag in normalized form appearance settings and consume it in the shared respondent renderer. Keep question surface selection per question and improve only the existing `plain` surface CSS.

**Tech Stack:** React 18, Vite, CSS, Node test runner.

## Global Constraints

- Existing forms show question numbers unless explicitly disabled.
- Do not alter submission, validation, permissions, routing, or Supabase behavior.
- Preserve mobile layouts, dark mode, conditional questions, and field widths.
- Add no new dependencies.

---

### Task 1: Normalize the display setting

**Files:**
- Modify: `src/features/forms/formModel.js`
- Modify: `src/features/forms/FormsDashboard.jsx`
- Test: `tests/access-control/formModel.test.js`

**Interfaces:**
- Produces: `normalizeFormAppearanceSettings(settings)` returning appearance settings with `showQuestionNumbers: boolean`.
- Consumes: existing schema settings normalization.

- [ ] Add failing tests proving missing values default to `true` and explicit `false` is preserved.
- [ ] Run `node --test tests/access-control/formModel.test.js` and confirm the new tests fail.
- [ ] Add `normalizeFormAppearanceSettings` and use it from `normalizeFormSettings`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Add the builder control and renderer behavior

**Files:**
- Modify: `src/features/forms/FormsDashboard.jsx`

**Interfaces:**
- Consumes: `formSettings.appearance.showQuestionNumbers`.
- Produces: respondent form canvas class `hide-question-numbers` and conditional number markup.

- [ ] Add a `Show question numbers` checkbox to Appearance.
- [ ] Add the visibility class to the shared form canvas.
- [ ] Render `.premium-question-number` only when the setting is enabled.
- [ ] Keep builder-only numbering unchanged.

### Task 3: Polish unboxed questions

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.question-surface-plain` and `.hide-question-numbers`.

- [ ] Update the plain surface spacing, divider, and focus treatment using existing form tokens.
- [ ] Collapse the number column when numbers are hidden.
- [ ] Add responsive rules so half-width fields and unboxed questions remain legible on mobile.
- [ ] Confirm dark mode inherits tokenized colors without hardcoded white surfaces.

### Task 4: Verify

**Files:**
- Test: `tests/access-control/formModel.test.js`

- [ ] Run `node --test tests/access-control/formModel.test.js`.
- [ ] Run `npm run build`.
- [ ] Confirm no lint command exists and report lint as skipped.
- [ ] Report modified files and any manual visual checks remaining.

