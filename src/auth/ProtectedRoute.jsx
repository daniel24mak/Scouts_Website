import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import BrandedLoader from "../components/BrandedLoader.jsx";

export default function ProtectedRoute({ allowedRoles, children, requirePublisher = false }) {
  const { user, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <BrandedLoader label="Checking your session" />;
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
