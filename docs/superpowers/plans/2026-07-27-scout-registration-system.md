# Scout Registration System Implementation Plan

## Architecture

Extend the existing Forms builder and posted-form lifecycle. Registration-specific
data lives in focused tables and services so `FormsDashboard.jsx` and
`AdminDashboardPage.jsx` remain integration points rather than new monoliths.

## Phase 1: Domain and security foundation

- Add `database/supabase-scout-registration.sql`.
- Add registration permissions, campaigns, public drafts, submissions, people,
  parent contacts, documents, duplicate matches, verification reviews, consent,
  scout-season enrollments, retention jobs, and access logs.
- Create private `scout-headshots`, `identity-documents`, and `form-attachments`
  buckets. Store UUID-only object paths and metadata, never public URLs.
- Enforce RLS, group-scoped review, short-lived document access, immutable
  verification history, and permission-aware RPCs.

## Phase 2: Forms extension

- Add file, image, protected-document, and scout-headshot question types.
- Normalize per-question upload constraints and PDF processing settings.
- Add `scout_registration` as a form purpose.
- Extract registration campaign settings into a dedicated component.
- Preserve standard and reimbursement behavior.

## Phase 3: Public registration

- Add `/register` and `/register/:campaignSlug`.
- Add campaign-state, returning/new path, draft/resume, consent, secure lookup,
  upload confirmation, and submission flows.
- Use generic lookup responses and server-side verification. Never expose scout
  records from an unauthenticated direct table query.
- Keep CAPTCHA/provider integration configurable and fail closed when required
  server configuration is absent.

## Phase 4: Dashboard operations

- Add Registration Campaigns and Registration Center under Forms.
- Add queues for pending review, duplicates, verified, approved, waitlisted,
  rejected, and document retention.
- Add group verification, protected document reveal, old/new comparison,
  duplicate decisions, approval, and bulk season enrollment.
- Keep historical contributions and season history immutable.

## Phase 5: Compatibility and operations

- Rename the existing upload page to Registration & Season Import while preserving
  spreadsheet import.
- Add safe registration exports that exclude private paths and sensitive document
  identifiers.
- Add storage monitoring and explicit season-end retention actions.
- Provide architecture for historical Google Forms import without guessing at
  source formats.

## Verification

- Node tests cover pure registration rules and migration security contracts.
- Existing access-control tests continue to pass.
- Production build passes.
- Playwright covers public registration and dashboard route smoke tests where
  credentials and local Supabase data are available.
- Graphify is refreshed after implementation.

## Deployment prerequisites

- Run `database/supabase-scout-registration.sql`.
- Deploy the registration Edge Function(s).
- Configure allowed origins and optional CAPTCHA/email provider secrets in
  Supabase, not in frontend `.env` files committed to Git.

