const defaultTimezone = "Asia/Dubai";

function pad(value) {
  return String(value).padStart(2, "0");
}

function cleanDate(value) {
  return String(value ?? "").slice(0, 10);
}

function cleanTime(value) {
  return String(value ?? "").slice(0, 5);
}

function addDays(dateValue, days) {
  const [year, month, day] = cleanDate(dateValue).split("-").map(Number);
  const date = new Date(year, month - 1, day + days);

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function compactDate(dateValue) {
  return cleanDate(dateValue).replaceAll("-", "");
}

function compactDateTime(dateValue, timeValue) {
  const date = compactDate(dateValue);
  const time = cleanTime(timeValue || "00:00").replace(":", "");

  return `${date}T${time}00`;
}

function outlookDateTime(dateValue, timeValue) {
  return `${cleanDate(dateValue)}T${cleanTime(timeValue || "00:00")}:00`;
}

function getEventDates(event) {
  const dateFrom = cleanDate(event.dateFrom ?? event.date);
  const dateTo = cleanDate(event.dateTo ?? event.dateFrom ?? event.date);
  const startTime = cleanTime(event.startTime);
  const endTime = cleanTime(event.endTime);
  const hasTime = Boolean(startTime || endTime);

  return {
    dateFrom,
    dateTo,
    startTime,
    endTime,
    hasTime,
    timezone: event.timezone ?? event.timeZone ?? defaultTimezone
  };
}

function getEventUrl(event) {
  if (event.url) {
    return event.url;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  if (event.id) {
    url.hash = `event-${event.id}`;
  }

  return url.toString();
}

export function escapeICSText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldICSLine(line) {
  const chars = [...line];
  const chunks = [];
  let current = "";

  chars.forEach((char) => {
    if (current.length >= 73) {
      chunks.push(current);
      current = ` ${char}`;
      return;
    }

    current += char;
  });

  chunks.push(current);
  return chunks.join("\r\n");
}

function buildDescription(event) {
  return [event.description, getEventUrl(event)].filter(Boolean).join("\n\n");
}

function getEndDateForExport(dateFrom, dateTo, startTime, endTime, hasTime) {
  if (!hasTime) {
    return addDays(dateTo || dateFrom, 1);
  }

  if (!endTime) {
    return compactDateTime(dateTo || dateFrom, startTime || "23:59");
  }

  return compactDateTime(dateTo || dateFrom, endTime);
}

export function buildGoogleCalendarUrl(event) {
  const { dateFrom, dateTo, startTime, endTime, hasTime, timezone } = getEventDates(event);
  const start = hasTime ? compactDateTime(dateFrom, startTime || "00:00") : compactDate(dateFrom);
  const end = getEndDateForExport(dateFrom, dateTo, startTime, endTime, hasTime);
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title ?? "Scouts event");
  url.searchParams.set("dates", `${start}/${end}`);
  url.searchParams.set("details", buildDescription(event));
  url.searchParams.set("location", event.location ?? "");
  url.searchParams.set("ctz", timezone);

  return url.toString();
}

export function buildOutlookCalendarUrl(event) {
  const { dateFrom, dateTo, startTime, endTime, hasTime, timezone } = getEventDates(event);
  const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");

  url.searchParams.set("path", "/calendar/action/compose");
  url.searchParams.set("rru", "addevent");
  url.searchParams.set("subject", event.title ?? "Scouts event");
  url.searchParams.set("body", buildDescription(event));
  url.searchParams.set("location", event.location ?? "");
  url.searchParams.set("allday", hasTime ? "false" : "true");
  url.searchParams.set("startdt", hasTime ? outlookDateTime(dateFrom, startTime || "00:00") : cleanDate(dateFrom));
  url.searchParams.set("enddt", hasTime ? outlookDateTime(dateTo || dateFrom, endTime || startTime || "23:59") : cleanDate(dateTo || dateFrom));
  url.searchParams.set("timezone", timezone);

  return url.toString();
}

export function generateICSContent(event) {
  const { dateFrom, dateTo, startTime, endTime, hasTime, timezone } = getEventDates(event);
  const uid = `${event.id ?? crypto.randomUUID()}@scout-of-saint-mary`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//St. Mary's Scouts Dubai//Calendar Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timezone}`,
    "BEGIN:VEVENT",
    `UID:${escapeICSText(uid)}`,
    `DTSTAMP:${stamp}`
  ];

  if (hasTime) {
    lines.push(`DTSTART;TZID=${timezone}:${compactDateTime(dateFrom, startTime || "00:00")}`);
    lines.push(`DTEND;TZID=${timezone}:${getEndDateForExport(dateFrom, dateTo, startTime, endTime, true)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(dateFrom)}`);
    lines.push(`DTEND;VALUE=DATE:${getEndDateForExport(dateFrom, dateTo, startTime, endTime, false)}`);
  }

  lines.push(
    `SUMMARY:${escapeICSText(event.title ?? "Scouts event")}`,
    `DESCRIPTION:${escapeICSText(buildDescription(event))}`,
    `LOCATION:${escapeICSText(event.location ?? "")}`,
    `URL:${escapeICSText(getEventUrl(event))}`,
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return lines.map(foldICSLine).join("\r\n");
}

export function downloadICSFile(event) {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const slug = String(event.title ?? "scouts-event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "scouts-event";
  const link = document.createElement("a");

  link.href = url;
  link.download = `${slug}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
