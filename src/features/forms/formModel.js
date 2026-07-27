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
    width: forcedFullWidthTypes.has(type) ? "full" : requestedWidth
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
