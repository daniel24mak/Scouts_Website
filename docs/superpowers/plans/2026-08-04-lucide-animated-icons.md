# Lucide Animated Interactive Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Use Lucide Animated for interactive website and dashboard controls without animating static informational artwork or changing navigation behavior.

**Architecture:** Vendor a focused set of official Lucide Animated components and expose them through one `InteractiveIcon` adapter. The adapter listens to the nearest interactive parent so hovering or pressing any part of a button/link animates its icon, while reduced-motion users receive a static state and unsupported icons receive a restrained Motion-based fallback.

**Tech Stack:** React 18, Lucide React, Lucide Animated registry components, Motion, Vite, Node test runner, Playwright.

## Global Constraints

- Preserve routes, permissions, Supabase behavior, form behavior, and existing click handlers.
- Animate interactive controls only; explanatory and decorative icons stay static.
- Keep pointer motion under 300ms where locally controlled and respect `prefers-reduced-motion`.
- Preserve desktop/mobile and light/dark theme behavior.

---

### Task 1: Shared animated-icon foundation

**Files:**
- Create: `src/components/icons/InteractiveIcon.jsx`
- Create: `src/components/icons/lucide-animated/*`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/access-control/interactiveIcons.test.js`

- [ ] Add a failing structural test for the shared adapter, reduced-motion handling, and official component attribution.
- [ ] Install `motion` and vendor the selected official components with their MIT license.
- [ ] Implement parent-triggered hover/touch animation and a restrained fallback for icons not present in the collection.
- [ ] Run the focused test and confirm it passes.

### Task 2: Shared public and dashboard controls

**Files:**
- Modify: `src/components/Layout.jsx`
- Modify: `src/workspaces/FocusedWorkspaceShell.jsx`
- Modify: `src/workspaces/WorkspaceSwitcher.jsx`
- Modify: `src/components/ToastProvider.jsx`
- Modify: `src/components/SiteRecoveryPrompt.jsx`

- [ ] Replace only icons inside buttons and links with `InteractiveIcon`.
- [ ] Preserve labels, ARIA attributes, routing, state, and click handlers exactly.
- [ ] Confirm static footer contact/location icons remain still unless they are links.

### Task 3: Verification

**Files:**
- Modify only if verification exposes a focused regression.

- [ ] Run the interactive icon test and access-control suite.
- [ ] Run `npm run build`.
- [ ] Inspect public navigation and dashboard shell at desktop/mobile widths in light/dark themes.
- [ ] Verify touch targets, keyboard focus, and reduced-motion behavior.

