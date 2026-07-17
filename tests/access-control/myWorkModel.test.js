import assert from "node:assert/strict";
import test from "node:test";
import {
  combineMyWorkTasks,
  filterTasksForAccess,
  normalizeMyWorkTask
} from "../../src/workspaces/myWorkModel.js";

const now = new Date("2026-07-17T08:00:00.000Z");

test("normalizes provider records into a stable task contract", () => {
  assert.deepEqual(normalizeMyWorkTask({
    id: "form-1",
    workspaceKey: "scouting",
    title: "Complete camp review",
    type: "form",
    dueDate: "2026-07-18T08:00:00.000Z",
    href: "/dashboard/scouting/my-forms",
    requiredPermission: "forms.respond"
  }, "forms", now), {
    id: "forms:form-1",
    providerKey: "forms",
    workspaceKey: "scouting",
    title: "Complete camp review",
    taskType: "form",
    status: "open",
    urgency: "due-soon",
    dueDate: "2026-07-18T08:00:00.000Z",
    relatedLabel: "",
    requiredPermission: "forms.respond",
    scope: null,
    href: "/dashboard/scouting/my-forms"
  });
});

test("combines providers, removes completed tasks, and orders overdue work first", () => {
  const tasks = combineMyWorkTasks({
    forms: [
      { id: "future", title: "Future form", workspaceKey: "scouting", dueDate: "2026-07-30T08:00:00.000Z" },
      { id: "done", title: "Done", workspaceKey: "scouting", status: "completed" }
    ],
    approvals: [{ id: "late", title: "Late approval", workspaceKey: "finance", dueDate: "2026-07-16T08:00:00.000Z" }]
  }, { now });

  assert.deepEqual(tasks.map((task) => task.id), ["approvals:late", "forms:future"]);
  assert.equal(tasks[0].urgency, "overdue");
});

test("filters by workspace and revalidates permission-scoped deep links", () => {
  const tasks = [
    normalizeMyWorkTask({ id: "a", title: "Finance", workspaceKey: "finance", href: "/dashboard/finance/reconciliation", requiredPermission: "finance.reconciliation.view" }, "workflow", now),
    normalizeMyWorkTask({ id: "b", title: "Storage", workspaceKey: "storage", href: "/dashboard/storage/audits", requiredPermission: "storage.audits.view" }, "workflow", now),
    normalizeMyWorkTask({ id: "c", title: "Unsafe", workspaceKey: "finance", href: "/dashboard/storage/audits" }, "workflow", now)
  ];

  const visible = filterTasksForAccess(tasks, {
    workspaceKey: "finance",
    allowedWorkspaceKeys: ["finance", "storage"],
    permissionKeys: ["finance.reconciliation.view"]
  });

  assert.deepEqual(visible.map((task) => task.id), ["workflow:a"]);
});
