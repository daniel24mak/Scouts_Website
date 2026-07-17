import { Bell, ChevronDown, ListTodo, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserRound } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  workspaceIcon: WorkspaceIcon,
  workspaces,
  onWorkspaceChange,
  navigation,
  activeSection,
  onSectionChange,
  children
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => window.localStorage.getItem(themeKey) ?? "light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(sidebarKey) === "collapsed");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem(sidebarKey, collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  useEffect(() => {
    const close = (event) => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const selectSection = (section) => {
    onSectionChange?.(section);
    setMobileMenuOpen(false);
  };

  return (
    <div className={`focused-workspace-shell dashboard-theme-${theme} ${collapsed ? "sidebar-collapsed" : ""}`} data-workspace={workspaceKey}>
      <header className="focused-workspace-topbar">
        <button type="button" className="icon-button focused-workspace-collapse" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
        <Link className="focused-workspace-logo" to="/" title="Back to website"><img src={scoutLogo} alt="St. Mary's Scouts Dubai" /></Link>
        <div className="focused-workspace-brand">{WorkspaceIcon ? <WorkspaceIcon size={20} aria-hidden="true" /> : null}<strong>{workspaceLabel}</strong></div>
        {workspaces?.length > 1 ? <WorkspaceSwitcher workspaces={workspaces} value={workspaceKey} onChange={onWorkspaceChange} /> : <span />}
        <div className="focused-workspace-spacer" />
        <div className="focused-workspace-actions">
          {workspaceKey !== "my-work" ? <button type="button" className="icon-button" title="My Work" aria-label="Open My Work" onClick={() => navigate("/dashboard/my-work")}><ListTodo size={19} /></button> : null}
          <button type="button" className="icon-button" title="Notifications" aria-label="Open Notifications" onClick={() => navigate("/dashboard/scouting/notifications")}><Bell size={19} /></button>
          <button type="button" className="icon-button" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}> 
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="focused-workspace-profile-menu" ref={profileRef}>
            <button type="button" className="focused-workspace-profile" title={user?.name ?? "Account"} onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
              <UserAvatar user={user} size={32} /><b>{user?.name ?? "Account"}</b><ChevronDown size={15} />
            </button>
            {profileOpen ? <div className="focused-workspace-profile-dropdown"><button type="button" onClick={() => { setProfileOpen(false); window.sessionStorage.setItem("scouts-open-profile", "true"); onWorkspaceChange?.("scouting"); }}><UserRound size={16} />My Profile</button><button type="button" className="danger" onClick={() => logout()}><LogOut size={16} />Log Out</button></div> : null}
          </div>
        </div>
      </header>

      <aside className="focused-workspace-sidebar" aria-label={`${workspaceLabel} navigation`}>
        {navigation.map(({ key, label, Icon, group }, index) => <Fragment key={key}>
          {group && group !== navigation[index - 1]?.group ? <span className="focused-workspace-nav-group">{group}</span> : null}
          <button type="button" className={activeSection === key ? "active" : ""} onClick={() => selectSection(key)}>{Icon ? <Icon size={18} aria-hidden="true" /> : null}<span>{label}</span></button>
        </Fragment>)}
      </aside>

      <main className="focused-workspace-main">{children}</main>

      <nav className="focused-workspace-mobile-nav" aria-label={`${workspaceLabel} mobile navigation`}>
        {navigation.slice(0, 4).map(({ key, label, Icon }) => (
          <button type="button" key={key} className={activeSection === key ? "active" : ""} onClick={() => selectSection(key)}>
            {Icon ? <Icon size={20} aria-hidden="true" /> : null}<span>{label}</span>
          </button>
        ))}
        <button type="button" className={mobileMenuOpen ? "active" : ""} onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen}>
          <Menu size={20} aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div className="focused-workspace-mobile-sheet" role="dialog" aria-label={`${workspaceLabel} sections`}>
          <button type="button" className="focused-workspace-sheet-backdrop" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />
          <div className="focused-workspace-sheet-panel">
            <div><strong>{workspaceLabel} sections</strong><button type="button" onClick={() => setMobileMenuOpen(false)}>Close</button></div>
            {navigation.map(({ key, label, Icon }) => (
              <button type="button" key={key} className={activeSection === key ? "active" : ""} onClick={() => selectSection(key)}>
                {Icon ? <Icon size={19} aria-hidden="true" /> : null}{label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
