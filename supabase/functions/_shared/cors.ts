const localDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function configuredOrigins() {
  return [
    Deno.env.get("ALLOWED_ORIGIN") ?? "",
    Deno.env.get("ALLOWED_ORIGINS") ?? ""
  ]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function corsHeaders(req: Request) {
  const origin = (req.headers.get("Origin") ?? "").replace(/\/$/, "");
  const allowedOrigins = configuredOrigins();
  const allowedOrigin = localDevelopmentOrigin.test(origin) || allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

export function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" }
  });
}
