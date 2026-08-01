import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, FileWarning, Search, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import {
  deleteRegistrationDocument,
  revealRegistrationDocument,
  resolveRegistrationDuplicate,
  runRegistrationAdminAction,
  updateRegistrationSubmission,
  verifyRegistrationDocument
} from "./registrationService.js";
import { formatPhoneAnswer, getOrderedFormQuestions } from "../forms/formModel.js";
import { downloadExcelFile } from "../../utils/excelExport.js";
import { richTextToPlainText } from "../../utils/richText.js";

const tabs = [
  ["overview", "Overview"],
  ["all", "All Submissions"],
  ["general", "Registration Forms"],
  ["returning", "Returning Scouts"],
  ["new", "New Scouts"],
  ["manual", "Possible Returning"],
  ["duplicates", "Possible Duplicates"],
  ["verification", "Verification"],
  ["ready", "Ready for Season"]
];

const readyStatuses = new Set(["verified", "approved"]);
const pendingStatuses = new Set(["submitted", "pending_group_verification", "needs_changes"]);

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai"
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function classification(submission, hasDuplicate, hasScoutProfile = true) {
  if (!hasScoutProfile) return "Registration submission";
  if (hasDuplicate) return "Possible Duplicate";
  if (submission.status === "manual_match") return "Manual Match Required";
  if (submission.status === "waitlisted") return "Waitlisted New Scout";
  return submission.registration_path === "returning" ? "Confirmed Returning Scout" : "New Scout";
}

function submissionSchema(submission) {
  return submission?.source_snapshot_json?.form?.schemaJson
    ?? submission?.source_snapshot_json?.schemaJson
    ?? {};
}

function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.join(", ");
  if (answer && typeof answer === "object") {
    if ("e164" in answer || "nationalNumber" in answer) return formatPhoneAnswer(answer);
    if (answer.name || answer.originalName) return answer.name ?? answer.originalName;
    return JSON.stringify(answer);
  }
  return String(answer ?? "");
}

function questionLabel(question, fallback) {
  return richTextToPlainText(question?.text || question?.title || question?.label) || fallback;
}

function orderedSubmissionAnswers(submission) {
  const answers = submission?.answers_json && typeof submission.answers_json === "object"
    ? submission.answers_json
    : {};
  const questions = getOrderedFormQuestions(submissionSchema(submission));
  const knownQuestionIds = new Set(questions.map((question) => question.id));
  const ordered = questions.map((question, index) => ({
    id: question.id,
    label: questionLabel(question, `Question ${index + 1}`),
    value: formatAnswer(answers[question.id]) || "Not provided"
  }));
  const unknown = Object.entries(answers)
    .filter(([questionId]) => !knownQuestionIds.has(questionId))
    .map(([questionId, answer], index) => ({
      id: questionId,
      label: `Question ${ordered.length + index + 1}`,
      value: formatAnswer(answer) || "Not provided"
    }));

  return [...ordered, ...unknown];
}

export default function RegistrationCenter({
  data = {},
  groups = [],
  scoutYears = [],
  searchQuery = "",
  onRefresh,
  setSaveMessage,
  viewerName = "Authorised reviewer",
  canManageRetention = false
}) {
  const [tab, setTab] = useState("overview");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [revealedDocument, setRevealedDocument] = useState(null);
  const [enrollmentDetails, setEnrollmentDetails] = useState({
    fullName: "",
    targetGroupId: "",
    dateOfBirth: "",
    gender: "",
    schoolName: "",
    schoolGrade: ""
  });
  const submissions = Array.isArray(data.submissions) ? data.submissions : [];
  const people = Array.isArray(data.people) ? data.people : [];
  const parents = Array.isArray(data.parents) ? data.parents : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const duplicates = Array.isArray(data.duplicates) ? data.duplicates : [];
  const enrollments = Array.isArray(data.enrollments) ? data.enrollments : [];
  const scouts = Array.isArray(data.scouts) ? data.scouts : [];
  const storageSummary = data.storageSummary && typeof data.storageSummary === "object"
    ? data.storageSummary
    : null;
  const selected = submissions.find((item) => item.id === selectedId);
  const personFor = (id) => people.find((item) => item.submission_id === id);
  const docsFor = (id) => documents.filter((item) => item.submission_id === id && !item.deleted_at);
  const parentsFor = (id) => parents.filter((item) => item.submission_id === id);
  const duplicatesFor = (id) => duplicates.filter((item) => item.submission_id === id && !item.decision);
  const scoutFor = (id) => scouts.find((item) => item.id === id);
  const groupName = (id) => groups.find((group) => group.id === id)?.name ?? "Unassigned";
  const answersFor = orderedSubmissionAnswers;
  const search = `${searchQuery} ${localSearch}`.trim().toLowerCase();

  useEffect(() => {
    if (!revealedDocument) return undefined;
    const timeout = window.setTimeout(() => setRevealedDocument(null), Math.max(0, revealedDocument.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [revealedDocument]);

  useEffect(() => {
    if (!selected) return;
    const person = personFor(selected.id);
    const answers = answersFor(selected);
    const answerMatching = (...patterns) => answers.find((answer) => {
      const label = answer.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return patterns.some((pattern) => pattern.test(label));
    })?.value ?? "";
    const groupAnswer = answerMatching(/^(requested )?(scout )?group$/, /^group preference$/);
    const inferredGroup = groups.find((group) =>
      String(group.id) === groupAnswer || String(group.name ?? "").toLowerCase() === groupAnswer.toLowerCase()
    );
    setEnrollmentDetails({
      fullName: person?.full_name ?? answerMatching(/^(scout|child|participant)( s)? (full )?name$/, /^full name$/),
      targetGroupId: selected.target_group_id ?? person?.requested_group_id ?? inferredGroup?.id ?? "",
      dateOfBirth: person?.date_of_birth ?? answerMatching(/^date of birth$/, /^birth date$/),
      gender: person?.gender ?? answerMatching(/^gender$/, /^sex$/),
      schoolName: person?.school_name ?? answerMatching(/^school( name)?$/),
      schoolGrade: person?.school_grade ?? answerMatching(/^school grade$/, /^grade$/)
    });
  }, [selectedId, people, groups]);

  const visible = useMemo(() => submissions.filter((submission) => {
    const person = personFor(submission.id);
    const duplicate = duplicatesFor(submission.id).length > 0;
    if (statusFilter !== "all" && submission.status !== statusFilter) return false;
    if (tab === "general" && person) return false;
    if (tab === "returning" && (submission.registration_path !== "returning" || !person)) return false;
    if (tab === "new" && (submission.registration_path !== "new" || !person)) return false;
    if (tab === "manual" && submission.status !== "manual_match") return false;
    if (tab === "duplicates" && !duplicate) return false;
    if (tab === "verification" && !pendingStatuses.has(submission.status)) return false;
    if (tab === "ready" && !readyStatuses.has(submission.status)) return false;
    return !search || [
      submission.reference_number, submission.status, person?.full_name,
      groupName(submission.target_group_id), classification(submission, duplicate, Boolean(person))
    ].some((value) => String(value ?? "").toLowerCase().includes(search));
  }), [submissions, people, duplicates, statusFilter, tab, search, groups]);

  const metrics = [
    ["Total submissions", submissions.length, Users],
    ["Returning scouts", submissions.filter((item) => item.registration_path === "returning" && personFor(item.id)).length, CheckCircle2],
    ["New scout applications", submissions.filter((item) => item.registration_path === "new" && personFor(item.id)).length, UserPlus],
    ["General registrations", submissions.filter((item) => !personFor(item.id)).length, Users],
    ["Pending verification", submissions.filter((item) => pendingStatuses.has(item.status)).length, ShieldCheck],
    ["Possible duplicates", submissions.filter((item) => duplicatesFor(item.id).length).length, AlertTriangle],
    ["Missing documents", submissions.filter((item) => docsFor(item.id).length === 0).length, FileWarning],
    ["Ready for season", submissions.filter((item) => readyStatuses.has(item.status)).length, CheckCircle2],
    ["Enrolled", enrollments.length, Users]
  ];

  const run = async (action, payload, message) => {
    setWorking(true);
    setError("");
    try {
      await action(payload);
      setSaveMessage(message);
      await onRefresh();
    } catch (nextError) {
      setError(nextError?.message ?? "Registration action failed.");
    } finally {
      setWorking(false);
    }
  };

  const enrollmentBlockers = (submission) => {
    const submissionDocuments = docsFor(submission.id);
    const blockers = [];
    if (!personFor(submission.id)) blockers.push("no scout profile");
    if (!readyStatuses.has(submission.status)) blockers.push("not verified");
    if (!submission.target_group_id) blockers.push("no group");
    if (duplicatesFor(submission.id).length) blockers.push("duplicate unresolved");
    if (!submissionDocuments.length) blockers.push("documents missing");
    if (submissionDocuments.some((document) => document.verification_status !== "verified")) blockers.push("documents unverified");
    if (enrollments.some((enrollment) => enrollment.submission_id === submission.id)) blockers.push("already enrolled");
    return blockers;
  };
  const selectableSubmissions = visible.filter((submission) => enrollmentBlockers(submission).length === 0);
  const selectedForEnrollment = submissions.filter((submission) => selectedSubmissionIds.includes(submission.id));

  const enrollSelected = async () => {
    const blocked = selectedForEnrollment.filter((submission) => enrollmentBlockers(submission).length);
    const ready = selectedForEnrollment.filter((submission) => enrollmentBlockers(submission).length === 0);
    if (!ready.length) {
      setError("No selected registrations are ready for season enrollment.");
      return;
    }
    const returningCount = ready.filter((submission) => submission.registration_path === "returning").length;
    const summary = [
      `${ready.length} ready: ${returningCount} returning, ${ready.length - returningCount} new.`,
      blocked.length ? `${blocked.length} blocked and will not be enrolled.` : "",
      "Continue with season enrollment?"
    ].filter(Boolean).join("\n");
    if (!window.confirm(summary)) return;
    setWorking(true);
    setError("");
    try {
      for (const submission of ready) {
        await runRegistrationAdminAction("enroll_submission", { submissionId: submission.id });
      }
      setSelectedSubmissionIds([]);
      setSaveMessage(`${ready.length} scout${ready.length === 1 ? "" : "s"} added to the season.`);
      await onRefresh();
    } catch (nextError) {
      setError(nextError?.message ?? "Bulk season enrollment failed.");
    } finally {
      setWorking(false);
    }
  };

  const openDocument = async (documentId) => {
    setWorking(true);
    setError("");
    try {
      const result = await revealRegistrationDocument(documentId);
      setRevealedDocument({
        id: documentId,
        url: result.url,
        expiresAt: Date.now() + (Number(result.expiresIn) || 60) * 1000
      });
      setSaveMessage("Protected document revealed for 60 seconds.");
    } catch (nextError) {
      setError(nextError?.message ?? "Document could not be opened.");
    } finally {
      setWorking(false);
    }
  };

  const exportExcel = () => {
    const questionColumns = new Map();
    visible.forEach((submission) => {
      const questions = getOrderedFormQuestions(submissionSchema(submission));
      questions.forEach((question) => {
        if (question?.id && !questionColumns.has(question.id)) {
          questionColumns.set(question.id, questionLabel(question, "Untitled question"));
        }
      });
      Object.keys(submission?.answers_json ?? {}).forEach((questionId) => {
        if (!questionColumns.has(questionId)) questionColumns.set(questionId, `Question ${questionColumns.size + 1}`);
      });
    });
    const headers = ["Reference", "Name", "Classification", "Status", "Group", "Submitted At", ...questionColumns.values()];
    const rows = visible.map((submission) => {
      const person = personFor(submission.id);
      const answers = submission?.answers_json && typeof submission.answers_json === "object" ? submission.answers_json : {};
      return [
        submission.reference_number,
        person?.full_name ?? "",
        classification(submission, duplicatesFor(submission.id).length > 0, Boolean(person)),
        submission.status,
        groupName(submission.target_group_id),
        formatDate(submission.submitted_at),
        ...questionColumns.keys().map((questionId) => {
          const value = answers[questionId];
          if (Array.isArray(value)) return value.join("; ");
          if (value && typeof value === "object") {
            if ("e164" in value || "nationalNumber" in value) return formatPhoneAnswer(value);
            if (value.name || value.originalName) return value.name ?? value.originalName;
            return JSON.stringify(value);
          }
          return value ?? "";
        })
      ];
    });
    downloadExcelFile({
      fileName: "scout-registration-submissions.xls",
      sheetName: "Registration responses",
      headers,
      rows
    });
  };

  return (
    <section className="registration-center">
      <div className="registration-section-heading">
        <div><p className="eyebrow">Season intake</p><h2>Registration Center</h2></div>
        <button type="button" className="inline-action" onClick={exportExcel}><Download size={16} />Download Excel</button>
      </div>
      <div className="registration-center-tabs" role="tablist">
        {tabs.map(([id, label]) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === "overview" && <>
        <div className="registration-metrics">{metrics.map(([label, value, Icon]) => <article key={label}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>)}</div>
        {storageSummary && <article className={`registration-storage-summary ${(Number(storageSummary.usagePercent) || 0) >= 80 ? "warning" : ""}`}>
          <div>
            <span>Protected registration storage</span>
            <strong>{formatBytes(storageSummary.usedBytes)} of {formatBytes(storageSummary.capacityBytes)}</strong>
            <small>{storageSummary.documentCount ?? 0} active documents · Largest file {formatBytes(storageSummary.largestDocumentBytes)}</small>
          </div>
          <div className="registration-storage-meter" role="progressbar" aria-label="Registration storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Number(storageSummary.usagePercent) || 0)}>
            <span style={{ width: `${Math.min(100, Number(storageSummary.usagePercent) || 0)}%` }} />
          </div>
        </article>}
      </>}
      <div className="registration-center-toolbar">
        <label><Search size={16} /><input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Search registrations" /></label>
        <select aria-label="Filter registration status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          {[...new Set(submissions.map((item) => item.status))].map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="registration-bulk-toolbar">
        <span>{selectedSubmissionIds.length} selected</span>
        <button type="button" className="inline-action" disabled={!selectableSubmissions.length || working} onClick={() => setSelectedSubmissionIds(selectableSubmissions.map((submission) => submission.id))}>Select ready</button>
        <button type="button" className="inline-action" disabled={!selectedSubmissionIds.length || working} onClick={() => setSelectedSubmissionIds([])}>Clear</button>
        <button type="button" className="primary-action" disabled={!selectedSubmissionIds.length || working} onClick={enrollSelected}><UserPlus size={16} />Review and add selected</button>
      </div>
      <div className="registration-submission-list">
        {visible.length ? visible.map((submission) => {
          const person = personFor(submission.id);
          const duplicate = duplicatesFor(submission.id).length > 0;
          const isSelected = selectedSubmissionIds.includes(submission.id);
          return <article className={`registration-submission-row ${isSelected ? "selected" : ""}`} key={submission.id}>
            <input
              type="checkbox"
              checked={isSelected}
              aria-label={`Select ${person?.full_name ?? submission.reference_number}`}
              onChange={(event) => setSelectedSubmissionIds((current) => event.target.checked
                ? [...new Set([...current, submission.id])]
                : current.filter((id) => id !== submission.id))}
            />
            <button type="button" className="registration-submission-open" onClick={() => setSelectedId(submission.id)}>
              <span className={`registration-status ${submission.status}`}>{submission.status.replaceAll("_", " ")}</span>
              <span><strong>{person?.full_name ?? submission.source_snapshot_json?.form?.title ?? "Registration"}</strong><small>{submission.reference_number} · {classification(submission, duplicate, Boolean(person))}</small></span>
              <span><strong>{groupName(submission.target_group_id)}</strong><small>{formatDate(submission.submitted_at)}</small></span>
              <Eye size={18} aria-hidden="true" />
            </button>
          </article>;
        }) : <article className="registration-empty-state"><CheckCircle2 size={28} /><h3>No registrations match this view</h3><p>New submissions will appear here automatically.</p></article>}
      </div>

      {selected && <div className="registration-review-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedId(null)}>
        <aside className="registration-review-drawer" aria-label="Registration review">
          <header><div><p className="eyebrow">{selected.reference_number}</p><h2>{personFor(selected.id)?.full_name ?? "Registration review"}</h2></div><button type="button" className="icon-button" aria-label="Close review" onClick={() => setSelectedId(null)}><X size={20} /></button></header>
          <div className="registration-review-columns">
            <section>
              <h3>Submitted information</h3>
              <dl className="registration-detail-list">
                {Object.entries(personFor(selected.id) ?? {}).filter(([key]) => !["id", "submission_id", "identity_fingerprint"].includes(key)).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value ?? "Not provided")}</dd></div>)}
              </dl>
              <h3>Form responses</h3>
              <dl className="registration-detail-list">
                {answersFor(selected).map((answer) => <div key={answer.id}><dt>{answer.label}</dt><dd>{answer.value}</dd></div>)}
              </dl>
              {!answersFor(selected).length && <p className="helper-text">No form responses were recorded.</p>}
              {parentsFor(selected.id).length > 0 && <><h3>Parent contacts</h3>
                {parentsFor(selected.id).map((parent) => <article className="registration-parent-card" key={parent.id}><strong>{parent.full_name}</strong><span>{parent.relationship}</span><span>{parent.phone || parent.email || "No contact recorded"}</span></article>)}
              </>}
            </section>
            <section>
              <div className="registration-enrollment-details">
                <div>
                  <p className="eyebrow">Season record</p>
                  <h3>Enrollment details</h3>
                  <p className="helper-text">Confirm the scout name and destination group before adding this registration to the season.</p>
                </div>
                <div className="registration-enrollment-grid">
                  <label className="registration-enrollment-wide">
                    <span>Scout full name <strong aria-hidden="true">*</strong></span>
                    <input
                      value={enrollmentDetails.fullName}
                      onChange={(event) => setEnrollmentDetails((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Enter the scout's full name"
                    />
                  </label>
                  <label className="registration-enrollment-wide">
                    <span>Target group <strong aria-hidden="true">*</strong></span>
                    <select
                      value={enrollmentDetails.targetGroupId}
                      onChange={(event) => setEnrollmentDetails((current) => ({ ...current, targetGroupId: event.target.value }))}
                    >
                      <option value="">Choose a scout group</option>
                      {groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label><span>Date of birth</span><input type="date" value={enrollmentDetails.dateOfBirth} onChange={(event) => setEnrollmentDetails((current) => ({ ...current, dateOfBirth: event.target.value }))} /></label>
                  <label><span>Gender</span><input value={enrollmentDetails.gender} onChange={(event) => setEnrollmentDetails((current) => ({ ...current, gender: event.target.value }))} placeholder="Optional" /></label>
                  <label><span>School</span><input value={enrollmentDetails.schoolName} onChange={(event) => setEnrollmentDetails((current) => ({ ...current, schoolName: event.target.value }))} placeholder="Optional" /></label>
                  <label><span>School grade</span><input value={enrollmentDetails.schoolGrade} onChange={(event) => setEnrollmentDetails((current) => ({ ...current, schoolGrade: event.target.value }))} placeholder="Optional" /></label>
                </div>
              </div>
              <h3>Newly uploaded documents</h3>
              <div className="registration-document-list">
                {docsFor(selected.id).map((document) => <article key={document.id}>
                  <div>
                    <strong>{String(document.document_type ?? "uploaded_document").replaceAll("_", " ")}</strong>
                    <span>{formatBytes(document.size_bytes)} | {String(document.verification_status ?? "uploaded").replaceAll("_", " ")}</span>
                  </div>
                  <div className="registration-document-actions">
                    <button type="button" className="inline-action" disabled={working} onClick={() => openDocument(document.id)}><Eye size={16} />Reveal</button>
                    <button type="button" className="inline-action" disabled={working || document.verification_status === "verified"} onClick={() => run(
                      () => verifyRegistrationDocument(selected.id, document.id, "verified"),
                      undefined,
                      "Document verified."
                    )}><CheckCircle2 size={16} />Verify</button>
                    <button type="button" className="inline-action danger-action" disabled={working || document.verification_status === "rejected"} onClick={() => run(
                      () => verifyRegistrationDocument(selected.id, document.id, "rejected"),
                      undefined,
                      "Document rejected."
                    )}>Reject</button>
                    {canManageRetention && <button type="button" className="inline-action danger-action" disabled={working} onClick={() => {
                      const reason = window.prompt("Why is this protected document being permanently deleted?");
                      if (!reason) return;
                      if (!window.confirm("Delete the private Storage object permanently? Verification history will be retained.")) return;
                      run(
                        () => deleteRegistrationDocument(document.id, reason),
                        undefined,
                        "Protected document deleted; verification history retained."
                      );
                    }}><Trash2 size={16} />Delete</button>}
                  </div>
                </article>)}
              </div>
              {!docsFor(selected.id).length && <p className="helper-text">No documents were submitted.</p>}
              {duplicatesFor(selected.id).map((match) => {
                const candidate = scoutFor(match.candidate_scout_id);
                return <div className="registration-duplicate-warning" key={match.id}>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Possible duplicate: {candidate?.name ?? "Existing scout"}</strong>
                    <p>{match.reasons_json?.join?.(", ") || "Existing scout details are similar."} Match score: {match.score}%.</p>
                    <div className="registration-duplicate-actions">
                      <button type="button" className="inline-action" disabled={working} onClick={() => run(
                        () => resolveRegistrationDuplicate(selected.id, match.id, "same_person"),
                        undefined,
                        "Duplicate linked to the existing scout."
                      )}>Same person</button>
                      <button type="button" className="inline-action" disabled={working} onClick={() => run(
                        () => resolveRegistrationDuplicate(selected.id, match.id, "different_person"),
                        undefined,
                        "Duplicate marked as a different person."
                      )}>Different person</button>
                      <button type="button" className="inline-action" disabled={working} onClick={() => run(
                        () => resolveRegistrationDuplicate(selected.id, match.id, "defer"),
                        undefined,
                        "Duplicate decision deferred."
                      )}>Decide later</button>
                    </div>
                  </div>
                </div>;
              })}
            </section>
          </div>
          {error && <div className="dashboard-error-banner" role="alert">{error}</div>}
          <footer>
            <button type="button" className="inline-action" disabled={working} onClick={() => run(updateRegistrationSubmission, { submissionId: selected.id, decision: "needs_changes" }, "Correction requested.")}>Request Changes</button>
            <button type="button" className="inline-action danger-action" disabled={working} onClick={() => run(updateRegistrationSubmission, { submissionId: selected.id, decision: "rejected" }, "Registration rejected.")}>Reject</button>
            <button type="button" className="inline-action" disabled={working} onClick={() => run(updateRegistrationSubmission, { submissionId: selected.id, decision: "verified" }, "Registration verified.")}>Verify</button>
            <button type="button" className="primary-action" disabled={working || !readyStatuses.has(selected.status) || !enrollmentDetails.fullName.trim() || !enrollmentDetails.targetGroupId} onClick={() => run(
              (payload) => runRegistrationAdminAction("enroll_submission", payload),
              { submissionId: selected.id, enrollmentDetails },
              "Scout added to the season."
            )}><UserPlus size={17} />Approve and Add to Season</button>
          </footer>
        </aside>
      </div>}
      {revealedDocument && <div className="registration-protected-preview" role="dialog" aria-modal="true" aria-label="Protected registration document" onMouseDown={(event) => event.target === event.currentTarget && setRevealedDocument(null)}>
        <div>
          <header>
            <div><strong>Protected verification view</strong><small>Automatically hides after 60 seconds</small></div>
            <button type="button" className="icon-button" aria-label="Hide protected document" onClick={() => setRevealedDocument(null)}><X size={20} /></button>
          </header>
          <iframe src={revealedDocument.url} title="Protected registration document" referrerPolicy="no-referrer" />
          <span className="registration-document-watermark" aria-hidden="true">{viewerName} / {formatDate(new Date())}</span>
        </div>
      </div>}
    </section>
  );
}
