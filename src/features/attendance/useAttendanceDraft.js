import { useRef, useState } from "react";

const emptySavedRecords = {};

// Each date/year/scope keeps its own draft, including while another save settles.
export function useAttendanceDraft(contextKey, savedRecords) {
  const [drafts, setDrafts] = useState({});
  const [committed, setCommitted] = useState({});
  const authoritativeRecordsRef = useRef({});
  const sourceRecords = savedRecords ?? emptySavedRecords;
  authoritativeRecordsRef.current[contextKey] = sourceRecords;
  const records = drafts[contextKey] ?? {};
  const snapshot = committed[contextKey];
  const hasNewAuthority = snapshot && savedRecords && snapshot.sourceRecords !== sourceRecords;
  if (hasNewAuthority) {
    // Discard only the confirmed fallback; newer unsaved drafts still win.
    setCommitted((current) => {
      if (current[contextKey] !== snapshot) return current;
      const next = { ...current };
      delete next[contextKey];
      return next;
    });
  }
  const effectiveRecords = { ...savedRecords, ...(!hasNewAuthority && snapshot?.records), ...records };

  const setRecords = (update) => {
    setDrafts((current) => ({
      ...current,
      [contextKey]: typeof update === "function" ? update(current[contextKey] ?? {}) : update
    }));
  };

  const commitSubmittedRecords = (submittedRecords, submittedEdits) => {
    // Keep the confirmed payload visible until an authoritative refresh succeeds.
    setCommitted((current) => ({
      ...current,
      [contextKey]: { records: submittedRecords, sourceRecords: authoritativeRecordsRef.current[contextKey] }
    }));
    setRecords((current) => Object.fromEntries(
      Object.entries(current).filter(([id, status]) => submittedEdits[id] !== status)
    ));
  };

  const clearCommittedRecords = () => {
    setCommitted((current) => {
      const snapshot = current[contextKey];
      // Superseded refresh promises may resolve without publishing their data.
      // Keep the fallback until the rendered authoritative source advances.
      const sourceRecords = authoritativeRecordsRef.current[contextKey];
      if (!snapshot || sourceRecords === emptySavedRecords || snapshot.sourceRecords === sourceRecords) return current;
      const next = { ...current };
      delete next[contextKey];
      return next;
    });
  };

  return { records, effectiveRecords, setRecords, commitSubmittedRecords, clearCommittedRecords };
}
