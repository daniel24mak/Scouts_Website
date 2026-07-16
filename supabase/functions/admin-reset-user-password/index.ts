import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { AuthorizationError, parseUuid, requireDashboardPermission, writeSecurityAudit } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  try {
    const context = await requireDashboardPermission(req, "users.reset_password");
    const body = await req.json().catch(() => { throw new AuthorizationError("Invalid request body", 400); });
    const userId = parseUuid(body.user_id);
    const { data: target, error: targetError } = await context.adminClient
      .from("user_profiles").select("id,email").eq("id", userId).maybeSingle();
    if (targetError || !target?.email) throw new AuthorizationError("User not found", 404);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL");
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, ...(siteUrl ? { redirect_to: siteUrl } : {}) })
    });
    if (!response.ok) throw new AuthorizationError("The recovery email could not be sent", 400);
    await writeSecurityAudit(context, "user.password_recovery_sent", userId, "success");
    return jsonResponse(req, { success: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return jsonResponse(req, { error: error instanceof AuthorizationError ? error.message : "Password recovery failed" }, status);
  }
});
