import { getFormsData } from "../services/formService.js";
import { getCurrentSupabaseUserId, getSupabaseRows } from "../services/supabaseClient.js";
import { combineMyWorkTasks } from "./myWorkModel.js";

const providers = new Map();

export function registerMyWorkProvider(key, provider) {
  if (!key || typeof provider !== "function") throw new TypeError("A provider key and loader are required.");
  providers.set(key, provider);
  return () => providers.delete(key);
}

function isFormTargetedToUser(form, userId) {
  if (form.targetType === "users") return form.targetUserIds.includes(userId);
  return form.targetType === "all_chiefs" || form.targetType === "groups";
}

async function loadFormTasks({ userId }) {
  const { postedForms, submissions } = await getFormsData();
  const mine = submissions.filter((submission) => submission.submittedBy === userId);
  return postedForms
    .filter((form) => form.approvalStatus === "open" && isFormTargetedToUser(form, userId))
    .filter((form) => !mine.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))
    .map((form) => {
      const draft = mine.find((submission) => submission.postedFormId === form.id && submission.approvalStatus === "draft");
      return {
        id: form.id,
        workspaceKey: "scouting",
        title: form.title,
        type: draft ? "form-draft" : "form",
        status: "open",
        dueDate: form.dueDate,
        relatedLabel: draft ? "Draft saved" : "Form response",
        href: "/dashboard/scouting/my-forms"
      };
    });
}

async function loadWorkflowTasks({ userId }) {
  const rows = await getSupabaseRows(
    "workspace_tasks",
    `select=*&assigned_to=eq.${encodeURIComponent(userId)}&status=in.(open,in_progress)&order=due_at.asc.nullslast`
  ).catch((error) => {
    if (/workspace_tasks|schema cache|PGRST205/i.test(error?.message ?? "")) return [];
    throw error;
  });
  return rows.map((row) => ({
    id: row.id,
    workspaceKey: row.workspace_key,
    title: row.title,
    type: row.task_type,
    status: row.status,
    urgency: row.urgency,
    dueDate: row.due_at,
    relatedLabel: row.related_label,
    requiredPermission: row.required_permission,
    scope: row.permission_scope,
    href: row.deep_link
  }));
}

registerMyWorkProvider("forms", loadFormTasks);
registerMyWorkProvider("workflow", loadWorkflowTasks);
registerMyWorkProvider("attendance", async () => []);

export async function getMyWorkTasks(context = {}) {
  const userId = context.userId ?? await getCurrentSupabaseUserId();
  if (!userId) return [];
  const results = await Promise.all([...providers.entries()].map(async ([key, provider]) => {
    try {
      return [key, await provider({ ...context, userId })];
    } catch (error) {
      return [key, { error }];
    }
  }));
  const failed = results.filter(([, value]) => !Array.isArray(value));
  const successful = Object.fromEntries(results.filter(([, value]) => Array.isArray(value)));
  if (!Object.keys(successful).length && failed.length) throw failed[0][1].error;
  return combineMyWorkTasks(successful);
}
