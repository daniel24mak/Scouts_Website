export const REGISTRATION_UPLOAD_TYPES = Object.freeze([
  "file_upload",
  "image_upload",
  "protected_document_upload",
  "scout_headshot_upload"
]);

export const REGISTRATION_FILE_FORMATS = Object.freeze(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"]);

export const REGISTRATION_STORAGE_CATEGORIES = Object.freeze([
  ["attachment", "General attachment"],
  ["identity_front", "ID front"],
  ["identity_back", "ID back"],
  ["identity_document", "Other identity document"],
  ["headshot", "Scout headshot"]
]);

export const PDF_PROCESSING_OPTIONS = Object.freeze([
  "keep_original",
  "compress",
  "original_and_compressed",
  "original_and_previews",
  "previews_only"
]);

const safeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asBoolean = (value, fallback) => typeof value === "boolean" ? value : fallback;
const asPositiveInteger = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

export function normalizeRegistrationSettings(settings = {}) {
  return {
    seasonId: settings.seasonId ?? "",
    registrationTitle: settings.registrationTitle ?? "",
    slug: String(settings.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
    returningEnabled: asBoolean(settings.returningEnabled, true),
    newEnabled: asBoolean(settings.newEnabled, false),
    returningOpensAt: settings.returningOpensAt ?? null,
    newOpensAt: settings.newOpensAt ?? null,
    closesAt: settings.closesAt ?? null,
    showOpeningDate: asBoolean(settings.showOpeningDate, true),
    newScoutWaitlist: asBoolean(settings.newScoutWaitlist, false),
    capacity: settings.capacity ? asPositiveInteger(settings.capacity, null) : null,
    acceptedGroupIds: Array.isArray(settings.acceptedGroupIds) ? settings.acceptedGroupIds.filter(Boolean) : [],
    minimumAge: settings.minimumAge === "" || settings.minimumAge == null ? null : Number(settings.minimumAge),
    maximumAge: settings.maximumAge === "" || settings.maximumAge == null ? null : Number(settings.maximumAge),
    birthYearFrom: settings.birthYearFrom === "" || settings.birthYearFrom == null ? null : Number(settings.birthYearFrom),
    birthYearTo: settings.birthYearTo === "" || settings.birthYearTo == null ? null : Number(settings.birthYearTo),
    requireHeadshot: asBoolean(settings.requireHeadshot, true),
    requireIdFront: asBoolean(settings.requireIdFront, true),
    requireIdBack: asBoolean(settings.requireIdBack, false),
    requireVerification: asBoolean(settings.requireVerification, true),
    requireParentVerification: asBoolean(settings.requireParentVerification, true),
    allowDrafts: asBoolean(settings.allowDrafts, true),
    privacyText: String(settings.privacyText ?? ""),
    consentText: String(settings.consentText ?? ""),
    retentionText: String(settings.retentionText ?? ""),
    approvedCount: Math.max(0, Number(settings.approvedCount ?? 0))
  };
}

export function getRegistrationAvailability(settings, path, now = new Date()) {
  const normalized = normalizeRegistrationSettings(settings);
  const isReturning = path === "returning";
  const enabled = isReturning ? normalized.returningEnabled : normalized.newEnabled;
  const opensAt = safeDate(isReturning ? normalized.returningOpensAt : normalized.newOpensAt);
  const closesAt = safeDate(normalized.closesAt);
  const current = safeDate(now) ?? new Date();

  if (!enabled) return { state: "disabled", opensAt, closesAt };
  if (opensAt && current < opensAt) return { state: "scheduled", opensAt, closesAt };
  if (closesAt && current > closesAt) return { state: "closed", opensAt, closesAt };
  if (!isReturning && normalized.capacity && normalized.approvedCount >= normalized.capacity) {
    return { state: normalized.newScoutWaitlist ? "waitlist" : "full", opensAt, closesAt };
  }
  return { state: "open", opensAt, closesAt };
}

export function calculateAgeOnDate(dateOfBirth, referenceDate = new Date()) {
  const birth = safeDate(dateOfBirth);
  const reference = safeDate(referenceDate);
  if (!birth || !reference || birth > reference) return null;

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < birth.getUTCMonth()
    || (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function normalizeUploadQuestion(question = {}) {
  const type = REGISTRATION_UPLOAD_TYPES.includes(question.type) ? question.type : "file_upload";
  const isProtected = ["protected_document_upload", "scout_headshot_upload"].includes(type);
  const defaultFormats = type === "file_upload" ? REGISTRATION_FILE_FORMATS : REGISTRATION_FILE_FORMATS.filter((format) => format !== "pdf");
  const acceptedFormats = Array.isArray(question.acceptedFormats)
    ? question.acceptedFormats.map((format) => String(format).toLowerCase()).filter((format) => REGISTRATION_FILE_FORMATS.includes(format))
    : defaultFormats;
  const requestedStorageCategory = String(question.storageCategory ?? "").trim().toLowerCase();
  const questionText = String(question.text ?? "").trim().toLowerCase();
  let storageCategory = requestedStorageCategory;

  if (type === "scout_headshot_upload") {
    storageCategory = "headshot";
  } else if (type === "protected_document_upload" && (!storageCategory || storageCategory === "identity_document")) {
    storageCategory = /\b(back|rear)\b/.test(questionText) ? "identity_back" : "identity_front";
  } else if (!storageCategory) {
    storageCategory = "attachment";
  }

  return {
    maxFiles: asPositiveInteger(question.maxFiles, 1),
    maxFileSizeMb: asPositiveInteger(question.maxFileSizeMb, isProtected ? 12 : 8),
    acceptedFormats: acceptedFormats.length ? [...new Set(acceptedFormats)] : defaultFormats,
    helperText: String(question.helperText ?? ""),
    uploadInstructions: String(question.uploadInstructions ?? ""),
    storageCategory,
    imageCompression: question.imageCompression ?? (type === "scout_headshot_upload" ? "headshot" : type === "image_upload" || isProtected ? "document" : "none"),
    pdfProcessing: PDF_PROCESSING_OPTIONS.includes(question.pdfProcessing) ? question.pdfProcessing : isProtected ? "original_and_previews" : "keep_original",
    privateClassification: question.privateClassification ?? (isProtected ? "protected" : "private"),
    requiresVerification: asBoolean(question.requiresVerification, isProtected)
  };
}

export function classifyDuplicateCandidate(candidate = {}) {
  let score = 0;
  if (candidate.exactIdentityHash) score += 70;
  if (candidate.dateOfBirthMatch) score += 20;
  if (candidate.parentPhoneMatch) score += 10;
  if (!candidate.exactIdentityHash && Number(candidate.nameSimilarity) >= 0.9) score += 45;
  else if (!candidate.exactIdentityHash && Number(candidate.nameSimilarity) >= 0.75) score += 25;

  return {
    classification: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    score: Math.min(score, 100),
    autoMerge: false
  };
}
