import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";

export default function ProtectedRoute({ allowedRoles, children, requirePublisher = false }) {
  const { user, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Loading</p>
        <h1>Checking your session</h1>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.accountStatus === "disabled") {
    return <Navigate to="/" replace />;
  }

  const isAdminChief = user.role === "admin" && allowedRoles.includes("chief") && user.groupId;

  if (!allowedRoles.includes(user.role) && !isAdminChief) {
    return <Navigate to="/" replace />;
  }

  if (requirePublisher && user.role !== "admin" && !user.permissions.canPublish) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
