import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import BrandedLoader from "../components/BrandedLoader.jsx";
import { getMyEffectiveAccess } from "../services/accessControlService.js";
import { getAvailableWorkspaces, resolveWorkspaceDestination } from "./workspaceAccess.js";
import { buildWorkspaceSectionPath, getWorkspaceSectionFromPath } from "./workspaceRouting.js";
import { getCanonicalWorkspaceSection, getSafeWorkspaceSection } from "./workspaceNavigation.js";

const LAST_WORKSPACE_KEY = "scouts-dashboard-last-workspace";
const LAST_ROUTES_KEY = "scouts-dashboard-workspace-routes";
const FinanceWorkspace = lazy(() => import("../features/finance/FinanceWorkspace.jsx"));
const StorageWorkspace = lazy(() => import("../features/storage/StorageWorkspace.jsx"));

function readStoredRoutes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAST_ROUTES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function WorkspaceDevelopmentState({ workspace }) {
  return (
    <main className="page-section narrow" aria-labelledby="workspace-title">
      <p className="eyebrow">{workspace.label} workspace</p>
      <h1 id="workspace-title">Preparing your workspace</h1>
      <p>This workspace is being connected to its permission-scoped tools.</p>
    </main>
  );
}

export default function DashboardWorkspaceRoute({ DashboardComponent }) {
  const { workspace: requestedWorkspace } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [effectiveAccess, setEffectiveAccess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getMyEffectiveAccess()
      .then((access) => {
        if (!cancelled) setEffectiveAccess(access?.loadError ? undefined : access);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const availableWorkspaces = useMemo(() => getAvailableWorkspaces({ user, effectiveAccess }), [effectiveAccess, user]);
  const destination = useMemo(() => resolveWorkspaceDestination({
    user,
    effectiveAccess,
    requestedWorkspace,
    lastWorkspace: window.localStorage.getItem(LAST_WORKSPACE_KEY),
    lastRoutes: readStoredRoutes()
  }), [effectiveAccess, requestedWorkspace, user]);

  useEffect(() => {
    if (!destination || destination.workspaceKey !== requestedWorkspace) return;
    window.localStorage.setItem(LAST_WORKSPACE_KEY, destination.workspaceKey);
    const routes = readStoredRoutes();
    routes[destination.workspaceKey] = location.pathname;
    window.localStorage.setItem(LAST_ROUTES_KEY, JSON.stringify(routes));
  }, [destination, location.pathname, requestedWorkspace]);

  if (isLoading) return <BrandedLoader label="Opening dashboard workspace" />;
  if (!destination) return <Navigate to="/" replace />;
  if (!requestedWorkspace || destination.workspaceKey !== requestedWorkspace) {
    return <Navigate to={destination.path} replace />;
  }

  const workspace = availableWorkspaces.find(({ key }) => key === destination.workspaceKey);
  const requestedSection = getWorkspaceSectionFromPath(location.pathname, workspace.key) ?? "overview";
  const section = getSafeWorkspaceSection(workspace.key, requestedSection);
  const canonicalSection = getCanonicalWorkspaceSection(workspace.key, requestedSection);
  if (requestedSection !== canonicalSection) return <Navigate to={buildWorkspaceSectionPath(workspace.key, canonicalSection)} replace />;
  const switchWorkspace = (nextWorkspace) => {
    const next = resolveWorkspaceDestination({
      user,
      effectiveAccess,
      requestedWorkspace: nextWorkspace,
      lastRoutes: readStoredRoutes()
    });
    if (next) navigate(next.path);
  };
  const changeSection = (nextSection) => {
    const path = buildWorkspaceSectionPath(workspace.key, nextSection);
    if (path && path !== location.pathname) navigate(path);
  };

  if (["scouting", "admin", "media"].includes(workspace.key)) {
    return (
      <DashboardComponent
        key={workspace.key}
        initialSection={section}
        workspaceKey={workspace.key}
        availableWorkspaces={availableWorkspaces}
        onWorkspaceChange={switchWorkspace}
        onSectionChange={changeSection}
      />
    );
  }

  if (workspace.key === "finance") {
    return (
      <Suspense fallback={<BrandedLoader label="Opening Finance workspace" />}>
        <FinanceWorkspace
          key={workspace.key}
          section={section}
          effectiveAccess={effectiveAccess}
          availableWorkspaces={availableWorkspaces}
          onWorkspaceChange={switchWorkspace}
          onSectionChange={changeSection}
        />
      </Suspense>
    );
  }

  if (workspace.key === "storage") {
    return (
      <Suspense fallback={<BrandedLoader label="Opening Storage workspace" />}>
        <StorageWorkspace key={workspace.key} section={section} effectiveAccess={effectiveAccess} availableWorkspaces={availableWorkspaces} onWorkspaceChange={switchWorkspace} onSectionChange={changeSection} />
      </Suspense>
    );
  }

  return <WorkspaceDevelopmentState workspace={workspace} />;
}
