import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const encoder = new TextEncoder();
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

async function hash(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanPhone(value: unknown) {
  return String(value ?? "").replace(/[^\d+]/g, "");
}

function secureCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (bytes[0] % 900000));
}

function smsConfigured() {
  return Boolean(
    Deno.env.get("TWILIO_ACCOUNT_SID")
    && Deno.env.get("TWILIO_AUTH_TOKEN")
    && Deno.env.get("TWILIO_FROM_NUMBER")
  );
}

function extensionFor(file: File) {
  const extensions: Record<string, string> = {
    "application/pdf": "pdf", "image/png": "png", "image/webp": "webp",
    "image/heic": "heic", "image/heif": "heif"
  };
  return extensions[file.type] ?? "jpg";
}

async function validSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    || text.slice(8, 12) === "WEBP" || text.slice(0, 4) === "%PDF"
    || (text.slice(4, 8) === "ftyp" && /(heic|heif|mif1)/i.test(text + file.name));
}

async function sendSms(phone: string, code: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) throw new Error("Verification delivery is not configured.");
  const body = new URLSearchParams({
    To: phone, From: from,
    Body: `Your St. Mary's Scouts verification code is ${code}. It expires in 10 minutes.`
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Verification delivery failed.");
}

function bucketAndType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("headshot")) return { bucket: "scout-headshots", documentType: "headshot" };
  if (normalized.includes("front")) return { bucket: "identity-documents", documentType: "identity_front" };
  if (normalized.includes("back")) return { bucket: "identity-documents", documentType: "identity_back" };
  if (normalized.includes("identity")) return { bucket: "identity-documents", documentType: "attachment" };
  return { bucket: "form-attachments", documentType: "attachment" };
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

async function detectDuplicates(admin: ReturnType<typeof createClient>, submissionId: string, payload: Record<string, unknown>) {
  const person = (payload.person ?? {}) as Record<string, unknown>;
  const parents = Array.isArray(payload.parents) ? payload.parents as Array<Record<string, unknown>> : [];
  const submittedName = normalizeName(person.fullName);
  if (!submittedName) return;

  const { data: candidates, error } = await admin.from("scouts")
    .select("id,name,age,group_id,parent_phone")
    .limit(5000);
  if (error) throw error;

  const submittedAge = Number(person.calculatedAge);
  const submittedGroup = String(person.requestedGroupId ?? "");
  const submittedPhones = new Set(parents.map((parent) => cleanPhone(parent.phone)).filter(Boolean));
  const matches = (candidates ?? []).flatMap((candidate) => {
    const reasons: string[] = [];
    let score = 0;
    if (normalizeName(candidate.name) === submittedName) {
      score += 60;
      reasons.push("Normalized full name matches");
    }
    if (Number.isFinite(submittedAge) && Number(candidate.age) === submittedAge) {
      score += 15;
      reasons.push("Age matches");
    }
    if (submittedGroup && candidate.group_id === submittedGroup) {
      score += 10;
      reasons.push("Group matches");
    }
    if (candidate.parent_phone && submittedPhones.has(cleanPhone(candidate.parent_phone))) {
      score += 25;
      reasons.push("Parent phone matches");
    }
    if (score < 50) return [];
    return [{
      submission_id: submissionId,
      candidate_scout_id: candidate.id,
      score: Math.min(score, 100),
      classification: score >= 80 ? "high" : "medium",
      reasons_json: reasons
    }];
  });

  if (!matches.length) return;
  const { error: matchError } = await admin.from("scout_registration_duplicate_matches").upsert(matches, {
    onConflict: "submission_id,candidate_scout_id"
  });
  if (matchError) throw matchError;
  await admin.from("scout_registration_submissions")
    .update({ status: "duplicate_review", updated_at: new Date().toISOString() })
    .eq("id", submissionId)
    .neq("status", "enrolled");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const fingerprint = await hash(`${req.headers.get("x-forwarded-for") ?? "unknown"}:${req.headers.get("user-agent") ?? "unknown"}`);
    const isMultipart = (req.headers.get("content-type") ?? "").includes("multipart/form-data");
    const body = isMultipart ? await req.formData() : await req.json();
    const action = body instanceof FormData ? String(body.get("action") ?? "") : String(body.action ?? "");

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await admin.from("registration_request_limits").select("id", { count: "exact", head: true })
      .eq("request_fingerprint", fingerprint).eq("action", action).gte("created_at", since);
    if ((count ?? 0) >= (action === "submit" ? 8 : 20)) return jsonResponse(req, { error: "Too many requests. Please wait and try again." }, 429);
    await admin.from("registration_request_limits").insert({ request_fingerprint: fingerprint, action });

    if (!(body instanceof FormData) && action === "request_verification") {
      if (!smsConfigured()) {
        return jsonResponse(req, { error: "Verification delivery is temporarily unavailable." }, 503);
      }
      const slug = String(body.slug ?? "");
      const scoutName = String(body.scoutName ?? "").trim();
      const phone = cleanPhone(body.parentPhone);
      if (!slug || scoutName.length < 2 || phone.length < 7) return jsonResponse(req, { error: "Enter valid verification details." }, 400);
      const { data: campaign } = await admin.from("registration_campaigns").select("id,scout_year_id").eq("slug", slug).in("status", ["scheduled", "open"]).maybeSingle();
      if (!campaign) return jsonResponse(req, { error: "Registration is unavailable." }, 404);
      const { data: scout } = await admin.from("scouts").select("id,parent_phone").eq("scout_year_id", campaign.scout_year_id)
        .ilike("name", scoutName).eq("parent_phone", phone).maybeSingle();
      const code = secureCode();
      const { data: challenge, error } = await admin.from("registration_parent_verification_challenges").insert({
        campaign_id: campaign.id,
        scout_id: scout?.id ?? null,
        destination_hash: await hash(phone),
        code_hash: await hash(code),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }).select("id").single();
      if (error) throw error;
      if (scout) await sendSms(phone, code);
      return jsonResponse(req, { challengeId: challenge.id, message: "If the details match, a verification code was sent." });
    }

    if (!(body instanceof FormData) && action === "verify_code") {
      const { data: challenge } = await admin.from("registration_parent_verification_challenges")
        .select("id,scout_id,code_hash,attempt_count,expires_at,verified_at,scouts(id,name,school_grade,gender,school,group_id,parent_name,parent_phone)")
        .eq("id", String(body.challengeId ?? "")).maybeSingle();
      const invalid = !challenge || challenge.verified_at || new Date(challenge.expires_at) <= new Date()
        || challenge.attempt_count >= 5 || !challenge.scout_id || challenge.code_hash !== await hash(String(body.code ?? ""));
      if (invalid) {
        if (challenge && challenge.attempt_count < 5) await admin.from("registration_parent_verification_challenges").update({ attempt_count: challenge.attempt_count + 1 }).eq("id", challenge.id);
        return jsonResponse(req, { error: "The verification code is invalid or expired." }, 400);
      }
      await admin.from("registration_parent_verification_challenges").update({ verified_at: new Date().toISOString() }).eq("id", challenge.id);
      const scout = Array.isArray(challenge.scouts) ? challenge.scouts[0] : challenge.scouts;
      return jsonResponse(req, {
        verificationId: challenge.id,
        prefill: {
          person: { fullName: scout?.name ?? "", gender: scout?.gender ?? "", schoolName: scout?.school ?? "", schoolGrade: scout?.school_grade ?? "", requestedGroupId: scout?.group_id ?? "" },
          parent: { fullName: scout?.parent_name ?? "", phone: scout?.parent_phone ?? "" }
        }
      });
    }

    if (!(body instanceof FormData) && action === "save_draft") {
      const { data: campaign } = await admin.from("registration_campaigns").select("id,allow_drafts").eq("slug", String(body.slug ?? "")).maybeSingle();
      if (!campaign?.allow_drafts) return jsonResponse(req, { saved: false });
      const rawToken = String(body.resumeToken ?? "") || crypto.randomUUID() + crypto.randomUUID();
      const row = {
        campaign_id: campaign.id,
        registration_path: String(body.registrationPath ?? "new"),
        resume_token_hash: await hash(rawToken),
        answers_json: body.payload ?? {},
        updated_at: new Date().toISOString()
      };
      const { error } = await admin.from("scout_registration_drafts").upsert(row, { onConflict: "resume_token_hash" });
      if (error) throw error;
      return jsonResponse(req, { saved: true, resumeToken: rawToken });
    }

    if (!(body instanceof FormData) && action === "load_draft") {
      const { data: campaign } = await admin.from("registration_campaigns").select("id,allow_drafts")
        .eq("slug", String(body.slug ?? "")).maybeSingle();
      if (!campaign?.allow_drafts) return jsonResponse(req, { error: "Saved registration is unavailable." }, 404);
      const rawToken = String(body.resumeToken ?? "");
      if (!rawToken) return jsonResponse(req, { error: "Saved registration is unavailable." }, 404);
      const { data: draft } = await admin.from("scout_registration_drafts")
        .select("registration_path,answers_json,current_page_id,expires_at")
        .eq("campaign_id", campaign.id)
        .eq("resume_token_hash", await hash(rawToken))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!draft) return jsonResponse(req, { error: "Saved registration is unavailable." }, 404);
      return jsonResponse(req, {
        registrationPath: draft.registration_path,
        payload: draft.answers_json,
        currentPageId: draft.current_page_id
      });
    }

    if (body instanceof FormData && action === "submit") {
      if (String(body.get("website") ?? "").trim()) {
        return jsonResponse(req, { error: "Registration request could not be accepted." }, 400);
      }
      const payload = JSON.parse(String(body.get("payload") ?? "{}"));
      const consent = JSON.parse(String(body.get("consent") ?? "{}"));
      const slug = String(body.get("slug") ?? "");
      const manifests = body.getAll("fileManifest").map((value) => JSON.parse(String(value)));
      const submittedTypes = new Set(manifests.map((manifest) => bucketAndType(String(manifest.documentType ?? "")).documentType));
      const { data: campaignRequirements } = await admin.from("registration_campaigns")
        .select("require_headshot,require_id_front,require_id_back")
        .eq("slug", slug)
        .maybeSingle();
      if (!campaignRequirements) return jsonResponse(req, { error: "Registration is unavailable." }, 404);
      const missingRequiredDocument = (
        (campaignRequirements.require_headshot && !submittedTypes.has("headshot"))
        || (campaignRequirements.require_id_front && !submittedTypes.has("identity_front"))
        || (campaignRequirements.require_id_back && !submittedTypes.has("identity_back"))
      );
      if (missingRequiredDocument) {
        return jsonResponse(req, { error: "Upload every required registration document before submitting." }, 400);
      }
      const { data: result, error: submitError } = await admin.rpc("submit_public_scout_registration", {
        target_slug: slug,
        registration_path: String(body.get("registrationPath") ?? ""),
        submission_payload: payload,
        consent_payload: { ...consent, requestFingerprint: fingerprint }
      });
      if (submitError) throw submitError;
      const { data: submission } = await admin.from("scout_registration_submissions").select("id,campaign_id").eq("reference_number", result.referenceNumber).single();
      const uploadedObjects: Array<{ bucket: string; path: string }> = [];
      try {
        const files = body.getAll("files").filter((value): value is File => value instanceof File);
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          if (file.size <= 0 || file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.has(file.type) || !(await validSignature(file))) {
            throw new Error("One or more files failed validation.");
          }
          const manifest = manifests[index] ?? {};
          const target = bucketAndType(String(manifest.documentType ?? ""));
          const path = `${submission.campaign_id}/${submission.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
          const { error: uploadError } = await admin.storage.from(target.bucket).upload(path, file, {
            contentType: file.type,
            cacheControl: "0"
          });
          if (uploadError) throw uploadError;
          uploadedObjects.push({ bucket: target.bucket, path });
          const { error: metadataError } = await admin.from("scout_registration_documents").insert({
            submission_id: submission.id,
            question_id: String(manifest.questionId ?? "attachment"),
            bucket_id: target.bucket,
            object_path: path,
            document_type: file.type === "application/pdf" ? "pdf_original" : target.documentType,
            original_format: extensionFor(file),
            processed_format: file.type === "image/webp" ? "webp" : null,
            mime_type: file.type,
            size_bytes: file.size,
            processing_status: "processed",
            content_hash: await hash(await file.arrayBuffer()),
            metadata_json: { originalName: String(manifest.originalName ?? file.name) }
          });
          if (metadataError) throw metadataError;
        }
        await detectDuplicates(admin, submission.id, payload);
      } catch (uploadError) {
        await Promise.all(uploadedObjects.map((item) => admin.storage.from(item.bucket).remove([item.path])));
        await admin.from("scout_registration_submissions").delete().eq("id", submission.id);
        throw uploadError;
      }
      if (payload.resumeToken) await admin.from("scout_registration_drafts").delete().eq("resume_token_hash", await hash(String(payload.resumeToken)));
      return jsonResponse(req, result);
    }
    return jsonResponse(req, { error: "Unsupported registration action." }, 400);
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Registration request failed." }, 400);
  }
});
