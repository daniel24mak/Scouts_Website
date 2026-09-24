import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("hosted registration uploads parse through an authenticated Supabase function", () => {
  const client = read("src/api/client.js");
  const edgeFunction = read("supabase/functions/parse-registration-upload/index.ts");

  assert.match(client, /invokeSupabaseFunction\("parse-registration-upload", payload\)/);
  assert.doesNotMatch(
    client.match(/export function uploadRegistrationSheet[\s\S]*?\n}/)?.[0] ?? "",
    /request\("\/registration\/parse"/
  );
  assert.match(edgeFunction, /auth\/v1\/user/);
  assert.match(edgeFunction, /XLSX\.read/);
});
