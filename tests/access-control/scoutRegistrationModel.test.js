import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateAgeOnDate,
  classifyDuplicateCandidate,
  getRegistrationAvailability,
  normalizeRegistrationSettings,
  normalizeUploadQuestion
} from "../../src/features/registration/registrationModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("registration settings default to a secure returning-scout campaign", () => {
  const settings = normalizeRegistrationSettings({});

  assert.equal(settings.returningEnabled, true);
  assert.equal(settings.newEnabled, false);
  assert.equal(settings.requireParentVerification, true);
  assert.equal(settings.requireVerification, true);
  assert.equal(settings.allowDrafts, true);
  assert.equal(settings.newScoutWaitlist, false);
});

test("campaign availability distinguishes scheduled, open, waitlist, and closed", () => {
  const base = {
    returningEnabled: true,
    newEnabled: true,
    returningOpensAt: "2026-08-01T00:00:00.000Z",
    newOpensAt: "2026-08-10T00:00:00.000Z",
    closesAt: "2026-08-31T23:59:59.000Z",
    newScoutWaitlist: true,
    capacity: 1,
    approvedCount: 1
  };

  assert.equal(getRegistrationAvailability(base, "returning", new Date("2026-07-20T00:00:00Z")).state, "scheduled");
  assert.equal(getRegistrationAvailability(base, "returning", new Date("2026-08-05T00:00:00Z")).state, "open");
  assert.equal(getRegistrationAvailability(base, "new", new Date("2026-08-12T00:00:00Z")).state, "waitlist");
  assert.equal(getRegistrationAvailability(base, "new", new Date("2026-09-01T00:00:00Z")).state, "closed");
});

test("age is calculated at the campaign reference date", () => {
  assert.equal(calculateAgeOnDate("2014-08-04", "2026-08-03"), 11);
  assert.equal(calculateAgeOnDate("2014-08-04", "2026-08-04"), 12);
  assert.equal(calculateAgeOnDate("", "2026-08-04"), null);
});

test("public registration uses the configured form instead of built-in scout fields", () => {
  const page = read("../../src/pages/ScoutRegistrationPage.jsx");

  assert.doesNotMatch(page, /Scout and parent details/);
  assert.doesNotMatch(page, /Tell us about the scout/);
  assert.match(page, /sourceSnapshot:/);
  assert.match(page, /setStep\("questions"\)/);
});

test("public registration SQL only creates a scout profile when structured scout details exist", () => {
  const migration = read("../../database/supabase-scout-registration.sql");

  assert.match(migration, /IF length\(btrim\(COALESCE\(person ->> 'fullName', ''\)\)\) > 0 THEN/);
  assert.match(migration, /INSERT INTO public\.scout_registration_people/);
  assert.match(migration, /registration_path = 'returning'\s+AND length\(btrim\(COALESCE\(person ->> 'fullName', ''\)\)\) > 0/);
});

test("registration review displays custom form answers and does not enroll generic registrations", () => {
  const center = read("../../src/features/registration/RegistrationCenter.jsx");

  assert.match(center, /answersFor\(selected\)/);
  assert.match(center, /Form responses/);
  assert.match(center, /no scout profile/);
});

test("upload questions retain per-question PDF and privacy controls", () => {
  const upload = normalizeUploadQuestion({
    type: "protected_document_upload",
    maxFiles: 2,
    maxFileSizeMb: 8,
    acceptedFormats: ["pdf", "jpg"],
    pdfProcessing: "original_and_previews"
  });

  assert.equal(upload.privateClassification, "protected");
  assert.equal(upload.requiresVerification, true);
  assert.equal(upload.maxFiles, 2);
  assert.equal(upload.maxFileSizeMb, 8);
  assert.deepEqual(upload.acceptedFormats, ["pdf", "jpg"]);
  assert.equal(upload.pdfProcessing, "original_and_previews");
  assert.equal(upload.storageCategory, "identity_front");
});

test("protected upload purpose recognizes ID front and preserves explicit ID back", () => {
  assert.equal(normalizeUploadQuestion({
    type: "protected_document_upload",
    text: "ID Front",
    storageCategory: "identity_document"
  }).storageCategory, "identity_front");
  assert.equal(normalizeUploadQuestion({
    type: "protected_document_upload",
    text: "Identity document",
    storageCategory: "identity_back"
  }).storageCategory, "identity_back");
});

test("duplicate classification never auto-merges candidates", () => {
  assert.deepEqual(
    classifyDuplicateCandidate({ exactIdentityHash: true, dateOfBirthMatch: true, parentPhoneMatch: true }),
    { classification: "high", score: 100, autoMerge: false }
  );
  assert.equal(classifyDuplicateCandidate({ nameSimilarity: 0.91, dateOfBirthMatch: true }).classification, "medium");
  assert.equal(classifyDuplicateCandidate({ nameSimilarity: 0.45 }).classification, "low");
});
