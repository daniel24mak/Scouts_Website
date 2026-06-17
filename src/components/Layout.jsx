import { CalendarDays, Camera, FileText, Home, Info, Instagram, MapPin, Menu, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import scoutLogo from "../assets/smscouts_logo.png";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/about", label: "About Us", icon: Info },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/blogs", label: "Blogs / News", icon: FileText },
  { to: "/gallery", label: "Gallery", icon: Camera }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const isHomePage = location.pathname === "/";
  const isDashboardPage =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/chiefs");

  useEffect(() => {
    const updateHeader = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 24);

      const isDesktop = window.innerWidth > 1024;
      const hideStart = Math.max(window.innerHeight * 0.72, 520);

      if (!isDesktop || isMenuOpen || currentScrollY < hideStart) {
        setIsHeaderHidden(false);
      } else if (currentScrollY > lastScrollY.current + 8) {
        setIsHeaderHidden(true);
      } else if (currentScrollY < lastScrollY.current - 8) {
        setIsHeaderHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, [isMenuOpen]);

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
        <header className={`site-header ${isHomePage && !isScrolled && !isMenuOpen ? "transparent" : "scrolled"} ${isHeaderHidden ? "hidden" : ""}`}>
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
        <div className={`header-menu ${isMenuOpen ? "open mobile-single-column-menu" : ""}`} id="site-menu">
          <button
            type="button"
            className="mobile-menu-close"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          >
            <X size={28} aria-hidden="true" />
          </button>
          <nav className="main-nav mobile-nav-stack" aria-label="Main navigation">
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
            <p>Building character, one adventure at a time.</p>
          </div>
        </div>
        <nav className="footer-column" aria-label="Footer navigation">
          <strong>Quick links</strong>
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/calendar">Calendar</Link>
          <Link to="/blogs">Blogs / News</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/login">Login</Link>
        </nav>
        <div className="footer-column footer-contact">
          <strong>Contact Us</strong>
          <span><MapPin size={17} aria-hidden="true" /> St. Mary's Catholic Church</span>
          <span><MapPin size={17} aria-hidden="true" /> Dubai, United Arab Emirates</span>
        </div>
        <div className="footer-column footer-social-column">
          <strong>Social</strong>
          <a className="footer-social" href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Follow St. Mary's Scouts Dubai on Instagram">
            <Instagram size={20} aria-hidden="true" />
            <span>Instagram</span>
          </a>
        </div>
        <p className="footer-bottom">Copyright 2026 St. Mary's Scouts Dubai. All rights reserved.</p>
      </footer>
      )}
    </div>
  );
}


