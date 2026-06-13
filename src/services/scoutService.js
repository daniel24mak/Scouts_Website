import { normalizeGroup, normalizeRule, normalizeScout } from "./supabaseMappers.js";
import {
  getSupabaseRows,
  insertSupabaseRow,
  insertSupabaseRows,
  isSupabaseConfigured,
  patchSupabaseRows,
  getCurrentSupabaseUserId,
  uploadSupabaseFile
} from "./supabaseClient.js";

export async function getActiveScoutYearId() {
  const [activeYear] = await getSupabaseRows("scout_years", "select=id&is_active=eq.true&limit=1");
  return activeYear?.id ?? null;
}

function currentScoutYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const startsThisYear = date.getMonth() >= 8;
  const startYear = startsThisYear ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function base64ToBlob(base64Content, fileName) {
  const binary = window.atob(base64Content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: fileName?.toLowerCase().endsWith(".csv")
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

export async function getScoutData() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const [years, groups, scouts, rules, uploads] = await Promise.all([
    getSupabaseRows("scout_years", "select=*&order=created_at.desc"),
    getSupabaseRows("groups", "select=*&order=sort_order.asc").catch(() =>
      getSupabaseRows("scout_groups", "select=*")
    ),
    getSupabaseRows("scouts", "select=*&order=name.asc"),
    getSupabaseRows("grouping_rules", "select=*"),
    getSupabaseRows("registration_uploads", "select=*&order=uploaded_at.desc").catch(() =>
      getSupabaseRows("scout_imports", "select=*&order=uploaded_at.desc")
    ).catch(() => [])
  ]);

  const activeYear = years.find((year) => year.is_active) ?? years[0];
  const activeScouts = activeYear
    ? scouts.filter((scout) => scout.scout_year_id === activeYear.id && scout.status !== "Archived")
    : scouts;
  const activeUpload = uploads.find((upload) => upload.scout_year_id === activeYear?.id) ?? uploads[0];
  const normalizedRules = rules.map(normalizeRule);

  return {
    groups: groups.map(normalizeGroup),
    registeredScouts: activeScouts.map(normalizeScout),
    registrationImportSettings: {
      scoutYear: activeYear?.label ?? "Current year",
      sortBy: activeYear?.sort_by ?? "schoolGrade",
      assignmentMode: activeYear?.assignment_mode ?? "schoolGrade",
      excelFileName: activeUpload?.file_name ?? "Supabase"
    },
    groupingRulesStore: {
      storageKey: `supabase-grouping-rules-${activeYear?.id ?? "current"}`,
      lastUpdated: normalizedRules[0]?.lastUpdated ?? "",
      updatedBy: "Supabase",
      rules: normalizedRules
    }
  };
}

export function updateScout(scoutId, scout) {
  return patchSupabaseRows("scouts", `id=eq.${encodeURIComponent(scoutId)}`, {
    name: scout.name,
    school_grade: scout.schoolGrade,
    age: scout.age ? Number(scout.age) : null,
    gender: scout.gender || null,
    school: scout.school || null,
    group_id: scout.groupId,
    equipe_id: scout.equipeId || null,
    parent_name: scout.parentName || null,
    parent_phone: scout.parentPhone || null,
    status: scout.status ?? "Registered"
  });
}

export async function createScout(scout) {
  const scoutYearId = await getActiveScoutYearId();

  return insertSupabaseRow("scouts", {
    scout_year_id: scoutYearId,
    name: scout.name,
    school_grade: scout.schoolGrade,
    age: scout.age ? Number(scout.age) : null,
    gender: scout.gender || null,
    school: scout.school || null,
    group_id: scout.groupId,
    equipe_id: scout.equipeId || null,
    parent_name: scout.parentName || null,
    parent_phone: scout.parentPhone || null,
    status: scout.status ?? "Registered",
    source: "manual"
  });
}

export async function importRegistrationSheetToSupabase({ fileName, contentBase64, scouts }) {
  const currentUserId = getCurrentSupabaseUserId();
  const previousYears = await getSupabaseRows("scout_years", "select=id,label,is_active");
  const label = currentScoutYearLabel();
  const existingYear = previousYears.find((year) => year.label === label);

  await Promise.all(
    previousYears
      .filter((year) => year.is_active)
      .map((year) =>
        patchSupabaseRows("scout_years", `id=eq.${encodeURIComponent(year.id)}`, {
          is_active: false,
          archived_at: new Date().toISOString()
        })
      )
  );

  const [activeYear] = existingYear
    ? await patchSupabaseRows("scout_years", `id=eq.${encodeURIComponent(existingYear.id)}`, {
        is_active: true,
        archived_at: null
      })
    : await insertSupabaseRow("scout_years", {
        label,
        sort_by: "schoolGrade",
        assignment_mode: "schoolGrade",
        is_active: true
      });

  if (!activeYear?.id) {
    throw new Error("Could not create or activate scout year.");
  }

  await patchSupabaseRows("scouts", `scout_year_id=eq.${encodeURIComponent(activeYear.id)}`, {
    status: "Archived"
  }).catch(() => null);

  const storagePath = `registration/${activeYear.id}/${Date.now()}-${fileName}`;
  await uploadSupabaseFile(storagePath, base64ToBlob(contentBase64, fileName));

  await insertSupabaseRow("registration_uploads", {
    scout_year_id: activeYear.id,
    file_name: fileName,
    storage_path: storagePath,
    uploaded_by: currentUserId
  });

  const rows = scouts.map((scout) => ({
    scout_year_id: activeYear.id,
    name: scout.name,
    school_grade: scout.schoolGrade,
    age: scout.age,
    gender: scout.gender || null,
    school: scout.school || null,
    group_id: scout.groupId,
    parent_name: scout.parentName || null,
    parent_phone: scout.parentPhone || null,
    status: scout.status ?? "Registered",
    source: "excel"
  }));

  for (let index = 0; index < rows.length; index += 100) {
    await insertSupabaseRows("scouts", rows.slice(index, index + 100));
  }

  return { ok: true, count: rows.length, scoutYear: label };
}

export async function saveGroupingRules({ rules, sortBy, assignmentMode }) {
  await Promise.all(
    rules.map((rule) =>
      patchSupabaseRows("grouping_rules", `group_id=eq.${encodeURIComponent(rule.groupId)}`, {
        assignment_basis: rule.assignmentBasis,
        grade_start: Number(rule.gradeStart),
        grade_end: Number(rule.gradeEnd),
        age_start: Number(rule.ageStart),
        age_end: Number(rule.ageEnd),
        gender_filter: rule.genderFilter ?? "mixed",
        updated_at: new Date().toISOString()
      })
    )
  );

  const [activeYear] = await getSupabaseRows("scout_years", "select=id&is_active=eq.true&limit=1");
  if (activeYear) {
    await patchSupabaseRows("scout_years", `id=eq.${encodeURIComponent(activeYear.id)}`, {
      sort_by: sortBy,
      assignment_mode: assignmentMode
    });
  }

  return { ok: true };
}
