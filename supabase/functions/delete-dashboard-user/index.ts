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
      const { data: adminAssignments, error: adminAssignmentsError } = await context.adminClient.from("user_role_assignments")
        .select("user_id")
        .eq("role_id", "system_administrator").eq("scope_type", "global").is("scope_id", null)
        .neq("user_id", userId).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`);
      if (adminAssignmentsError) throw new AuthorizationError("System Administrator safety check failed", 500);

      const otherAdminIds = [...new Set((adminAssignments ?? []).map((assignment) => assignment.user_id).filter(Boolean))];
      if (!otherAdminIds.length) throw new AuthorizationError("The final active System Administrator cannot be deleted", 409);

      const { data: activeAdminProfiles, error: activeAdminProfilesError } = await context.adminClient.from("user_profiles")
        .select("id")
        .in("id", otherAdminIds)
        .eq("account_status", "active")
        .limit(1);
      if (activeAdminProfilesError) throw new AuthorizationError("System Administrator safety check failed", 500);
      if (!activeAdminProfiles?.length) throw new AuthorizationError("The final active System Administrator cannot be deleted", 409);
    }

    const reason = typeof body.reason === "string" && body.reason.trim().length >= 8
      ? body.reason.trim()
      : "Dashboard account retired";
    const { error: retireError } = await context.userClient.rpc("retire_dashboard_user", {
      target_user_id: userId,
      reason
    });
    if (retireError) throw new AuthorizationError(retireError.message || "The user account could not be retired", 400);

    // Keep the Auth row so contribution foreign keys retain their historical owner.
    const { error: banError } = await context.adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) throw new AuthorizationError("Access was revoked, but the Auth login could not be disabled", 500);
    await writeSecurityAudit(context, "user.auth_banned", userId, "success", { target_user_id: userId, reason });
    return jsonResponse(req, { success: true, retained_history: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return jsonResponse(req, { error: error instanceof AuthorizationError ? error.message : "User deletion failed" }, status);
  }
});
