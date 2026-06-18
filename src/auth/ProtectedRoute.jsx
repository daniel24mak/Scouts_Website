import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import BrandedLoader from "../components/BrandedLoader.jsx";

export default function ProtectedRoute({ allowedRoles, children, requirePublisher = false }) {
  const { user, isAuthLoading, isProfileLoading, authError } = useAuth();
  const location = useLocation();

  console.debug("[auth] route guard", {
    path: location.pathname,
    isAuthLoading,
    isProfileLoading,
    hasUser: Boolean(user),
    role: user?.role ?? null,
    accountStatus: user?.accountStatus ?? null,
    allowedRoles,
    requirePublisher
  });

  if (isAuthLoading || isProfileLoading) {
    return <BrandedLoader label="Checking your session" />;
  }

  if (authError) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Login error</p>
        <h1>We could not finish checking your session.</h1>
        <p className="helper-text">{authError.message}</p>
        <Navigate to="/login" state={{ from: location }} replace />
      </section>
    );
  }

  if (!user) {
    console.debug("[auth] route guard redirect login", { from: location.pathname });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.accountStatus === "disabled") {
    console.debug("[auth] route guard disabled account", { userId: user.id });
    return <Navigate to="/" replace />;
  }

  const isAdminChief = user.role === "admin" && allowedRoles.includes("chief") && user.groupId;

  if (!allowedRoles.includes(user.role) && !isAdminChief) {
    console.debug("[auth] route guard role rejected", { role: user.role, allowedRoles });
    return <Navigate to="/" replace />;
  }

  if (requirePublisher && user.role !== "admin" && !user.permissions?.canPublish) {
    console.debug("[auth] route guard publisher rejected", { userId: user.id });
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}