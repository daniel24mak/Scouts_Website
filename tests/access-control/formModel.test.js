import test from "node:test";
import assert from "node:assert/strict";
import {
  canShareFormRow,
  formatPhoneAnswer,
  getAnswerScalar,
  moveFormQuestion,
  normalizeFormQuestion,
  normalizePhoneAnswer,
  validatePhoneAnswer
} from "../../src/features/forms/formModel.js";

test("legacy questions remain full width and receive a stable row", () => {
  const question = normalizeFormQuestion({
    id: "question-1",
    type: "short_text",
    text: "Name"
  });

  assert.deepEqual(question.layout, {
    rowId: "row-question-1",
    width: "full"
  });
});

test("long answers and uploads are always full width", () => {
  for (const type of ["long_text", "file_upload", "image_upload", "protected_document_upload"]) {
    const question = normalizeFormQuestion({
      id: `question-${type}`,
      type,
      layout: { rowId: "shared-row", width: "half" }
    });

    assert.equal(question.layout.width, "full");
  }
});

test("row capacity prevents question widths from exceeding one row", () => {
  const half = { id: "a", type: "short_text", layout: { rowId: "row-a", width: "half" } };
  const third = { id: "b", type: "short_text", layout: { rowId: "row-b", width: "one_third" } };
  const twoThirds = { id: "c", type: "short_text", layout: { rowId: "row-c", width: "two_thirds" } };

  assert.equal(canShareFormRow([half], half), true);
  assert.equal(canShareFormRow([third], twoThirds), true);
  assert.equal(canShareFormRow([half], twoThirds), false);
});

test("moving a compatible field beside another field preserves a valid row", () => {
  const schema = {
    pages: [{ id: "page-1", order: 0 }],
    questions: [
      { id: "a", pageId: "page-1", order: 0, type: "short_text", layout: { rowId: "row-a", width: "half" } },
      { id: "b", pageId: "page-1", order: 1, type: "short_text", layout: { rowId: "row-b", width: "half" } }
    ]
  };

  const moved = moveFormQuestion(schema, "b", "a");

  assert.deepEqual(moved.questions.map((question) => question.id), ["a", "b"]);
  assert.equal(moved.questions[0].layout.rowId, moved.questions[1].layout.rowId);
});

test("moving a field between pages updates its page and keeps rows within capacity", () => {
  const schema = {
    pages: [{ id: "page-1", order: 0 }, { id: "page-2", order: 1 }],
    questions: [
      { id: "a", pageId: "page-1", order: 0, type: "short_text", layout: { rowId: "row-a", width: "two_thirds" } },
      { id: "b", pageId: "page-2", order: 0, type: "short_text", layout: { rowId: "row-b", width: "half" } }
    ]
  };

  const moved = moveFormQuestion(schema, "b", "a");
  const movedQuestion = moved.questions.find((question) => question.id === "b");

  assert.equal(movedQuestion.pageId, "page-1");
  assert.notEqual(movedQuestion.layout.rowId, moved.questions.find((question) => question.id === "a").layout.rowId);
  assert.deepEqual(moved.questions.filter((question) => question.pageId === "page-1").map((question) => question.order), [0, 1]);
});

test("phone answers normalize to separate components and E.164", () => {
  const answer = normalizePhoneAnswer({
    country: "AE",
    nationalNumber: "501234567"
  });

  assert.deepEqual(answer, {
    e164: "+971501234567",
    country: "AE",
    callingCode: "+971",
    nationalNumber: "501234567"
  });
  assert.equal(formatPhoneAnswer(answer), "+971 50 123 4567");
  assert.equal(getAnswerScalar(answer), "+971501234567");
});

test("phone validation accepts valid numbers and explains invalid input", () => {
  const question = normalizeFormQuestion({
    id: "phone-1",
    type: "phone",
    required: true,
    phoneSettings: {
      countryMode: "single",
      allowedCountry: "AE",
      defaultCountry: "AE"
    }
  });

  assert.equal(
    validatePhoneAnswer(question, normalizePhoneAnswer({ country: "AE", nationalNumber: "501234567" })),
    ""
  );
  assert.equal(
    validatePhoneAnswer(question, normalizePhoneAnswer({ country: "US", nationalNumber: "2025550123" })),
    "Use a United Arab Emirates phone number."
  );
  assert.equal(
    validatePhoneAnswer(question, { country: "AE", nationalNumber: "123" }),
    "Enter a valid phone number."
  );
});
