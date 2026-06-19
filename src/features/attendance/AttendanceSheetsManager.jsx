import { useEffect, useMemo, useState } from "react";
import { Download, Save, Trash2 } from "lucide-react";
import {
  deleteAttendanceSession,
  updateAttendanceSessionDate,
  updateAttendanceSessionLabel
} from "../../api/client.js";
import { useBootstrap } from "../../api/useBootstrap.js";
import { useAuth } from "../../auth/AuthProvider.jsx";

const attendedStatuses = ["Present", "Late"];

function sortScouts(scouts, sortBy) {
  return [...scouts].sort((a, b) => String(a[sortBy] ?? a.name).localeCompare(String(b[sortBy] ?? b.name)));
}

function getSessionLabel(session) {
  const label = String(session.topic ?? "").trim();

  return label && label !== "Meeting" ? label : session.date;
}

function getAttendancePercentage(scoutId, sessions) {
  if (!sessions.length) {
    return "0%";
  }

  const attended = sessions.filter((session) => attendedStatuses.includes(session.records?.[scoutId])).length;

  return `${Math.round((attended / sessions.length) * 100)}%`;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv({ group, scouts, sessions }) {
  const today = new Date().toISOString().slice(0, 10);
  const headers = ["Scout Name", ...sessions.map(getSessionLabel), "Attendance %"];
  const rows = [
    [`Group: ${group?.name ?? "Attendance"}`],
    [`Export date: ${today}`],
    [],
    headers,
    ...scouts.map((scout) => [
      scout.name,
      ...sessions.map((session) => session.records?.[scout.id] ?? "-"),
      getAttendancePercentage(scout.id, sessions)
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `attendance-${group?.id ?? "group"}-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceSheetsManager() {
  const { user } = useAuth();
  const { data, isLoading, error, refresh } = useBootstrap();
  const canViewAllGroups = user?.role === "admin";
  const accessibleGroups = useMemo(
    () => (canViewAllGroups ? data.groups : data.groups.filter((group) => group.id === user?.groupId)),
    [canViewAllGroups, data.groups, user?.groupId]
  );
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [labelEdits, setLabelEdits] = useState({});
  const [dateEdits, setDateEdits] = useState({});
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!selectedGroupId && accessibleGroups[0]?.id) {
      setSelectedGroupId(accessibleGroups[0].id);
    }
  }, [accessibleGroups, selectedGroupId]);

  const selectedGroup = accessibleGroups.find((group) => group.id === selectedGroupId) ?? accessibleGroups[0];
  const canManageColumns = user?.role === "admin" || ["head", "vice"].includes(user?.chiefLevel);
  const groupSessions = useMemo(
    () =>
      data.attendanceMeetings
        .filter((session) => session.groupId === selectedGroup?.id && (session.scope ?? "group") !== "equipe")
        .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [data.attendanceMeetings, selectedGroup?.id]
  );
  const groupScouts = useMemo(
    () =>
      sortScouts(
        data.registeredScouts.filter((scout) => scout.groupId === selectedGroup?.id && scout.status !== "Archived"),
        data.registrationImportSettings.sortBy
      ),
    [data.registeredScouts, data.registrationImportSettings.sortBy, selectedGroup?.id]
  );

  const handleLabelSave = async (session) => {
    const nextLabel = String(labelEdits[session.id] ?? session.topic ?? "").trim() || "Meeting";

    setSaveMessage("");
    setSaveError("");

    try {
      await updateAttendanceSessionLabel(session.id, nextLabel);
      setSaveMessage(`Saved label for ${session.date}.`);
      await refresh();
    } catch (labelError) {
      setSaveError(labelError?.message || "Could not save the attendance label.");
    }
  };

  const handleDateSave = async (session) => {
    const nextDate = dateEdits[session.id] ?? session.date;

    if (!nextDate) {
      setSaveError("Choose a valid attendance date before saving.");
      return;
    }

    setSaveMessage("");
    setSaveError("");

    try {
      await updateAttendanceSessionDate(session.id, nextDate);
      setSaveMessage(`Saved date for ${getSessionLabel(session)}.`);
      await refresh();
    } catch (dateError) {
      setSaveError(dateError?.message || "Could not save the attendance date.");
    }
  };

  const handleDeleteSession = async (session) => {
    const label = getSessionLabel(session);
    const confirmed = window.confirm(
      `Delete the attendance column "${label}" from ${session.date}? This will also delete every scout record saved for that attendance session.`
    );

    if (!confirmed) {
      return;
    }

    setSaveMessage("");
    setSaveError("");

    try {
      await deleteAttendanceSession(session.id);
      setSaveMessage(`Deleted attendance column "${label}".`);
      await refresh();
    } catch (deleteError) {
      setSaveError(deleteError?.message || "Could not delete the attendance column.");
    }
  };

  if (isLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">Attendance sheets</p>
        <h1>Loading attendance sheets...</h1>
        <p className="helper-text">The group attendance table will appear here.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-section">
        <p className="eyebrow">Attendance sheets</p>
        <h1>Attendance could not load</h1>
        <p className="helper-text">{error.message || "Please refresh and try again."}</p>
      </section>
    );
  }

  if (!accessibleGroups.length) {
    return (
      <section className="page-section">
        <p className="eyebrow">Attendance sheets</p>
        <h1>No group assigned</h1>
        <p className="helper-text">Your account does not currently have access to a group attendance sheet.</p>
      </section>
    );
  }

  return (
    <section className="page-section">
      <p className="eyebrow">Attendance sheets</p>
      <h1>View and download group attendance</h1>
      <p className="helper-text">
        Attendance is separated by group in Supabase. Each saved group attendance date becomes a sheet column.
      </p>

      <div className="attendance-sheet-toolbar">
        {canViewAllGroups && (
          <label className="compact-field">
            Group
            <select value={selectedGroup?.id ?? ""} onChange={(event) => setSelectedGroupId(event.target.value)}>
              {accessibleGroups.map((group) => (
                <option value={group.id} key={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!canViewAllGroups && (
          <article className="attendance-sheet-group-card">
            <span>Group</span>
            <strong>{selectedGroup?.name}</strong>
          </article>
        )}
        <button
          type="button"
          className="inline-action"
          onClick={() => downloadCsv({ group: selectedGroup, scouts: groupScouts, sessions: groupSessions })}
          disabled={!selectedGroup}
        >
          <Download size={16} aria-hidden="true" />
          Download CSV
        </button>
      </div>

      {saveMessage && <p className="helper-text">{saveMessage}</p>}
      {saveError && <p className="form-error">{saveError}</p>}

      <article className="table-panel attendance-sheet-panel">
        <div className="panel-heading">
          <div>
            <h2>{selectedGroup?.name} attendance sheet</h2>
            <p>
              {groupSessions.length
                ? `${groupSessions.length} attendance sessions saved`
                : "No attendance has been taken for this group yet."}
            </p>
          </div>
          <span>{groupScouts.length} scouts</span>
        </div>

        <div className="attendance-sheet-scroll">
          <table className="attendance-sheet-table">
            <thead>
              <tr>
                <th className="attendance-sticky-column">Scout Name</th>
                {groupSessions.map((session) => (
                  <th key={session.id}>
                    <div className="attendance-session-heading">
                      <input
                        value={labelEdits[session.id] ?? getSessionLabel(session)}
                        onChange={(event) =>
                          setLabelEdits((current) => ({ ...current, [session.id]: event.target.value }))
                        }
                        aria-label={`Attendance label for ${session.date}`}
                      />
                      <small>{session.date}</small>
                      <button type="button" onClick={() => handleLabelSave(session)}>
                        <Save size={14} aria-hidden="true" />
                        Save
                      </button>
                      {canManageColumns && (
                        <>
                          <input
                            type="date"
                            value={dateEdits[session.id] ?? session.date}
                            onChange={(event) =>
                              setDateEdits((current) => ({ ...current, [session.id]: event.target.value }))
                            }
                            aria-label={`Attendance date for ${getSessionLabel(session)}`}
                          />
                          <button type="button" onClick={() => handleDateSave(session)}>
                            <Save size={14} aria-hidden="true" />
                            Date
                          </button>
                          <button
                            type="button"
                            className="attendance-delete-session-button"
                            onClick={() => handleDeleteSession(session)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </th>
                ))}
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {groupScouts.length ? (
                groupScouts.map((scout) => (
                  <tr key={scout.id}>
                    <td className="attendance-sticky-column">{scout.name}</td>
                    {groupSessions.map((session) => {
                      const status = session.records?.[scout.id] ?? "-";

                      return (
                        <td key={session.id}>
                          <span className={`attendance-status attendance-status-${String(status).toLowerCase()}`}>
                            {status}
                          </span>
                        </td>
                      );
                    })}
                    <td>{getAttendancePercentage(scout.id, groupSessions)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={groupSessions.length + 2}>No scouts found for this group.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
