import * as XLSX from "npm:xlsx@0.18.5";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Rule = {
  groupId: string;
  assignmentBasis?: string;
  gradeStart?: number;
  gradeEnd?: number;
  ageStart?: number;
  ageEnd?: number;
  genderFilter?: string;
};

const aliases: Record<string, string[]> = {
  name: ["name", "fullname", "scoutname", "membername", "studentname", "childname", "participantname"],
  schoolGrade: ["grade", "schoolgrade", "class", "year", "yeargroup", "studentgrade"],
  age: ["age", "ageyears", "yearsold", "studentage"],
  gender: ["gender", "sex", "malefemale", "boygirl"],
  school: ["school", "schoolname"],
  parentName: ["parent", "parentname", "guardian", "guardianname", "mother", "father"],
  parentPhone: ["phone", "mobile", "contact", "parentphone", "guardianphone", "telephone"],
  status: ["status", "registrationstatus"]
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizedHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function columnIndex(headers: unknown[], field: string) {
  const candidates = aliases[field] ?? [];
  return headers.map(normalizedHeader).findIndex((header) => candidates.some((alias) => header.includes(alias)));
}

function numberFrom(value: unknown) {
  const match = clean(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function genderFrom(value: unknown) {
  const valueNormalized = clean(value).toLowerCase();
  if (["m", "male", "boy", "boys"].includes(valueNormalized)) return "male";
  if (["f", "female", "girl", "girls"].includes(valueNormalized)) return "female";
  return "";
}

function groupFor(scout: Record<string, unknown>, rules: Rule[], assignmentMode: string) {
  const basis = assignmentMode === "age" ? "age" : "schoolGrade";
  const grade = numberFrom(scout.schoolGrade);
  const age = numberFrom(scout.age);
  const gender = genderFrom(scout.gender);
  const matches = rules.filter((rule) => {
    if (basis === "age" || rule.assignmentBasis === "age") {
      return age !== null && age >= Number(rule.ageStart) && age <= Number(rule.ageEnd);
    }
    return grade !== null && grade >= Number(rule.gradeStart) && grade <= Number(rule.gradeEnd);
  });
  return (matches.find((rule) => rule.genderFilter === gender)
    ?? matches.find((rule) => (rule.genderFilter ?? "mixed") === "mixed")
    ?? matches[0]
    ?? rules[0])?.groupId ?? "louvetoux";
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey) throw new Error("Server configuration error");
    if (!authorization?.startsWith("Bearer ")) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authorization }
    });
    if (!authResponse.ok) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const body = await req.json();
    if (!body.contentBase64) return jsonResponse(req, { error: "Missing sheet content." }, 400);

    const restHeaders = { apikey: anonKey, Authorization: authorization };
    const [rulesResponse, settingsResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/grouping_rules?select=group_id,assignment_basis,grade_start,grade_end,age_start,age_end,gender_filter&order=group_id`, { headers: restHeaders }),
      fetch(`${supabaseUrl}/rest/v1/registration_import_settings?select=assignment_mode&id=eq.1&limit=1`, { headers: restHeaders })
    ]);
    if (!rulesResponse.ok || !settingsResponse.ok) throw new Error("Registration import settings could not be loaded.");

    const rules = (await rulesResponse.json()).map((rule: Record<string, unknown>) => ({
      groupId: rule.group_id,
      assignmentBasis: rule.assignment_basis,
      gradeStart: rule.grade_start,
      gradeEnd: rule.grade_end,
      ageStart: rule.age_start,
      ageEnd: rule.age_end,
      genderFilter: rule.gender_filter
    })) as Rule[];
    const settings = await settingsResponse.json();
    const assignmentMode = body.assignmentMode ?? settings[0]?.assignment_mode ?? "schoolGrade";
    const workbook = XLSX.read(bytesFromBase64(body.contentBase64), { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    const headerRowIndex = rows.findIndex((row) => columnIndex(row, "name") >= 0);
    const headers = rows[headerRowIndex] ?? [];
    const columns = Object.fromEntries(Object.keys(aliases).map((field) => [field, columnIndex(headers, field)]));
    if (columns.name < 0) columns.name = 0;

    const scouts = rows.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 0).map((row) => {
      const name = clean(row[columns.name]);
      if (!name || /^name$/i.test(name)) return null;
      const grade = numberFrom(row[columns.schoolGrade]);
      const scout = {
        name,
        schoolGrade: grade ? `Grade ${grade}` : clean(row[columns.schoolGrade]),
        age: numberFrom(row[columns.age]),
        gender: genderFrom(row[columns.gender]),
        school: clean(row[columns.school]),
        parentName: clean(row[columns.parentName]),
        parentPhone: clean(row[columns.parentPhone]),
        status: clean(row[columns.status]) || "Registered"
      };
      return { ...scout, groupId: groupFor(scout, rules, assignmentMode) };
    }).filter(Boolean);

    return jsonResponse(req, { ok: true, count: scouts.length, scouts });
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Registration file could not be parsed." }, 400);
  }
});
