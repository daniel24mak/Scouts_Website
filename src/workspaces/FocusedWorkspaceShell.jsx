import { Bell, ChevronDown, ListTodo, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import scoutLogo from "../assets/smscouts_logo.png";
import UserAvatar from "../components/UserAvatar.jsx";
import WorkspaceSwitcher from "./WorkspaceSwitcher.jsx";
import "./focusedWorkspaceShell.css";

const themeKey = "scouts-dashboard-theme";
const sidebarKey = "scouts-dashboard-sidebar-mode";

export default function FocusedWorkspaceShell({
  workspaceKey,
  workspaceLabel,
  workspaces,
  onWorkspaceChange,
  navigation,
  activeSection,
  onSectionChange,
  children
}) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => window.localStorage.getItem(themeKey) ?? "light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(sidebarKey) === "collapsed");
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(true);
  const [sidebarTooltip, setSidebarTooltip] = useState(null);
  const profileRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem(sidebarKey, collapsed ? "collapsed" : "expanded");
    if (!collapsed) setSidebarTooltip(null);
  }, [collapsed]);
  useEffect(() => {
    const close = (event) => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const closeOverlays = (event) => {
      if (event.key !== "Escape") return;
      setProfileOpen(false);
      setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOverlays);
    return () => document.removeEventListener("keydown", closeOverlays);
  }, []);
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastToggleY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      const distance = Math.abs(currentScrollY - lastToggleY);
      if (!window.matchMedia("(max-width: 768px)").matches || mobileMenuOpen) {
        setMobileNavExpanded(true);
      } else if (currentScrollY < 120 || (delta < -6 && distance > 18)) {
        setMobileNavExpanded(true);
        lastToggleY = currentScrollY;
      } else if (delta > 6 && distance > 28) {
        setMobileNavExpanded(false);
        lastToggleY = currentScrollY;
      }
      lastScrollY = currentScrollY;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [mobileMenuOpen]);

  const selectSection = (section) => {
    onSectionChange?.(section);
    setMobileMenuOpen(false);
    setSidebarTooltip(null);
  };
  const sidebarTooltipHandlers = (label) => ({
    onMouseEnter: (event) => {
      if (!collapsed) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setSidebarTooltip({
        label,
        left: rect.right + 8,
        top: rect.top + rect.height / 2
      });
    },
    onMouseLeave: () => setSidebarTooltip(null),
    onFocus: (event) => {
      if (!collapsed) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setSidebarTooltip({
        label,
        left: rect.right + 8,
        top: rect.top + rect.height / 2
      });
    },
    onBlur: () => setSidebarTooltip(null)
  });
  const activeTitle = navigation.find(({ key }) => key === activeSection)?.label ?? workspaceLabel;
  const mobilePrimaryItems = navigation.slice(0, 4);
  const mobileMoreActive = navigation.slice(4).some(({ key }) => key === activeSection);
  const activeMobileIndex = Math.max(0, mobilePrimaryItems.findIndex(({ key }) => key === activeSection));
  const mobileActiveIndex = mobileMoreActive || mobileMenuOpen ? mobilePrimaryItems.length : activeMobileIndex;
  const mobileTabCount = mobilePrimaryItems.length + 1;
  const triggerMobilePress = () => navigator.vibrate?.(8);

  return (
    <div className={`admin-cms-shell focused-workspace-shell dashboard-theme-${theme} sidebar-${collapsed ? "collapsed" : "expanded"} ${mobileNavExpanded ? "mobile-menu-bar-visible" : ""}`} data-workspace={workspaceKey}>
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-brand-group">
          <button type="button" className="dashboard-shell-toggle" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          <Link className="dashboard-wordmark" to="/" title="Back to website" aria-label="Back to website"><img src={scoutLogo} alt="" /><span>St. Mary's Scouts</span></Link>
        </div>
        <div className="dashboard-topbar-title-group"><strong className="dashboard-topbar-title">{activeTitle}</strong>{workspaces?.length > 1 ? <WorkspaceSwitcher workspaces={workspaces} value={workspaceKey} onChange={onWorkspaceChange} /> : null}</div>
        <div className="dashboard-topbar-actions">
          {workspaceKey !== "my-work" ? <button type="button" className="dashboard-my-work-button" title="My Work" aria-label="Open My Work" onClick={() => selectSection("myWork")}><ListTodo size={18} /><span>My Work</span></button> : null}
          <button type="button" className="dashboard-notification-button" title="Notifications" aria-label="Open Notifications" onClick={() => selectSection("notifications")}><Bell size={18} /></button>
          <button type="button" className="dashboard-theme-toggle" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="dashboard-profile-menu" ref={profileRef}>
            <button type="button" className="dashboard-profile-button" title={user?.name ?? "Account"} onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
              <UserAvatar user={user} size={36} /><span>{user?.name ?? "Account"}</span><ChevronDown size={15} />
            </button>
            {profileOpen ? <div className="dashboard-profile-dropdown"><button type="button" onClick={() => { setProfileOpen(false); window.sessionStorage.setItem("scouts-open-profile", "true"); onWorkspaceChange?.("scouting"); }}>My Profile</button><button type="button" className="danger-action" onClick={() => logout()}>Log Out</button></div> : null}
          </div>
        </div>
      </header>

      <aside className="admin-sidebar" aria-label={`${workspaceLabel} navigation`}>
        <nav className="sidebar-navigation">
          {navigation.map(({ key, label, Icon, group }, index) => <Fragment key={key}>
            {group && group !== navigation[index - 1]?.group ? <span className="focused-workspace-nav-group">{group}</span> : null}
            <button type="button" className={activeSection === key ? "active" : ""} aria-label={label} onClick={() => selectSection(key)} {...sidebarTooltipHandlers(label)}>{Icon ? <Icon size={17} aria-hidden="true" /> : null}<span>{label}</span></button>
          </Fragment>)}
        </nav>
      </aside>
      {sidebarTooltip && createPortal(
        <div className="dashboard-sidebar-tooltip-portal" style={{ left: `${sidebarTooltip.left}px`, top: `${sidebarTooltip.top}px` }} role="tooltip">
          {sidebarTooltip.label}
        </div>,
        document.body
      )}

      <main className="admin-main focused-workspace-main">{children}</main>

      <nav className="dashboard-bottom-tabs" aria-label={`${workspaceLabel} mobile navigation`} style={{ "--mobile-tab-count": mobileTabCount, "--mobile-active-index": mobileActiveIndex }}>
        <span className="dashboard-bottom-indicator" aria-hidden="true" />
        {mobilePrimaryItems.map(({ key, label, Icon }) => (
          <button type="button" key={key} className={activeSection === key ? "active" : ""} onPointerDown={triggerMobilePress} onClick={() => selectSection(key)} aria-label={label} title={label}>
            {Icon ? <Icon size={20} aria-hidden="true" /> : null}<span>{label}</span>
          </button>
        ))}
        <button type="button" className={mobileMenuOpen || mobileMoreActive ? "active" : ""} onPointerDown={triggerMobilePress} onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label="More" title="More">
          <Menu size={20} aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div className="dashboard-more-sheet-backdrop" role="dialog" aria-label={`${workspaceLabel} sections`} onClick={() => setMobileMenuOpen(false)}>
          <div className="dashboard-more-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading compact"><div><p className="eyebrow">More</p><h2>{workspaceLabel} Sections</h2></div><button type="button" className="modal-close-button" aria-label="Close more menu" onClick={() => setMobileMenuOpen(false)}>Close</button></div>
            <div className="dashboard-more-grid">
              {navigation.map(({ key, label, Icon }) => (
                <button type="button" key={key} className={activeSection === key ? "active" : ""} onClick={() => selectSection(key)}>
                  {Icon ? <Icon size={19} aria-hidden="true" /> : null}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
