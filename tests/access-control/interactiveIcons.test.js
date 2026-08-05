import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("interactive icons use the shared Lucide Animated adapter", () => {
  const adapter = read("../../src/components/icons/InteractiveIcon.jsx");
  const layout = read("../../src/components/Layout.jsx");
  const workspaceShell = read("../../src/workspaces/FocusedWorkspaceShell.jsx");
  const dashboard = read("../../src/pages/AdminDashboardPage.jsx");

  assert.match(adapter, /from "motion\/react"/);
  assert.match(adapter, /useReducedMotion/);
  assert.match(adapter, /closest\("button, a, \[role='button'\], label"\)/);
  assert.match(layout, /<InteractiveIcon icon=\{Icon\}/);
  assert.match(workspaceShell, /<InteractiveIcon icon=\{Icon\}/);
  assert.match(dashboard, /<InteractiveIcon icon=\{Icon\}/);
  assert.match(dashboard, /<InteractiveIcon icon=\{Bell\}/);
});

test("collapsed dashboard sidebar hides labels without hiding interactive icons", () => {
  const stylesheets = [
    read("../../src/styles.css"),
    read("../../src/workspaces/dashboardShell.css")
  ];

  stylesheets.forEach((styles) => {
    assert.doesNotMatch(styles, /sidebar-collapsed \.admin-sidebar button span,/);
    assert.match(styles, /sidebar-collapsed \.admin-sidebar button > span:not\(\.interactive-icon\),/);
  });
});

test("mobile dashboard navigation hides labels without hiding interactive icons", () => {
  const stylesheets = [
    read("../../src/styles.css"),
    read("../../src/workspaces/dashboardShell.css")
  ];

  stylesheets.forEach((styles) => {
    assert.doesNotMatch(styles, /dashboard-bottom-tabs button > span,/);
    assert.match(styles, /dashboard-bottom-tabs button > span:not\(\.interactive-icon\),/);
    assert.match(styles, /dashboard-bottom-tabs a\.dashboard-bottom-tab-link > span:not\(\.interactive-icon\)/);
  });
});

test("vendored Lucide Animated components retain their license", () => {
  const license = read("../../src/components/icons/lucide-animated/LICENSE");
  const packageJson = JSON.parse(read("../../package.json"));

  assert.match(license, /Copyright \(c\) 2024-2026 pqoqubbw/);
  assert.ok(packageJson.dependencies.motion, "motion must be a runtime dependency");
});
