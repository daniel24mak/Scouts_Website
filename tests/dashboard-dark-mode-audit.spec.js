import { test, expect } from "@playwright/test";

const dashboardSections = [
  { name: "my-group", label: "My Group" },
  { name: "equipe-management", label: "Equipe Management" },
  { name: "calendar-events", label: "Calendar Events" },
  { name: "posts-blogs", label: "Posts / Blogs" },
  { name: "gallery-albums", label: "Gallery / Albums" },
  { name: "my-forms", label: "My Forms" },
  { name: "contact-messages", label: "Contact Messages" },
  { name: "scouts", label: "Scouts" },
  { name: "groups-sorting-rules", label: "Groups & Sorting Rules" },
  { name: "website-content", label: "Website Content" }
];

function parseRgb(color) {
  const match = color?.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const [r, g, b, a = "1"] = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  return { r, g, b, a };
}

function isNearWhite(color) {
  const rgb = parseRgb(color);
  if (!rgb || rgb.a === 0) return false;
  return rgb.r > 230 && rgb.g > 230 && rgb.b > 230;
}

async function login(page) {
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
  if (!email || !password) test.skip(true, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run authenticated dashboard audit.");
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/dashboard|admin|portal/i, { timeout: 30000 });
}

async function enableDarkMode(page) {
  const shell = page.locator(".admin-cms-shell");
  await shell.waitFor({ state: "visible", timeout: 30000 });
  const className = await shell.getAttribute("class");
  if (!className?.includes("dashboard-theme-dark")) {
    await page.locator(".dashboard-theme-toggle").click();
  }
  await expect(shell).toHaveClass(/dashboard-theme-dark/);
}

async function openSection(page, label) {
  const item = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
  if (await item.count()) {
    await item.click();
    return;
  }
  const groupTriggers = page.locator(".sidebar-group-trigger");
  const count = await groupTriggers.count();
  for (let index = 0; index < count; index += 1) {
    const trigger = groupTriggers.nth(index);
    if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
    const target = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
    if (await target.count()) {
      await target.click();
      return;
    }
  }
  throw new Error(`Could not open dashboard section: ${label}`);
}

async function findLightElements(page) {
  return page.evaluate(() => {
    const skipTags = new Set(["HTML", "BODY", "SCRIPT", "STYLE", "PATH", "SVG"]);
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const parse = (color) => {
      const match = color?.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const [r, g, b, a = "1"] = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return { r, g, b, a };
    };
    const nearWhite = (color) => {
      const rgb = parse(color);
      return rgb && rgb.a !== 0 && rgb.r > 230 && rgb.g > 230 && rgb.b > 230;
    };
    return [...document.querySelectorAll(".admin-cms-shell *")]
      .filter((node) => !skipTags.has(node.tagName) && visible(node))
      .map((node) => {
        const style = getComputedStyle(node);
        return {
          tag: node.tagName.toLowerCase(),
          className: node.className?.toString?.() ?? "",
          text: node.textContent?.trim?.().slice(0, 60) ?? "",
          background: style.backgroundColor,
          borderTop: style.borderTopColor,
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          color: style.color
        };
      })
      .filter((item) => nearWhite(item.background) || (item.borderTopWidth > 0 && nearWhite(item.borderTop)));
  });
}

test.describe("dashboard dark mode visual audit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await enableDarkMode(page);
  });

  for (const section of dashboardSections) {
    test(`${section.label} has no hardcoded white surfaces`, async ({ page }) => {
      await openSection(page, section.label);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `test-results/dark-mode-${section.name}.png`, fullPage: true });
      const offenders = await findLightElements(page);
      expect(offenders, JSON.stringify(offenders.slice(0, 25), null, 2)).toEqual([]);
    });
  }
});
