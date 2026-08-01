import { AuthorizationError, parseUuid, requireDashboardPermission } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const reviewDecisions = new Set(["approved", "rejected", "needs_changes", "verified"]);
const duplicateDecisions = new Set(["same_person", "different_person", "defer"]);

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasPassed = today.getUTCMonth() > birthDate.getUTCMonth()
    || (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? age : null;
}

async function requireRegistrationScope(context: Awaited<ReturnType<typeof requireDashboardPermission>>, groupId: string | null) {
  const { data, error } = await context.userClient.rpc("can_manage_registration_group", {
    target_group_id: groupId
  });
  if (error || data !== true) throw new AuthorizationError("You cannot manage registration for this scout group", 403);
}

async function auditRegistrationAction(
  context: Awaited<ReturnType<typeof requireDashboardPermission>>,
  action: string,
  submissionId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await context.adminClient.from("audit_logs").insert({
    actor_id: context.callerId,
    action,
    entity_type: "scout_registration",
    entity_id: submissionId,
    module: "registration",
    resource_type: "scout_registration",
    resource_id: submissionId,
    outcome: "success",
    metadata
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const permission = action === "reveal_document"
      ? "identity_documents.view"
      : action === "delete_document"
        ? "registration.retention.manage"
        : action === "enroll_submission" ? "registration.approve" : "registration.verify";
    const context = await requireDashboardPermission(req, permission);

    if (action === "reveal_document") {
      const documentId = parseUuid(body.documentId);
      const { data: document, error } = await context.adminClient.from("scout_registration_documents")
        .select("id,bucket_id,object_path,submission_id,deleted_at").eq("id", documentId).maybeSingle();
      if (error || !document || document.deleted_at) throw new AuthorizationError("Document is unavailable", 404);
      const { data: scopedSubmission } = await context.adminClient.from("scout_registration_submissions")
        .select("target_group_id").eq("id", document.submission_id).maybeSingle();
      if (!scopedSubmission) throw new AuthorizationError("Registration submission was not found", 404);
      await requireRegistrationScope(context, scopedSubmission.target_group_id);
      const { data: signed, error: signedError } = await context.adminClient.storage.from(document.bucket_id).createSignedUrl(document.object_path, 60);
      if (signedError) throw new AuthorizationError("Document could not be revealed", 400);
      await context.adminClient.from("registration_document_access_logs").insert({
        document_id: document.id,
        submission_id: document.submission_id,
        actor_id: context.callerId,
        action: "reveal",
        purpose: "registration_verification",
        request_id: crypto.randomUUID()
      });
      return new Response(JSON.stringify({ url: signed.signedUrl, expiresIn: 60 }), {
        status: 200,
        headers: {
          ...corsHeaders(req),
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      });
    }

    if (action === "delete_document") {
      const documentId = parseUuid(body.documentId);
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 8) throw new AuthorizationError("Add a deletion reason of at least 8 characters", 400);
      const { data: document, error } = await context.adminClient.from("scout_registration_documents")
        .select("id,bucket_id,object_path,submission_id,verification_status,deleted_at")
        .eq("id", documentId)
        .maybeSingle();
      if (error || !document || document.deleted_at) throw new AuthorizationError("Document is unavailable", 404);
      const { error: removeError } = await context.adminClient.storage.from(document.bucket_id).remove([document.object_path]);
      if (removeError) throw new AuthorizationError("The private Storage object could not be deleted", 400);
      const deletedAt = new Date().toISOString();
      const tombstonePath = `${document.submission_id}/${document.id}/${crypto.randomUUID()}.deleted`;
      const { error: updateError } = await context.adminClient.from("scout_registration_documents").update({
        object_path: tombstonePath,
        verification_status: "deleted",
        deleted_at: deletedAt,
        deleted_by: context.callerId,
        deletion_reason: reason,
        metadata_json: { deleted: true }
      }).eq("id", documentId).is("deleted_at", null);
      if (updateError) throw new AuthorizationError(updateError.message, 400);
      const { error: accessLogError } = await context.adminClient.from("registration_document_access_logs").insert({
        document_id: documentId,
        submission_id: document.submission_id,
        actor_id: context.callerId,
        action: "delete",
        purpose: "season_retention_review",
        request_id: crypto.randomUUID()
      });
      if (accessLogError) throw new AuthorizationError(accessLogError.message, 400);
      await context.adminClient.from("scout_registration_reviews").insert({
        submission_id: document.submission_id,
        review_type: "retention",
        decision: "deleted",
        comment: reason,
        previous_values: { verificationStatus: document.verification_status },
        new_values: { verificationStatus: "deleted", deletedAt },
        reviewed_by: context.callerId
      });
      await auditRegistrationAction(context, "registration.document_deleted", document.submission_id, {
        documentId,
        reason
      });
      return jsonResponse(req, { success: true, deletedAt });
    }

    const submissionId = parseUuid(body.submissionId);
    const { data: submission, error: submissionError } = await context.adminClient.from("scout_registration_submissions")
      .select("*,scout_registration_people(*),scout_registration_parent_contacts(*)")
      .eq("id", submissionId).maybeSingle();
    if (submissionError || !submission) throw new AuthorizationError("Registration submission was not found", 404);
    const enrollmentDetails = body.enrollmentDetails && typeof body.enrollmentDetails === "object"
      ? body.enrollmentDetails as Record<string, unknown>
      : {};
    const requestedEnrollmentGroupId = action === "enroll_submission"
      ? String(enrollmentDetails.targetGroupId ?? submission.target_group_id ?? "").trim() || null
      : submission.target_group_id;
    await requireRegistrationScope(context, requestedEnrollmentGroupId);

    if (action === "review_submission") {
      const decision = String(body.decision ?? "");
      if (!reviewDecisions.has(decision)) throw new AuthorizationError("Invalid review decision", 400);
      if (decision === "verified" || decision === "approved") {
        const [{ count: unresolvedDuplicates }, { count: unverifiedDocuments }] = await Promise.all([
          context.adminClient.from("scout_registration_duplicate_matches")
            .select("id", { count: "exact", head: true })
            .eq("submission_id", submissionId)
            .is("decision", null),
          context.adminClient.from("scout_registration_documents")
            .select("id", { count: "exact", head: true })
            .eq("submission_id", submissionId)
            .neq("verification_status", "verified")
            .is("deleted_at", null)
        ]);
        if ((unresolvedDuplicates ?? 0) > 0) {
          throw new AuthorizationError("Resolve possible duplicates before verification", 409);
        }
        if ((unverifiedDocuments ?? 0) > 0) {
          throw new AuthorizationError("Verify or reject every uploaded document before approval", 409);
        }
      }
      const status = decision === "verified" ? "verified" : decision;
      const now = new Date().toISOString();
      const { error } = await context.adminClient.from("scout_registration_submissions").update({
        status,
        reviewed_at: now,
        approved_at: decision === "approved" ? now : submission.approved_at,
        updated_at: now
      }).eq("id", submissionId);
      if (error) throw new AuthorizationError(error.message, 400);
      await context.adminClient.from("scout_registration_reviews").insert({
        submission_id: submissionId,
        review_type: decision === "verified" ? "group_verification" : "approval",
        decision,
        group_id: submission.target_group_id,
        comment: String(body.comment ?? ""),
        previous_values: { status: submission.status },
        new_values: { status },
        reviewed_by: context.callerId
      });
      await auditRegistrationAction(context, `registration.${decision}`, submissionId, {
        previousStatus: submission.status,
        status,
        groupId: submission.target_group_id
      });
      return jsonResponse(req, { success: true, status });
    }

    if (action === "resolve_duplicate") {
      const matchId = parseUuid(body.matchId);
      const decision = String(body.decision ?? "");
      if (!duplicateDecisions.has(decision)) throw new AuthorizationError("Invalid duplicate decision", 400);
      const { data: match, error: matchError } = await context.adminClient
        .from("scout_registration_duplicate_matches")
        .select("id,candidate_scout_id")
        .eq("id", matchId)
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (matchError || !match) throw new AuthorizationError("Duplicate candidate was not found", 404);
      const { error } = await context.adminClient.from("scout_registration_duplicate_matches").update({
        decision,
        decided_by: context.callerId,
        decided_at: new Date().toISOString(),
        decision_note: String(body.comment ?? "")
      }).eq("id", matchId).eq("submission_id", submissionId);
      if (error) throw new AuthorizationError(error.message, 400);
      if (decision === "same_person") {
        const { error: linkError } = await context.adminClient.from("scout_registration_submissions").update({
          matched_scout_id: match.candidate_scout_id,
          status: "pending_group_verification",
          updated_at: new Date().toISOString()
        }).eq("id", submissionId);
        if (linkError) throw new AuthorizationError(linkError.message, 400);
      }
      await auditRegistrationAction(context, "registration.duplicate_resolved", submissionId, {
        matchId,
        decision,
        candidateScoutId: match.candidate_scout_id
      });
      return jsonResponse(req, { success: true, decision });
    }

    if (action === "verify_document") {
      const documentId = parseUuid(body.documentId);
      const decision = String(body.decision ?? "");
      if (!["verified", "rejected"].includes(decision)) throw new AuthorizationError("Invalid document decision", 400);
      const { error } = await context.adminClient.from("scout_registration_documents").update({
        verification_status: decision,
        verified_at: new Date().toISOString(),
        verified_by: context.callerId
      }).eq("id", documentId).eq("submission_id", submissionId);
      if (error) throw new AuthorizationError(error.message, 400);
      const { error: accessLogError } = await context.adminClient.from("registration_document_access_logs").insert({
        document_id: documentId,
        submission_id: submissionId,
        actor_id: context.callerId,
        action: decision === "verified" ? "verify" : "reject",
        purpose: "registration_verification",
        request_id: crypto.randomUUID()
      });
      if (accessLogError) throw new AuthorizationError(accessLogError.message, 400);
      await auditRegistrationAction(context, "registration.document_verified", submissionId, { documentId, decision });
      return jsonResponse(req, { success: true, verificationStatus: decision });
    }

    if (action === "enroll_submission") {
      if (!["approved", "verified"].includes(submission.status)) throw new AuthorizationError("Approve the registration before enrollment", 409);
      const existingPerson = Array.isArray(submission.scout_registration_people) ? submission.scout_registration_people[0] : submission.scout_registration_people;
      const targetGroupId = String(enrollmentDetails.targetGroupId ?? submission.target_group_id ?? existingPerson?.requested_group_id ?? "").trim();
      const fullName = String(enrollmentDetails.fullName ?? existingPerson?.full_name ?? "").trim();
      if (!fullName || !targetGroupId) throw new AuthorizationError("Enter the scout's full name and target group before enrollment", 400);
      const rawDateOfBirth = String(enrollmentDetails.dateOfBirth ?? existingPerson?.date_of_birth ?? "").trim();
      const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(rawDateOfBirth) ? rawDateOfBirth : null;
      const now = new Date().toISOString();
      const { data: person, error: personError } = await context.adminClient.from("scout_registration_people").upsert({
        submission_id: submissionId,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        gender: String(enrollmentDetails.gender ?? existingPerson?.gender ?? "").trim() || null,
        school_name: String(enrollmentDetails.schoolName ?? existingPerson?.school_name ?? "").trim() || null,
        school_grade: String(enrollmentDetails.schoolGrade ?? existingPerson?.school_grade ?? "").trim() || null,
        calculated_age: calculateAge(dateOfBirth) ?? existingPerson?.calculated_age ?? null,
        requested_group_id: targetGroupId,
        updated_at: now
      }, { onConflict: "submission_id" }).select("*").single();
      if (personError || !person) throw new AuthorizationError(personError?.message ?? "Scout enrollment details could not be saved", 400);
      const { error: groupUpdateError } = await context.adminClient.from("scout_registration_submissions").update({
        target_group_id: targetGroupId,
        updated_at: now
      }).eq("id", submissionId);
      if (groupUpdateError) throw new AuthorizationError(groupUpdateError.message, 400);
      const { data: campaign, error: campaignError } = await context.adminClient.from("registration_campaigns")
        .select("scout_year_id").eq("id", submission.campaign_id).single();
      if (campaignError || !campaign) throw new AuthorizationError("Registration campaign was not found", 404);
      let scoutId = submission.matched_scout_id;
      if (!scoutId) {
        const parent = Array.isArray(submission.scout_registration_parent_contacts) ? submission.scout_registration_parent_contacts[0] : submission.scout_registration_parent_contacts;
        const { data: scout, error } = await context.adminClient.from("scouts").insert({
          scout_year_id: campaign.scout_year_id,
          name: person.full_name,
          school_grade: person.school_grade,
          age: person.calculated_age,
          gender: person.gender,
          school: person.school_name,
          group_id: targetGroupId,
          parent_name: parent?.full_name ?? null,
          parent_phone: parent?.phone ?? null,
          source: "registration"
        }).select("id").single();
        if (error) throw new AuthorizationError(error.message, 400);
        scoutId = scout.id;
      }
      const { error: enrollmentError } = await context.adminClient.from("scout_season_enrollments").upsert({
        scout_id: scoutId,
        scout_year_id: campaign.scout_year_id,
        registration_submission_id: submissionId,
        group_id: targetGroupId,
        status: "active",
        enrolled_by: context.callerId,
        enrolled_at: now
      }, { onConflict: "scout_id,scout_year_id" });
      if (enrollmentError) throw new AuthorizationError(enrollmentError.message, 400);
      await context.adminClient.from("scout_registration_submissions").update({
        status: "enrolled", matched_scout_id: scoutId, target_group_id: targetGroupId, enrolled_at: now, updated_at: now
      }).eq("id", submissionId);
      await auditRegistrationAction(context, "registration.enrolled", submissionId, {
        scoutId,
        scoutYearId: campaign.scout_year_id,
        groupId: targetGroupId
      });
      return jsonResponse(req, { success: true, scoutId, status: "enrolled" });
    }

    throw new AuthorizationError("Unsupported registration action", 400);
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Registration action failed" }, status);
  }
});
