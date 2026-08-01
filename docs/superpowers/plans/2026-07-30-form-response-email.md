# Form Response Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Email question type and optional, secure full-response email receipts for submitted dashboard and public registration forms.

**Architecture:** Form delivery settings remain inside the existing versioned form schema. Final submissions are saved first, then a trusted Edge Function/shared server helper resolves the allowed recipient, formats the stored form response, sends through a configured provider, and records an idempotent delivery attempt. Drafts never trigger email and delivery failure never removes a saved response.

**Tech Stack:** React 18, Vite, Supabase Postgres/RLS, Supabase Edge Functions (Deno), Resend HTTP API, Node test runner.

## Global Constraints

- Preserve current form storage, routing, permissions, registration, reimbursement, and submission behavior.
- Never expose provider credentials or a private sender credential in frontend code.
- Existing forms must default to no email delivery.
- Every Email answer remains a normal stored form response regardless of delivery mode.
- Public forms cannot use an authenticated dashboard-profile recipient.
- Protected uploads must never expose private object paths or URLs in email.
- Delivery failures must be non-destructive and visible as a warning after a successful submission.

---

### Task 1: Form model and validation

**Files:**
- Modify: `src/services/formService.js`
- Modify: `src/features/forms/FormsDashboard.jsx`
- Test: `tests/access-control/formModel.test.js`

**Interfaces:**
- Produces: question type `email`
- Produces: `settings.responseEmail = { mode, questionId }`
- Produces: email validation shared by builder/filler checks

- [ ] **Step 1: Write failing tests**

Add assertions that Email is a supported type, that response-email settings normalize to `none`, and that invalid delivery settings are rejected by builder review.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/access-control/formModel.test.js`
Expected: FAIL because the Email type and settings do not exist.

- [ ] **Step 3: Implement the model**

Add `["email", "Email address"]`, normalize `responseEmail.mode` to `none | entered_email | dashboard_profile`, and preserve a selected Email question ID only for `entered_email`.

- [ ] **Step 4: Implement builder and form UI**

Render Email fields as `<input type="email" inputMode="email" autoComplete="email">`. Add posting controls for no email, entered-address email, and dashboard-profile email; show only Email questions in the recipient selector and block invalid public combinations.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/access-control/formModel.test.js`
Expected: PASS.

### Task 2: Delivery formatter and database log

**Files:**
- Create: `supabase/functions/_shared/formResponseEmail.ts`
- Create: `database/supabase-form-response-emails.sql`
- Create: `tests/access-control/formResponseEmail.test.js`

**Interfaces:**
- Produces: `deliverFormResponseEmail(adminClient, request)`
- Produces: table `public.form_response_email_deliveries`

- [ ] **Step 1: Write failing formatter tests**

Cover recipient selection, invalid/missing email, visible-question ordering, multilingual answers, HTML escaping, upload redaction, and stable idempotency keys.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/access-control/formResponseEmail.test.js`
Expected: FAIL because the formatter module does not exist.

- [ ] **Step 3: Create the SQL migration**

Create a delivery table keyed by source type, source submission ID, and recipient; enable RLS; expose read access only through existing form-management authorization; grant no browser write access.

- [ ] **Step 4: Implement the shared helper**

Reload the posted form and saved submission, normalize settings, resolve only the configured recipient, format visible questions and answers, redact protected uploads, claim the idempotency row, call Resend using Edge Function secrets, and update delivery status.

- [ ] **Step 5: Run formatter tests**

Run: `node --test tests/access-control/formResponseEmail.test.js`
Expected: PASS.

### Task 3: Dashboard final-submission delivery

**Files:**
- Create: `supabase/functions/send-form-response-email/index.ts`
- Modify: `src/services/formService.js`
- Modify: `src/api/client.js`
- Modify: `src/features/forms/FormsDashboard.jsx`

**Interfaces:**
- Consumes: `deliverFormResponseEmail`
- Produces: `sendDashboardFormResponseEmail(submissionId)`

- [ ] **Step 1: Create the authenticated Edge Function**

Require a valid active dashboard user, verify the saved submission belongs to the caller or the caller can manage forms, then invoke the shared helper for `form_submission`.

- [ ] **Step 2: Add the frontend service call**

After `saveDashboardFormSubmission` returns a submitted record, invoke `send-form-response-email` with only the saved submission ID. Do not invoke it for drafts.

- [ ] **Step 3: Add non-destructive status feedback**

Keep submission success when delivery is skipped or fails, and show a concise warning that the response was saved but the email could not be sent.

- [ ] **Step 4: Verify dashboard flow**

Run focused tests and manually submit a form in each delivery mode with provider secrets absent; verify the response remains saved.

### Task 4: Public registration delivery

**Files:**
- Modify: `supabase/functions/scout-registration/index.ts`
- Modify: `src/pages/ScoutRegistrationPage.jsx`

**Interfaces:**
- Consumes: `deliverFormResponseEmail`
- Produces: registration response property `emailDelivery`

- [ ] **Step 1: Invoke delivery after successful registration**

After uploads and duplicate checks succeed, invoke the shared helper with the saved registration submission ID and the campaign’s posted form. Never invoke it for saved drafts.

- [ ] **Step 2: Return delivery status**

Return the registration result plus `emailDelivery`, without turning a provider failure into a failed registration.

- [ ] **Step 3: Show public confirmation feedback**

Keep the registration reference and success state. Add a warning only when a configured receipt could not be delivered.

- [ ] **Step 4: Verify public restrictions**

Confirm `dashboard_profile` cannot be posted for a public registration and entered-address mode uses only the configured Email question answer.

### Task 5: Full verification and deployment notes

**Files:**
- Modify only if verification finds a scoped defect.

**Interfaces:**
- Produces: verified build and deployment commands

- [ ] **Step 1: Run tests**

Run: `npm run test:access-control`
Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build completes successfully.

- [ ] **Step 3: Inspect UI**

Use Playwright at desktop and mobile widths to verify Email inputs, posting controls, public restrictions, review formatting, and no overflow in light/dark dashboard themes.

- [ ] **Step 4: Document manual deployment**

Report the exact SQL migration, Edge Function deployments, and `FORM_EMAIL_PROVIDER_API_KEY`, `FORM_EMAIL_FROM`, and optional `FORM_EMAIL_REPLY_TO` secrets. State clearly that email remains safely skipped until these secrets are configured.
