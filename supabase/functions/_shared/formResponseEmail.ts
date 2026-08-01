type JsonRecord = Record<string, unknown>;

type EmailSourceType = "form_submission" | "scout_registration";

type DeliveryInput = {
  sourceType: EmailSourceType;
  submissionId: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const uploadQuestionTypes = new Set([
  "file_upload",
  "image_upload",
  "protected_document_upload",
  "scout_headshot_upload"
]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getSchema(form: JsonRecord) {
  return asRecord(form.schemaJson ?? form.schema_json);
}

function getResponseEmailSettings(form: JsonRecord) {
  const settings = asRecord(getSchema(form).settings);
  const responseEmail = asRecord(settings.responseEmail);
  return {
    mode: String(responseEmail.mode ?? "none"),
    questionId: String(responseEmail.questionId ?? "")
  };
}

function validEmail(value: unknown) {
  const email = String(value ?? "").trim();
  return emailPattern.test(email) ? email : "";
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripMarkup(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#0?39;/giu, "'")
    .trim();
}

function hasAnswer(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value as JsonRecord).some(hasAnswer);
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function conditionMatches(condition: JsonRecord, answers: JsonRecord) {
  if (!condition.enabled || !condition.sourceQuestionId) return true;
  const answer = answers[String(condition.sourceQuestionId)];
  const expected = condition.value;
  const operator = String(condition.operator ?? "equals");
  const answerValues = Array.isArray(answer)
    ? answer.map(String)
    : answer === null || answer === undefined || String(answer).trim() === ""
      ? []
      : String(answer).split(",").map((value) => value.trim()).filter(Boolean);
  const expectedValues = Array.isArray(expected) ? expected.map(String) : [String(expected ?? "")];

  switch (operator) {
    case "is_answered": return hasAnswer(answer);
    case "is_not_answered": return !hasAnswer(answer);
    case "not_equals": return !answerValues.some((value) => expectedValues.includes(value));
    case "contains": return answerValues.includes(String(expected ?? ""));
    case "does_not_contain": return !answerValues.includes(String(expected ?? ""));
    case "contains_any": return expectedValues.some((value) => answerValues.includes(value));
    case "contains_all": return expectedValues.every((value) => answerValues.includes(value));
    case "greater_than": return Number(answer) > Number(expected);
    case "less_than": return Number(answer) < Number(expected);
    default: return answerValues.some((value) => expectedValues.includes(value));
  }
}

function itemIsVisible(item: JsonRecord, answers: JsonRecord) {
  return conditionMatches(asRecord(item.conditionalLogic ?? item.conditional_logic), answers);
}

function formatAnswer(question: JsonRecord, value: unknown) {
  if (uploadQuestionTypes.has(String(question.type ?? ""))) {
    const count = Array.isArray(value) ? value.length : hasAnswer(value) ? 1 : 0;
    return count > 1 ? `File received (${count} files)` : count === 1 ? "File received" : "No file received";
  }
  if (Array.isArray(value)) return value.map(stripMarkup).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    if (record.e164) return String(record.e164);
    return Object.values(record).map(stripMarkup).filter(Boolean).join(" ");
  }
  const questionType = String(question.type ?? "");
  const normalized = questionType === "rich_text" || questionType === "formatted_text"
    ? stripMarkup(value)
    : String(value ?? "").trim();
  return normalized || "No answer";
}

function orderedQuestions(form: JsonRecord, answers: JsonRecord) {
  const schema = getSchema(form);
  const pages = asArray(schema.pages).map(asRecord).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const questions = asArray(schema.questions).map(asRecord);
  const visiblePageIds = new Set(
    pages
      .filter((page, index) => index === 0 || itemIsVisible(page, answers))
      .map((page) => String(page.id ?? ""))
  );
  const pageOrder = new Map(pages.map((page, index) => [String(page.id ?? ""), index]));
  return questions
    .filter((question) => {
      const pageId = String(question.pageId ?? question.page_id ?? "");
      return (!pageId || visiblePageIds.has(pageId)) && itemIsVisible(question, answers);
    })
    .sort((a, b) => {
      const pageDifference = (pageOrder.get(String(a.pageId ?? a.page_id ?? "")) ?? 0)
        - (pageOrder.get(String(b.pageId ?? b.page_id ?? "")) ?? 0);
      return pageDifference || Number(a.order ?? 0) - Number(b.order ?? 0);
    });
}

export function getFormResponseRecipient({
  form,
  answers,
  profileEmail = ""
}: {
  form: JsonRecord;
  answers: JsonRecord;
  profileEmail?: string;
}) {
  const settings = getResponseEmailSettings(form);
  if (settings.mode === "entered_email") return validEmail(answers[settings.questionId]);
  if (settings.mode === "dashboard_profile") return validEmail(profileEmail);
  return "";
}

export function buildFormResponseEmail({
  form,
  answers,
  reference = "",
  submittedAt = ""
}: {
  form: JsonRecord;
  answers: JsonRecord;
  reference?: string;
  submittedAt?: string;
}) {
  const title = stripMarkup(form.title) || "Form response";
  const rows = orderedQuestions(form, answers).map((question) => ({
    question: stripMarkup(question.text ?? question.title) || "Untitled question",
    answer: formatAnswer(question, answers[String(question.id ?? "")])
  }));
  const metadata = [
    reference ? `Reference: ${reference}` : "",
    submittedAt ? `Submitted: ${submittedAt}` : ""
  ].filter(Boolean);
  const text = [
    `Your response to ${title}`,
    ...metadata,
    "",
    ...rows.flatMap((row) => [row.question, row.answer, ""])
  ].join("\n").trim();
  const htmlRows = rows.map((row) => `
    <tr>
      <td style="padding:14px 0 5px;font-weight:700;color:#10213f;">${htmlEscape(row.question)}</td>
    </tr>
    <tr>
      <td style="padding:0 0 14px;color:#4f5d73;white-space:pre-wrap;">${htmlEscape(row.answer)}</td>
    </tr>`).join("");
  const htmlMetadata = metadata.map((line) => `<div style="color:#6b7280;font-size:13px;">${htmlEscape(line)}</div>`).join("");
  return {
    subject: `${title} - response received`,
    text,
    html: `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;color:#10213f;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #dfe4ee;border-radius:10px;padding:28px;">
          <div style="font-size:13px;font-weight:700;color:#4055a6;text-transform:uppercase;">St. Mary's Scouts Dubai</div>
          <h1 style="font-size:24px;line-height:1.25;margin:10px 0 8px;">${htmlEscape(title)}</h1>
          ${htmlMetadata}
          <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:20px;">${htmlRows}</table>
        </div>
      </div>
    </body></html>`
  };
}

export async function getFormResponseEmailIdempotencyKey(
  sourceType: EmailSourceType,
  submissionId: string,
  recipientEmail: string
) {
  const value = `${sourceType}:${submissionId}:${recipientEmail.trim().toLowerCase()}`;
  return sha256(value);
}

async function recordFailure(adminClient: any, delivery: JsonRecord, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Email delivery failed.");
  await adminClient.from("form_response_email_deliveries").upsert({
    ...delivery,
    status: "failed",
    last_error: message.slice(0, 1000),
    updated_at: new Date().toISOString()
  }, { onConflict: "idempotency_key" });
  return { status: "failed", error: message };
}

export async function deliverFormResponseEmail(adminClient: any, input: DeliveryInput) {
  let submission: JsonRecord;
  let form: JsonRecord;
  let answers: JsonRecord;
  let profileEmail = "";
  let reference = "";
  let submittedAt = "";

  try {
    if (input.sourceType === "form_submission") {
      const submissionResult = await adminClient.from("form_submissions").select("*").eq("id", input.submissionId).single();
      if (submissionResult.error) throw submissionResult.error;
      submission = asRecord(submissionResult.data);
      const formResult = await adminClient.from("posted_forms").select("*").eq("id", submission.posted_form_id).single();
      if (formResult.error) throw formResult.error;
      form = asRecord(formResult.data);
      answers = asRecord(submission.answers_json);
      submittedAt = String(submission.submitted_at ?? submission.updated_at ?? "");
      if (submission.submitted_by) {
        const userResult = await adminClient.auth.admin.getUserById(String(submission.submitted_by));
        profileEmail = String(userResult.data?.user?.email ?? "");
      }
    } else {
      const submissionResult = await adminClient.from("scout_registration_submissions").select("*").eq("id", input.submissionId).single();
      if (submissionResult.error) throw submissionResult.error;
      submission = asRecord(submissionResult.data);
      const campaignResult = await adminClient.from("registration_campaigns").select("posted_form_id").eq("id", submission.campaign_id).single();
      if (campaignResult.error) throw campaignResult.error;
      const formResult = await adminClient.from("posted_forms").select("*").eq("id", campaignResult.data.posted_form_id).single();
      if (formResult.error) throw formResult.error;
      form = asRecord(formResult.data);
      const storedAnswers = asRecord(submission.answers_json);
      answers = asRecord(storedAnswers.answers ?? storedAnswers);
      reference = String(submission.reference_number ?? "");
      submittedAt = String(submission.submitted_at ?? "");
    }
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }

  const settings = getResponseEmailSettings(form);
  if (settings.mode === "none") return { status: "skipped", reason: "disabled" };
  if (input.sourceType === "scout_registration" && settings.mode === "dashboard_profile") {
    return { status: "skipped", reason: "dashboard_recipient_unavailable" };
  }

  const recipientEmail = getFormResponseRecipient({ form, answers, profileEmail });
  if (!recipientEmail) return { status: "failed", error: "A valid email recipient was not available." };
  const idempotencyKey = await getFormResponseEmailIdempotencyKey(input.sourceType, input.submissionId, recipientEmail);
  const existingResult = await adminClient.from("form_response_email_deliveries")
    .select("status,provider_message_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingResult.error) {
    return { status: "failed", error: "Email delivery logging is unavailable." };
  }
  if (existingResult.data?.status === "sent") {
    return { status: "sent", alreadySent: true, providerMessageId: existingResult.data.provider_message_id };
  }

  const delivery = {
    source_type: input.sourceType,
    source_submission_id: input.submissionId,
    posted_form_id: form.id,
    recipient_email_hash: await sha256(recipientEmail.trim().toLowerCase()),
    recipient_email_masked: maskEmail(recipientEmail.trim().toLowerCase()),
    idempotency_key: idempotencyKey,
    provider: "resend",
    attempt_count: Number(existingResult.data ? 2 : 1)
  };
  const apiKey = Deno.env.get("FORM_EMAIL_PROVIDER_API_KEY");
  const sender = Deno.env.get("FORM_EMAIL_FROM");
  if (!apiKey || !sender) {
    return recordFailure(adminClient, delivery, "Form response email delivery is not configured.");
  }

  const message = buildFormResponseEmail({ form, answers, reference, submittedAt });
  try {
    const processingResult = await adminClient.from("form_response_email_deliveries").upsert({
      ...delivery,
      status: "processing",
      last_error: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "idempotency_key" });
    if (processingResult.error) throw new Error("Email delivery logging is unavailable.");
    const replyTo = Deno.env.get("FORM_EMAIL_REPLY_TO");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        from: sender,
        to: [recipientEmail],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    const providerResult = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(providerResult.message ?? `Email provider returned ${response.status}.`));
    await adminClient.from("form_response_email_deliveries").update({
      status: "sent",
      provider_message_id: providerResult.id ?? null,
      last_error: null,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("idempotency_key", idempotencyKey);
    return { status: "sent", providerMessageId: providerResult.id ?? null };
  } catch (error) {
    return recordFailure(adminClient, delivery, error);
  }
}
