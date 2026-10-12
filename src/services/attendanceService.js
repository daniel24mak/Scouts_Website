import {
  callSupabaseRpc,
  getSupabaseRows,
  patchSupabaseRows,
  supabaseRequest
} from "./supabaseClient.js";
import { logAuditEvent } from "./auditService.js";

function validateAttendanceRecords(records) {
  if (records === null || typeof records !== "object" || Array.isArray(records)) {
    throw new Error("Attendance records must be an object.");
  }

  const statuses = new Set(["Present", "Absent", "Late", "Excused"]);
  for (const status of Object.values(records)) {
    if (!statuses.has(status)) {
      throw new Error("Invalid attendance status.");
    }
  }
}

export async function getAttendanceData(options = {}) {
  const readRows = (table, query) => getSupabaseRows(table, query).catch((error) => {
    if (options?.requireAttendance === true) throw error;
    return [];
  });
  const [
    attendanceMeetings,
    attendanceRecords,
    chiefAttendanceMeetings,
    chiefAttendanceRecords
  ] = await Promise.all([
    readRows("attendance_sessions", "select=*&order=date.asc"),
    readRows("attendance_records", "select=*"),
    readRows("chief_attendance_sessions", "select=*&order=date.asc"),
    readRows("chief_attendance_records", "select=*")
  ]);

  return {
    attendanceMeetings: attendanceMeetings.map((meeting) => ({
      id: meeting.id,
      groupId: meeting.group_id,
      equipeId: meeting.equipe_id ?? null,
      scope: meeting.scope ?? "group",
      date: meeting.date,
      topic: meeting.topic ?? "Meeting",
      takenBy: meeting.taken_by ?? null,
      createdAt: meeting.created_at ?? null,
      records: Object.fromEntries(
        attendanceRecords
          .filter((record) => record.session_id === meeting.id)
          .map((record) => [record.scout_id, record.status])
      )
    })),
    attendanceSheets: [],
    chiefAttendanceMeetings: chiefAttendanceMeetings.map((meeting) => ({
      id: meeting.id,
      date: meeting.date,
      topic: meeting.topic ?? "Chief meeting",
      takenBy: meeting.taken_by ?? null,
      createdAt: meeting.created_at ?? null,
      records: Object.fromEntries(
        chiefAttendanceRecords
          .filter((record) => record.session_id === meeting.id)
          .map((record) => [record.chief_id, record.status])
      )
    })),
    chiefAttendanceSheet: { fileName: "Supabase", savedRows: chiefAttendanceRecords.length },
    attendanceRecords,
    chiefAttendanceRecords
  };
}

export async function saveSupabaseScoutAttendance({ groupId, equipeId = null, scope = "group", date, topic = "Meeting", records }) {
  validateAttendanceRecords(records);
  return callSupabaseRpc("save_scout_attendance", {
    target_group_id: groupId,
    target_equipe_id: equipeId,
    target_scope: scope,
    target_date: date,
    target_topic: topic,
    target_records: records
  });
}

export async function updateSupabaseAttendanceSessionLabel(sessionId, topic) {
  const label = String(topic ?? "").trim() || "Meeting";

  const result = await patchSupabaseRows("attendance_sessions", `id=eq.${encodeURIComponent(sessionId)}`, {
    topic: label
  });

  await logAuditEvent("attendance_updated_after_submission", "Attendance", sessionId, { topic: label });
  return result;
}

export async function updateSupabaseAttendanceSessionDate(sessionId, date) {
  const result = await supabaseRequest("/rest/v1/rpc/update_attendance_session_date", {
    method: "POST",
    body: JSON.stringify({ target_session_id: sessionId, target_date: date })
  });

  await logAuditEvent("attendance_updated_after_submission", "Attendance", sessionId, { date });
  return result;
}

export async function deleteSupabaseAttendanceSession(sessionId) {
  return supabaseRequest("/rest/v1/rpc/delete_attendance_session", {
    method: "POST",
    body: JSON.stringify({ target_session_id: sessionId })
  });
}

export async function saveSupabaseChiefAttendance({ date, topic = "Chief meeting", records }) {
  validateAttendanceRecords(records);
  return callSupabaseRpc("save_chief_attendance", {
    target_date: date,
    target_topic: topic,
    target_records: records
  });
}
