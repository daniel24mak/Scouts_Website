export function getSessionLabel(session) {
  const label = String(session?.topic ?? "").trim();
  return label && label !== "Meeting" ? label : session?.date;
}

function includesTerm(values, term) {
  return values.some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
}

export function filterAttendanceSheet({ scouts = [], sessions = [], query = "" }) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return { scouts, sessions, hasMatches: true };

  const matchingScouts = scouts.filter((scout) => includesTerm(
    [scout.name, scout.schoolGrade, scout.school, scout.age, scout.groupId],
    term
  ));
  const matchingSessions = sessions.filter((session) => includesTerm(
    [session.date, session.topic, getSessionLabel(session)],
    term
  ));

  if (matchingScouts.length && matchingSessions.length) {
    return { scouts: matchingScouts, sessions: matchingSessions, hasMatches: true };
  }
  if (matchingScouts.length) return { scouts: matchingScouts, sessions, hasMatches: true };
  if (matchingSessions.length) return { scouts, sessions: matchingSessions, hasMatches: true };
  return { scouts: [], sessions: [], hasMatches: false };
}
