import test from "node:test";
import assert from "node:assert/strict";
import {
  canShareFormRow,
  formatPhoneAnswer,
  getAnswerScalar,
  getOrderedFormQuestions,
  moveFormQuestion,
  normalizeFormAppearanceSettings,
  normalizeFormResponseEmailSettings,
  normalizeFormQuestion,
  packFormQuestionRows,
  normalizePhoneAnswer,
  validateEmailAnswer,
  validateExpectedAnswer,
  validateFormResponseEmailSettings,
  validatePhoneAnswer
} from "../../src/features/forms/formModel.js";

test("expected-answer rules remain disabled for existing questions", () => {
  const question = normalizeFormQuestion({ id: "question-1", type: "yes_no" });

  assert.deepEqual(question.expectedAnswer, {
    enabled: false,
    value: "",
    message: ""
  });
  assert.equal(validateExpectedAnswer(question, "No"), "");
});

test("expected-answer rules block a mismatched answer with the configured message", () => {
  const question = normalizeFormQuestion({
    id: "question-1",
    type: "yes_no",
    expectedAnswer: {
      enabled: true,
      value: "Yes",
      message: "Please complete the required step, then select Yes."
    }
  });

  assert.equal(validateExpectedAnswer(question, "yes"), "");
  assert.equal(
    validateExpectedAnswer(question, "No"),
    "Please complete the required step, then select Yes."
  );
});

test("expected-answer rules support checkbox answers without depending on order", () => {
  const question = normalizeFormQuestion({
    id: "question-1",
    type: "checkboxes",
    expectedAnswer: {
      enabled: true,
      value: ["Medical form", "Consent"],
      message: "Select both required confirmations."
    }
  });

  assert.equal(validateExpectedAnswer(question, ["Consent", "Medical form"]), "");
  assert.equal(validateExpectedAnswer(question, ["Consent"]), "Select both required confirmations.");
});

test("expected-answer instructions preserve spaces while they are being edited", () => {
  const question = normalizeFormQuestion({
    id: "question-1",
    type: "yes_no",
    expectedAnswer: {
      enabled: true,
      value: "Yes",
      message: "Please complete this step "
    }
  });

  assert.equal(question.expectedAnswer.message, "Please complete this step ");
  assert.equal(validateExpectedAnswer(question, "No"), "Please complete this step");
});

test("form appearance shows question numbers for existing forms by default", () => {
  assert.equal(normalizeFormAppearanceSettings().showQuestionNumbers, true);
  assert.equal(normalizeFormAppearanceSettings({ accentColor: "#123456" }).showQuestionNumbers, true);
});

test("form appearance preserves an explicit choice to hide question numbers", () => {
  assert.equal(normalizeFormAppearanceSettings({ showQuestionNumbers: false }).showQuestionNumbers, false);
});

test("form questions follow page order and then question order", () => {
  const questions = getOrderedFormQuestions({
    pages: [
      { id: "page-2", order: 2 },
      { id: "page-1", order: 1 }
    ],
    questions: [
      { id: "third", pageId: "page-2", order: 0 },
      { id: "second", pageId: "page-1", order: 1 },
      { id: "first", pageId: "page-1", order: 0 }
    ]
  });

  assert.deepEqual(questions.map((question) => question.id), ["first", "second", "third"]);
});

test("legacy questions remain full width and receive a stable row", () => {
  const question = normalizeFormQuestion({
    id: "question-1",
    type: "short_text",
    text: "Name"
  });

  assert.deepEqual(question.layout, {
    rowId: "row-question-1",
    width: "full",
    surface: "default"
  });
});

test("consecutive half-width questions automatically share a row", () => {
  const questions = packFormQuestionRows([
    { id: "first", pageId: "page-1", order: 0, type: "short_text", layout: { width: "half" } },
    { id: "second", pageId: "page-1", order: 1, type: "short_text", layout: { width: "half" } }
  ]);

  assert.equal(questions[0].layout.rowId, questions[1].layout.rowId);
  assert.equal(questions[0].layout.width, "half");
  assert.equal(questions[1].layout.width, "half");
});

test("row packing starts a new row when the next field would exceed capacity", () => {
  const questions = packFormQuestionRows([
    { id: "first", pageId: "page-1", order: 0, type: "short_text", layout: { width: "two_thirds" } },
    { id: "second", pageId: "page-1", order: 1, type: "short_text", layout: { width: "half" } }
  ]);

  assert.notEqual(questions[0].layout.rowId, questions[1].layout.rowId);
});

test("question surface style is normalized without changing legacy forms", () => {
  assert.equal(normalizeFormQuestion({ id: "default" }).layout.surface, "default");
  assert.equal(normalizeFormQuestion({ id: "boxed", layout: { surface: "boxed" } }).layout.surface, "boxed");
  assert.equal(normalizeFormQuestion({ id: "plain", layout: { surface: "plain" } }).layout.surface, "plain");
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

test("email answers are stored as text and validated without restricting languages elsewhere", () => {
  const question = normalizeFormQuestion({
    id: "email-1",
    type: "email",
    required: true
  });

  assert.equal(validateEmailAnswer(question, "parent@example.com"), "");
  assert.equal(validateEmailAnswer(question, "not-an-email"), "Enter a valid email address.");
  assert.equal(validateEmailAnswer(question, ""), "Enter an email address.");
  assert.equal(validateEmailAnswer({ ...question, required: false }, ""), "");
});

test("response email settings default to no delivery for existing forms", () => {
  assert.deepEqual(normalizeFormResponseEmailSettings(), {
    mode: "none",
    questionId: ""
  });
  assert.deepEqual(normalizeFormResponseEmailSettings({
    mode: "entered_email",
    questionId: "email-1"
  }), {
    mode: "entered_email",
    questionId: "email-1"
  });
});

test("entered email delivery requires an email question", () => {
  const questions = [
    { id: "name-1", type: "short_text" },
    { id: "email-1", type: "email" }
  ];

  assert.equal(validateFormResponseEmailSettings(
    { mode: "entered_email", questionId: "email-1" },
    questions,
    { publicForm: true }
  ), "");
  assert.equal(validateFormResponseEmailSettings(
    { mode: "entered_email", questionId: "name-1" },
    questions,
    { publicForm: false }
  ), "Choose an Email question for the receipt recipient.");
});

test("dashboard profile delivery is rejected for public forms", () => {
  assert.equal(validateFormResponseEmailSettings(
    { mode: "dashboard_profile" },
    [],
    { publicForm: true }
  ), "Public forms cannot send to a dashboard profile email.");
  assert.equal(validateFormResponseEmailSettings(
    { mode: "dashboard_profile" },
    [],
    { publicForm: false }
  ), "");
});
