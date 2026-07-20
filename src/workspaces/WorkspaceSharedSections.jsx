import { AlertCircle, Bell, CheckCheck, CheckCircle2, ClipboardCheck, FileClock, ListTodo, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { getWorkspaceAuditLogs } from "../services/auditService.js";
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService.js";
import { filterTasksForAccess } from "./myWorkModel.js";
import { getMyWorkTasks } from "./myWorkService.js";
import "./myWork.css";
import "./workspaceSharedSections.css";

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(value))
  : "Not recorded";

const permissionKeys = (access) => [...new Set((access?.permissions ?? [])
  .map((permission) => permission.key ?? permission.permissionKey ?? permission.permission_id)
  .filter(Boolean))];

function SharedState({ icon: Icon, title, message, error = false, action = null }) {
  return <section className={`workspace-shared-state ${error ? "error" : ""}`} role={error ? "alert" : undefined}>
    <Icon size={29} aria-hidden="true" /><h2>{title}</h2><p>{message}</p>{action}
  </section>;
}

export function WorkspaceMyWork({ workspaceKey, effectiveAccess }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", tasks: [] });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", tasks: [] });
    getMyWorkTasks({ userId: user?.id })
      .then((tasks) => { if (!cancelled) setState({ loading: false, error: "", tasks }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, tasks: [] }); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const tasks = useMemo(() => filterTasksForAccess(state.tasks, {
    workspaceKey,
    allowedWorkspaceKeys: [workspaceKey],
    permissionKeys: permissionKeys(effectiveAccess)
  }), [effectiveAccess, state.tasks, workspaceKey]);

  if (state.loading) return <SharedState icon={ListTodo} title="Loading your work" message={`Checking your current ${workspaceKey} assignments.`} />;
  if (state.error) return <SharedState icon={AlertCircle} title="Your work could not be loaded" message={state.error} error />;
  if (!tasks.length) return <SharedState icon={CheckCircle2} title="You are all caught up" message={`No ${workspaceKey} actions need your attention right now.`} />;

  return <div className="workspace-shared-list">{tasks.map((task) => <article key={task.id} className={`workspace-shared-row urgency-${task.urgency}`}>
    <div className="workspace-shared-row-icon"><ClipboardCheck size={20} /></div>
    <div><span>{task.urgency.replaceAll("-", " ")}</span><h2>{task.title}</h2><p>{task.relatedLabel || "Assigned action"}</p><small>{task.dueDate ? formatDate(task.dueDate) : "No due date"}</small></div>
    <button type="button" onClick={() => navigate(task.href)}>Open</button>
  </article>)}</div>;
}

export function WorkspaceNotifications({ workspaceLabel }) {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const items = await getNotifications();
      setState({ loading: false, error: "", items });
    } catch (error) {
      setState({ loading: false, error: error.message, items: [] });
    }
  };
  useEffect(() => { load(); }, []);

  const updateItem = async (id) => {
    await markNotificationRead(id);
    setState((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, isRead: true } : item) }));
  };
  const removeItem = async (id) => {
    await deleteNotification(id);
    setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  };
  const readAll = async () => {
    await markAllNotificationsRead();
    setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, isRead: true })) }));
  };

  if (state.loading) return <SharedState icon={Bell} title="Loading notifications" message="Checking your latest updates." />;
  if (state.error) return <SharedState icon={AlertCircle} title="Notifications could not be loaded" message={state.error} error />;

  return <section className="workspace-notifications">
    <div className="workspace-shared-toolbar"><p>Updates relevant to your dashboard account while you remain in {workspaceLabel}.</p>{state.items.some((item) => !item.isRead) ? <button type="button" onClick={readAll}><CheckCheck size={17} />Mark all read</button> : null}</div>
    {!state.items.length ? <SharedState icon={CheckCircle2} title="No notifications" message="New updates will appear here automatically." /> : <div className="workspace-shared-list">{state.items.map((item) => <article key={item.id} className={`workspace-shared-row notification ${item.isRead ? "read" : "unread"}`}>
      <div className="workspace-shared-row-icon"><Bell size={19} /></div>
      <div><span>{item.type.replaceAll("_", " ")}</span><h2>{item.title}</h2><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div>
      <div className="workspace-shared-actions">{!item.isRead ? <button type="button" onClick={() => updateItem(item.id)}>Mark read</button> : null}<button type="button" className="danger-icon" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item.id)}><Trash2 size={17} /></button></div>
    </article>)}</div>}
  </section>;
}

function metadataSummary(metadata) {
  return Object.entries(metadata ?? {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 3)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
    .join(" · ");
}

export function WorkspaceActivityLog({ workspaceKey, workspaceLabel }) {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });
  const [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", rows: [] });
    getWorkspaceAuditLogs(workspaceKey)
      .then((rows) => { if (!cancelled) setState({ loading: false, error: "", rows }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, rows: [] }); });
    return () => { cancelled = true; };
  }, [workspaceKey]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.rows;
    return state.rows.filter((row) => [row.action, row.resourceType, row.resourceId, row.outcome, row.reason, metadataSummary(row.metadata)].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [query, state.rows]);

  if (state.loading) return <SharedState icon={FileClock} title={`Loading ${workspaceLabel} reports`} message="Reading the latest workspace activity log." />;
  if (state.error) return <SharedState icon={AlertCircle} title="Activity log could not be loaded" message={state.error} error />;

  return <section className="workspace-activity-log">
    <div className="workspace-shared-toolbar"><p>Recorded {workspaceLabel} actions, newest first.</p><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity logs" aria-label={`Search ${workspaceLabel} activity logs`} /></div>
    {!rows.length ? <SharedState icon={FileClock} title="No matching activity" message={query ? "Try a different search." : `${workspaceLabel} actions will appear here as they are recorded.`} /> : <div className="workspace-log-table"><table><thead><tr><th>Time</th><th>Action</th><th>Record</th><th>Result</th><th>Details</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.createdAt)}</td><td>{row.action.replaceAll(".", " ").replaceAll("_", " ")}</td><td><strong>{row.resourceType.replaceAll("_", " ")}</strong>{row.resourceId ? <small>{row.resourceId}</small> : null}</td><td><span className={`workspace-log-outcome ${row.outcome}`}>{row.outcome}</span></td><td>{row.reason || metadataSummary(row.metadata) || "—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
