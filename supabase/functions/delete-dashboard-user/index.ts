import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { AuthorizationError, parseUuid, requireDashboardPermission, writeSecurityAudit } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  try {
    const context = await requireDashboardPermission(req, "users.delete");
    const body = await req.json().catch(() => { throw new AuthorizationError("Invalid request body", 400); });
    const userId = parseUuid(body.user_id);
    if (userId === context.callerId) throw new AuthorizationError("You cannot delete your own account", 400);
    const { data: target } = await context.adminClient.from("user_profiles").select("id").eq("id", userId).maybeSingle();
    if (!target) throw new AuthorizationError("User not found", 404);

    const { data: targetIsSystemAdmin } = await context.adminClient.rpc("is_system_administrator", { target_user_id: userId });
    if (targetIsSystemAdmin === true) {
      const now = new Date().toISOString();
      const { count } = await context.adminClient.from("user_role_assignments")
        .select("id,user_profiles!inner(account_status)", { count: "exact", head: true })
        .eq("role_id", "system_administrator").eq("scope_type", "global").is("scope_id", null)
        .eq("user_profiles.account_status", "active")
        .neq("user_id", userId).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`);
      if (!count) throw new AuthorizationError("The final active System Administrator cannot be deleted", 409);
    }

    const { error: deleteError } = await context.adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw new AuthorizationError("The user could not be deleted", 400);
    await writeSecurityAudit(context, "user.deleted", null, "success", { target_user_id: userId });
    return jsonResponse(req, { success: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return jsonResponse(req, { error: error instanceof AuthorizationError ? error.message : "User deletion failed" }, status);
  }
});
