import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AlbumDetailPage from "./pages/AlbumDetailPage.jsx";
import AdminChiefAttendancePage from "./pages/AdminChiefAttendancePage.jsx";
import AttendancePage from "./pages/AttendancePage.jsx";
import BlogDetailPage from "./pages/BlogDetailPage.jsx";
import BlogsPage from "./pages/BlogsPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import ChiefContentDashboardPage from "./pages/ChiefContentDashboardPage.jsx";
import GalleryPage from "./pages/GalleryPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
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
    </AuthProvider>
  );
}
