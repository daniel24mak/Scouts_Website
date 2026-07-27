import {
  callSupabaseRpc,
  getSupabaseRows,
  invokeSupabaseFunction,
  invokeSupabaseFunctionForm,
  patchSupabaseRows
} from "../../services/supabaseClient.js";
import { normalizeRegistrationSettings } from "./registrationModel.js";

export async function listPublicRegistrationCampaigns() {
  const result = await callSupabaseRpc("list_public_registration_campaigns");
  return Array.isArray(result) ? result : [];
}

export async function getPublicRegistrationCampaign(slug) {
  const result = await callSupabaseRpc("get_public_registration_campaign", { target_slug: slug });
  if (!result?.id) throw new Error("This registration campaign is unavailable.");
  return {
    ...result,
    settings: normalizeRegistrationSettings(result),
    form: {
      ...result.form,
      schemaJson: result.form?.schemaJson ?? { pages: [], questions: [] }
    }
  };
}

export function requestReturningScoutVerification(payload) {
  return invokeSupabaseFunction("scout-registration", {
    action: "request_verification",
    ...payload
  });
}

export function verifyReturningScoutCode(payload) {
  return invokeSupabaseFunction("scout-registration", {
    action: "verify_code",
    ...payload
  });
}

export function saveRegistrationDraft(payload) {
  return invokeSupabaseFunction("scout-registration", {
    action: "save_draft",
    ...payload
  });
}

export function loadRegistrationDraft(payload) {
  return invokeSupabaseFunction("scout-registration", {
    action: "load_draft",
    ...payload
  });
}

export function submitScoutRegistration({ slug, path, payload, consent, files = [], honeypot = "" }) {
  const formData = new FormData();
  formData.set("action", "submit");
  formData.set("slug", slug);
  formData.set("registrationPath", path);
  formData.set("payload", JSON.stringify(payload));
  formData.set("consent", JSON.stringify(consent));
  formData.set("website", honeypot);
  files.forEach(({ questionId, file, documentType }) => {
    formData.append("files", file, file.name);
    formData.append("fileManifest", JSON.stringify({
      questionId,
      documentType,
      originalName: file.name
    }));
  });
  return invokeSupabaseFunctionForm("scout-registration", formData);
}

export async function getRegistrationCenterData() {
  const [submissions, people, parents, documents, duplicates, reviews, enrollments, scouts] = await Promise.all([
    getSupabaseRows("scout_registration_submissions", "select=*&order=submitted_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_people", "select=*").catch(() => []),
    getSupabaseRows("scout_registration_parent_contacts", "select=*").catch(() => []),
    getSupabaseRows("scout_registration_documents", "select=*&order=uploaded_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_duplicate_matches", "select=*&order=created_at.desc").catch(() => []),
    getSupabaseRows("scout_registration_reviews", "select=*&order=reviewed_at.desc").catch(() => []),
    getSupabaseRows("scout_season_enrollments", "select=*&order=enrolled_at.desc").catch(() => []),
    getSupabaseRows("scouts", "select=id,name,school_grade,age,group_id,parent_name,parent_phone").catch(() => [])
  ]);
  return { submissions, people, parents, documents, duplicates, reviews, enrollments, scouts };
}

export function runRegistrationAdminAction(action, payload) {
  return invokeSupabaseFunction("scout-registration-admin", {
    action,
    ...payload
  });
}

export function updateRegistrationSubmission(payload) {
  return runRegistrationAdminAction("review_submission", payload);
}

export function revealRegistrationDocument(documentId) {
  return runRegistrationAdminAction("reveal_document", { documentId });
}

export function verifyRegistrationDocument(submissionId, documentId, decision) {
  return runRegistrationAdminAction("verify_document", {
    submissionId,
    documentId,
    decision
  });
}

export function deleteRegistrationDocument(documentId, reason) {
  return runRegistrationAdminAction("delete_document", {
    documentId,
    reason
  });
}

export function resolveRegistrationDuplicate(submissionId, matchId, decision, comment = "") {
  return runRegistrationAdminAction("resolve_duplicate", {
    submissionId,
    matchId,
    decision,
    comment
  });
}

export function setRegistrationCampaignStatus(campaignId, status) {
  return patchSupabaseRows(
    "registration_campaigns",
    `id=eq.${encodeURIComponent(campaignId)}`,
    {
      status,
      updated_at: new Date().toISOString(),
      archived_at: status === "archived" ? new Date().toISOString() : null
    }
  );
}
