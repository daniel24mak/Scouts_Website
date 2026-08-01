import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFormResponseEmail,
  getFormResponseRecipient,
  getFormResponseEmailIdempotencyKey
} from "../../supabase/functions/_shared/formResponseEmail.ts";

const form = {
  id: "form-1",
  title: "Camp registration",
  description: "Summer camp",
  schemaJson: {
    settings: {
      responseEmail: {
        mode: "entered_email",
        questionId: "email-1"
      }
    },
    pages: [{ id: "page-1", order: 0, title: "Details" }],
    questions: [
      { id: "name-1", pageId: "page-1", order: 0, type: "short_text", text: "Scout name" },
      { id: "email-1", pageId: "page-1", order: 1, type: "email", text: "Parent email" },
      { id: "notes-1", pageId: "page-1", order: 2, type: "long_text", text: "ملاحظات" },
      { id: "id-front", pageId: "page-1", order: 3, type: "protected_document_upload", text: "ID Front" }
    ]
  }
};

test("entered-email mode resolves only the configured email answer", () => {
  assert.equal(getFormResponseRecipient({
    form,
    answers: {
      "email-1": " parent@example.com ",
      "name-1": "other@example.com"
    }
  }), "parent@example.com");
});

test("dashboard-profile mode resolves the authenticated respondent email", () => {
  assert.equal(getFormResponseRecipient({
    form: {
      ...form,
      schemaJson: {
        ...form.schemaJson,
        settings: { responseEmail: { mode: "dashboard_profile" } }
      }
    },
    answers: {},
    profileEmail: "chief@example.com"
  }), "chief@example.com");
});

test("invalid or absent configured recipients are rejected", () => {
  assert.equal(getFormResponseRecipient({
    form,
    answers: { "email-1": "not-an-email" }
  }), "");
  assert.equal(getFormResponseRecipient({
    form: {
      ...form,
      schemaJson: {
        ...form.schemaJson,
        settings: { responseEmail: { mode: "none" } }
      }
    },
    answers: { "email-1": "parent@example.com" }
  }), "");
});

test("response email preserves question order and multilingual answers", () => {
  const message = buildFormResponseEmail({
    form,
    answers: {
      "name-1": "Jean",
      "email-1": "parent@example.com",
      "notes-1": "مرحبا بالعالم",
      "id-front": ["identity-card.png"]
    },
    reference: "REG-100",
    submittedAt: "2026-07-30T10:00:00.000Z"
  });

  assert.match(message.subject, /Camp registration/);
  assert.match(message.text, /Reference: REG-100/);
  assert.ok(message.text.indexOf("Scout name") < message.text.indexOf("Parent email"));
  assert.match(message.text, /مرحبا بالعالم/);
});

test("protected uploads never expose paths or URLs", () => {
  const message = buildFormResponseEmail({
    form,
    answers: {
      "id-front": ["identity-card.png", "private/path/secret.pdf"]
    }
  });

  assert.match(message.text, /File received/);
  assert.doesNotMatch(message.text, /private\/path/);
  assert.doesNotMatch(message.html, /secret\.pdf/);
});

test("email HTML escapes form content", () => {
  const message = buildFormResponseEmail({
    form,
    answers: { "name-1": "<script>alert(1)</script>" }
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
});

test("email includes only questions visible for the submitted answers", () => {
  const conditionalForm = {
    ...form,
    schemaJson: {
      ...form.schemaJson,
      questions: [
        ...form.schemaJson.questions,
        {
          id: "conditional-1",
          pageId: "page-1",
          order: 4,
          type: "short_text",
          text: "Conditional detail",
          conditionalLogic: {
            enabled: true,
            sourceQuestionId: "name-1",
            operator: "equals",
            value: "Show"
          }
        }
      ]
    }
  };
  const hidden = buildFormResponseEmail({
    form: conditionalForm,
    answers: { "name-1": "Hide", "conditional-1": "Private answer" }
  });
  const visible = buildFormResponseEmail({
    form: conditionalForm,
    answers: { "name-1": "Show", "conditional-1": "Visible answer" }
  });

  assert.doesNotMatch(hidden.text, /Conditional detail/);
  assert.match(visible.text, /Visible answer/);
});

test("delivery idempotency is stable per source submission and recipient", async () => {
  const first = await getFormResponseEmailIdempotencyKey("form_submission", "submission-1", "Parent@Example.com");
  const second = await getFormResponseEmailIdempotencyKey("form_submission", "submission-1", "parent@example.com");
  const different = await getFormResponseEmailIdempotencyKey("form_submission", "submission-2", "parent@example.com");

  assert.equal(first, second);
  assert.notEqual(first, different);
});
