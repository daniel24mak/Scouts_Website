# Form Response Email Design

## Goal

Add a validated Email question type and optional submission-receipt delivery to the existing Forms system without changing how responses are stored. Email delivery must be server-side, must never expose provider credentials, and must never prevent a valid response from being saved.

## Builder Experience

The question type list gains an `Email` option. Email questions retain the existing question controls, including title, description, required state, width, container style, conditions, and page placement. Answers are trimmed and validated as email addresses before review and submission.

Posting settings gain a `Response email` control with three modes:

1. `Do not send`: store the response only.
2. `Send to entered email`: select one Email question as the receipt address.
3. `Send to dashboard respondent`: use the authenticated respondent's profile email.

`Send to entered email` is available to public and authenticated forms. The selected question must exist and have the Email type before the form can be posted. `Send to dashboard respondent` is only valid for forms restricted to authenticated dashboard users. Public forms cannot be posted with this mode.

All existing forms normalize to `Do not send`, preserving current behavior.

## Submission Flow

The response is saved first using the existing submission workflow. After a successful final submission, the frontend calls a dedicated Supabase Edge Function with the saved submission identifier and form context. Draft saves never send email.

For public registration submissions, the registration Edge Function invokes the same server-side delivery helper after the database transaction succeeds. The recipient comes from the configured Email answer. Public callers cannot supply an arbitrary recipient outside the stored answer.

For dashboard submissions, the Edge Function reloads the posted form, saved submission, schema, and respondent profile using its trusted Supabase client. It derives the recipient from either the configured Email answer or the authenticated respondent's profile. It does not trust a recipient or rendered email body supplied by the browser.

Repeated submission requests are idempotent. A delivery record keyed by submission and recipient prevents accidental duplicate emails.

## Email Content

The email contains:

- Form title
- Submission timestamp and reference where available
- Each visible question and its submitted answer, in form order
- A short privacy notice

Rich text is converted to safe email HTML. Arrays are rendered as lists. Empty optional answers are shown as `Not answered`. Upload questions never expose storage paths, signed URLs, or files. They display `File received` and the safe original filename when available.

## Delivery Infrastructure

Create a Supabase Edge Function for response-email delivery. It uses server-side secrets:

- `FORM_EMAIL_PROVIDER_API_KEY`
- `FORM_EMAIL_FROM`
- `FORM_EMAIL_REPLY_TO` (optional)

The initial provider adapter targets Resend's HTTP API without adding a frontend dependency. The sender address is not hardcoded. A verified St. Mary's Scouts sender can be configured later by updating `FORM_EMAIL_FROM`.

If email secrets are missing or the provider rejects delivery, the saved submission remains successful. The delivery attempt is recorded as failed, and the UI reports that the response was saved but the email copy could not be sent.

## Data Model

Form delivery settings live inside the existing form settings JSON to avoid changing existing form tables:

```json
{
  "responseEmail": {
    "mode": "none",
    "emailQuestionId": null
  }
}
```

Add a `form_response_email_deliveries` table for operational reliability:

- submission source and submission ID
- posted form or campaign ID
- recipient email hash and masked recipient
- delivery status
- provider message ID
- attempt count
- last error
- created, attempted, and delivered timestamps

RLS denies direct public writes. Only trusted Edge Functions create or update delivery rows. Authorized form managers may read delivery status for forms they can manage.

## Error Handling

- Invalid Email answers block review/submission with an inline error.
- Missing configured Email questions block posting in the builder review.
- Missing dashboard profile email blocks only email delivery, not response storage.
- Provider/network failures do not roll back submissions.
- Errors are sanitized before display and logging.
- Retry requests use the delivery record and never create uncontrolled duplicate mail.

## Security And Privacy

- Provider secrets remain in Supabase secrets only.
- The browser never builds authoritative recipient lists or sends provider requests.
- The server verifies the saved form mode, recipient source, and submission ownership.
- Protected uploads and private URLs are excluded.
- Email delivery defaults off for all old and new forms.
- Public submission rate limits and existing anti-abuse checks remain in force.

## Testing

Add focused tests for:

- Email question normalization and validation
- Legacy forms defaulting to no email
- Posting validation for each delivery mode
- Recipient resolution from entered answers and dashboard profiles
- Safe formatting of all answer types
- Protected upload redaction
- Drafts never sending
- Successful, failed, and duplicate delivery attempts

Run the focused tests, production build, and Playwright checks for builder settings, public forms, dashboard forms, mobile layout, and both themes.

## Deployment

Deployment requires:

1. Run the delivery-table SQL migration.
2. Deploy the response-email Edge Function and the updated registration function.
3. Set the provider and sender Supabase secrets.
4. Submit one test public form and one authenticated dashboard form.
5. Confirm delivery status and verify that protected upload links are absent.
