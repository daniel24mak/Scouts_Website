const COMPLETE_STATUSES = new Set(["completed", "resolved", "approved", "rejected", "cancelled", "submitted"]);
const URGENCY_RANK = Object.freeze({ overdue: 0, "action-required": 1, "due-soon": 2, normal: 3 });

function validDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function getUrgency(task, now) {
  if (task.urgency && Object.hasOwn(URGENCY_RANK, task.urgency)) return task.urgency;
  const dueAt = validDate(task.dueDate ?? task.due_at);
  if (!dueAt) return task.status === "action_required" ? "action-required" : "normal";
  const remaining = Date.parse(dueAt) - now.getTime();
  if (remaining < 0) return "overdue";
  return remaining <= 3 * 24 * 60 * 60 * 1000 ? "due-soon" : "normal";
}

export function normalizeMyWorkTask(task = {}, providerKey = "workspace", now = new Date()) {
  const sourceId = String(task.id ?? task.sourceId ?? "").trim();
  const workspaceKey = String(task.workspaceKey ?? task.workspace_key ?? "scouting").trim().toLowerCase();
  const status = String(task.status ?? "open").trim().toLowerCase();
  return {
    id: `${providerKey}:${sourceId}`,
    providerKey,
    workspaceKey,
    title: String(task.title ?? "Action required").trim(),
    taskType: String(task.taskType ?? task.type ?? "task").trim().toLowerCase(),
    status,
    urgency: getUrgency({ ...task, status }, now),
    dueDate: validDate(task.dueDate ?? task.due_at),
    relatedLabel: String(task.relatedLabel ?? task.related_label ?? "").trim(),
    requiredPermission: task.requiredPermission ?? task.required_permission ?? null,
    scope: task.scope ?? null,
    href: String(task.href ?? task.deepLink ?? task.deep_link ?? `/dashboard/${workspaceKey}`).trim()
  };
}

export function combineMyWorkTasks(providerResults = {}, { now = new Date() } = {}) {
  return Object.entries(providerResults)
    .flatMap(([providerKey, tasks]) => (Array.isArray(tasks) ? tasks : []).map((task) => normalizeMyWorkTask(task, providerKey, now)))
    .filter((task) => task.id.split(":")[1] && task.title && !COMPLETE_STATUSES.has(task.status))
    .sort((left, right) => {
      const urgency = URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency];
      if (urgency) return urgency;
      const leftDue = left.dueDate ? Date.parse(left.dueDate) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueDate ? Date.parse(right.dueDate) : Number.POSITIVE_INFINITY;
      return leftDue - rightDue || left.title.localeCompare(right.title);
    });
}

export function filterTasksForAccess(tasks = [], {
  workspaceKey = null,
  allowedWorkspaceKeys = [],
  permissionKeys = []
} = {}) {
  const workspaces = new Set(allowedWorkspaceKeys);
  const permissions = new Set(permissionKeys);
  return tasks.filter((task) => {
    if (!workspaces.has(task.workspaceKey)) return false;
    if (workspaceKey && task.workspaceKey !== workspaceKey) return false;
    if (task.requiredPermission && !permissions.has(task.requiredPermission)) return false;
    const canonicalRoot = `/dashboard/${task.workspaceKey}`;
    return task.href === canonicalRoot || task.href.startsWith(`${canonicalRoot}/`);
  });
}
