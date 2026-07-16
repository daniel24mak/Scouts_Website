import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { AuthorizationError, requireDashboardPermission, requireSystemAdministrator, writeSecurityAudit } from "../_shared/dashboardAuthorization.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  try {
    const context = await requireDashboardPermission(req, "users.invite");
    const body = await req.json().catch(() => { throw new AuthorizationError("Invalid request body", 400); });
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "chief");
    const chiefLevel = String(body.chief_level ?? "chief");
    const groupIds = [...new Set([
      body.group_id ? String(body.group_id) : "",
      ...(Array.isArray(body.coordinator_group_ids) ? body.coordinator_group_ids.map(String) : [])
    ].filter(Boolean))];
    const permissions = (
      body.permissions && typeof body.permissions === "object" ? body.permissions : {}
    ) as Record<string, unknown>;

    if (!fullName || fullName.length > 160) throw new AuthorizationError("Enter a valid full name", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthorizationError("Enter a valid email address", 400);
    if (!new Set(["chief", "admin"]).has(role)) throw new AuthorizationError("Role is invalid", 400);
    if (!new Set(["chief", "vice", "head"]).has(chiefLevel)) throw new AuthorizationError("Chief level is invalid", 400);
    if (groupIds.length > 20) throw new AuthorizationError("Too many group assignments", 400);
    if (role === "chief" && !groupIds.length) throw new AuthorizationError("Select at least one group", 400);
    if (role === "admin") await requireSystemAdministrator(context);

    if (groupIds.length) {
      const { data: groups, error } = await context.adminClient.from("groups").select("id").in("id", groupIds);
      if (error || groups?.length !== groupIds.length) throw new AuthorizationError("One or more groups are invalid", 400);
    }

    const siteUrl = Deno.env.get("SITE_URL")?.replace(/\/$/, "");
    const { data: invitation, error: inviteError } = await context.adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(siteUrl ? { redirectTo: `${siteUrl}/` } : {})
    });
    if (inviteError || !invitation.user) throw new AuthorizationError("The invitation could not be sent", 400);
    const userId = invitation.user.id;

    const { error: profileError } = await context.adminClient.from("user_profiles").insert({
      id: userId, full_name: fullName, email, role,
      chief_level: role === "chief" ? chiefLevel : null,
      group_id: groupIds[0] ?? null,
      is_coordinator: groupIds.length > 1,
      coordinator_group_ids: groupIds,
      account_status: "active",
      profile_picture_url: body.profile_picture_url || null,
      can_publish: Boolean(permissions.can_publish),
      can_create_group_meetings: Boolean(permissions.can_create_group_meetings),
      can_edit_scouts: Boolean(permissions.can_edit_scouts),
      manage_form_templates: Boolean(permissions.manage_form_templates),
      view_all_forms: Boolean(permissions.view_all_forms),
      post_forms: Boolean(permissions.post_forms),
      must_change_password: false
    });
    if (profileError) {
      await context.adminClient.auth.admin.deleteUser(userId);
      throw new AuthorizationError("The user profile could not be created", 400);
    }

    if (role === "admin") {
      const { error } = await context.adminClient.from("user_role_assignments").insert({
        user_id: userId, role_id: "system_administrator", scope_type: "global", scope_id: null,
        assigned_by: context.callerId, assignment_reason: "Created through People & Access"
      });
      if (error) {
        await context.adminClient.auth.admin.deleteUser(userId);
        throw new AuthorizationError("The administrator role could not be assigned", 400);
      }
    } else {
      const position = chiefLevel === "head" ? "head_chief" : chiefLevel === "vice" ? "vice_chief" : "chief";
      const { error: groupError } = await context.adminClient.from("user_group_assignments").insert(groupIds.map((groupId, index) => ({
        user_id: userId, group_id: groupId, position, is_primary: index === 0, assigned_by: context.callerId
      })));
      const { error: roleError } = await context.adminClient.from("user_role_assignments").insert(groupIds.map((groupId) => ({
        user_id: userId, role_id: "chief", scope_type: "group", scope_id: groupId,
        assigned_by: context.callerId, assignment_reason: "Created through People & Access"
      })));
      if (groupError || roleError) {
        await context.adminClient.auth.admin.deleteUser(userId);
        throw new AuthorizationError("The group access could not be assigned", 400);
      }
    }

    await writeSecurityAudit(context, "user.invited", userId, "success", { role, group_ids: groupIds });
    return jsonResponse(req, { user: { id: userId, full_name: fullName, email, role, account_status: "active" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return jsonResponse(req, { error: error instanceof AuthorizationError ? error.message : "User invitation failed" }, status);
  }
});
