import { useState } from "react";
import { saveChiefAttendance } from "../../api/client.js";
import { useBootstrap } from "../../api/useBootstrap.js";

const attendanceStatuses = ["Present", "Absent", "Late", "Excused"];


function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function hasChiefAccess(user) {
  return user.role === "chief" || Boolean(user.groupId && user.chiefLevel);
}

export default function ChiefAttendanceManager() {
  const { data, refresh } = useBootstrap();
  const chiefs = data.users.filter(hasChiefAccess);
  const [selectedDate, setSelectedDate] = useState(getTodayDateInputValue);
  const [records, setRecords] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const meeting = data.chiefAttendanceMeetings.find((item) => item.date === selectedDate);
  const effectiveRecords = { ...(meeting?.records ?? {}), ...records };
  const handleSave = async () => {
    await saveChiefAttendance({
      date: selectedDate,
      topic: meeting?.topic ?? "Chief meeting",
      records: Object.fromEntries(
        chiefs.map((chief) => [chief.id, effectiveRecords[chief.id] ?? "Present"])
      )
    });
    setRecords({});
    setSaveMessage("Chief attendance saved to the database.");
    await refresh();
  };

  return (
    <section className="page-section">
      <p className="eyebrow">Chief attendance</p>
      <h1>Choose a date, then take attendance for chiefs</h1>
      <p className="helper-text">
        Admins use this page for chief meetings. These records are saved separately from scout group
        attendance.
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
          <h2>Chief Excel sheet</h2>
          <p>
            File: {data.chiefAttendanceSheet?.fileName}
            <br />
            Saved rows: {data.chiefAttendanceSheet?.savedRows}
            <br />
            Last saved: {data.chiefAttendanceSheet?.lastSaved}
          </p>
        </article>
      </div>
      {saveMessage && <p className="helper-text">{saveMessage}</p>}
      <article className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>{meeting?.topic ?? "Chief meeting"}</h2>
            <p>{selectedDate}</p>
          </div>
          <button type="button" className="inline-action" onClick={handleSave}>
            Save to {data.chiefAttendanceSheet?.fileName}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Chief</th>
              <th>Assigned group</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {chiefs.map((chief) => {
              const group = data.groups.find((item) => item.id === chief.groupId);

              return (
                <tr key={chief.id}>
                  <td>{chief.name}</td>
                  <td>{group?.name ?? "Unassigned"}</td>
                  <td>
                    <select
                      value={effectiveRecords[chief.id] ?? "Present"}
                      onChange={(event) =>
                        setRecords((current) => ({ ...current, [chief.id]: event.target.value }))
                      }
                    >
                      {attendanceStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </section>
  );
}
