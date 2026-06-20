import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: requesterProfile, error: requesterError } = await adminClient
    .from("user_profiles")
    .select("id,role,account_status")
    .eq("id", authData.user.id)
    .single();

  if (requesterError || !requesterProfile || requesterProfile.role !== "admin" || requesterProfile.account_status !== "active") {
    return json({ error: "Only active admins can create dashboard users" }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const temporaryPassword = String(body.temporary_password ?? "");
  const role = String(body.role ?? "chief");
  const chiefLevel = String(body.chief_level ?? "chief");
  const groupId = body.group_id ? String(body.group_id) : null;
  const accountStatus = String(body.account_status ?? "active");
  const permissions = body.permissions ?? {};

  if (!fullName || !email || !temporaryPassword || !role) {
    return json({ error: "Full name, email, temporary password, and role are required" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
  if (temporaryPassword.length < 6) return json({ error: "Temporary password is too weak" }, 400);
  if (role !== "admin" && !groupId) return json({ error: "Group is required for chief users" }, 400);

  const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      group_id: groupId,
      chief_level: chiefLevel,
    },
  });

  if (createAuthError || !createdAuth.user) {
    return json({ error: createAuthError?.message || "Failed to create auth user" }, 400);
  }

  const authUserId = createdAuth.user.id;
  const profileRow = {
    id: authUserId,
    full_name: fullName,
    email,
    role,
    chief_level: chiefLevel,
    group_id: groupId,
    account_status: accountStatus,
    profile_picture_url: body.profile_picture_url || null,
    can_publish: Boolean(permissions.can_publish),
    can_create_group_meetings: Boolean(permissions.can_create_group_meetings),
    can_edit_scouts: Boolean(permissions.can_edit_scouts),
    must_change_password: true,
  };

  let insertResult = await adminClient.from("user_profiles").insert(profileRow).select().single();
  if (insertResult.error && String(insertResult.error.message).includes("must_change_password")) {
    const { must_change_password: _removed, ...fallbackRow } = profileRow;
    insertResult = await adminClient.from("user_profiles").insert(fallbackRow).select().single();
  }

  if (insertResult.error) {
    await adminClient.auth.admin.deleteUser(authUserId);
    return json({ error: insertResult.error.message }, 400);
  }

  return json({ user: insertResult.data });
});
