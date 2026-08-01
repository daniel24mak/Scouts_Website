import {
  getCountryCallingCode,
  parsePhoneNumberFromString
} from "libphonenumber-js";

export const FORM_FIELD_WIDTHS = [
  ["full", "Full width"],
  ["half", "Half width"],
  ["one_third", "One third"],
  ["two_thirds", "Two thirds"]
];

export const FORM_QUESTION_SURFACES = [
  ["default", "Form default"],
  ["boxed", "In a box"],
  ["plain", "No box"]
];

export function normalizeFormAppearanceSettings(settings = {}) {
  return {
    ...settings,
    showQuestionNumbers: settings.showQuestionNumbers !== false
  };
}

export function getOrderedFormQuestions(schema = {}) {
  const questions = Array.isArray(schema.questions) ? schema.questions : [];
  const pages = (Array.isArray(schema.pages) ? schema.pages : [])
    .map((page, index) => ({ page, index }))
    .sort((a, b) => (Number(a.page.order) || 0) - (Number(b.page.order) || 0) || a.index - b.index)
    .map(({ page }) => page);
  const pageIds = new Set(pages.map((page) => page.id));
  const byQuestionOrder = (a, b) =>
    (Number(a.question.order) || 0) - (Number(b.question.order) || 0)
    || a.index - b.index;
  const indexedQuestions = questions.map((question, index) => ({ question, index }));

  return [
    ...pages.flatMap((page) => indexedQuestions
      .filter(({ question }) => question.pageId === page.id)
      .sort(byQuestionOrder)),
    ...indexedQuestions
      .filter(({ question }) => !pageIds.has(question.pageId))
      .sort(byQuestionOrder)
  ].map(({ question }) => question);
}

const widthUnits = {
  full: 12,
  half: 6,
  one_third: 4,
  two_thirds: 8
};

const forcedFullWidthTypes = new Set([
  "long_text",
  "file_upload",
  "image_upload",
  "protected_document_upload",
  "scout_headshot_upload"
]);

const responseEmailModes = new Set([
  "none",
  "entered_email",
  "dashboard_profile"
]);

function safeCountry(country, fallback = "AE") {
  const value = String(country || fallback).toUpperCase();
  try {
    getCountryCallingCode(value);
    return value;
  } catch {
    return fallback;
  }
}

export function normalizePhoneSettings(settings = {}) {
  const countryMode = settings.countryMode === "single" ? "single" : "all";
  const defaultCountry = safeCountry(settings.defaultCountry);
  return {
    countryMode,
    defaultCountry,
    allowedCountry: safeCountry(settings.allowedCountry, defaultCountry)
  };
}

export function normalizeFormQuestion(question = {}) {
  const id = question.id || crypto.randomUUID();
  const type = question.type || "short_text";
  const requestedWidth = widthUnits[question.layout?.width]
    ? question.layout.width
    : "full";
  const layout = {
    rowId: question.layout?.rowId || `row-${id}`,
    width: forcedFullWidthTypes.has(type) ? "full" : requestedWidth,
    surface: ["boxed", "plain"].includes(question.layout?.surface)
      ? question.layout.surface
      : "default"
  };

  return {
    ...question,
    id,
    type,
    layout,
    ...(type === "phone"
      ? { phoneSettings: normalizePhoneSettings(question.phoneSettings) }
      : {})
  };
}

export function getFormWidthUnits(width) {
  return widthUnits[width] || widthUnits.full;
}

export function canShareFormRow(existingQuestions = [], candidateQuestion) {
  const used = existingQuestions
    .map(normalizeFormQuestion)
    .reduce((total, question) => total + getFormWidthUnits(question.layout.width), 0);
  const candidate = normalizeFormQuestion(candidateQuestion);
  return used + getFormWidthUnits(candidate.layout.width) <= 12;
}

export function packFormQuestionRows(questions = []) {
  const rowsByPage = new Map();
  return questions.map(normalizeFormQuestion).map((question) => {
    const pageKey = question.pageId || "__default";
    const units = getFormWidthUnits(question.layout.width);
    const currentRow = rowsByPage.get(pageKey);
    const startsNewRow = !currentRow || units === 12 || currentRow.units + units > 12;
    const row = startsNewRow
      ? { id: `row-${question.id}`, units }
      : { id: currentRow.id, units: currentRow.units + units };

    rowsByPage.set(pageKey, units === 12 ? null : row);
    return {
      ...question,
      layout: {
        ...question.layout,
        rowId: row.id
      }
    };
  });
}

export function moveFormQuestion(schema, sourceQuestionId, targetQuestionId) {
  const questions = Array.isArray(schema?.questions)
    ? schema.questions.map(normalizeFormQuestion)
    : [];
  const source = questions.find((question) => question.id === sourceQuestionId);
  const target = questions.find((question) => question.id === targetQuestionId);
  if (!source || !target || source.id === target.id) return { ...schema, questions };

  const remaining = questions.filter((question) => question.id !== source.id);
  const targetPageQuestions = remaining
    .filter((question) => question.pageId === target.pageId)
    .sort((a, b) => a.order - b.order);
  const targetIndex = targetPageQuestions.findIndex((question) => question.id === target.id);
  const targetRow = targetPageQuestions.filter(
    (question) => question.layout.rowId === target.layout.rowId
  );
  const shareRow = canShareFormRow(targetRow, source);
  const moved = {
    ...source,
    pageId: target.pageId,
    layout: {
      ...source.layout,
      rowId: shareRow ? target.layout.rowId : `row-${source.id}`
    }
  };

  targetPageQuestions.splice(targetIndex + 1, 0, moved);
  const affectedPages = new Set([source.pageId, target.pageId]);
  const reordered = [];
  affectedPages.forEach((pageId) => {
    const pageQuestions = pageId === target.pageId
      ? targetPageQuestions
      : remaining
        .filter((question) => question.pageId === pageId)
        .sort((a, b) => a.order - b.order);
    pageQuestions.forEach((question, order) => reordered.push({ ...question, order }));
  });

  return {
    ...schema,
    questions: [
      ...remaining.filter((question) => !affectedPages.has(question.pageId)),
      ...reordered
    ]
  };
}

export function normalizePhoneAnswer(value, fallbackCountry = "AE") {
  const rawCountry = typeof value === "object" && value
    ? value.country
    : fallbackCountry;
  const country = safeCountry(rawCountry, safeCountry(fallbackCountry));
  const rawNumber = typeof value === "object" && value
    ? value.e164 || value.nationalNumber || ""
    : value || "";
  const cleaned = String(rawNumber).trim();
  const parsed = parsePhoneNumberFromString(cleaned, country);
  const nationalNumber = parsed?.nationalNumber
    || cleaned.replace(/\D/g, "");
  const parsedCountry = parsed?.country || country;
  const callingCode = `+${getCountryCallingCode(parsedCountry)}`;

  return {
    e164: parsed?.number || "",
    country: parsedCountry,
    callingCode,
    nationalNumber
  };
}

export function getCountryName(country) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(country)
      || country;
  } catch {
    return country;
  }
}

export function validatePhoneAnswer(question, value) {
  const normalizedQuestion = normalizeFormQuestion(question);
  const answer = normalizePhoneAnswer(
    value,
    normalizedQuestion.phoneSettings?.defaultCountry
  );
  const hasInput = Boolean(answer.nationalNumber || answer.e164);

  if (!hasInput) {
    return normalizedQuestion.required ? "Enter a phone number." : "";
  }

  if (
    normalizedQuestion.phoneSettings?.countryMode === "single"
    && answer.country !== normalizedQuestion.phoneSettings.allowedCountry
  ) {
    return `Use a ${getCountryName(normalizedQuestion.phoneSettings.allowedCountry)} phone number.`;
  }

  const parsed = parsePhoneNumberFromString(
    answer.e164 || answer.nationalNumber,
    answer.country
  );
  return parsed?.isValid() ? "" : "Enter a valid phone number.";
}

export function validateEmailAnswer(question, value) {
  const answer = String(value ?? "").trim();
  if (!answer) return question?.required ? "Enter an email address." : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(answer)
    ? ""
    : "Enter a valid email address.";
}

export function normalizeFormResponseEmailSettings(settings = {}) {
  const mode = responseEmailModes.has(settings?.mode)
    ? settings.mode
    : "none";
  return {
    mode,
    questionId: mode === "entered_email"
      ? String(settings?.questionId ?? "")
      : ""
  };
}

export function validateFormResponseEmailSettings(
  settings,
  questions = [],
  { publicForm = false } = {}
) {
  const normalized = normalizeFormResponseEmailSettings(settings);
  if (normalized.mode === "none") return "";
  if (normalized.mode === "dashboard_profile") {
    return publicForm
      ? "Public forms cannot send to a dashboard profile email."
      : "";
  }
  const recipientQuestion = questions.find(
    (question) => question.id === normalized.questionId
  );
  return recipientQuestion?.type === "email"
    ? ""
    : "Choose an Email question for the receipt recipient.";
}

export function formatPhoneAnswer(value) {
  if (!value) return "";
  const answer = normalizePhoneAnswer(value, value?.country || "AE");
  const parsed = parsePhoneNumberFromString(
    answer.e164 || answer.nationalNumber,
    answer.country
  );
  return parsed?.formatInternational() || [
    answer.callingCode,
    answer.nationalNumber
  ].filter(Boolean).join(" ");
}

export function getAnswerScalar(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("e164" in value || "nationalNumber" in value) {
      return normalizePhoneAnswer(value, value.country || "AE").e164;
    }
  }
  return value;
}
