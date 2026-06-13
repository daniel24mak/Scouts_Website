import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "../../api/client.js";
import { useBootstrap } from "../../api/useBootstrap.js";
import { useAuth } from "../../auth/AuthProvider.jsx";
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadICSFile
} from "../../services/calendarExportService.js";
import { subscribeDashboardRealtime } from "../../services/realtimeService.js";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateKey) {
  const [year, month, day] = String(dateKey ?? "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getMonthCells(displayDate) {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = formatDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      date,
      dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey
    };
  });
}

function canSeeEvent(event, user) {
  if (user?.role !== "admin" && (event.approvalStatus ?? "approved") !== "approved") {
    return false;
  }

  if (event.visibility === "public") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (event.visibility === "logged-in") {
    return true;
  }

  if (event.visibility === "group") {
    return event.visibleGroupIds?.includes(user.groupId) || event.groupId === user.groupId;
  }

  return event.type !== "meeting";
}

function getEventsForDay(events, dateKey) {
  return events.filter((event) => {
    const dateFrom = event.dateFrom ?? event.date;
    const dateTo = event.dateTo ?? dateFrom;

    return dateKey >= dateFrom && dateKey <= dateTo;
  });
}

function getVisibilityLabel(event) {
  if (event.visibility === "public") {
    return "Everyone";
  }

  if (event.visibility === "logged-in") {
    return "Logged in";
  }

  return "Group chiefs";
}

function hasChiefAccess(user) {
  return user?.role === "chief" || Boolean(user?.groupId && user?.chiefLevel);
}

function formatEventDateRange(event) {
  const dateFrom = event.dateFrom ?? event.date;
  const dateTo = event.dateTo ?? dateFrom;

  if (dateFrom === dateTo) {
    return dateFrom;
  }

  return `${dateFrom} to ${dateTo}`;
}

function formatEventTime(event) {
  return [event.startTime, event.endTime].filter(Boolean).join(" - ") || "All day";
}

function validateEventDates(event) {
  if (event.dateTo < event.dateFrom) {
    return "Date to cannot be before Date from.";
  }

  if (event.dateFrom === event.dateTo && event.startTime && event.endTime && event.endTime < event.startTime) {
    return "End time cannot be before start time for a one-day event.";
  }

  return "";
}

function groupEventsByDate(events) {
  return events.reduce((groups, event) => {
    const dateKey = event.dateFrom ?? event.date;
    groups[dateKey] = [...(groups[dateKey] ?? []), event];
    return groups;
  }, {});
}

export default function CalendarManagement() {
  const { user } = useAuth();
  const { data, refresh } = useBootstrap();
  const todayKey = formatDateKey(new Date());
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calendarView, setCalendarView] = useState("month");
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const [calendarExportError, setCalendarExportError] = useState("");
  const [lastCalendarUpdate, setLastCalendarUpdate] = useState(null);
  const [groupMeeting, setGroupMeeting] = useState({
    title: "",
    dateFrom: "",
    dateTo: "",
    startTime: "",
    endTime: "",
    location: "Scout Hall",
    description: ""
  });
  const [adminEvent, setAdminEvent] = useState({
    title: "",
    dateFrom: "",
    dateTo: "",
    startTime: "",
    endTime: "",
    visibility: "public",
    visibleGroupIds: ["louvetoux"],
    location: "Scout Hall",
    description: ""
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const monthCells = useMemo(() => getMonthCells(displayDate), [displayDate]);
  const monthLabel = monthFormatter.format(displayDate);
  const visibleEvents = useMemo(
    () => data.plannedEvents.filter((event) => canSeeEvent(event, user)),
    [data.plannedEvents, user]
  );
  const selectedDateEvents = useMemo(
    () => getEventsForDay(visibleEvents, selectedDate),
    [selectedDate, visibleEvents]
  );
  const agendaEventsByDate = useMemo(() => {
    const currentMonth = displayDate.getMonth();
    const currentYear = displayDate.getFullYear();
    const monthEvents = visibleEvents
      .filter((event) => {
        const date = parseLocalDate(event.dateFrom ?? event.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .sort((a, b) => String(a.dateFrom ?? a.date).localeCompare(String(b.dateFrom ?? b.date)));

    return groupEventsByDate(monthEvents);
  }, [displayDate, visibleEvents]);
  const scoutGroups = data.groups;
  const canCreateGroupMeeting =
    hasChiefAccess(user) &&
    ["head", "vice"].includes(user.chiefLevel) &&
    user.permissions.canCreateGroupMeetings;
  const canCreateAdminEvent = user?.role === "admin";
  const canEditSelectedEvent =
    selectedEvent &&
    user &&
    (user.role === "admin" || selectedEvent.submittedBy === user.id);
  const selectedEventGroup = selectedEvent
    ? scoutGroups.find((item) => item.id === selectedEvent.groupId)
    : null;

  useEffect(() => {
    const unsubscribe = subscribeDashboardRealtime(async () => {
      await refresh();
      setLastCalendarUpdate(new Date());
    }, { intervalMs: 9000 });

    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    const updatedEvent = visibleEvents.find((event) => event.id === selectedEvent.id);
    if (updatedEvent) {
      setSelectedEvent(updatedEvent);
      return;
    }

    setSelectedEvent(null);
    setEditingEvent(null);
  }, [selectedEvent, visibleEvents]);

  const goToPreviousMonth = () => {
    setDisplayDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setDisplayDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };
  const goToCurrentMonth = () => {
    const today = new Date();
    setDisplayDate(today);
    setSelectedDate(formatDateKey(today));
  };
  const selectCalendarDate = (dateKey) => {
    setSelectedDate(dateKey);
    setCalendarView("month");
  };
  const handleCreateGroupMeeting = async (event) => {
    event.preventDefault();
    const error = validateEventDates(groupMeeting);
    if (error) {
      setSaveMessage(error);
      return;
    }

    await createCalendarEvent({
      ...groupMeeting,
      date: groupMeeting.dateFrom,
      title: groupMeeting.title || `${user.groupId} meeting`,
      type: "meeting",
      visibility: "group",
      groupId: user.groupId,
      visibleGroupIds: [user.groupId],
      description: groupMeeting.description || "Group meeting created by a head or vice chief.",
      approvalStatus: user.role === "admin" ? "approved" : "pending"
    });
    setSaveMessage(user.role === "admin" ? "Group meeting saved." : "Group meeting submitted for admin approval.");
    setGroupMeeting({
      title: "",
      dateFrom: "",
      dateTo: "",
      startTime: "",
      endTime: "",
      location: "Scout Hall",
      description: ""
    });
    await refresh();
    setLastCalendarUpdate(new Date());
  };
  const handleCreateAdminEvent = async (event) => {
    event.preventDefault();
    const error = validateEventDates(adminEvent);
    if (error) {
      setSaveMessage(error);
      return;
    }

    await createCalendarEvent({
      ...adminEvent,
      date: adminEvent.dateFrom,
      type: adminEvent.visibility === "group" ? "meeting" : "event",
      status: "planned",
      approvalStatus: "approved",
      description: adminEvent.description || "Calendar event created by admin."
    });
    setSaveMessage("Calendar event saved.");
    setAdminEvent({
      title: "",
      dateFrom: "",
      dateTo: "",
      startTime: "",
      endTime: "",
      visibility: "public",
      visibleGroupIds: ["louvetoux"],
      location: "Scout Hall",
      description: ""
    });
    await refresh();
    setLastCalendarUpdate(new Date());
  };
  const handleDeleteEvent = async (eventId, title) => {
    const shouldDelete = window.confirm(`Delete "${title}" from the calendar?`);
    if (!shouldDelete) {
      return;
    }

    await deleteCalendarEvent(eventId);
    setSaveMessage("Calendar event deleted.");
    setSelectedEvent(null);
    await refresh();
    setLastCalendarUpdate(new Date());
  };
  const beginEditEvent = () => {
    setEditingEvent({
      title: selectedEvent.title ?? "",
      dateFrom: selectedEvent.dateFrom ?? selectedEvent.date ?? "",
      dateTo: selectedEvent.dateTo ?? selectedEvent.dateFrom ?? selectedEvent.date ?? "",
      startTime: selectedEvent.startTime ?? "",
      endTime: selectedEvent.endTime ?? "",
      visibility: selectedEvent.visibility ?? "public",
      visibleGroupIds: selectedEvent.visibleGroupIds ?? [],
      groupId: selectedEvent.groupId ?? "",
      location: selectedEvent.location ?? "",
      description: selectedEvent.description ?? "",
      approvalStatus: selectedEvent.approvalStatus ?? "pending"
    });
  };
  const saveEventEdit = async (event) => {
    event.preventDefault();
    const error = validateEventDates(editingEvent);
    if (error) {
      setSaveMessage(error);
      return;
    }

    await updateCalendarEvent(selectedEvent.id, {
      ...selectedEvent,
      ...editingEvent,
      date: editingEvent.dateFrom,
      type: editingEvent.visibility === "group" ? "meeting" : "event",
      approvalStatus: user.role === "admin" ? editingEvent.approvalStatus : "pending"
    });
    setSaveMessage(user.role === "admin" ? "Calendar event updated." : "Calendar event changes submitted for admin approval.");
    setEditingEvent(null);
    setSelectedEvent(null);
    await refresh();
    setLastCalendarUpdate(new Date());
  };
  const openCalendarLink = (builder) => {
    try {
      setCalendarExportError("");
      setCalendarMenuOpen(false);
      window.open(builder(selectedEvent), "_blank", "noopener,noreferrer");
    } catch {
      setCalendarExportError("Unable to add this event to your calendar.");
    }
  };
  const downloadCalendarFile = () => {
    try {
      setCalendarExportError("");
      setCalendarMenuOpen(false);
      downloadICSFile(selectedEvent);
    } catch {
      setCalendarExportError("Unable to create a calendar file for this event.");
    }
  };

  return (
    <section className="page-section calendar-page">
      <p className="eyebrow">Calendar</p>
      <div className="calendar-title-row">
        <div>
          <h1>{monthLabel}</h1>
          <p className="helper-text calendar-selected-date">Selected date: {fullDateFormatter.format(parseLocalDate(selectedDate))}</p>
        </div>
        <div className="calendar-nav-controls" aria-label="Calendar navigation">
          <button type="button" aria-label="Previous month" onClick={goToPreviousMonth}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={goToCurrentMonth}>Today</button>
          <button type="button" aria-label="Next month" onClick={goToNextMonth}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="calendar-view-toolbar" aria-label="Calendar views">
        <button type="button" className={calendarView === "month" ? "active" : ""} onClick={() => setCalendarView("month")}>Month</button>
        <button type="button" className={calendarView === "agenda" ? "active" : ""} onClick={() => setCalendarView("agenda")}>Agenda</button>
        {lastCalendarUpdate && (
          <span className="calendar-live-status">
            <RefreshCw size={14} aria-hidden="true" />
            Updated just now
          </span>
        )}
      </div>
      <p className="helper-text">
        Public events are visible to everyone. Chief-only meetings are hidden unless the logged-in
        user is allowed to see that group.
      </p>
      {saveMessage && <p className="helper-text">{saveMessage}</p>}
      {(canCreateGroupMeeting || canCreateAdminEvent) && (
        <div className="calendar-tools">
          {canCreateGroupMeeting && (
            <form className="calendar-create-panel" onSubmit={handleCreateGroupMeeting}>
              <h2>Create group meeting</h2>
              <p>Head chiefs and vice chiefs can create meetings for chiefs in their group only.</p>
              <label>Title<input type="text" placeholder={`${user.groupId} meeting`} value={groupMeeting.title} onChange={(event) => setGroupMeeting((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Date from<input type="date" required value={groupMeeting.dateFrom} onChange={(event) => setGroupMeeting((current) => ({ ...current, dateFrom: event.target.value, dateTo: current.dateTo || event.target.value }))} /></label>
              <label>Date to<input type="date" required value={groupMeeting.dateTo} onChange={(event) => setGroupMeeting((current) => ({ ...current, dateTo: event.target.value }))} /></label>
              <label>Description<input type="text" required value={groupMeeting.description} onChange={(event) => setGroupMeeting((current) => ({ ...current, description: event.target.value }))} /></label>
              <label>Start time<input type="time" value={groupMeeting.startTime} onChange={(event) => setGroupMeeting((current) => ({ ...current, startTime: event.target.value }))} /></label>
              <label>End time<input type="time" value={groupMeeting.endTime} onChange={(event) => setGroupMeeting((current) => ({ ...current, endTime: event.target.value }))} /></label>
              <label>Location<input type="text" required value={groupMeeting.location} onChange={(event) => setGroupMeeting((current) => ({ ...current, location: event.target.value }))} /></label>
              <button type="submit"><Plus size={18} aria-hidden="true" />Add group meeting</button>
            </form>
          )}
          {canCreateAdminEvent && (
            <form className="calendar-create-panel" onSubmit={handleCreateAdminEvent}>
              <h2>Create calendar event</h2>
              <p>Admins can publish to everyone, logged-in users, or selected logged-in groups.</p>
              <label>Title<input type="text" required placeholder="Group activity" value={adminEvent.title} onChange={(event) => setAdminEvent((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Date from<input type="date" required value={adminEvent.dateFrom} onChange={(event) => setAdminEvent((current) => ({ ...current, dateFrom: event.target.value, dateTo: current.dateTo || event.target.value }))} /></label>
              <label>Date to<input type="date" required value={adminEvent.dateTo} onChange={(event) => setAdminEvent((current) => ({ ...current, dateTo: event.target.value }))} /></label>
              <label>Description<input type="text" required value={adminEvent.description} onChange={(event) => setAdminEvent((current) => ({ ...current, description: event.target.value }))} /></label>
              <label>Start time<input type="time" value={adminEvent.startTime} onChange={(event) => setAdminEvent((current) => ({ ...current, startTime: event.target.value }))} /></label>
              <label>End time<input type="time" value={adminEvent.endTime} onChange={(event) => setAdminEvent((current) => ({ ...current, endTime: event.target.value }))} /></label>
              <label>Location<input type="text" required value={adminEvent.location} onChange={(event) => setAdminEvent((current) => ({ ...current, location: event.target.value }))} /></label>
              <label>Visibility<select value={adminEvent.visibility} onChange={(event) => setAdminEvent((current) => ({ ...current, visibility: event.target.value }))}><option value="public">Everyone</option><option value="logged-in">Logged-in users</option><option value="group">Specific logged-in groups</option></select></label>
              <label>Groups<select multiple value={adminEvent.visibleGroupIds} onChange={(event) => setAdminEvent((current) => ({ ...current, visibleGroupIds: [...event.target.selectedOptions].map((option) => option.value) }))}>{scoutGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <button type="submit"><Plus size={18} aria-hidden="true" />Add event</button>
            </form>
          )}
        </div>
      )}
      <div className={`calendar-responsive-shell ${calendarView}`}>
        <div className="month-calendar" aria-label={`${monthLabel} calendar`}>
          {weekdays.map((day) => <div className="weekday-heading" key={day}>{day}</div>)}
          {monthCells.map((cell) => {
            const dayEvents = getEventsForDay(visibleEvents, cell.dateKey);
            return (
              <button
                type="button"
                className={`calendar-day ${cell.isCurrentMonth ? "" : "outside"} ${cell.isToday ? "today" : ""} ${cell.dateKey === selectedDate ? "selected" : ""}`}
                key={cell.dateKey}
                onClick={() => selectCalendarDate(cell.dateKey)}
                aria-label={`${cell.dateKey}, ${dayEvents.length} events`}
              >
                <span className="day-number">{cell.day}</span>
                <span className="mobile-event-indicators" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((event) => <i key={event.id} className={event.visibility} />)}
                </span>
                {dayEvents.length > 0 && <span className="mobile-event-count">{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</span>}
                <span className="day-events">
                  {dayEvents.slice(0, 3).map((event) => {
                    const group = scoutGroups.find((item) => item.id === event.groupId);
                    return (
                      <span className={`calendar-pill ${event.visibility}`} key={event.id}>
                        <span className="calendar-pill-title">{event.title}</span>
                        <small>{getVisibilityLabel(event)}{group ? ` - ${group.name}` : ""}</small>
                      </span>
                    );
                  })}
                  {dayEvents.length > 3 && <span className="calendar-more-count">+{dayEvents.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
        <section className="selected-day-panel" aria-live="polite">
          <div className="panel-heading compact-heading">
            <div>
              <h2>{fullDateFormatter.format(parseLocalDate(selectedDate))}</h2>
              <p>{selectedDateEvents.length ? `${selectedDateEvents.length} scheduled event${selectedDateEvents.length === 1 ? "" : "s"}` : "No events are scheduled for this date."}</p>
            </div>
          </div>
          <div className="calendar-agenda-list">
            {selectedDateEvents.length ? selectedDateEvents.map((event) => {
              const group = scoutGroups.find((item) => item.id === event.groupId);
              return (
                <button type="button" className="calendar-agenda-card" key={event.id} onClick={() => setSelectedEvent(event)}>
                  {event.imageUrl && <img src={event.imageUrl} alt="" loading="lazy" />}
                  <span>
                    <strong>{event.title}</strong>
                    <small>{formatEventDateRange(event)} · {formatEventTime(event)}</small>
                    {event.location && <small>{event.location}</small>}
                    <small>{getVisibilityLabel(event)}{group ? ` · ${group.name}` : ""}</small>
                  </span>
                </button>
              );
            }) : <p className="empty-state">No events are scheduled for this date.</p>}
          </div>
        </section>
        <section className="calendar-agenda-panel">
          {Object.keys(agendaEventsByDate).length ? Object.entries(agendaEventsByDate).map(([dateKey, events]) => (
            <article className="agenda-date-group" key={dateKey}>
              <h2>{fullDateFormatter.format(parseLocalDate(dateKey))}</h2>
              <div className="calendar-agenda-list">
                {events.map((event) => {
                  const group = scoutGroups.find((item) => item.id === event.groupId);
                  return (
                    <button type="button" className="calendar-agenda-card" key={event.id} onClick={() => setSelectedEvent(event)}>
                      {event.imageUrl && <img src={event.imageUrl} alt="" loading="lazy" />}
                      <span>
                        <strong>{event.title}</strong>
                        <small>{formatEventTime(event)}</small>
                        {event.location && <small>{event.location}</small>}
                        <small>{getVisibilityLabel(event)}{group ? ` · ${group.name}` : ""}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          )) : <p className="empty-state">No upcoming events found for this month.</p>}
        </section>
      </div>
      <div className="calendar-legend">
        <span><CalendarDays size={16} aria-hidden="true" />Events appear on their calendar dates</span>
        <span><Lock size={16} aria-hidden="true" />Chief-only meetings are hidden from public users</span>
        <span><MapPin size={16} aria-hidden="true" />Admins can view every group meeting</span>
      </div>
      {selectedEvent && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}>
          <article className="modal-panel calendar-detail-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading calendar-detail-heading">
              <div>
                <p className="eyebrow">Calendar event</p>
                <h2 id="calendar-event-title">{selectedEvent.title}</h2>
              </div>
              <button type="button" className="calendar-detail-close" aria-label="Close event details" onClick={() => { setEditingEvent(null); setSelectedEvent(null); }}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {selectedEvent.imageUrl && <img className="calendar-detail-image" src={selectedEvent.imageUrl} alt="" loading="lazy" />}
            <div className="modal-body">
              {editingEvent ? (
                <form className="calendar-create-panel" onSubmit={saveEventEdit}>
                  <label>Title<input value={editingEvent.title} required onChange={(event) => setEditingEvent((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>Date from<input type="date" value={editingEvent.dateFrom} required onChange={(event) => setEditingEvent((current) => ({ ...current, dateFrom: event.target.value, dateTo: current.dateTo || event.target.value }))} /></label>
                  <label>Date to<input type="date" value={editingEvent.dateTo} required onChange={(event) => setEditingEvent((current) => ({ ...current, dateTo: event.target.value }))} /></label>
                  <label>Start time<input type="time" value={editingEvent.startTime} onChange={(event) => setEditingEvent((current) => ({ ...current, startTime: event.target.value }))} /></label>
                  <label>End time<input type="time" value={editingEvent.endTime} onChange={(event) => setEditingEvent((current) => ({ ...current, endTime: event.target.value }))} /></label>
                  <label>Location<input value={editingEvent.location} required onChange={(event) => setEditingEvent((current) => ({ ...current, location: event.target.value }))} /></label>
                  <label>Description<textarea rows="4" value={editingEvent.description} required onChange={(event) => setEditingEvent((current) => ({ ...current, description: event.target.value }))} /></label>
                  {user?.role === "admin" && (
                    <>
                      <label>Visibility<select value={editingEvent.visibility} onChange={(event) => setEditingEvent((current) => ({ ...current, visibility: event.target.value }))}><option value="public">Everyone</option><option value="logged-in">Logged-in users</option><option value="group">Specific logged-in groups</option></select></label>
                      <label>Status<select value={editingEvent.approvalStatus} onChange={(event) => setEditingEvent((current) => ({ ...current, approvalStatus: event.target.value }))}><option value="pending">pending</option><option value="approved">approved</option><option value="needs_changes">needs changes</option><option value="rejected">rejected</option><option value="archived">archived</option></select></label>
                    </>
                  )}
                  <div className="blog-submit-actions"><button type="submit">Save event</button><button type="button" className="secondary-action" onClick={() => setEditingEvent(null)}>Cancel</button></div>
                </form>
              ) : (
                <>
                  <div className="calendar-detail-grid">
                    <span><CalendarDays size={16} aria-hidden="true" />Date from: {selectedEvent.dateFrom ?? selectedEvent.date}</span>
                    <span><CalendarDays size={16} aria-hidden="true" />Date to: {selectedEvent.dateTo ?? selectedEvent.dateFrom ?? selectedEvent.date}</span>
                    <span><Clock size={16} aria-hidden="true" />{formatEventTime(selectedEvent)}</span>
                    <span><Eye size={16} aria-hidden="true" />{getVisibilityLabel(selectedEvent)}</span>
                    {selectedEvent.location && <span><MapPin size={16} aria-hidden="true" />{selectedEvent.location}</span>}
                    {selectedEventGroup && <span>{selectedEventGroup.name}</span>}
                    {user?.role === "admin" && <span>Status: {selectedEvent.approvalStatus ?? "approved"}</span>}
                    {user?.role === "admin" && selectedEvent.submittedBy && <span>Created by: {selectedEvent.submittedBy}</span>}
                  </div>
                  <p className="detail-copy">{selectedEvent.description || "No description added yet."}</p>
                  <div className="calendar-add-menu-wrap">
                    <button type="button" className="inline-action" onClick={() => setCalendarMenuOpen((current) => !current)}>
                      <Download size={16} aria-hidden="true" />Add to Calendar
                    </button>
                    {calendarMenuOpen && (
                      <div className="calendar-add-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => openCalendarLink(buildGoogleCalendarUrl)}>Google Calendar</button>
                        <button type="button" role="menuitem" onClick={downloadCalendarFile}>Apple Calendar / iCalendar</button>
                        <button type="button" role="menuitem" onClick={() => openCalendarLink(buildOutlookCalendarUrl)}>Outlook Calendar</button>
                        <button type="button" role="menuitem" onClick={downloadCalendarFile}>Download .ics File</button>
                      </div>
                    )}
                    {calendarExportError && <p className="form-error">{calendarExportError}</p>}
                  </div>
                  <div className="blog-submit-actions">
                    {canEditSelectedEvent && <button type="button" className="inline-action" onClick={beginEditEvent}>Edit event</button>}
                    {canCreateAdminEvent && <button type="button" className="inline-action danger-action" onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.title)}>Delete event</button>}
                  </div>
                </>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
