const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const logoPath = path.join(root, "src", "assets", "smscouts_logo.png");
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
const outDir = path.join(root, "tmp-dashboard-checks");
fs.mkdirSync(outDir, { recursive: true });

const sidebarButtons = [
  ["Overview", "▦", true],
  ["AI Assistant", "✧", false],
  ["Notifications", "♡", false],
  ["My Group", "☷", false],
  ["Scout Attendance", "✓", false],
  ["Attendance Sheets", "▤", false],
  ["Chief Attendance", "✓", false],
  ["Blog Posts", "▤", false],
  ["Calendar Events", "▣", false],
  ["Gallery", "▥", false],
  ["Approval Requests", "✓", false],
  ["Contact Messages", "□", false],
  ["Documents", "▤", false],
  ["Reports", "▦", false],
  ["Archived Years", "▤", false],
  ["Users", "☷", false],
  ["Settings", "⚙", false],
  ["Audit Logs", "▦", false]
];

function html(theme = "light", collapsed = false) {
  const themeClass = theme === "dark" ? "dashboard-theme-dark" : "dashboard-theme-light";
  const collapseClass = collapsed ? "sidebar-collapsed" : "sidebar-expanded";
  const buttons = sidebarButtons.map(([label, icon, active]) => `
    <button class="${active ? "active" : ""}" type="button"><span aria-hidden="true">${icon}</span><span>${label}</span></button>
  `).join("");
  const settingsSubitems = Array.from({ length: 8 }, (_, index) => `
    <button type="button"><span>Setting ${index + 1}</span></button>
  `).join("");

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; }
      .dashboard-theme-light { --dashboard-page-bg: #eef1f7; --dashboard-text: #172033; --dashboard-muted: #667085; --dashboard-blue: #4055a6; }
      .dashboard-theme-dark { --dashboard-page-bg: #0f1624; --dashboard-text: #f8fafc; --dashboard-muted: #a6adbc; --dashboard-blue: #8ca3ff; }
      .dashboard-theme-toggle, .dashboard-notification-button, .dashboard-profile-button {
        display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 10px; background: transparent; color: var(--dashboard-muted); min-width: 36px; min-height: 36px;
      }
      .dashboard-profile-button { gap: 8px; }
      .overview-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
      .overview-card, .panel { border-radius: 14px; padding: 20px; background: var(--dashboard-surface); color: var(--dashboard-text); min-height: 80px; }
      .panel { margin-top: 16px; min-height: 420px; }
      .sidebar-group.open .sidebar-subitems { max-height: 900px; }
    </style>
  </head>
  <body>
    <section class="admin-cms-shell ${themeClass} ${collapseClass}">
      <div class="dashboard-topbar">
        <div class="dashboard-topbar-brand-group">
          <button type="button" class="dashboard-shell-toggle">☰</button>
          <a class="dashboard-wordmark" href="#"><img src="${logo}" alt=""><span>St. Mary's Scouts</span></a>
        </div>
        <div class="dashboard-topbar-title-group"><strong class="dashboard-topbar-title">Approval Requests</strong></div>
        <button type="button" class="dashboard-mobile-search-toggle">⌕</button>
        <div class="dashboard-topbar-search"><input placeholder="Search current section" /></div>
        <div class="dashboard-topbar-actions">
          <button type="button" class="dashboard-theme-toggle">☾</button>
          <button type="button" class="dashboard-notification-button">♡</button>
          <button type="button" class="dashboard-profile-button"><img src="${logo}" width="28" height="28" alt=""><span>Chief Daniel</span></button>
        </div>
      </div>
      <aside class="admin-sidebar" id="dashboard-sidebar">
        <nav class="sidebar-navigation">
          ${buttons}
          <div class="sidebar-group open">
            <button class="sidebar-group-trigger" type="button"><span>⚙</span><span>Settings</span><span class="sidebar-chevron">⌄</span></button>
            <div class="sidebar-subitems">${settingsSubitems}</div>
          </div>
        </nav>
      </aside>
      <main class="admin-main">
        <div class="overview-grid">
          <article class="overview-card">Active scouts<br><strong>329</strong></article>
          <article class="overview-card">Chiefs<br><strong>3</strong></article>
          <article class="overview-card">Attendance days<br><strong>0</strong></article>
          <article class="overview-card">Pending approvals<br><strong>0</strong></article>
        </div>
        <section class="panel"><h2>Pending Work</h2><p>No pending work right now.</p></section>
        <section class="panel"><h2>Upcoming Events</h2><p>No upcoming events visible right now.</p></section>
      </main>
      <nav class="dashboard-bottom-tabs">
        <button class="active">Overview</button>
        <button>Attendance</button>
        <button>AI</button>
        <button>Forms</button>
        <button>More</button>
      </nav>
    </section>
  </body>
  </html>`;
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
        display: style.display,
        overflowY: style.overflowY,
        overflowX: style.overflowX,
        top: style.top,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      docScrollWidth: document.documentElement.scrollWidth,
      topbar: rect(".dashboard-topbar"),
      sidebar: rect(".admin-sidebar"),
      mobileSearch: rect(".dashboard-mobile-search-toggle"),
      fullSearch: rect(".dashboard-topbar-search"),
      shellToggle: rect(".dashboard-shell-toggle"),
      titleText: document.querySelector(".dashboard-topbar-title").textContent,
      titleWidth: rect(".dashboard-topbar-title").width,
      drawerCloseCount: document.querySelectorAll(".dashboard-drawer-close").length
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = {};

  for (const theme of ["light", "dark"]) {
    for (const collapsed of [false, true]) {
      await page.setViewportSize({ width: 1365, height: 900 });
      await page.setContent(html(theme, collapsed), { waitUntil: "load" });
      const key = `desktop-${theme}-${collapsed ? "collapsed" : "expanded"}`;
      results[key] = await measure(page);
      await page.screenshot({ path: path.join(outDir, `${key}.png`), fullPage: true });
    }
  }

  for (const width of [375, 390]) {
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 844 });
      await page.setContent(html(theme, false), { waitUntil: "load" });
      const key = `mobile-${width}-${theme}`;
      const closed = await measure(page);
      await page.$eval(".dashboard-topbar-search", (el) => el.classList.add("open"));
      const open = await measure(page);
      results[key] = { closed, open };
      await page.screenshot({ path: path.join(outDir, `${key}.png`), fullPage: true });
    }
  }

  fs.writeFileSync(path.join(outDir, "dashboard-shell-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
