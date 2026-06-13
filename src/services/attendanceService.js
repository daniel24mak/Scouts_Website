import {
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabaseRows,
  insertSupabaseRow
} from "./supabaseClient.js";
import { getActiveScoutYearId } from "./scoutService.js";

export async function getAttendanceData() {
  const [
    attendanceMeetings,
    attendanceRecords,
    chiefAttendanceMeetings,
    chiefAttendanceRecords
  ] = await Promise.all([
    getSupabaseRows("attendance_sessions", "select=*&order=date.asc").catch(() => []),
    getSupabaseRows("attendance_records", "select=*").catch(() => []),
    getSupabaseRows("chief_attendance_sessions", "select=*&order=date.asc").catch(() => []),
    getSupabaseRows("chief_attendance_records", "select=*").catch(() => [])
  ]);

  return {
    attendanceMeetings: attendanceMeetings.map((meeting) => ({
      id: meeting.id,
      groupId: meeting.group_id,
      equipeId: meeting.equipe_id ?? null,
      scope: meeting.scope ?? "group",
      date: meeting.date,
      topic: meeting.topic,
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
      topic: meeting.topic,
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
  const scoutYearId = await getActiveScoutYearId();
  const currentUserId = getCurrentSupabaseUserId();
  const equipeFilter = equipeId ? `equipe_id=eq.${encodeURIComponent(equipeId)}` : "equipe_id=is.null";
  const [existingSession] = await getSupabaseRows(
    "attendance_sessions",
    `select=id&scout_year_id=eq.${encodeURIComponent(scoutYearId)}&group_id=eq.${encodeURIComponent(groupId)}&scope=eq.${encodeURIComponent(scope)}&${equipeFilter}&date=eq.${encodeURIComponent(date)}&limit=1`
  );
  const [session] =
    existingSession
      ? [existingSession]
      : await insertSupabaseRow("attendance_sessions", {
          scout_year_id: scoutYearId,
          group_id: groupId,
          equipe_id: equipeId,
          scope,
          date,
          topic,
          taken_by: currentUserId
        });

  await deleteSupabaseRows("attendance_records", `session_id=eq.${encodeURIComponent(session.id)}`);

  await Promise.all(
    Object.entries(records ?? {}).map(([scoutId, status]) =>
      insertSupabaseRow("attendance_records", {
        session_id: session.id,
        scout_id: scoutId,
        status
      })
    )
  );

  return { id: session.id };
}

export async function saveSupabaseChiefAttendance({ date, topic = "Chief meeting", records }) {
  const scoutYearId = await getActiveScoutYearId();
  const currentUserId = getCurrentSupabaseUserId();
  const [existingSession] = await getSupabaseRows(
    "chief_attendance_sessions",
    `select=id&scout_year_id=eq.${encodeURIComponent(scoutYearId)}&date=eq.${encodeURIComponent(date)}&limit=1`
  );
  const [session] =
    existingSession
      ? [existingSession]
      : await insertSupabaseRow("chief_attendance_sessions", {
          scout_year_id: scoutYearId,
          date,
          topic,
          taken_by: currentUserId
        });

  await deleteSupabaseRows("chief_attendance_records", `session_id=eq.${encodeURIComponent(session.id)}`);

  await Promise.all(
    Object.entries(records ?? {}).map(([chiefId, status]) =>
      insertSupabaseRow("chief_attendance_records", {
        session_id: session.id,
        chief_id: chiefId,
        status
      })
    )
  );

  return { id: session.id };
}
