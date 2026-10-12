import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const definitions = ["supabase-attendance-save-fix.sql", "supabase-schema.sql"].map((file) => {
  const sql = fs.readFileSync(new URL(`../../database/${file}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  const definition = sql.match(/CREATE OR REPLACE FUNCTION public\.save_chief_attendance\([\s\S]*?\$\$;/)?.[0];
  assert.ok(definition, `${file} must define the chief attendance RPC`);
  return { file, definition };
});

const session = "11111111-1111-1111-1111-111111111111";
const otherSession = "22222222-2222-2222-2222-222222222222";
const wolf = "a1111111-1111-1111-1111-111111111111";
const secondWolf = "a2222222-2222-2222-2222-222222222222";
const newWolf = "a3333333-3333-3333-3333-333333333333";
const lion = "b1111111-1111-1111-1111-111111111111";
const secondLion = "b2222222-2222-2222-2222-222222222222";
const initialRows = [
  { session_id: session, chief_id: wolf, status: "Present" },
  { session_id: session, chief_id: secondWolf, status: "Late" },
  { session_id: session, chief_id: lion, status: "Absent" },
  { session_id: session, chief_id: secondLion, status: "Excused" },
  { session_id: otherSession, chief_id: wolf, status: "Excused" }
];

// These statements come from the real RPC. Only PostgreSQL's UUID cast,
// JSON table-function name and function-local parameters are bridged to SQLite.
// Restoring the old session-wide DELETE must lose the lions and fail these tests.
function replacementStatements(definition) {
  return ["DELETE FROM", "INSERT INTO"].map((operation) => {
    const statement = definition.match(new RegExp(`${operation} public\\.chief_attendance_records\\b[\\s\\S]*?;`))?.[0];
    assert.ok(statement, `chief attendance must have a ${operation} record statement`);
    return statement;
  });
}

function replaceWithSqlite(definition, records) {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`CREATE TABLE chief_attendance_records (
      session_id TEXT NOT NULL, chief_id TEXT NOT NULL, status TEXT NOT NULL,
      PRIMARY KEY (session_id, chief_id)
    );`);
    const insert = database.prepare("INSERT INTO chief_attendance_records VALUES (?, ?, ?)");
    for (const row of initialRows) insert.run(row.session_id, row.chief_id, row.status);
    database.exec("BEGIN");
    let inserted;
    for (const statement of replacementStatements(definition)) {
      const sql = statement.replaceAll("public.", "").replaceAll("::uuid", "")
        .replaceAll("jsonb_each_text", "json_each")
        .replaceAll("saved_session_id", ":saved_session_id")
        .replaceAll("target_records", ":target_records");
      const parameters = { saved_session_id: session };
      if (sql.includes(":target_records")) parameters.target_records = JSON.stringify(records);
      inserted = database.prepare(sql).run(parameters).changes;
    }
    database.exec("COMMIT");
    return {
      rows: database.prepare("SELECT session_id, chief_id, status FROM chief_attendance_records ORDER BY session_id, chief_id")
        .all().map((row) => ({ ...row })),
      inserted
    };
  } finally {
    database.close();
  }
}

const groupSubmission = { [wolf]: "Absent", [newWolf]: "Present" };
const groupExpected = [
  { session_id: session, chief_id: wolf, status: "Absent" },
  { session_id: session, chief_id: secondWolf, status: "Late" },
  { session_id: session, chief_id: newWolf, status: "Present" },
  { session_id: session, chief_id: lion, status: "Absent" },
  { session_id: session, chief_id: secondLion, status: "Excused" },
  { session_id: otherSession, chief_id: wolf, status: "Excused" }
];
const globalSubmission = { [wolf]: "Late", [secondWolf]: "Absent", [lion]: "Present", [secondLion]: "Late" };
const globalExpected = [
  { session_id: session, chief_id: wolf, status: "Late" },
  { session_id: session, chief_id: secondWolf, status: "Absent" },
  { session_id: session, chief_id: lion, status: "Present" },
  { session_id: session, chief_id: secondLion, status: "Late" },
  { session_id: otherSession, chief_id: wolf, status: "Excused" }
];

test("chief attendance migration and clean-schema RPC definitions stay identical", () => {
  assert.equal(definitions[0].definition, definitions[1].definition);
});

for (const { file, definition } of definitions) {
  test(`${file}: chief record deletion targets only submitted IDs in the saved session`, () => {
    const [deletion] = replacementStatements(definition);
    assert.match(deletion, /WHERE session_id = saved_session_id\s+AND chief_id IN\s*\(\s*SELECT key::uuid FROM jsonb_each_text\(target_records\)\s*\)/);
  });

  test(`${file}: submitting one group's chiefs preserves the other group and omitted chiefs`, () => {
    const result = replaceWithSqlite(definition, groupSubmission);
    assert.deepEqual(result.rows, groupExpected);
    assert.equal(result.inserted, 2);
  });

  test(`${file}: an empty chief payload preserves every saved record`, () => {
    const result = replaceWithSqlite(definition, {});
    assert.deepEqual(result.rows, initialRows);
    assert.equal(result.inserted, 0);
  });

  test(`${file}: a global chief payload updates every submitted group`, () => {
    const result = replaceWithSqlite(definition, globalSubmission);
    assert.deepEqual(result.rows, globalExpected);
    assert.equal(result.inserted, 4);
  });
}

// Optional full PL/pgSQL verification uses only an explicitly named disposable
// Docker container. Routine runs still execute the real record SQL through SQLite.
// Start a cached postgres image with --network none, no ports, and no mounts;
// set CHIEF_ATTENDANCE_PG_CONTAINER and optionally CHIEF_ATTENDANCE_DOCKER.
const postgresContainer = process.env.CHIEF_ATTENDANCE_PG_CONTAINER;
const docker = process.env.CHIEF_ATTENDANCE_DOCKER || "docker";

function runPostgres(sql) {
  assert.match(postgresContainer, /^codex-chief-attendance-test-[a-z0-9-]+$/, "live tests require an isolated test container");
  const result = spawnSync(docker, ["exec", "-i", postgresContainer, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-A", "-t"], {
    input: sql, encoding: "utf8", timeout: 30000, windowsHide: true
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return Object.fromEntries(result.stdout.split(/\r?\n/).filter((line) => /^(ROWS|RPC|AUDIT):/.test(line)).map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator), JSON.parse(line.slice(separator + 1))];
  }));
}

const postgresFixture = `
  BEGIN;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
    SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
  $$;
  CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;
  CREATE TABLE public.scout_years (id uuid PRIMARY KEY, is_active boolean NOT NULL);
  CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY, role text, group_id text, chief_level text,
    coordinator_group_ids text[] NOT NULL DEFAULT '{}'
  );
  CREATE TABLE public.chief_attendance_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scout_year_id uuid NOT NULL REFERENCES public.scout_years(id),
    date date NOT NULL, topic text NOT NULL DEFAULT 'Chief meeting',
    taken_by uuid REFERENCES public.user_profiles(id), created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.chief_attendance_records (
    session_id uuid NOT NULL REFERENCES public.chief_attendance_sessions(id) ON DELETE CASCADE,
    chief_id uuid NOT NULL REFERENCES public.user_profiles(id), status text NOT NULL,
    PRIMARY KEY (session_id, chief_id)
  );
  CREATE TABLE public.audit_logs (
    actor_id uuid, action text, entity_type text, entity_id text, metadata jsonb
  );
  INSERT INTO public.scout_years VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', true);
  INSERT INTO public.user_profiles (id, role, group_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', NULL),
    ('${wolf}', 'chief', 'wolves'), ('${secondWolf}', 'chief', 'wolves'), ('${newWolf}', 'chief', 'wolves'),
    ('${lion}', 'chief', 'lions'), ('${secondLion}', 'chief', 'lions');
  INSERT INTO public.chief_attendance_sessions (id, scout_year_id, date, topic, taken_by) VALUES
    ('${session}', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-11', 'Original meeting', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    ('${otherSession}', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-10', 'Earlier meeting', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  INSERT INTO public.chief_attendance_records VALUES
    ('${session}', '${wolf}', 'Present'), ('${session}', '${secondWolf}', 'Late'),
    ('${session}', '${lion}', 'Absent'), ('${session}', '${secondLion}', 'Excused'),
    ('${otherSession}', '${wolf}', 'Excused');
`;
const postgresObservations = `
  SELECT 'ROWS:' || jsonb_agg(to_jsonb(record) ORDER BY record.session_id, record.chief_id)::text
    FROM public.chief_attendance_records AS record;
  SELECT 'AUDIT:' || COALESCE(jsonb_agg(to_jsonb(audit)), '[]'::jsonb)::text FROM public.audit_logs AS audit;
  ROLLBACK;
`;

for (const { file, definition } of definitions) {
  for (const [description, payload, expected, count] of [
    ["one-group save preserves both groups and a different meeting", groupSubmission, groupExpected, 2],
    ["empty save preserves the entire meeting", {}, initialRows, 0],
    ["global save updates every submitted chief", globalSubmission, globalExpected, 4]
  ]) {
    test(`${file}: PostgreSQL RPC ${description}`, { skip: !postgresContainer }, () => {
      const result = runPostgres(`${postgresFixture}\n${definition}\n
        SELECT 'RPC:' || public.save_chief_attendance('2026-10-11', 'Updated meeting', '${JSON.stringify(payload)}'::jsonb)::text;
        ${postgresObservations}`);
      assert.deepEqual(result.ROWS, expected);
      assert.deepEqual(result.RPC, { id: session, recordCount: count });
      assert.deepEqual(result.AUDIT, [{
        actor_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        action: "attendance_updated_after_submission", entity_type: "Chief attendance", entity_id: session,
        metadata: { date: "2026-10-11", topic: "Updated meeting", recordCount: count }
      }]);
    });
  }

  test(`${file}: PostgreSQL rejects a mixed invalid payload without changing records or audit`, { skip: !postgresContainer }, () => {
    const result = runPostgres(`${postgresFixture}\n${definition}\n
      DO $$ BEGIN
        PERFORM public.save_chief_attendance('2026-10-11', 'Invalid meeting', '{"${wolf}":"Absent","${lion}":"present"}'::jsonb);
        RAISE EXCEPTION 'Expected strict status rejection';
      EXCEPTION WHEN invalid_parameter_value THEN NULL;
      END $$;
      ${postgresObservations}`);
    assert.deepEqual(result.ROWS, initialRows);
    assert.deepEqual(result.AUDIT, []);
  });

  test(`${file}: PostgreSQL audit failure rolls the record replacement back`, { skip: !postgresContainer }, () => {
    const result = runPostgres(`${postgresFixture}\n${definition}\n
      CREATE FUNCTION public.reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Audit write rejected' USING ERRCODE = '23514'; END;
      $$;
      CREATE TRIGGER reject_test_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_test_audit();
      DO $$ BEGIN
        PERFORM public.save_chief_attendance('2026-10-11', 'Rolled back meeting', '${JSON.stringify(groupSubmission)}'::jsonb);
        RAISE EXCEPTION 'Expected audit rejection';
      EXCEPTION WHEN check_violation THEN NULL;
      END $$;
      ${postgresObservations}`);
    assert.deepEqual(result.ROWS, initialRows);
    assert.deepEqual(result.AUDIT, []);
  });
}
