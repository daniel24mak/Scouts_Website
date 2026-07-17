import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../../database/supabase-public-policy-helper-grants.sql", import.meta.url), "utf8");

test("anonymous public reads can safely evaluate the admin policy helper", () => {
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_admin\(\) TO anon, authenticated/i);
  assert.doesNotMatch(sql, /GRANT\s+.*(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE/i);
});
