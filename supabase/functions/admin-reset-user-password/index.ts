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
    return json({ error: "Only active admins can reset dashboard user passwords" }, 403);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const userId = String(body.user_id ?? "").trim();
  const temporaryPassword = String(body.temporary_password ?? "");

  if (!userId || !temporaryPassword) return json({ error: "User and temporary password are required" }, 400);
  if (temporaryPassword.length < 6) return json({ error: "Temporary password is too weak" }, 400);

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (updateAuthError) return json({ error: updateAuthError.message }, 400);

  const updateResult = await adminClient
    .from("user_profiles")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateResult.error && !String(updateResult.error.message).includes("must_change_password")) {
    return json({ error: updateResult.error.message }, 400);
  }

  return json({ success: true });
});
