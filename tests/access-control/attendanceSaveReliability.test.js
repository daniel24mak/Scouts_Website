import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readSql(name) {
  const path = new URL(`../../database/${name}`, import.meta.url);
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n") : "";
}

const migrationSql = readSql("supabase-attendance-save-fix.sql");
const schemaSql = readSql("supabase-schema.sql");
const signatures = {
  save_scout_attendance: "text, uuid, text, date, text, jsonb",
  save_chief_attendance: "date, text, jsonb"
};

function definition(sql, name) {
  const result = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`, "i"));
  assert.ok(result, `${name} RPC definition must exist`);
  return result[0];
}

test("attendance migration is additive and transaction-wrapped with an exact clean-schema mirror", () => {
  assert.match(migrationSql, /^BEGIN;/m);
  assert.match(migrationSql, /COMMIT;\s*$/);
  assert.doesNotMatch(migrationSql, /DROP TABLE|ALTER TABLE|DELETE FROM public\.(?:attendance_sessions|chief_attendance_sessions)/i);
  for (const name of Object.keys(signatures)) {
    assert.equal(definition(schemaSql, name), definition(migrationSql, name));
  }
});

for (const [file, sql] of [["migration", migrationSql], ["clean schema", schemaSql]]) {
  test(`${file}: attendance RPCs have the exact public interfaces and restricted execution grants`, () => {
    assert.match(definition(sql, "save_scout_attendance"), /\(\s*target_group_id text,\s*target_equipe_id uuid,\s*target_scope text,\s*target_date date,\s*target_topic text,\s*target_records jsonb\s*\)\s*RETURNS jsonb/i);
    assert.match(definition(sql, "save_chief_attendance"), /\(\s*target_date date,\s*target_topic text,\s*target_records jsonb\s*\)\s*RETURNS jsonb/i);
    for (const [name, signature] of Object.entries(signatures)) {
      const escaped = signature.replaceAll(", ", ",\\s*");
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(${escaped}\\) FROM PUBLIC, anon;`, "i"));
      assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(${escaped}\\) TO authenticated;`, "i"));
      assert.doesNotMatch(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]*TO (?:PUBLIC|anon|service_role)`, "i"));
    }
  });

  for (const name of Object.keys(signatures)) {
    const chief = name === "save_chief_attendance";
    const table = chief ? "chief_attendance_records" : "attendance_records";
    const sessionTable = chief ? "chief_attendance_sessions" : "attendance_sessions";

    test(`${file}: ${name} requires authentication, exactly one active year and an object payload`, () => {
      const fn = definition(sql, name);
      assert.match(fn, /SECURITY DEFINER\s+SET search_path = pg_catalog, public/i);
      assert.match(fn, /auth\.uid\(\)/);
      assert.match(fn, /IF caller_id IS NULL THEN[\s\S]*?RAISE EXCEPTION/i);
      assert.match(fn, /FROM public\.scout_years[\s\S]*?WHERE is_active = true[\s\S]*?FOR SHARE/i);
      assert.match(fn, /IF active_year_id IS NULL OR cardinality\(active_year_ids\) <> 1 THEN[\s\S]*?RAISE EXCEPTION/i);
      assert.match(fn, /jsonb_typeof\(target_records\) IS DISTINCT FROM 'object'[\s\S]*?RAISE EXCEPTION/i);
      assert.match(fn, /target_date IS NULL[\s\S]*?RAISE EXCEPTION/i);
      assert.doesNotMatch(fn, /registration\.retention\.manage|has_required_aal/i);
    });

    test(`${file}: ${name} validates all UUIDs, strict statuses and membership before replacement`, () => {
      const fn = definition(sql, name);
      const deletion = fn.indexOf(`DELETE FROM public.${table}`);
      assert.ok(deletion > 0);
      const validation = fn.slice(0, deletion);
      assert.match(validation, /key !~\* '\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$'/);
      assert.match(validation, /value IS NULL OR value NOT IN \('Present', 'Absent', 'Late', 'Excused'\)/);
      assert.match(validation, /FROM jsonb_each_text\(target_records\)/);
      assert.match(validation, /WHERE NOT EXISTS[\s\S]*?RAISE EXCEPTION/i);
      if (chief) {
        assert.match(validation, /FROM public\.user_profiles[\s\S]*?id = record\.key::uuid[\s\S]*?account_status = 'active'/i);
        assert.match(validation, /role = 'chief'/);
      } else {
        assert.match(validation, /FROM public\.scouts[\s\S]*?id = record\.key::uuid[\s\S]*?scout_year_id = active_year_id[\s\S]*?group_id = target_group_id[\s\S]*?equipe_id = target_equipe_id/i);
        assert.match(validation, /FROM public\.equipes[\s\S]*?id = target_equipe_id[\s\S]*?group_id = target_group_id/i);
        assert.match(validation, /target_scope NOT IN \('group', 'equipe'\)/);
        assert.match(validation, /target_scope = 'group' AND target_equipe_id IS NOT NULL/);
        assert.match(validation, /target_scope = 'equipe' AND target_equipe_id IS NULL/);
      }
    });

    test(`${file}: ${name} locks a deterministic session and replaces records with one set-based insert and audit`, () => {
      const fn = definition(sql, name);
      const deletion = fn.indexOf(`DELETE FROM public.${table}`);
      const insertion = fn.indexOf(`INSERT INTO public.${table}`);
      const audit = fn.indexOf("INSERT INTO public.audit_logs");
      assert.match(fn.slice(0, deletion), /pg_advisory_xact_lock/);
      assert.match(fn.slice(0, deletion), new RegExp(`FROM public\\.${sessionTable}[\\s\\S]*?ORDER BY created_at, id[\\s\\S]*?LIMIT 1[\\s\\S]*?FOR UPDATE`, "i"));
      assert.match(fn.slice(0, deletion), new RegExp(`UPDATE public\\.${sessionTable}[\\s\\S]*?topic = saved_topic`, "i"));
      assert.ok(deletion < insertion && insertion < audit, "delete, insert, and audit must execute in that order");
      assert.match(fn.slice(insertion, audit), /SELECT saved_session_id, key::uuid, value\s+FROM jsonb_each_text\(target_records\)/i);
      assert.match(fn.slice(insertion, audit), /GET DIAGNOSTICS saved_record_count = ROW_COUNT/);
      assert.match(fn.slice(audit), /attendance_updated_after_submission[\s\S]*?attendance_taken/);
      assert.match(fn.slice(audit), /RETURN jsonb_build_object\('id', saved_session_id, 'recordCount', saved_record_count\)/);
      assert.doesNotMatch(fn, /EXCEPTION\s+WHEN|\bCOMMIT\b|\bROLLBACK\b|FOR\s+\w+\s+IN\s+SELECT/i, "failures must propagate and roll back the entire RPC");
    });
  }

  test(`${file}: scout saves use existing scope helpers and chief saves remain admin-only`, () => {
    const scout = definition(sql, "save_scout_attendance");
    assert.match(scout, /public\.is_admin\(\)/);
    assert.match(scout, /public\.can_manage_group\(target_group_id\)/);
    assert.match(scout, /public\.is_coordinator_for_group\(target_group_id\)/);
    assert.match(scout, /public\.can_take_equipe_attendance\(target_equipe_id\)/);
    assert.match(definition(sql, "save_chief_attendance"), /IF NOT public\.is_admin\(\) THEN[\s\S]*?RAISE EXCEPTION/i);
  });
}
