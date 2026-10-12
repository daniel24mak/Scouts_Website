import { useState } from "react";

// Each date/year/scope keeps its own draft, including while another save settles.
export function useAttendanceDraft(contextKey, savedRecords = {}) {
  const [drafts, setDrafts] = useState({});
  const [committed, setCommitted] = useState({});
  const records = drafts[contextKey] ?? {};
  const effectiveRecords = { ...savedRecords, ...committed[contextKey], ...records };

  const setRecords = (update) => {
    setDrafts((current) => ({
      ...current,
      [contextKey]: typeof update === "function" ? update(current[contextKey] ?? {}) : update
    }));
  };

  const commitSubmittedRecords = (submittedRecords, submittedEdits) => {
    // Keep the confirmed payload visible until an authoritative refresh succeeds.
    setCommitted((current) => ({ ...current, [contextKey]: submittedRecords }));
    setRecords((current) => Object.fromEntries(
      Object.entries(current).filter(([id, status]) => submittedEdits[id] !== status)
    ));
  };

  const clearCommittedRecords = () => {
    setCommitted((current) => {
      const next = { ...current };
      delete next[contextKey];
      return next;
    });
  };

  return { records, effectiveRecords, setRecords, commitSubmittedRecords, clearCommittedRecords };
}
