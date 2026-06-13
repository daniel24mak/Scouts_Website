import { useMemo, useState } from "react";
import { saveScoutAttendance } from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import { useAuth } from "../auth/AuthProvider.jsx";

const attendanceStatuses = ["Present", "Absent", "Late", "Excused"];
const attendedStatuses = ["Present", "Late"];

function sortScouts(scouts, sortBy) {
  return [...scouts].sort((a, b) =>
    String(a[sortBy]).localeCompare(String(b[sortBy]))
  );
}

function getSchoolGrade(scout) {
  return scout.schoolGrade || scout.school || "Unspecified";
}

function getAttendancePercentage(scoutId, groupMeetings) {
  if (groupMeetings.length === 0) {
    return "0%";
  }

  const attended = groupMeetings.filter((meeting) =>
    attendedStatuses.includes(meeting.records?.[scoutId])
  ).length;

  return `${Math.round((attended / groupMeetings.length) * 100)}%`;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { data, refresh } = useBootstrap();
  const [selectedDate, setSelectedDate] = useState("2026-06-07");
  const [attendanceScope, setAttendanceScope] = useState("group");
  const [selectedEquipeId, setSelectedEquipeId] = useState("");
  const [records, setRecords] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const visibleGroups = data.groups.filter((group) => group.id === user.groupId);

  const selectedGroup = visibleGroups[0];
  const groupEquipes = (data.equipes ?? []).filter((equipe) => equipe.groupId === selectedGroup?.id && equipe.isActive);
  const myEquipe = groupEquipes.find((equipe) => equipe.leaderId === user.id || equipe.coLeaderId === user.id);
  const canTakeWholeGroup = user.role === "admin" || ["head", "vice"].includes(user.chiefLevel);
  const effectiveScope = canTakeWholeGroup ? attendanceScope : "equipe";
  const effectiveEquipeId = effectiveScope === "equipe"
    ? selectedEquipeId || myEquipe?.id || (canTakeWholeGroup ? groupEquipes[0]?.id : "") || ""
    : "";
  const groupMeetings = useMemo(
    () =>
      data.attendanceMeetings.filter(
        (meeting) =>
          meeting.groupId === selectedGroup?.id &&
          (effectiveScope === "group" ? meeting.scope !== "equipe" : meeting.equipeId === effectiveEquipeId)
      ),
    [data.attendanceMeetings, effectiveEquipeId, effectiveScope, selectedGroup]
  );
  const selectedMeeting =
    groupMeetings.find((meeting) => meeting.date === selectedDate) ?? groupMeetings[0];
  const attendanceSheet = data.attendanceSheets.find((sheet) => sheet.groupId === selectedGroup?.id);
  const scouts = sortScouts(
    data.registeredScouts.filter((scout) =>
      scout.groupId === selectedGroup?.id &&
      (effectiveScope === "group" || scout.equipeId === effectiveEquipeId)
    ),
    data.registrationImportSettings.sortBy
  );
  const effectiveRecords = { ...(selectedMeeting?.records ?? {}), ...records };
  const handleRecordChange = (scoutId, status) => {
    setRecords((current) => ({ ...current, [scoutId]: status }));
  };
  const handleSave = async () => {
    if (effectiveScope === "equipe" && !effectiveEquipeId) {
      setSaveMessage("You need an assigned equipe before taking equipe attendance.");
      return;
    }

    await saveScoutAttendance({
      groupId: selectedGroup.id,
      equipeId: effectiveScope === "equipe" ? effectiveEquipeId : null,
      scope: effectiveScope,
      date: selectedDate,
      topic: selectedMeeting?.topic ?? "Meeting",
      records: Object.fromEntries(scouts.map((scout) => [scout.id, effectiveRecords[scout.id] ?? "Present"]))
    });
    setRecords({});
    setSaveMessage("Attendance saved to the database.");
    await refresh();
  };

  return (
    <section className="page-section">
      <p className="eyebrow">Scout attendance</p>
      <h1>Choose a date, then take attendance</h1>
      <p className="helper-text">
        Attendance is saved to the separate Excel sheet for this group. Percentages are calculated
        by reading saved attendance days and dividing attended meetings by total attendance days.
      </p>
      <div className="content-grid">
        <article className="admin-panel">
          <h2>Attendance date</h2>
          <label className="compact-field">
            Taking attendance for
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setRecords({});
              }}
            />
          </label>
        </article>
        <article className="admin-panel">
          <h2>Attendance scope</h2>
          {canTakeWholeGroup ? (
            <>
              <label className="compact-field">
                Scope
                <select value={attendanceScope} onChange={(event) => { setAttendanceScope(event.target.value); setRecords({}); }}>
                  <option value="equipe">Select Equipe</option>
                  <option value="group">Whole Group</option>
                </select>
              </label>
              {attendanceScope === "equipe" && (
                <label className="compact-field">
                  Equipe
                  <select value={effectiveEquipeId} onChange={(event) => { setSelectedEquipeId(event.target.value); setRecords({}); }}>
                    {groupEquipes.map((equipe) => <option value={equipe.id} key={equipe.id}>{equipe.name}</option>)}
                  </select>
                </label>
              )}
            </>
          ) : (
            <p>{myEquipe ? `My Equipe: ${myEquipe.name}` : "No equipe is assigned to your account yet."}</p>
          )}
        </article>
        <article className="admin-panel">
          <h2>Excel sheet</h2>
          <p>
            File: {attendanceSheet?.fileName}
            <br />
            Saved rows: {attendanceSheet?.savedRows ?? 0}
            <br />
            Total attendance days: {groupMeetings.length}
          </p>
        </article>
        <article className="admin-panel">
          <h2>Current sorting</h2>
          <p>Names are sorted by {data.registrationImportSettings.sortBy} before attendance is taken.</p>
        </article>
      </div>
      {saveMessage && <p className="helper-text">{saveMessage}</p>}
      <div className="group-stack">
        {visibleGroups.map((group) => (
          <article className="table-panel" key={group.id}>
            <div className="panel-heading">
              <div>
                <h2>{group.name}</h2>
                <p>
                  {selectedDate} - {selectedMeeting?.topic ?? "New attendance day"}
                </p>
              </div>
              <button type="button" className="inline-action" onClick={handleSave}>
                Save to {attendanceSheet?.fileName}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>School Grade</th>
                  <th>Age</th>
                  <th>Attendance</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {scouts.map((scout) => (
                  <tr key={scout.id}>
                    <td>{scout.name}</td>
                    <td>{getSchoolGrade(scout)}</td>
                    <td>{scout.age}</td>
                    <td>
                      <select
                        value={effectiveRecords[scout.id] ?? "Present"}
                        onChange={(event) => handleRecordChange(scout.id, event.target.value)}
                      >
                        {attendanceStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{getAttendancePercentage(scout.id, groupMeetings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </section>
  );
}
