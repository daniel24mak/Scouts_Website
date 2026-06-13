import { Link } from "react-router-dom";
import { useState } from "react";
import { createCalendarEvent } from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { canCreateGroupMeetings } from "../services/permissions.js";

const sortLabels = {
  schoolGrade: "school grade",
  age: "age",
  school: "school",
  name: "name",
  groupId: "group"
};

function sortScouts(scouts, sortBy) {
  return [...scouts].sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy])));
}

function getSchoolGrade(scout) {
  const grade = String(scout?.schoolGrade ?? "").trim();
  const school = String(scout?.school ?? "").trim();

  if (grade && school && grade.toLowerCase() === school.toLowerCase()) {
    return grade;
  }

  return grade || school || "Unspecified";
}

function getEquipeName(scout, equipes) {
  return equipes.find((equipe) => equipe.id === scout?.equipeId)?.name ?? "Unassigned";
}

function hasChiefAccess(user) {
  return user.role === "chief" || Boolean(user.groupId && user.chiefLevel);
}

export default function ChiefsPortalPage() {
  const { user } = useAuth();
  const { data, refresh } = useBootstrap();
  const [eventMessage, setEventMessage] = useState("");
  const [chiefEvent, setChiefEvent] = useState({
    title: "",
    dateFrom: "",
    dateTo: "",
    startTime: "",
    endTime: "",
    location: "Scout Hall",
    description: "",
    visibility: "group"
  });
  const visibleGroups =
    user.role === "admin" ? data.groups : data.groups.filter((group) => group.id === user.groupId);
  const eligibleForEvents =
    canCreateGroupMeetings(user) || ["head", "vice"].includes(user.chiefLevel);
  const createdEvents = data.plannedEvents.filter(
    (event) =>
      event.submittedBy === user.id ||
      (event.visibility === "group" && event.visibleGroupIds?.includes(user.groupId))
  );
  const handleEventSubmit = async (event) => {
    event.preventDefault();

    if (chiefEvent.dateTo < chiefEvent.dateFrom) {
      setEventMessage("Date to cannot be before Date from.");
      return;
    }

    if (
      chiefEvent.dateFrom === chiefEvent.dateTo &&
      chiefEvent.startTime &&
      chiefEvent.endTime &&
      chiefEvent.endTime < chiefEvent.startTime
    ) {
      setEventMessage("End time cannot be before start time for a one-day event.");
      return;
    }

    const canPublishDirectly = user.role === "admin";

    await createCalendarEvent({
      ...chiefEvent,
      date: chiefEvent.dateFrom,
      type: chiefEvent.visibility === "group" ? "meeting" : "event",
      groupId: chiefEvent.visibility === "group" ? user.groupId : null,
      visibleGroupIds: chiefEvent.visibility === "group" ? [user.groupId] : [],
      approvalStatus: canPublishDirectly ? "approved" : "pending"
    });
    setChiefEvent({
      title: "",
      dateFrom: "",
      dateTo: "",
      startTime: "",
      endTime: "",
      location: "Scout Hall",
      description: "",
      visibility: "group"
    });
    setEventMessage(canPublishDirectly ? "Calendar event published." : "Calendar event submitted for admin approval.");
    await refresh();
  };

  return (
    <section className="page-section">
      <p className="eyebrow">Chiefs portal</p>
      <h1>Group information and attendance</h1>
      <div className="action-row">
        {hasChiefAccess(user) && (
          <Link className="inline-action" to="/chiefs/attendance">
            Take scout attendance
          </Link>
        )}
        {(user.role === "admin" || user.permissions.canPublish) && (
          <Link className="inline-action" to="/chiefs/content">
            Open publishing dashboard
          </Link>
        )}
        {user.role === "admin" && (
          <Link className="inline-action" to="/admin/chief-attendance">
            Take chief attendance
          </Link>
        )}
      </div>
      {eligibleForEvents && (
        <article className="editor-panel chief-event-panel">
          <h2>Create group calendar event</h2>
          <p className="helper-text">
            Events default to group-only. Events that are not directly publishable are saved as pending
            until an admin approves them.
          </p>
          {eventMessage && <p className="helper-text">{eventMessage}</p>}
          <form className="chief-event-form" onSubmit={handleEventSubmit}>
            <label>
              Event title
              <input
                required
                value={chiefEvent.title}
                onChange={(event) => setChiefEvent((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              Date from
              <input
                type="date"
                required
                value={chiefEvent.dateFrom}
                onChange={(event) =>
                  setChiefEvent((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                    dateTo: current.dateTo || event.target.value
                  }))
                }
              />
            </label>
            <label>
              Date to
              <input
                type="date"
                required
                value={chiefEvent.dateTo}
                onChange={(event) => setChiefEvent((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </label>
            <label>
              Start time
              <input
                type="time"
                value={chiefEvent.startTime}
                onChange={(event) => setChiefEvent((current) => ({ ...current, startTime: event.target.value }))}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={chiefEvent.endTime}
                onChange={(event) => setChiefEvent((current) => ({ ...current, endTime: event.target.value }))}
              />
            </label>
            <label>
              Location
              <input
                required
                value={chiefEvent.location}
                onChange={(event) => setChiefEvent((current) => ({ ...current, location: event.target.value }))}
              />
            </label>
            <label>
              Visibility
              <select
                value={chiefEvent.visibility}
                onChange={(event) => setChiefEvent((current) => ({ ...current, visibility: event.target.value }))}
              >
                <option value="group">Group-only</option>
                <option value="logged-in">Internal / chiefs-only</option>
                {(user.role === "admin" || user.permissions?.canPublish) && <option value="public">Public</option>}
              </select>
            </label>
            <label className="wide-field">
              Description
              <textarea
                rows="4"
                required
                value={chiefEvent.description}
                onChange={(event) => setChiefEvent((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <button type="submit">Submit calendar event</button>
          </form>
        </article>
      )}
      {eligibleForEvents && (
        <article className="table-panel admin-chief-list">
          <div className="panel-heading">
            <div>
              <h2>Calendar event submissions</h2>
              <p>View your submitted events and group-only events for your assigned group.</p>
            </div>
            <span>{createdEvents.length} events</span>
          </div>
          <table>
            <thead><tr><th>Event</th><th>Date from</th><th>Date to</th><th>Visibility</th><th>Status</th></tr></thead>
            <tbody>
              {createdEvents.length ? createdEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{event.dateFrom ?? event.date}</td>
                  <td>{event.dateTo ?? event.date}</td>
                  <td>{event.visibility}</td>
                  <td>{event.approvalStatus}</td>
                </tr>
              )) : <tr><td colSpan="5">No event submissions yet.</td></tr>}
            </tbody>
          </table>
        </article>
      )}
      <p className="helper-text">
        Imported scouts are sorted by {sortLabels[data.registrationImportSettings.sortBy]} from{" "}
        {data.registrationImportSettings.excelFileName}. Group assignment is based on{" "}
        {sortLabels[data.registrationImportSettings.assignmentMode]}.
      </p>
      {user.role === "admin" && (
        <article className="table-panel admin-chief-list">
          <div className="panel-heading">
            <div>
              <h2>Chiefs</h2>
              <p>Admins can see chief names and their assigned groups from the Chiefs tab.</p>
            </div>
            <span>{data.users.filter((item) => hasChiefAccess(item)).length} chiefs</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Chief</th>
                <th>Assigned group</th>
                <th>Publishing</th>
              </tr>
            </thead>
            <tbody>
              {data.users
                .filter((item) => hasChiefAccess(item))
                .map((chief) => {
                  const group = data.groups.find((item) => item.id === chief.groupId);

                  return (
                    <tr key={chief.id}>
                      <td>{chief.name}</td>
                      <td>{group?.name ?? "Unassigned"}</td>
                      <td>{chief.permissions.canPublish ? "Allowed" : "Not allowed"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </article>
      )}
      <div className="group-stack">
        {visibleGroups.map((group) => (
          <article className="table-panel" key={group.id}>
            <div className="panel-heading">
              <div>
                <h2>{group.name}</h2>
                <p>
                  {group.gradeRange} - {group.ageRange}
                </p>
              </div>
              <span>
                {data.registeredScouts.filter((scout) => scout.groupId === group.id).length} scouts
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>School Grade</th>
                  <th>Age</th>
                  <th>Equipe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortScouts(
                  data.registeredScouts.filter((scout) => scout.groupId === group.id),
                  data.registrationImportSettings.sortBy
                ).map((scout) => (
                  <tr key={scout.id}>
                    <td>{scout.name}</td>
                    <td>{getSchoolGrade(scout)}</td>
                    <td>{scout.age}</td>
                    <td>{getEquipeName(scout, data.equipes ?? [])}</td>
                    <td>{scout.status}</td>
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
