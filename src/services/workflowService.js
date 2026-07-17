import { callSupabaseRpc, getSupabaseRows } from "./supabaseClient.js";

export async function getAssignedWorkflowTasks(userId) {
  if (!userId) return [];
  return getSupabaseRows("workspace_tasks", `select=*&assigned_to=eq.${encodeURIComponent(userId)}&status=in.(open,in_progress)&order=due_at.asc.nullslast`);
}

export function startWorkspaceWorkflow({ templateKey, sourceType, sourceId, title, context = {} }) {
  return callSupabaseRpc("start_workspace_workflow", {
    target_template_key: templateKey,
    target_source_type: sourceType,
    target_source_id: sourceId,
    target_title: title,
    target_context: context
  });
}

export function decideWorkflowAssignment(assignmentId, decision, comment = "") {
  return callSupabaseRpc("decide_workspace_workflow", {
    target_assignment_id: assignmentId,
    target_decision: decision,
    target_comment: comment || null
  });
}

export function completeWorkspaceTask(taskId) {
  return callSupabaseRpc("complete_workspace_task", { target_task_id: taskId });
}
