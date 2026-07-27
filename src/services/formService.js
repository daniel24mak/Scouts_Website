import { callSupabaseRpc, deleteSupabaseRows, getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow, patchSupabaseRows, upsertSupabaseRows } from "./supabaseClient.js";
import { normalizeRegistrationSettings } from "../features/registration/registrationModel.js";

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
  ["phone", "Phone number"],
  ["number", "Number"],
  ["rating", "Rating scale 1-5"],
  ["yes_no", "Yes / No"],
  ["multiple_choice", "Multiple choice"],
  ["checkboxes", "Checkboxes"],
  ["dropdown", "Dropdown"],
  ["date", "Date"],
  ["file_upload", "File upload"],
  ["image_upload", "Image upload"],
  ["protected_document_upload", "Protected document upload"],
  ["scout_headshot_upload", "Scout headshot upload"]
];

export function blankFormSchema() {
  const pageId = crypto.randomUUID();
  return {
    pages: [
      {
        id: pageId,
        title: "Page 1",
        description: "",
        order: 0,
        conditionalLogic: { enabled: false, sourceQuestionId: "", operator: "equals", value: "" }
      }
    ],
    questions: [
      {
        id: crypto.randomUUID(),
        pageId,
        order: 0,
        type: "short_text",
        text: "Untitled question",
        required: false,
        options: [],
        layout: { rowId: null, width: "full" },
        conditionalLogic: { enabled: false, sourceQuestionId: "", operator: "equals", value: "" }
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
  const schemaJson = jsonValue(form.schema_json ?? form.schemaJson, blankFormSchema());
  const behavior = schemaJson?.settings?.behavior ?? {};
  return {
    id: form.id,
    templateId: form.template_id ?? form.templateId ?? null,
    templateVersionId: form.template_version_id ?? form.templateVersionId ?? null,
    title: form.title ?? "Untitled posted form",
    description: form.description ?? "",
    instructions: form.instructions ?? "",
    schemaJson,
    approvalStatus: form.status ?? form.approvalStatus ?? "draft",
    targetType: form.target_type ?? form.targetType ?? "all_chiefs",
    targetGroupIds: jsonValue(form.target_group_ids ?? form.targetGroupIds, []),
    targetUserIds: jsonValue(form.target_user_ids ?? form.targetUserIds, []),
    linkedEventId: form.linked_event_id ?? form.linkedEventId ?? null,
    dueDate: form.due_date ?? form.dueDate ?? null,
    allowEdits: Boolean(form.allow_edits ?? form.allowEdits ?? true),
    generateAiSummary: Boolean(form.generate_ai_summary ?? form.generateAiSummary ?? false),
    formKind: form.form_kind ?? form.formKind ?? behavior.formKind ?? "standard",
    publicSlug: form.public_slug ?? form.publicSlug ?? null,
    publicAccessEnabled: Boolean(form.public_access_enabled ?? form.publicAccessEnabled ?? false),
    allowMultipleSubmissions: Boolean(form.allow_multiple_submissions ?? form.allowMultipleSubmissions ?? behavior.allowMultipleSubmissions ?? false),
    maxSubmissions: form.max_submissions ?? form.maxSubmissions ?? behavior.maxSubmissions ?? null,
    availableFrom: form.available_from ?? form.availableFrom ?? behavior.availableFrom ?? null,
    availableUntil: form.available_until ?? form.availableUntil ?? behavior.availableUntil ?? null,
    receiptRequired: Boolean(form.receipt_required ?? form.receiptRequired ?? behavior.receiptRequired ?? false),
    createdBy: form.created_by ?? form.createdBy ?? null,
    submittedBy: form.created_by ?? form.createdBy ?? form.submitted_by ?? form.submittedBy ?? null,
    approvedBy: form.approved_by ?? form.approvedBy ?? null,
    postedAt: form.posted_at ?? form.postedAt ?? null,
    closedBy: form.closed_by ?? form.closedBy ?? null,
    closedAt: form.closed_at ?? form.closedAt ?? null,
    reviewerComment: form.reviewer_comment ?? form.reviewerComment ?? "",
    createdAt: form.created_at ?? form.createdAt ?? null,
    updatedAt: form.updated_at ?? form.updatedAt ?? null,
    submitterName: form.creator?.full_name ?? form.submitterName ?? null,
    submitterProfilePictureUrl: form.creator?.profile_picture_url ?? form.submitterProfilePictureUrl ?? null,
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

export function normalizeReimbursement(reimbursement) {
  return {
    id: reimbursement.id,
    referenceNumber: reimbursement.reference_number ?? reimbursement.referenceNumber ?? "Pending",
    postedFormId: reimbursement.posted_form_id ?? reimbursement.postedFormId ?? null,
    formSubmissionId: reimbursement.form_submission_id ?? reimbursement.formSubmissionId ?? null,
    amount: Number(reimbursement.amount ?? 0),
    expenseDate: reimbursement.expense_date ?? reimbursement.expenseDate ?? null,
    status: reimbursement.status ?? "draft",
    paymentStatus: reimbursement.payment_status ?? reimbursement.paymentStatus ?? "not_scheduled",
    createdAt: reimbursement.created_at ?? reimbursement.createdAt ?? null,
    updatedAt: reimbursement.updated_at ?? reimbursement.updatedAt ?? null
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

export function normalizeRegistrationCampaign(campaign) {
  return {
    id: campaign.id,
    postedFormId: campaign.posted_form_id ?? campaign.postedFormId,
    status: campaign.status ?? "draft",
    settings: normalizeRegistrationSettings({
      seasonId: campaign.scout_year_id ?? campaign.seasonId,
      registrationTitle: campaign.title ?? campaign.registrationTitle,
      slug: campaign.slug,
      returningEnabled: campaign.returning_enabled ?? campaign.returningEnabled,
      newEnabled: campaign.new_enabled ?? campaign.newEnabled,
      returningOpensAt: campaign.returning_opens_at ?? campaign.returningOpensAt,
      newOpensAt: campaign.new_opens_at ?? campaign.newOpensAt,
      closesAt: campaign.closes_at ?? campaign.closesAt,
      showOpeningDate: campaign.show_opening_date ?? campaign.showOpeningDate,
      newScoutWaitlist: campaign.new_scout_waitlist ?? campaign.newScoutWaitlist,
      capacity: campaign.capacity,
      acceptedGroupIds: campaign.accepted_group_ids ?? campaign.acceptedGroupIds,
      minimumAge: campaign.minimum_age ?? campaign.minimumAge,
      maximumAge: campaign.maximum_age ?? campaign.maximumAge,
      birthYearFrom: campaign.birth_year_from ?? campaign.birthYearFrom,
      birthYearTo: campaign.birth_year_to ?? campaign.birthYearTo,
      requireHeadshot: campaign.require_headshot ?? campaign.requireHeadshot,
      requireIdFront: campaign.require_id_front ?? campaign.requireIdFront,
      requireIdBack: campaign.require_id_back ?? campaign.requireIdBack,
      requireVerification: campaign.require_verification ?? campaign.requireVerification,
      requireParentVerification: campaign.require_parent_verification ?? campaign.requireParentVerification,
      allowDrafts: campaign.allow_drafts ?? campaign.allowDrafts,
      privacyText: campaign.privacy_text ?? campaign.privacyText,
      consentText: campaign.consent_text ?? campaign.consentText,
      retentionText: campaign.retention_text ?? campaign.retentionText
    }),
    createdAt: campaign.created_at ?? campaign.createdAt ?? null,
    updatedAt: campaign.updated_at ?? campaign.updatedAt ?? null
  };
}

export async function getFormsData() {
  const [
    templates,
    versions,
    postedForms,
    submissions,
    aiSummaries,
    reimbursements,
    registrationCampaigns,
    registrationSubmissions,
    registrationPeople,
    registrationParents,
    registrationDocuments,
    registrationDuplicates,
    registrationReviews,
    scoutSeasonEnrollments,
    registrationStorageSummary
  ] = await Promise.all([
    getSupabaseRows("form_templates", "select=*&order=updated_at.desc"),
    getSupabaseRows("form_template_versions", "select=*&order=created_at.desc"),
    getSupabaseRows("posted_forms", "select=*,creator:user_profiles!posted_forms_created_by_fkey(full_name,profile_picture_url)&order=updated_at.desc").catch(() => getSupabaseRows("posted_forms", "select=*&order=updated_at.desc")),
    getSupabaseRows("form_submissions", "select=*&order=updated_at.desc"),
    getSupabaseRows("form_ai_summaries", "select=*&order=updated_at.desc"),
    getSupabaseRows("finance_reimbursements", "select=*&order=updated_at.desc").catch(() => []),
    getSupabaseRows("registration_campaigns", "select=*&order=updated_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_submissions", "select=*&order=submitted_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_people", "select=*").catch(() => []),
    getSupabaseRows("scout_registration_parent_contacts", "select=*").catch(() => []),
    getSupabaseRows("scout_registration_documents", "select=*&order=uploaded_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_duplicate_matches", "select=*&order=created_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_reviews", "select=*&order=reviewed_at.desc").catch(() => []),
    getSupabaseRows("scout_season_enrollments", "select=*&order=enrolled_at.desc").catch(() => []),
    callSupabaseRpc("get_registration_storage_summary").catch(() => null)
  ]);

  return {
    formTemplates: templates.map(normalizeFormTemplate),
    formTemplateVersions: versions.map(normalizeTemplateVersion),
    postedForms: postedForms.map(normalizePostedForm),
    formSubmissions: submissions.map(normalizeFormSubmission),
    formAiSummaries: aiSummaries.map(normalizeFormAiSummary),
    reimbursements: reimbursements.map(normalizeReimbursement),
    registrationCampaigns: registrationCampaigns.map(normalizeRegistrationCampaign),
    registrationSubmissions,
    registrationPeople,
    registrationParents,
    registrationDocuments,
    registrationDuplicates,
    registrationReviews,
    scoutSeasonEnrollments,
    registrationStorageSummary
  };
}

async function saveRegistrationCampaign(postedFormId, payload, postedStatus) {
  const settings = normalizeRegistrationSettings(payload.schemaJson?.settings?.behavior?.registration);
  const now = new Date().toISOString();
  const status = postedStatus === "open" || postedStatus === "approved"
    ? "open"
    : postedStatus === "closed" ? "closed" : "draft";
  const [campaign] = await upsertSupabaseRows("registration_campaigns", [{
    posted_form_id: postedFormId,
    scout_year_id: settings.seasonId,
    title: settings.registrationTitle || payload.title,
    slug: settings.slug,
    status,
    returning_enabled: settings.returningEnabled,
    new_enabled: settings.newEnabled,
    returning_opens_at: settings.returningOpensAt || null,
    new_opens_at: settings.newOpensAt || null,
    closes_at: settings.closesAt || null,
    show_opening_date: settings.showOpeningDate,
    new_scout_waitlist: settings.newScoutWaitlist,
    capacity: settings.capacity,
    accepted_group_ids: settings.acceptedGroupIds,
    minimum_age: settings.minimumAge,
    maximum_age: settings.maximumAge,
    birth_year_from: settings.birthYearFrom,
    birth_year_to: settings.birthYearTo,
    require_headshot: settings.requireHeadshot,
    require_id_front: settings.requireIdFront,
    require_id_back: settings.requireIdBack,
    require_verification: settings.requireVerification,
    require_parent_verification: settings.requireParentVerification,
    allow_drafts: settings.allowDrafts,
    privacy_text: settings.privacyText,
    consent_text: settings.consentText,
    retention_text: settings.retentionText,
    created_by: getCurrentSupabaseUserId(),
    updated_by: getCurrentSupabaseUserId(),
    updated_at: now
  }], "posted_form_id");
  return normalizeRegistrationCampaign(campaign);
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
    form_kind: payload.formKind ?? "standard",
    public_slug: payload.publicSlug || null,
    public_access_enabled: payload.formKind === "scout_registration",
    updated_at: new Date().toISOString()
  };

  if (payload.formKind === "reimbursement") {
    row.allow_multiple_submissions = payload.allowMultipleSubmissions ?? true;
    row.max_submissions = payload.maxSubmissions || null;
    row.available_from = payload.availableFrom || null;
    row.available_until = payload.availableUntil || null;
    row.receipt_required = payload.receiptRequired ?? false;
  }

  if (row.status === "open" && !payload.postedAt) {
    row.posted_at = new Date().toISOString();
    row.approved_by = userId;
  }

  if (payload.id) {
    const [form] = await patchSupabaseRows("posted_forms", `id=eq.${encodeURIComponent(payload.id)}`, row);
    if (row.form_kind === "scout_registration") await saveRegistrationCampaign(form.id, payload, row.status);
    if (row.status === "open") await callSupabaseRpc("create_posted_form_notifications", { target_form_id: form.id });
    return normalizePostedForm(form);
  }

  const [form] = await insertSupabaseRow("posted_forms", {
    ...row,
    created_by: userId
  });
  if (row.form_kind === "scout_registration") await saveRegistrationCampaign(form.id, payload, row.status);
  if (row.status === "open") await callSupabaseRpc("create_posted_form_notifications", { target_form_id: form.id });
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
  if (row.status === "open") await callSupabaseRpc("create_posted_form_notifications", { target_form_id: form.id });
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
  await callSupabaseRpc("create_posted_form_notifications", { target_form_id: form.id });
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

export async function submitReimbursementForm(payload) {
  const saved = await callSupabaseRpc("submit_reimbursement_form", {
    target_form_id: payload.postedFormId,
    submitted_answers: payload.answersJson ?? {},
    claimant_group_id: payload.groupId || null
  });
  return saved;
}

export async function saveReimbursementFormDraft(payload) {
  const saved = await callSupabaseRpc("save_reimbursement_form_draft", {
    target_form_id: payload.postedFormId,
    submitted_answers: payload.answersJson ?? {},
    claimant_group_id: payload.groupId || null
  });
  return normalizeFormSubmission(saved);
}
