import { AlertCircle, CalendarClock, CheckCircle2, ClipboardCheck, ListTodo } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { getMyEffectiveAccess } from "../services/accessControlService.js";
import FocusedWorkspaceShell from "./FocusedWorkspaceShell.jsx";
import { filterTasksForAccess } from "./myWorkModel.js";
import { getMyWorkTasks } from "./myWorkService.js";
import { getAvailableWorkspaces } from "./workspaceAccess.js";
import "./myWork.css";

const navigation = [{ key: "my-work", label: "My Work", Icon: ListTodo }];

function permissionKeys(access) {
  return [...new Set((access?.permissions ?? []).map((permission) => permission.key).filter(Boolean))];
}

function formatDue(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(value));
}

export default function MyWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", tasks: [], access: null });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([getMyEffectiveAccess(), getMyWorkTasks({ userId: user?.id })])
      .then(([access, tasks]) => { if (!cancelled) setState({ loading: false, error: "", tasks, access }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, tasks: [], access: null }); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const workspaces = useMemo(() => getAvailableWorkspaces({ user, effectiveAccess: state.access?.loadError ? undefined : state.access }), [state.access, user]);
  const switcherWorkspaces = useMemo(() => [{ key: "my-work", label: "My Work" }, ...workspaces], [workspaces]);
  const tasks = useMemo(() => filterTasksForAccess(state.tasks, {
    allowedWorkspaceKeys: workspaces.map(({ key }) => key),
    permissionKeys: permissionKeys(state.access)
  }), [state.access, state.tasks, workspaces]);

  return <FocusedWorkspaceShell workspaceKey="my-work" workspaceLabel="My Work" workspaceIcon={ListTodo} workspaces={switcherWorkspaces} onWorkspaceChange={(key) => navigate(key === "my-work" ? "/dashboard/my-work" : `/dashboard/${key}`)} navigation={navigation} activeSection="my-work">
    <header className="my-work-heading"><div><span>One focused queue</span><h1>My Work</h1><p>Forms, approvals, and assigned actions from every workspace you can access.</p></div><strong>{tasks.length}</strong></header>
    {state.loading ? <section className="my-work-state" aria-live="polite"><ListTodo size={28} /><h2>Loading your work</h2><p>Checking current assignments and permissions.</p><div className="my-work-loading" /></section> : null}
    {!state.loading && state.error ? <section className="my-work-state error" role="alert"><AlertCircle size={28} /><h2>Your work could not be loaded</h2><p>{state.error}</p><button type="button" onClick={() => window.location.reload()}>Reload dashboard</button></section> : null}
    {!state.loading && !state.error && !tasks.length ? <section className="my-work-state"><CheckCircle2 size={30} /><h2>You are all caught up</h2><p>New assigned work will appear here automatically.</p></section> : null}
    {!state.loading && !state.error && tasks.length ? <div className="my-work-list">{tasks.map((task) => <article key={task.id} className={`my-work-card urgency-${task.urgency}`}><div className="my-work-task-icon">{task.taskType.includes("approval") ? <ClipboardCheck /> : <CalendarClock />}</div><div><div className="my-work-meta"><span>{task.workspaceKey}</span><span>{task.urgency.replaceAll("-", " ")}</span></div><h2>{task.title}</h2><p>{task.relatedLabel || "Assigned action"}</p><small>{formatDue(task.dueDate)}</small></div><button type="button" onClick={() => navigate(task.href)}>Open</button></article>)}</div> : null}
  </FocusedWorkspaceShell>;
}
