import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import FormattedText from "../components/FormattedText.jsx";
import { getPublicCalendarEvents } from "../services/calendarService.js";
import { usePublicData } from "../api/usePublicData.js";
import { getPublicBlogsPage, getPublicGalleryPage } from "../api/publicClient.js";

const eventLimit = 100;
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("en", {
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

export default function CalendarPage() {
  const todayKey = formatDateKey(new Date());
  const [displayDate, setDisplayDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedEvent, setSelectedEvent] = useState(null);
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
  const selectedDateEvents = useMemo(() => getEventsForDay(events, selectedDate), [events, selectedDate]);
  const requestedEventId = searchParams.get("event") || location.state?.openEventId || "";
  const linkedBlog = selectedEvent?.linkedBlogId
    ? linkedContent.blogPosts.find((post) => post.id === selectedEvent.linkedBlogId)
    : null;
  const linkedAlbum = selectedEvent?.linkedAlbumId
    ? linkedContent.albums.find((album) => album.id === selectedEvent.linkedAlbumId)
    : null;

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
    setDisplayDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
    if (requestedEventId) {
      navigate("/calendar", { replace: true, state: null });
    }
  };

  const selectCalendarDate = (dateKey) => {
    setSelectedDate(dateKey);
    const nextDate = parseLocalDate(dateKey);
    setDisplayDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  };

  return (
    <section className="page-section calendar-page public-calendar-page">
      <p className="eyebrow">Calendar</p>
      <div className="calendar-title-row">
        <div>
          <h1>Upcoming public events</h1>
          <p className="helper-text calendar-selected-date">Selected date: {dateFormatter.format(parseLocalDate(selectedDate))}</p>
        </div>
        <div className="calendar-nav-controls" aria-label="Calendar navigation">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <p className="empty-public-state">Events could not be loaded: {error.message}</p>}
      {isLoading && <p className="helper-text">Loading events...</p>}

      <div className="calendar-responsive-shell month">
        <div className="month-calendar" aria-label={`${monthLabel} calendar`}>
          {weekdays.map((day) => <span className="weekday-heading" key={day}>{day}</span>)}
          {monthCells.map((cell) => {
            const dayEvents = getEventsForDay(events, cell.dateKey);

            return (
              <button
                type="button"
                className={`calendar-day ${cell.isCurrentMonth ? "" : "outside"} ${cell.isToday ? "today" : ""} ${cell.dateKey === selectedDate ? "selected" : ""}`}
                key={cell.dateKey}
                onClick={() => selectCalendarDate(cell.dateKey)}
                aria-label={`${cell.dateKey}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
              >
                <span className="day-number">{cell.day}</span>
                <span className="mobile-event-indicators" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((event) => <i key={event.id} className="public" />)}
                </span>
                {dayEvents.length > 0 && <span className="mobile-event-count">{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</span>}
                <span className="day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span className="calendar-pill public" key={event.id}>
                      <span className="calendar-pill-title">{event.title}</span>
                      <small>{formatEventTime(event)}</small>
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="calendar-more-count">+{dayEvents.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>

        <aside className="selected-day-panel">
          <p className="eyebrow">Selected Date</p>
          <h2>{dateFormatter.format(parseLocalDate(selectedDate))}</h2>
          <p>{selectedDateEvents.length ? `${selectedDateEvents.length} public event${selectedDateEvents.length === 1 ? "" : "s"}` : "No public events are scheduled for this date."}</p>
          <div className="calendar-agenda-list">
            {selectedDateEvents.length ? selectedDateEvents.map((event) => (
              <button type="button" className="calendar-agenda-card" key={event.id} onClick={() => setSelectedEvent(event)}>
                {event.imageUrl && <img src={event.imageUrl} alt="" loading="lazy" decoding="async" width={320} height={180} />}
                <span>{formatEventTime(event)}</span>
                <strong>{event.title}</strong>
                <small>{event.location || "St. Mary's Catholic Church, Dubai"}</small>
              </button>
            )) : <p className="empty-state">No events are scheduled for this date.</p>}
          </div>
        </aside>
      </div>

      {!events.length && !isLoading && <p className="empty-public-state">No upcoming public events are available yet.</p>}

      {selectedEvent && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Event details" onClick={closeEventDetail}>
          <article className="event-detail-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lightbox-close" aria-label="Close event details" onClick={closeEventDetail}>
              <X size={24} aria-hidden="true" />
            </button>
            {selectedEvent.imageUrl && <img src={selectedEvent.imageUrl} alt="" loading="eager" decoding="async" width={900} height={520} />}
            <p className="eyebrow">{selectedEvent.type ?? "Event"}</p>
            <h2>{selectedEvent.title}</h2>
            <div className="card-meta">
              <span><CalendarDays size={16} aria-hidden="true" />{formatEventRange(selectedEvent)}</span>
              <span><Clock size={16} aria-hidden="true" />{formatEventTime(selectedEvent)}</span>
              <span><MapPin size={16} aria-hidden="true" />{selectedEvent.location || "St. Mary's Catholic Church, Dubai"}</span>
            </div>
            <FormattedText text={selectedEvent.description} fallback="More details will be shared soon." className="detail-copy formatted-text" />
            {(linkedBlog || linkedAlbum) && (
              <div className="event-linked-content">
                {linkedBlog && <Link to={`/blogs/${linkedBlog.slug}`}>Read linked blog: {linkedBlog.title}</Link>}
                {linkedAlbum && <Link to={`/gallery/${linkedAlbum.id}`}>View linked gallery: {linkedAlbum.title}</Link>}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}


