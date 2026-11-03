import assert from "node:assert/strict";
import test from "node:test";

import { filterAttendanceSheet } from "../../src/features/attendance/attendanceSheetsModel.js";

const scouts = [
  { id: "alex", name: "Alexander Noujaim", school: "Central" },
  { id: "maya", name: "Maya Saliba", school: "North" }
];

const sessions = [
  { id: "oct-09", date: "2026-10-09", topic: "Meeting" },
  { id: "oct-16", date: "2026-10-16", topic: "Autumn Camp" }
];

test("scout searches filter rows without removing session columns", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "Alex" });

  assert.deepEqual(result.scouts.map(({ id }) => id), ["alex"]);
  assert.deepEqual(result.sessions.map(({ id }) => id), ["oct-09", "oct-16"]);
  assert.equal(result.hasMatches, true);
});

test("session searches filter columns without removing scout rows", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "Camp" });

  assert.deepEqual(result.scouts.map(({ id }) => id), ["alex", "maya"]);
  assert.deepEqual(result.sessions.map(({ id }) => id), ["oct-16"]);
  assert.equal(result.hasMatches, true);
});

test("a query matching scouts and sessions filters both dimensions", () => {
  const overlappingScouts = [...scouts, { id: "camp", name: "Campbell Young" }];
  const result = filterAttendanceSheet({ scouts: overlappingScouts, sessions, query: "Camp" });

  assert.deepEqual(result.scouts.map(({ id }) => id), ["camp"]);
  assert.deepEqual(result.sessions.map(({ id }) => id), ["oct-16"]);
});

test("queries matching neither category return an explicit no-match result", () => {
  const result = filterAttendanceSheet({ scouts, sessions, query: "not-found" });

  assert.deepEqual(result.scouts, []);
  assert.deepEqual(result.sessions, []);
  assert.equal(result.hasMatches, false);
});
