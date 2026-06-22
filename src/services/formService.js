import { deleteSupabaseRows, getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow, patchSupabaseRows } from "./supabaseClient.js";

function jsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export const formQuestionTypes = [
  ["short_text", "Short text"],
  ["long_text", "Long text"],
  ["number", "Number"],
  ["rating", "Rating scale 1-5"],
  ["yes_no", "Yes / No"],
  ["multiple_choice", "Multiple choice"],
  ["checkboxes", "Checkboxes"],
  ["dropdown", "Dropdown"],
  ["date", "Date"]
];

export function blankFormSchema() {
  return {
    questions: [
      {
        id: crypto.randomUUID(),
        type: "short_text",
        text: "Untitled question",
        required: false,
        options: []
      }
    ]
  };
}

export function normalizeFormTemplate(template) {
  return {
    id: template.id,
    title: template.title ?? "Untitled form template",
    description: template.description ?? "",
    status: template.status ?? "draft",
    currentVersionId: template.current_version_id ?? template.currentVersionId ?? null,
    schemaJson: jsonValue(template.schema_json ?? template.schemaJson, blankFormSchema()),
    createdBy: template.created_by ?? template.createdBy ?? null,
    updatedBy: template.updated_by ?? template.updatedBy ?? null,
    createdAt: template.created_at ?? template.createdAt ?? null,
    updatedAt: template.updated_at ?? template.updatedAt ?? null,
    archivedAt: template.archived_at ?? template.archivedAt ?? null
  };
}

export function normalizeTemplateVersion(version) {
  return {
    id: version.id,
    templateId: version.template_id ?? version.templateId,
    versionNumber: version.version_number ?? version.versionNumber ?? 1,
    title: version.title ?? "Untitled form template",
    description: version.description ?? "",
    schemaJson: jsonValue(version.schema_json ?? version.schemaJson, blankFormSchema()),
    createdBy: version.created_by ?? version.createdBy ?? null,
    createdAt: version.created_at ?? version.createdAt ?? null
  };
}

export function normalizePostedForm(form) {
  return {
    id: form.id,
    templateId: form.template_id ?? form.templateId ?? null,
    templateVersionId: form.template_version_id ?? form.templateVersionId ?? null,
    title: form.title ?? "Untitled posted form",
    description: form.description ?? "",
    instructions: form.instructions ?? "",
    schemaJson: jsonValue(form.schema_json ?? form.schemaJson, blankFormSchema()),
    approvalStatus: form.status ?? form.approvalStatus ?? "draft",
    targetType: form.target_type ?? form.targetType ?? "all_chiefs",
    targetGroupIds: jsonValue(form.target_group_ids ?? form.targetGroupIds, []),
    targetUserIds: jsonValue(form.target_user_ids ?? form.targetUserIds, []),
    linkedEventId: form.linked_event_id ?? form.linkedEventId ?? null,
    dueDate: form.due_date ?? form.dueDate ?? null,
    allowEdits: Boolean(form.allow_edits ?? form.allowEdits ?? true),
    generateAiSummary: Boolean(form.generate_ai_summary ?? form.generateAiSummary ?? false),
    createdBy: form.created_by ?? form.createdBy ?? null,
    approvedBy: form.approved_by ?? form.approvedBy ?? null,
    postedAt: form.posted_at ?? form.postedAt ?? null,
    closedBy: form.closed_by ?? form.closedBy ?? null,
    closedAt: form.closed_at ?? form.closedAt ?? null,
    reviewerComment: form.reviewer_comment ?? form.reviewerComment ?? "",
    createdAt: form.created_at ?? form.createdAt ?? null,
    updatedAt: form.updated_at ?? form.updatedAt ?? null,
    contentType: "Posted form"
  };
}

export function normalizeFormSubmission(submission) {
  return {
    id: submission.id,
    postedFormId: submission.posted_form_id ?? submission.postedFormId,
    submittedBy: submission.submitted_by ?? submission.submittedBy,
    groupId: submission.group_id ?? submission.groupId ?? null,
    answersJson: jsonValue(submission.answers_json ?? submission.answersJson, {}),
    approvalStatus: submission.status ?? submission.approvalStatus ?? "draft",
    submittedAt: submission.submitted_at ?? submission.submittedAt ?? null,
    editedAt: submission.edited_at ?? submission.editedAt ?? null,
    lockedAt: submission.locked_at ?? submission.lockedAt ?? null,
    createdAt: submission.created_at ?? submission.createdAt ?? null,
    updatedAt: submission.updated_at ?? submission.updatedAt ?? null
  };
}

export function normalizeFormAiSummary(summary) {
  return {
    id: summary.id,
    postedFormId: summary.posted_form_id ?? summary.postedFormId,
    status: summary.status ?? "not_configured",
    summaryJson: jsonValue(summary.summary_json ?? summary.summaryJson, null),
    createdAt: summary.created_at ?? summary.createdAt ?? null,
    updatedAt: summary.updated_at ?? summary.updatedAt ?? null
  };
}

export async function getFormsData() {
  const [templates, versions, postedForms, submissions, aiSummaries] = await Promise.all([
    getSupabaseRows("form_templates", "select=*&order=updated_at.desc"),
    getSupabaseRows("form_template_versions", "select=*&order=created_at.desc"),
    getSupabaseRows("posted_forms", "select=*&order=updated_at.desc"),
    getSupabaseRows("form_submissions", "select=*&order=updated_at.desc"),
    getSupabaseRows("form_ai_summaries", "select=*&order=updated_at.desc")
  ]);

  return {
    formTemplates: templates.map(normalizeFormTemplate),
    formTemplateVersions: versions.map(normalizeTemplateVersion),
    postedForms: postedForms.map(normalizePostedForm),
    formSubmissions: submissions.map(normalizeFormSubmission),
    formAiSummaries: aiSummaries.map(normalizeFormAiSummary)
  };
}

async function insertTemplateVersion(templateId, payload) {
  const existing = await getSupabaseRows("form_template_versions", `select=id,version_number&template_id=eq.${encodeURIComponent(templateId)}&order=version_number.desc&limit=1`);
  const versionNumber = Number(existing[0]?.version_number ?? 0) + 1;
  const [version] = await insertSupabaseRow("form_template_versions", {
    template_id: templateId,
    version_number: versionNumber,
    title: payload.title,
    description: payload.description ?? "",
    schema_json: payload.schemaJson,
    created_by: getCurrentSupabaseUserId()
  });
  await patchSupabaseRows("form_templates", `id=eq.${encodeURIComponent(templateId)}`, { current_version_id: version.id, updated_at: new Date().toISOString() });
  return version;
}

export async function saveFormTemplate(payload) {
  const userId = getCurrentSupabaseUserId();
  if (payload.id) {
    const [template] = await patchSupabaseRows("form_templates", `id=eq.${encodeURIComponent(payload.id)}`, {
      title: payload.title,
      description: payload.description ?? "",
      status: payload.status ?? "draft",
      schema_json: payload.schemaJson,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      archived_at: payload.status === "archived" ? new Date().toISOString() : null
    });
    await insertTemplateVersion(payload.id, payload);
    return normalizeFormTemplate(template);
  }

  const [template] = await insertSupabaseRow("form_templates", {
    title: payload.title,
    description: payload.description ?? "",
    status: payload.status ?? "draft",
    schema_json: payload.schemaJson,
    created_by: userId,
    updated_by: userId
  });
  await insertTemplateVersion(template.id, payload);
  return normalizeFormTemplate(template);
}


export async function deleteFormTemplateCascade(templateId) {
  await patchSupabaseRows("posted_forms", `template_id=eq.${encodeURIComponent(templateId)}`, { template_id: null, template_version_id: null, updated_at: new Date().toISOString() });
  await deleteSupabaseRows("form_template_versions", `template_id=eq.${encodeURIComponent(templateId)}`);
  return deleteSupabaseRows("form_templates", `id=eq.${encodeURIComponent(templateId)}`);
}

export async function savePostedForm(payload) {
  const userId = getCurrentSupabaseUserId();
  const row = {
    template_id: payload.templateId ?? null,
    template_version_id: payload.templateVersionId ?? null,
    title: payload.title,
    description: payload.description ?? "",
    instructions: payload.instructions ?? "",
    schema_json: payload.schemaJson,
    status: payload.approvalStatus ?? payload.status ?? "pending",
    target_type: payload.targetType ?? "all_chiefs",
    target_group_ids: payload.targetGroupIds ?? [],
    target_user_ids: payload.targetUserIds ?? [],
    linked_event_id: payload.linkedEventId || null,
    due_date: payload.dueDate || null,
    allow_edits: payload.allowEdits ?? true,
    generate_ai_summary: payload.generateAiSummary ?? false,
    reviewer_comment: payload.reviewerComment ?? "",
    updated_at: new Date().toISOString()
  };

  if (row.status === "open" && !payload.postedAt) {
    row.posted_at = new Date().toISOString();
    row.approved_by = userId;
  }

  if (payload.id) {
    const [form] = await patchSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(payload.id)}`, row);
    return normalizePostedForm(form);
  }

  const [form] = await insertSupabaseRow("posted_forms", {
    ...row,
    created_by: userId
  });
  return normalizePostedForm(form);
}

export async function updatePostedFormReview(formId, status, reviewerComment = "") {
  const now = new Date().toISOString();
  const row = {
    status,
    reviewer_comment: reviewerComment,
    updated_at: now
  };

  if (status === "open" || status === "approved") {
    row.status = "open";
    row.approved_by = getCurrentSupabaseUserId();
    row.posted_at = now;
  }

  const [form] = await patchSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(formId)}`, row);
  return normalizePostedForm(form);
}

export async function closePostedForm(formId) {
  const now = new Date().toISOString();
  const [form] = await patchSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(formId)}`, {
    status: "closed",
    closed_by: getCurrentSupabaseUserId(),
    closed_at: now,
    updated_at: now
  });
  await patchSupabaseRows("form_submissions", `posted_form_id=eq.${encodeURIComponent(formId)}`, { locked_at: now, updated_at: now });
  return normalizePostedForm(form);
}


export async function reopenPostedForm(formId) {
  const now = new Date().toISOString();
  const [form] = await patchSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(formId)}`, {
    status: "open",
    closed_by: null,
    closed_at: null,
    posted_at: now,
    approved_by: getCurrentSupabaseUserId(),
    updated_at: now
  });
  await patchSupabaseRows("form_submissions", `posted_form_id=eq.${encodeURIComponent(formId)}`, { locked_at: null, updated_at: now });
  return normalizePostedForm(form);
}

export async function deletePostedFormCascade(formId) {
  await deleteSupabaseRows("form_ai_summaries", `posted_form_id=eq.${encodeURIComponent(formId)}`);
  await deleteSupabaseRows("form_submissions", `posted_form_id=eq.${encodeURIComponent(formId)}`);
  return deleteSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(formId)}`);
}

export async function saveFormSubmission(payload) {
  const now = new Date().toISOString();
  const status = payload.status ?? "submitted";
  const existing = await getSupabaseRows(
    "form_submissions",
    `select=*&posted_form_id=eq.${encodeURIComponent(payload.postedFormId)}&submitted_by=eq.${encodeURIComponent(payload.submittedBy)}&limit=1`
  );
  const row = {
    posted_form_id: payload.postedFormId,
    submitted_by: payload.submittedBy,
    group_id: payload.groupId || null,
    answers_json: payload.answersJson ?? {},
    status,
    submitted_at: status === "submitted" ? (existing[0]?.submitted_at ?? now) : existing[0]?.submitted_at ?? null,
    edited_at: existing[0] ? now : null,
    updated_at: now
  };

  if (existing[0]) {
    const [submission] = await patchSupabaseRows("form_submissions", `id=eq.${encodeURIComponent(existing[0].id)}`, row);
    return normalizeFormSubmission(submission);
  }

  const [submission] = await insertSupabaseRow("form_submissions", row);
  return normalizeFormSubmission(submission);
}
