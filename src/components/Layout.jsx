import { Camera, FileText, Home, Info, Instagram, Menu, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import scoutLogo from "../assets/smscouts_logo.png";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/about", label: "About Us", icon: Info },
  { to: "/blogs", label: "Blogs / News", icon: FileText },
  { to: "/gallery", label: "Gallery", icon: Camera }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isHomePage = location.pathname === "/";
  const isDashboardPage =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chiefs");

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 24);

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate("/");
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <div className={`app-shell ${isDashboardPage ? "dashboard-shell" : ""}`}>
      {!isDashboardPage && (
        <header className={`site-header ${isHomePage && !isScrolled && !isMenuOpen ? "transparent" : "scrolled"}`}>
        <NavLink to="/" className="brand" onClick={closeMenu}>
          <img className="brand-logo" src={scoutLogo} alt="Scout of Saint Mary logo" />
          <span>
            <strong>St. Mary's Scouts Dubai</strong>
            <small>Faith, service, leadership</small>
          </span>
        </NavLink>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="site-menu"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
        <div className={`header-menu ${isMenuOpen ? "open" : ""}`} id="site-menu">
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={closeMenu}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            {user && (
              <NavLink to="/dashboard" onClick={closeMenu}>
                <Users size={18} aria-hidden="true" />
                Dashboard
              </NavLink>
            )}
          </nav>
          <div className="session-controls">
            {user ? (
              <>
                <span>{user.name}</span>
                <button type="button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <NavLink className="button-link" to="/login" onClick={closeMenu}>
                Log in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      )}
      <main>
        <Outlet />
      </main>
      {!isDashboardPage && (
        <footer className="site-footer">
        <div className="footer-brand">
          <img className="footer-logo" src={scoutLogo} alt="Scout of Saint Mary logo" />
          <div>
            <strong>St. Mary's Scouts Dubai</strong>
            <p>
              A church-based scouting group at St. Mary's Catholic Church, Dubai,
              helping young people grow through faith, leadership, service, teamwork,
              and community.
            </p>
          </div>
        </div>
        <div className="footer-column">
          <strong>Location</strong>
          <span>St. Mary's Catholic Church</span>
          <span>Dubai, United Arab Emirates</span>
          <a className="footer-social" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
            <Instagram size={18} aria-hidden="true" />
            Follow us on Instagram
          </a>
        </div>
        <nav className="footer-column" aria-label="Footer navigation">
          <strong>Quick links</strong>
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/blogs">Blogs / News</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/login">Login</Link>
        </nav>
        <p className="footer-bottom">Copyright 2026 St. Mary's Scouts Dubai. All rights reserved.</p>
      </footer>
      )}
    </div>
  );
}
