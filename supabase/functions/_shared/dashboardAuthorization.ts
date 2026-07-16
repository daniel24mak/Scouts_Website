import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthorizedContext = {
  callerId: string;
  userClient: ReturnType<typeof createClient>;
  adminClient: ReturnType<typeof createClient>;
};

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireDashboardPermission(req: Request, permission: string): Promise<AuthorizedContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new AuthorizationError("Server configuration error", 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AuthorizationError("Unauthorized", 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) throw new AuthorizationError("Unauthorized", 401);
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles").select("id,account_status").eq("id", authData.user.id).maybeSingle();
  if (profileError || !profile || profile.account_status !== "active") {
    throw new AuthorizationError("This account is not active", 403);
  }
  const { data: allowed, error: permissionError } = await userClient.rpc("has_permission", {
    target_permission: permission
  });
  if (permissionError) throw new AuthorizationError("Authorization could not be verified", 503);
  if (allowed !== true) {
    const [{ data: isSystemAdministrator }, { data: meetsAssuranceLevel }] = await Promise.all([
      userClient.rpc("is_system_administrator", { target_user_id: authData.user.id }),
      userClient.rpc("has_required_aal", { target_permission: permission })
    ]);
    if (isSystemAdministrator === true && meetsAssuranceLevel === false) {
      throw new AuthorizationError("This action requires an MFA-verified session", 403);
    }
    throw new AuthorizationError("Your account is missing the required normalized permission", 403);
  }
  return { callerId: authData.user.id, userClient, adminClient };
}

export async function requireSystemAdministrator(context: AuthorizedContext) {
  const { data, error } = await context.userClient.rpc("is_system_administrator", {
    target_user_id: context.callerId
  });
  if (error || data !== true) throw new AuthorizationError("System Administrator access is required", 403);
}

export async function writeSecurityAudit(
  context: AuthorizedContext,
  action: string,
  targetUserId: string | null,
  outcome: "success" | "denied" | "failed",
  metadata: Record<string, unknown> = {}
) {
  await context.adminClient.from("audit_logs").insert({
    actor_id: context.callerId,
    action,
    entity_type: "user",
    entity_id: targetUserId,
    module: "people_access",
    resource_type: "user",
    resource_id: targetUserId,
    target_user_id: targetUserId,
    outcome,
    metadata
  });
}

export function parseUuid(value: unknown, field = "User") {
  const candidate = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
    throw new AuthorizationError(`${field} is invalid`, 400);
  }
  return candidate;
}
