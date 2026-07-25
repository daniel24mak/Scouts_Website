import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the application loads one authoritative dashboard shell stylesheet", () => {
  const main = read("src/main.jsx");
  const shellCss = read("src/workspaces/dashboardShell.css");

  assert.match(main, /import "\.\/workspaces\/dashboardShell\.css";/);
  assert.match(shellCss, /\.dashboard-topbar\s*\{/);
  assert.match(shellCss, /\.admin-sidebar\s*\{/);
  assert.match(shellCss, /\.dashboard-bottom-tabs\s*[,{\n]/);
});

test("focused workspace styling does not redefine shared shell chrome", () => {
  const focusedCss = read("src/workspaces/focusedWorkspaceShell.css");
  const forbiddenSelectors = [
    ".dashboard-topbar",
    ".admin-sidebar",
    ".dashboard-bottom-tabs",
    ".dashboard-more-sheet"
  ];

  forbiddenSelectors.forEach((selector) => {
    assert.equal(
      focusedCss.includes(selector),
      false,
      `${selector} belongs in dashboardShell.css`
    );
  });
});

