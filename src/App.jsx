import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import BrandedLoader from "./components/BrandedLoader.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";

const AboutPage = lazy(() => import("./pages/AboutPage.jsx"));
const AdminChiefAttendancePage = lazy(() => import("./pages/AdminChiefAttendancePage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage.jsx"));
const AlbumDetailPage = lazy(() => import("./pages/AlbumDetailPage.jsx"));
const AttendancePage = lazy(() => import("./pages/AttendancePage.jsx"));
const BlogDetailPage = lazy(() => import("./pages/BlogDetailPage.jsx"));
const BlogsPage = lazy(() => import("./pages/BlogsPage.jsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.jsx"));
const ChiefContentDashboardPage = lazy(() => import("./pages/ChiefContentDashboardPage.jsx"));
const GalleryPage = lazy(() => import("./pages/GalleryPage.jsx"));
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

function RouteFallback() {
  return <BrandedLoader label="Preparing page" />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="blogs" element={<BlogsPage />} />
            <Route path="blogs/:slug" element={<BlogDetailPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="gallery/:albumId" element={<AlbumDetailPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route
              path="chiefs"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="chiefs/attendance"
              element={
                <ProtectedRoute allowedRoles={["chief", "admin"]}>
                  <AttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="chiefs/content"
              element={
                <ProtectedRoute allowedRoles={["chief", "admin"]} requirePublisher>
                  <ChiefContentDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="admin/chief-attendance"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminChiefAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={["chief", "admin"]}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}
