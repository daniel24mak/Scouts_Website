import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { deliverFormResponseEmail } from "../_shared/formResponseEmail.ts";

function validUuid(value: unknown) {
  const candidate = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(candidate)
    ? candidate
    : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(req, { error: "Server configuration error" }, 500);
    }
    if (!authorization?.startsWith("Bearer ")) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse(req, { error: "Unauthorized" }, 401);
    const { data: profile } = await adminClient.from("user_profiles")
      .select("account_status").eq("id", authData.user.id).maybeSingle();
    if (profile?.account_status !== "active") return jsonResponse(req, { error: "This account is not active" }, 403);

    const body = await req.json().catch(() => ({}));
    const submissionId = validUuid(body.submissionId);
    if (!submissionId) return jsonResponse(req, { error: "Submission is invalid" }, 400);
    const { data: submission, error: submissionError } = await adminClient.from("form_submissions")
      .select("id,submitted_by,status").eq("id", submissionId).maybeSingle();
    if (submissionError || !submission) return jsonResponse(req, { error: "Submission was not found" }, 404);
    if (submission.submitted_by !== authData.user.id) return jsonResponse(req, { error: "Forbidden" }, 403);
    if (submission.status !== "submitted") return jsonResponse(req, { status: "skipped", reason: "draft" });

    const result = await deliverFormResponseEmail(adminClient, {
      sourceType: "form_submission",
      submissionId
    });
    return jsonResponse(req, result, result.status === "failed" ? 202 : 200);
  } catch (error) {
    return jsonResponse(req, {
      status: "failed",
      error: error instanceof Error ? error.message : "Email delivery failed"
    }, 202);
  }
});
