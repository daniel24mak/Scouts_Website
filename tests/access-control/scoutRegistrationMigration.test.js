import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../../database/supabase-scout-registration.sql", import.meta.url), "utf8");

test("registration migration creates the complete protected lifecycle", () => {
  for (const table of [
    "registration_campaigns",
    "scout_registration_drafts",
    "scout_registration_submissions",
    "scout_registration_people",
    "scout_registration_parent_contacts",
    "scout_registration_documents",
    "scout_registration_duplicate_matches",
    "scout_registration_reviews",
    "scout_registration_consents",
    "scout_season_enrollments",
    "registration_retention_jobs",
    "registration_document_access_logs"
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
  }
});

test("registration migration accepts every supported form kind", () => {
  assert.match(sql, /posted_forms_form_kind_check/i);
  assert.match(sql, /'standard'[\s\S]*'reimbursement'[\s\S]*'scout_registration'/i);

  const incremental = fs.readFileSync(
    new URL("../../database/supabase-forms-posting-submission-fix.sql", import.meta.url),
    "utf8"
  );
  assert.match(incremental, /posted_forms_form_kind_check/i);
  assert.match(incremental, /'standard'[\s\S]*'reimbursement'[\s\S]*'scout_registration'/i);
});

test("registration storage remains private and paths are generated server-side", () => {
  for (const bucket of ["scout-headshots", "identity-documents", "form-attachments"]) {
    assert.match(sql, new RegExp(`'${bucket}'[\\s\\S]{0,120}false`, "i"));
  }
  assert.match(sql, /gen_random_uuid\(\)/i);
  assert.doesNotMatch(sql, /public_url/i);
});

test("registration permissions include scoped verification and protected identity access", () => {
  for (const permission of [
    "registration.verify",
    "identity_documents.view",
    "identity_documents.verify",
    "registration.manage_all_groups"
  ]) {
    assert.match(sql, new RegExp(permission.replace(".", "\\."), "i"));
  }
  assert.match(sql, /has_permission_for_group/i);
  assert.match(sql, /assignment\.position IN \('head_chief', 'vice_chief', 'coordinator'\)/i);
  assert.match(sql, /SELECT 'chief', permission_id/i);
});

test("public registration uses RPC contracts rather than anonymous table grants", () => {
  assert.match(sql, /FUNCTION public\.get_public_registration_campaign/i);
  assert.match(sql, /FUNCTION public\.submit_public_scout_registration/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_public_registration_campaign/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,100}TO\s+anon/i);
});

test("public registration can resolve pgcrypto consent hashing", () => {
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions/i);
  assert.match(
    sql,
    /FUNCTION public\.submit_public_scout_registration[\s\S]*?SET search_path = public, extensions[\s\S]*?digest\(campaign\.consent_text, 'sha256'\)/i
  );
});

test("registration storage access is short lived and audited", () => {
  const edge = fs.readFileSync(new URL("../../supabase/functions/scout-registration-admin/index.ts", import.meta.url), "utf8");
  assert.match(edge, /createSignedUrl\(document\.object_path,\s*60\)/);
  assert.match(edge, /registration_document_access_logs/);
  assert.match(edge, /requireRegistrationScope/);
  assert.match(edge, /action === "delete_document"/);
  assert.match(edge, /\.remove\(\[document\.object_path\]\)/);
  assert.match(edge, /verification_status:\s*"deleted"/);
});

test("registration enrollment can save reviewer-supplied scout and group details", () => {
  const edge = fs.readFileSync(new URL("../../supabase/functions/scout-registration-admin/index.ts", import.meta.url), "utf8");

  assert.match(edge, /enrollmentDetails/);
  assert.match(edge, /scout_registration_people/);
  assert.match(edge, /targetGroupId/);
  assert.match(edge, /requested_group_id/);
});

test("registration reviewers can list document metadata without bypassing protected reveal", () => {
  const edge = fs.readFileSync(new URL("../../supabase/functions/scout-registration-admin/index.ts", import.meta.url), "utf8");
  const metadataPolicy = sql.match(
    /CREATE POLICY "registration documents metadata reviewed"[\s\S]*?\);\s*DROP POLICY/i
  )?.[0] ?? "";

  assert.match(metadataPolicy, /can_manage_registration_group/i);
  assert.doesNotMatch(metadataPolicy, /identity_documents\.view/i);
  assert.match(edge, /reveal_document[\s\S]{0,180}identity_documents\.view/i);
});

test("registration storage usage is calculated server-side for authorized users", () => {
  assert.match(sql, /FUNCTION public\.get_registration_storage_summary\(\)/i);
  assert.match(sql, /has_permission\('registration\.storage\.view'\)/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_registration_storage_summary\(\) TO authenticated/i);
});

test("public submission validates required files and a bot honeypot on the server", () => {
  const edge = fs.readFileSync(new URL("../../supabase/functions/scout-registration/index.ts", import.meta.url), "utf8");
  assert.match(edge, /body\.get\("website"\)/);
  assert.match(edge, /require_headshot,require_id_front,require_id_back/);
  assert.match(edge, /Upload every required registration document/);
});
