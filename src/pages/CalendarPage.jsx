import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, X } from "lucide-react";
import SafeImage from "../components/SafeImage.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import FormattedText from "../components/FormattedText.jsx";
import { getPublicCalendarEvents } from "../services/calendarService.js";
import { usePublicData } from "../api/usePublicData.js";
import { getPublicBlogsPage, getPublicGalleryPage } from "../api/publicClient.js";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, downloadICSFile } from "../services/calendarExportService.js";

const eventLimit = 500;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
});
const defaultEventColor = "#4055a6";

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
      dateKey,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey
    };
  });
}

function getEventsForDay(events, dateKey) {
  return events.filter((event) => {
    const dateFrom = event.dateFrom ?? event.date;
    const dateTo = event.dateTo ?? dateFrom;

    return dateKey >= dateFrom && dateKey <= dateTo;
  });
}

function formatEventDate(event) {
  const date = event.dateFrom ?? event.date;
  if (!date) return "Date to be announced";
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

function formatEventRange(event) {
  const dateFrom = event.dateFrom ?? event.date;
  const dateTo = event.dateTo ?? dateFrom;

  if (!dateFrom) return "Date to be announced";
  if (dateFrom === dateTo) return formatEventDate(event);

  return `${dateFormatter.format(new Date(`${dateFrom}T00:00:00`))} to ${dateFormatter.format(new Date(`${dateTo}T00:00:00`))}`;
}

function formatEventTime(event) {
  if (!event.startTime && !event.endTime) return "Time to be announced";
  return [event.startTime, event.endTime].filter(Boolean).join(" - ");
}

function getEventColor(event) {
  return event.color ?? event.eventColor ?? event.accentColor ?? defaultEventColor;
}

function getEventMapLink(event) {
  return event.locationUrl ?? event.locationLink ?? event.mapUrl ?? event.mapLink ?? "";
}

function getEventMapEmbed(event) {
  return event.mapEmbedUrl ?? event.locationEmbedUrl ?? "";
}

function getAvailableYears(events, displayDate) {
  const currentYear = new Date().getFullYear();
  const displayYear = displayDate.getFullYear();
  const years = new Set([currentYear - 1, currentYear, currentYear + 1, displayYear]);

  events.forEach((event) => {
    const date = event.dateFrom ?? event.date;
    if (date) years.add(parseLocalDate(date).getFullYear());
  });

  return [...years].sort((a, b) => a - b);
}

export default function CalendarPage() {
  const todayKey = formatDateKey(new Date());
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDayModalDate, setSelectedDayModalDate] = useState("");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading, error } = usePublicData(
    () => getPublicCalendarEvents({ limit: eventLimit }),
    [],
    [],
    ["calendar", "public", eventLimit]
  );
  const events = data ?? [];
  const { data: linkedContent } = usePublicData(
    async () => {
      const [blogs, gallery] = await Promise.all([
        getPublicBlogsPage({ limit: 100 }),
        getPublicGalleryPage({ limit: 100 })
      ]);
      return { blogPosts: blogs.blogPosts, albums: gallery.albums };
    },
    [],
    { blogPosts: [], albums: [] },
    ["calendar", "linked-content"]
  );
  const monthCells = useMemo(() => getMonthCells(displayDate), [displayDate]);
  const monthLabel = monthFormatter.format(displayDate);
  const availableYears = useMemo(() => getAvailableYears(events, displayDate), [events, displayDate]);
  const selectedDateEvents = useMemo(() => getEventsForDay(events, selectedDate), [events, selectedDate]);
  const selectedDayModalEvents = useMemo(
    () => (selectedDayModalDate ? getEventsForDay(events, selectedDayModalDate) : []),
    [events, selectedDayModalDate]
  );
  const requestedEventId = searchParams.get("event") || location.state?.openEventId || "";
  const linkedBlog = selectedEvent?.linkedBlogId
    ? linkedContent.blogPosts.find((post) => post.id === selectedEvent.linkedBlogId)
    : null;
  const linkedAlbum = selectedEvent?.linkedAlbumId
    ? linkedContent.albums.find((album) => album.id === selectedEvent.linkedAlbumId)
    : null;
  const mapLink = selectedEvent ? getEventMapLink(selectedEvent) : "";
  const mapEmbed = selectedEvent ? getEventMapEmbed(selectedEvent) : "";

  useEffect(() => {
    if (!requestedEventId || !events.length) return;

    const nextEvent = events.find((event) => String(event.id) === String(requestedEventId));
    if (!nextEvent) return;

    const nextDateKey = nextEvent.dateFrom ?? nextEvent.date;
    setSelectedEvent(nextEvent);

    if (nextDateKey) {
      setSelectedDate(nextDateKey);
      const nextDate = parseLocalDate(nextDateKey);
      setDisplayDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }, [events, requestedEventId]);

  const changeMonth = (direction) => {
    setIsMonthPickerOpen(false);
    setDisplayDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
    if (requestedEventId) {
      navigate("/calendar", { replace: true, state: null });
    }
  };

  const selectCalendarDate = (dateKey, dayEvents = []) => {
    setSelectedDate(dateKey);
    const nextDate = parseLocalDate(dateKey);
    setDisplayDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));

    if (window.matchMedia("(max-width: 768px)").matches && dayEvents.length) {
      if (dayEvents.length === 1) {
        setSelectedEvent(dayEvents[0]);
      } else {
        setSelectedDayModalDate(dateKey);
      }
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setSelectedDate(todayKey);
    setDisplayDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setIsMonthPickerOpen(false);
  };

  const updateMonthPicker = ({ month = displayDate.getMonth(), year = displayDate.getFullYear() }) => {
    setDisplayDate(new Date(Number(year), Number(month), 1));
  };

  return (
    <section className="page-section calendar-page public-calendar-page">
      <div className="calendar-title-row public-calendar-title-row">
        <div>
          <h1>Events & Calendar</h1>
          <p className="helper-text calendar-selected-date">Selected date: {dateFormatter.format(parseLocalDate(selectedDate))}</p>
        </div>
      </div>

      <div className="calendar-nav-bar" aria-label="Calendar navigation">
        <button type="button" className="calendar-icon-nav" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="calendar-month-picker-wrap">
          <button type="button" className="calendar-month-label" onClick={() => setIsMonthPickerOpen((open) => !open)}>
            {monthLabel}
          </button>
          {isMonthPickerOpen && (
            <div className="calendar-month-picker">
              <label>
                Month
                <select value={displayDate.getMonth()} onChange={(event) => updateMonthPicker({ month: event.target.value })}>
                  {monthNames.map((month, index) => <option value={index} key={month}>{month}</option>)}
                </select>
              </label>
              <label>
                Year
                <select value={displayDate.getFullYear()} onChange={(event) => updateMonthPicker({ year: event.target.value })}>
                  {availableYears.map((year) => <option value={year} key={year}>{year}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
        <button type="button" className="calendar-icon-nav" onClick={() => changeMonth(1)} aria-label="Next month">
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className="calendar-today-button" onClick={jumpToToday}>Today</button>
      </div>

      {error && <p className="empty-public-state">Events could not be loaded: {error.message}</p>}

      <div className="calendar-responsive-shell month" aria-busy={isLoading}>
        <div className="month-calendar" aria-label={`${monthLabel} calendar`}>
          {isLoading && <div className="calendar-loading-panel" role="status">Loading events...</div>}
          {weekdays.map((day) => <span className="weekday-heading" key={day}>{day}</span>)}
          {monthCells.map((cell) => {
            const dayEvents = getEventsForDay(events, cell.dateKey);

            return (
              <div
                className={`calendar-day ${cell.isCurrentMonth ? "" : "outside"} ${cell.isToday ? "today" : ""} ${cell.dateKey === selectedDate ? "selected" : ""}`}
                key={cell.dateKey}
                aria-label={`${cell.dateKey}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              >
                <button type="button" className="calendar-day-select" onClick={() => selectCalendarDate(cell.dateKey, dayEvents)}>
                  <span className="day-number">{cell.day}</span>
                </button>
                <button type="button" className="mobile-event-indicators" aria-label={`Open ${cell.dateKey} events`} onClick={() => selectCalendarDate(cell.dateKey, dayEvents)}>
                  {dayEvents.slice(0, 3).map((event) => <i key={event.id} style={{ "--event-color": getEventColor(event) }} />)}
                </button>
                {dayEvents.length > 0 && <button type="button" className="mobile-event-count" onClick={() => selectCalendarDate(cell.dateKey, dayEvents)}>{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</button>}
                <span className="day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      type="button"
                      className="calendar-pill public"
                      key={event.id}
                      style={{ "--event-color": getEventColor(event) }}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <span className="calendar-pill-title">{event.title}</span>
                      <small>{formatEventTime(event)}</small>
                    </button>
                  ))}
                  {dayEvents.length > 3 && <button type="button" className="calendar-more-count" onClick={() => setSelectedDayModalDate(cell.dateKey)}>+{dayEvents.length - 3} more</button>}
                </span>
              </div>
            );
          })}
        </div>

        <aside className="selected-day-panel">
          <p className="eyebrow">Selected Date</p>
          <h2>{dateFormatter.format(parseLocalDate(selectedDate))}</h2>
          <p>{selectedDateEvents.length ? `${selectedDateEvents.length} public event${selectedDateEvents.length === 1 ? "" : "s"}` : "No public events are scheduled for this date."}</p>
          <div className="calendar-agenda-list">
            {isLoading ? (
              <div className="calendar-agenda-card public-loading-card">
                <div className="loading-thumb" />
                <span>
                  <strong>Loading events...</strong>
                  <i />
                </span>
              </div>
            ) : selectedDateEvents.length ? selectedDateEvents.map((event) => (
              <button type="button" className="calendar-agenda-card" key={event.id} onClick={() => setSelectedEvent(event)} style={{ "--event-color": getEventColor(event) }}>
                {event.imageUrl && <SafeImage src={event.imageUrl} alt="" loading="lazy" width={320} height={180} />}
                <span>{formatEventTime(event)}</span>
                <strong>{event.title}</strong>
                <small>{event.location || "St. Mary's Catholic Church, Dubai"}</small>
              </button>
            )) : <p className="empty-state">No events are scheduled for this date.</p>}
          </div>
        </aside>
      </div>

      {!events.length && !isLoading && <p className="empty-public-state">No public events are available yet.</p>}

      {selectedDayModalDate && !selectedEvent && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Events for selected date" onClick={() => setSelectedDayModalDate("")}>
          <article className="event-detail-modal event-day-list-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lightbox-close" aria-label="Close event list" onClick={() => setSelectedDayModalDate("")}>
              <X size={24} aria-hidden="true" />
            </button>
            <p className="eyebrow">Events</p>
            <h2>{dateFormatter.format(parseLocalDate(selectedDayModalDate))}</h2>
            <div className="calendar-agenda-list">
              {selectedDayModalEvents.map((event) => (
                <button type="button" className="calendar-agenda-card" key={event.id} onClick={() => { setSelectedDayModalDate(""); setSelectedEvent(event); }} style={{ "--event-color": getEventColor(event) }}>
                  <span>{formatEventTime(event)}</span>
                  <strong>{event.title}</strong>
                  <small>{event.location || "St. Mary's Catholic Church, Dubai"}</small>
                </button>
              ))}
            </div>
          </article>
        </div>
      )}

      {selectedEvent && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Event details" onClick={closeEventDetail}>
          <article className="event-detail-modal" onClick={(event) => event.stopPropagation()} style={{ "--event-color": getEventColor(selectedEvent) }}>
            <button type="button" className="lightbox-close" aria-label="Close event details" onClick={closeEventDetail}>
              <X size={24} aria-hidden="true" />
            </button>
            {selectedEvent.imageUrl && <SafeImage src={selectedEvent.imageUrl} alt="" loading="eager" fetchPriority="high" width={900} height={520} />}
            <div className="event-detail-heading-block">
              <span className="event-color-dot" aria-hidden="true" />
              <div>
                <p className="eyebrow">{selectedEvent.type ?? "Event"}</p>
                <h2>{selectedEvent.title}</h2>
              </div>
            </div>
            <div className="card-meta">
              <span><CalendarDays size={16} aria-hidden="true" />{formatEventRange(selectedEvent)}</span>
              <span><Clock size={16} aria-hidden="true" />{formatEventTime(selectedEvent)}</span>
              <span><MapPin size={16} aria-hidden="true" />{selectedEvent.location || "St. Mary's Catholic Church, Dubai"}</span>
            </div>
            <FormattedText text={selectedEvent.description} fallback="More details will be shared soon." className="detail-copy formatted-text" />
            {(mapEmbed || mapLink) && (
              <div className="event-map-preview">
                {mapEmbed ? <iframe title={`${selectedEvent.title} map`} src={mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : null}
                {mapLink ? <a href={mapLink} target="_blank" rel="noreferrer">Open location map</a> : null}
              </div>
            )}
            {(linkedBlog || linkedAlbum) && (
              <div className="event-linked-content">
                {linkedBlog && <Link to={`/blogs/${linkedBlog.slug}`}>Read linked blog: {linkedBlog.title}</Link>}
                {linkedAlbum && <Link to={`/gallery/${linkedAlbum.id}`}>View linked gallery: {linkedAlbum.title}</Link>}
              </div>
            )}
            <div className="event-calendar-actions">
              <a href={buildGoogleCalendarUrl(selectedEvent)} target="_blank" rel="noreferrer">Add to Google Calendar</a>
              <a href={buildOutlookCalendarUrl(selectedEvent)} target="_blank" rel="noreferrer">Add to Outlook</a>
              <button type="button" onClick={() => downloadICSFile(selectedEvent)}>Download .ics</button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}