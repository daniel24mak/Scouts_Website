import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) throw new Error("Authentication required");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Invalid session");

    const body = await req.json();
    const workspace = String(body.workspace || "");
    if (!["finance", "storage"].includes(workspace)) throw new Error("Invalid workspace");

    const { data: allowed } = await userClient.rpc("has_permission", {
      target_permission: `${workspace}.files.manage`,
    });
    if (!allowed) throw new Error("Permission denied");

    const name = String(body.fileName || "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const type = String(body.contentType || "");
    const size = Number(body.size || 0);
    if (body.action !== "download" && (!name || !ALLOWED_TYPES.has(type) || size <= 0 || size > MAX_FILE_SIZE)) {
      throw new Error("File type or size is not allowed");
    }

    const bucket = `${workspace}-private`;
    const admin = createClient(url, service);
    if (body.action === "download") {
      const requestedPath = String(body.path || "");
      if (!requestedPath.startsWith(`${workspace}/`)) throw new Error("Invalid scoped path");

      const { data: fileRecord, error: metadataError } = await admin
        .from("workspace_private_files")
        .select("id")
        .eq("workspace_key", workspace)
        .eq("bucket_id", bucket)
        .eq("object_path", requestedPath)
        .is("deleted_at", null)
        .maybeSingle();
      if (metadataError || !fileRecord) throw new Error("File is not available");

      const { data, error } = await admin.storage.from(bucket).createSignedUrl(requestedPath, 60);
      if (error) throw error;
      return Response.json({ url: data.signedUrl, expiresIn: 60 }, { headers: cors });
    }

    const resource = String(body.resourceId || "unassigned").replace(/[^a-zA-Z0-9-]/g, "");
    const path = `${workspace}/${resource}/${crypto.randomUUID()}-${name}`;
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw error;
    return Response.json({ path, token: data.token, signedUrl: data.signedUrl }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 403, headers: cors },
    );
  }
});
