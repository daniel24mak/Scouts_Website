import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Copy, FileText, GripVertical, Plus, Search, Star, Trash2, Users } from "lucide-react";
import {
  closeDashboardPostedForm,
  deleteDashboardFormTemplate,
  deleteDashboardPostedForm,
  reopenDashboardPostedForm,
  saveDashboardFormSubmission,
  saveDashboardFormTemplate,
  saveDashboardPostedForm
} from "../../api/client.js";
import FormattedText from "../../components/FormattedText.jsx";
import RichTextEditor from "../../components/RichTextEditor.jsx";
import { blankFormSchema, formQuestionTypes } from "../../services/formService.js";

const optionQuestionTypes = new Set(["multiple_choice", "checkboxes", "dropdown"]);
const aiSummarySections = ["Recommendations", "Course of action", "What went wrong", "What was good", "Key risks", "Follow-up actions"];
const builderSteps = ["Form Details", "Build Questions", "Posting Settings / Review"];

function makeQuestion(type = "short_text") {
  return {
    id: crypto.randomUUID(),
    type,
    text: "Untitled question",
    required: false,
    options: optionQuestionTypes.has(type) ? ["Option 1"] : []
  };
}

function safeSchema(schema) {
  const nextSchema = schema?.questions?.length ? schema : blankFormSchema();
  return {
    questions: nextSchema.questions.map((question) => ({
      id: question.id || crypto.randomUUID(),
      type: question.type || "short_text",
      text: question.text || "Untitled question",
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? question.options : []
    }))
  };
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getUserName(users, userId) {
  return users.find((user) => user.id === userId)?.name ?? "Unknown user";
}

function getGroupName(groups, groupId) {
  return groups.find((group) => group.id === groupId)?.name ?? groupId ?? "No group";
}

function isTargetedToUser(form, user) {
  if (!user) return false;
  if (form.targetType === "all_chiefs") return true;
  if (form.targetType === "groups") return form.targetGroupIds?.includes(user.groupId);
  if (form.targetType === "users") return form.targetUserIds?.includes(user.id);
  return false;
}

function answerToText(value) {
  if (Array.isArray(value)) return value.join("; ");
  return value ?? "";
}

function downloadCsv({ form, submissions, users, groups }) {
  const questions = form.schemaJson.questions ?? [];
  const headers = ["Name", "Group", "Submitted At", "Edited At", "Submission Status", ...questions.map((question) => question.text || "Untitled question")];
  const rows = submissions.map((submission) => {
    const submitter = users.find((item) => item.id === submission.submittedBy);
    return [
      submitter?.name ?? "Unknown user",
      getGroupName(groups, submission.groupId ?? submitter?.groupId),
      formatDate(submission.submittedAt),
      formatDate(submission.editedAt),
      submission.approvalStatus,
      ...questions.map((question) => answerToText(submission.answersJson?.[question.id]))
    ];
  });
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${form.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-responses.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function QuestionInput({ question, value, onChange, disabled = false }) {
  if (question.type === "long_text") {
    if (disabled) return value ? <FormattedText text={value} className="formatted-text forms-rich-answer" /> : <div className="forms-rich-answer-placeholder">Long answer</div>;
    return <RichTextEditor value={value ?? ""} onChange={onChange} minHeight={130} placeholder="Write a formatted answer..." />;
  }
  if (question.type === "number") return <input disabled={disabled} type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  if (question.type === "rating") {
    return <div className="forms-rating-control" role="radiogroup" aria-label={question.text}>{[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} disabled={disabled} className={String(value ?? "") === String(rating) ? "selected" : ""} onClick={() => onChange(rating)} aria-label={`${rating} out of 5`}><Star size={18} fill={String(value ?? "") === String(rating) ? "currentColor" : "none"} /><span>{rating}</span></button>)}</div>;
  }
  if (question.type === "yes_no") return <div className="forms-segmented-control">{["Yes", "No"].map((choice) => <button type="button" key={choice} disabled={disabled} className={value === choice ? "selected" : ""} onClick={() => onChange(choice)}>{choice}</button>)}</div>;
  if (question.type === "multiple_choice") return <div className="forms-choice-stack">{question.options.map((option) => <label key={option}><input disabled={disabled} type="radio" checked={value === option} onChange={() => onChange(option)} />{option}</label>)}</div>;
  if (question.type === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return <div className="forms-choice-stack">{question.options.map((option) => <label key={option}><input disabled={disabled} type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</div>;
  }
  if (question.type === "dropdown") return <select disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)}><option value="">Choose</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (question.type === "date") return <input disabled={disabled} type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  return <input disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Short answer text" />;
}

export function FormPreview({ form, answers = {}, onAnswerChange = null, disabled = false, errorQuestionIds = [] }) {
  const schema = safeSchema(form.schemaJson);
  return (
    <article className="forms-preview-card">
      <div className="forms-preview-header">
        <h2>{form.title || "Untitled form"}</h2>
        <FormattedText text={form.description} />
        {form.instructions && <div className="forms-preview-instructions"><strong>Instructions</strong><FormattedText text={form.instructions} /></div>}
      </div>
      <div className="forms-preview-questions">
        {schema.questions.map((question, index) => (
          <div className={`forms-fill-question ${errorQuestionIds.includes(question.id) ? "has-error" : ""}`} key={question.id} data-question-id={question.id}>
            <label>
              <span>{index + 1}. {question.text}{question.required && <em>*</em>}</span>
              <QuestionInput question={question} value={answers[question.id]} disabled={disabled || !onAnswerChange} onChange={(nextValue) => onAnswerChange?.(question.id, nextValue)} />
              {errorQuestionIds.includes(question.id) && <small className="forms-field-error">This question is required.</small>}
            </label>
          </div>
        ))}
      </div>
    </article>
  );
}

function WizardStepper({ step }) {
  return <div className="forms-wizard-stepper" aria-label={`Step ${step + 1} of ${builderSteps.length}`}>{builderSteps.map((label, index) => <div className={`forms-wizard-step ${index < step ? "complete" : ""} ${index === step ? "current" : ""}`} key={label}><span>{index < step ? <CheckCircle2 size={18} /> : index + 1}</span><small>{label}</small></div>)}</div>;
}

function TemplatePicker({ templates, onUse }) {
  return <div className="forms-template-picker">{templates.length ? templates.map((template) => <article className="forms-template-mini-card" key={template.id}><FileText size={22} /><div><strong>{template.title}</strong><small>{safeSchema(template.schemaJson).questions.length} questions</small></div><button type="button" className="inline-action" onClick={() => onUse(template)}>Use Template</button></article>) : <p className="empty-state">No templates are available yet.</p>}</div>;
}
function FormBuilder({ data, isAdmin, canManageTemplates, canPostForms, template, postedForm, onDone, setSaveMessage }) {
  const source = postedForm ?? template;
  const [title, setTitle] = useState(source?.title ?? "Untitled form");
  const [description, setDescription] = useState(source?.description ?? "");
  const [instructions, setInstructions] = useState(postedForm?.instructions ?? "");
  const [schemaJson, setSchemaJson] = useState(safeSchema(source?.schemaJson));
  const [targetType, setTargetType] = useState(postedForm?.targetType ?? "all_chiefs");
  const [targetGroupIds, setTargetGroupIds] = useState(postedForm?.targetGroupIds ?? []);
  const [dueDate, setDueDate] = useState(postedForm?.dueDate ?? "");
  const [linkedEventId, setLinkedEventId] = useState(postedForm?.linkedEventId ?? "");
  const [allowEdits, setAllowEdits] = useState(postedForm?.allowEdits ?? true);
  const [generateAiSummary, setGenerateAiSummary] = useState(postedForm?.generateAiSummary ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [questionMode, setQuestionMode] = useState("edit");
  const [showTemplates, setShowTemplates] = useState(false);
  const [addQuestionType, setAddQuestionType] = useState("short_text");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const updateQuestion = (id, patch) => setSchemaJson((current) => ({ questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question) }));
  const moveQuestion = (index, direction) => setSchemaJson((current) => {
    const questions = [...current.questions];
    const next = index + direction;
    if (next < 0 || next >= questions.length) return current;
    [questions[index], questions[next]] = [questions[next], questions[index]];
    return { questions };
  });
  const dropQuestion = (toIndex) => {
    if (draggedIndex === null || draggedIndex === toIndex) return;
    setSchemaJson((current) => {
      const questions = [...current.questions];
      const [moved] = questions.splice(draggedIndex, 1);
      questions.splice(toIndex, 0, moved);
      return { questions };
    });
    setDraggedIndex(null);
  };
  const duplicateQuestion = (index) => setSchemaJson((current) => {
    const questions = [...current.questions];
    questions.splice(index + 1, 0, { ...current.questions[index], id: crypto.randomUUID(), text: `${current.questions[index].text} copy` });
    return { questions };
  });
  const deleteQuestion = (id) => setSchemaJson((current) => ({ questions: current.questions.filter((question) => question.id !== id) }));
  const payload = () => ({ title, description, instructions, schemaJson: safeSchema(schemaJson), targetType, targetGroupIds, targetUserIds: postedForm?.targetUserIds ?? [], dueDate, linkedEventId, allowEdits, generateAiSummary });

  const useTemplate = (nextTemplate) => {
    setTitle(nextTemplate.title);
    setDescription(nextTemplate.description ?? "");
    setSchemaJson(safeSchema(nextTemplate.schemaJson));
    setShowTemplates(false);
    setSaveMessage(`Template "${nextTemplate.title}" loaded.`);
  };
  const saveTemplate = async (status = "active", saveAsNew = false) => {
    setIsSaving(true);
    try {
      await saveDashboardFormTemplate({ id: saveAsNew ? undefined : template?.id, ...payload(), status });
      setSaveMessage(status === "draft" ? "Form template draft saved." : saveAsNew ? "Form saved as a new template." : "Form template saved.");
      await onDone("formTemplates");
    } finally { setIsSaving(false); }
  };
  const post = async (saveTemplateFirst = false) => {
    setIsSaving(true);
    try {
      let nextTemplate = template;
      if (saveTemplateFirst && canManageTemplates) nextTemplate = await saveDashboardFormTemplate({ id: template?.id, ...payload(), status: "active" });
      await saveDashboardPostedForm({ id: postedForm?.id, ...payload(), templateId: nextTemplate?.id ?? template?.id ?? null, templateVersionId: nextTemplate?.currentVersionId ?? template?.currentVersionId ?? null, approvalStatus: isAdmin ? "open" : "pending" });
      setSaveMessage(isAdmin ? "Form posted and opened." : "Form sent for approval before posting.");
      await onDone("postedForms");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="forms-builder-shell">
      <div className="forms-builder-topbar"><button type="button" className="inline-action" onClick={() => onDone()}>Back</button><strong>{postedForm ? "Edit posted form" : template ? "Edit template" : "Create form"}</strong></div>
      <WizardStepper step={step} />
      <section className="forms-builder-canvas">
        {step === 0 && <div className="forms-wizard-panel">
          <div className="forms-section-heading"><div><p className="eyebrow">Step 1</p><h2>Form details</h2></div><button type="button" className="inline-action" onClick={() => setShowTemplates((current) => !current)}><FileText size={16} />Start from Template</button></div>
          {showTemplates && <TemplatePicker templates={data.formTemplates ?? []} onUse={useTemplate} />}
          <label className="forms-field-label">Form title<input className="forms-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Form title" /></label>
          <RichTextEditor label="Description" value={description} onChange={setDescription} minHeight={150} placeholder="Explain the purpose of this form..." />
          <RichTextEditor label="Instructions" value={instructions} onChange={setInstructions} minHeight={130} placeholder="Add instructions for chiefs..." />
        </div>}

        {step === 1 && <div className="forms-wizard-panel">
          <div className="forms-section-heading"><div><p className="eyebrow">Step 2</p><h2>Build questions</h2></div><div className="forms-mode-toggle"><button type="button" className={questionMode === "edit" ? "active" : ""} onClick={() => setQuestionMode("edit")}>Edit</button><button type="button" className={questionMode === "preview" ? "active" : ""} onClick={() => setQuestionMode("preview")}>Preview</button></div></div>
          {questionMode === "preview" ? <FormPreview form={{ title, description, instructions, schemaJson }} /> : <>
            <div className="forms-question-list">{schemaJson.questions.map((question, index) => <article className="forms-question-card" key={question.id} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropQuestion(index)}>
              <div className="forms-question-card-topline"><span className="forms-drag-handle" title="Drag to reorder"><GripVertical size={20} /></span><span className="forms-question-number">Question {index + 1}</span><div className="forms-question-icon-actions"><button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveQuestion(index, -1)}><ArrowUp size={16} /></button><button type="button" className="icon-button" title="Move down" disabled={index === schemaJson.questions.length - 1} onClick={() => moveQuestion(index, 1)}><ArrowDown size={16} /></button><button type="button" className="icon-button" title="Duplicate" onClick={() => duplicateQuestion(index)}><Copy size={16} /></button><button type="button" className="icon-button danger-action" title="Delete" onClick={() => deleteQuestion(question.id)} disabled={schemaJson.questions.length === 1}><Trash2 size={16} /></button></div></div>
              <div className="forms-question-header"><label>Question<input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} /></label><label>Answer type<select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value, options: optionQuestionTypes.has(event.target.value) ? (question.options.length ? question.options : ["Option 1"]) : [] })}>{formQuestionTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
              {optionQuestionTypes.has(question.type) && <div className="forms-options-editor">{question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`}><span>{optionIndex + 1}</span><input value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((item, idx) => idx === optionIndex ? event.target.value : item) })} /><button type="button" className="icon-button" onClick={() => updateQuestion(question.id, { options: question.options.filter((_, idx) => idx !== optionIndex) })}><Trash2 size={15} /></button></div>)}<button type="button" className="inline-action" onClick={() => updateQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}>Add option</button></div>}
              <label className="toggle-row"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />Required</label>
            </article>)}</div>
            <div className="forms-add-question-row"><select value={addQuestionType} onChange={(event) => setAddQuestionType(event.target.value)}>{formQuestionTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" className="primary-action" onClick={() => setSchemaJson((current) => ({ questions: [...current.questions, makeQuestion(addQuestionType)] }))}><Plus size={17} />Add Question</button></div>
          </>}
        </div>}

        {step === 2 && <div className="forms-wizard-panel">
          <div className="forms-section-heading"><div><p className="eyebrow">Step 3</p><h2>Posting settings and review</h2></div></div>
          {canPostForms ? <div className="forms-posting-settings"><div className="inline-editor-grid"><label>Audience<select value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="all_chiefs">All chiefs</option><option value="groups">Selected groups</option></select></label><label>Due date<input type="date" value={dueDate ?? ""} onChange={(event) => setDueDate(event.target.value)} /></label><label>Linked calendar event<select value={linkedEventId ?? ""} onChange={(event) => setLinkedEventId(event.target.value)}><option value="">None</option>{(data.plannedEvents ?? []).map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label></div>
            {targetType === "groups" && <div className="forms-group-picker">{(data.groups ?? []).map((group) => <label key={group.id}><input type="checkbox" checked={targetGroupIds.includes(group.id)} onChange={(event) => setTargetGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>)}</div>}
            <label className="toggle-row"><input type="checkbox" checked={allowEdits} onChange={(event) => setAllowEdits(event.target.checked)} />Allow chiefs to edit submitted responses while open</label><label className="toggle-row forms-coming-soon-toggle"><input type="checkbox" checked={generateAiSummary} onChange={(event) => setGenerateAiSummary(event.target.checked)} />Generate AI summary <span>Coming Soon</span></label></div> : <p className="helper-text">Posting requires the Post Forms permission.</p>}
          <article className="forms-final-review"><div><p className="eyebrow">Final review</p><h3>{title || "Untitled form"}</h3><FormattedText text={description} fallback="No description provided." /></div><div className="forms-review-stat"><strong>{schemaJson.questions.length}</strong><span>Questions</span></div><div className="forms-review-stat"><strong>{schemaJson.questions.filter((question) => question.required).length}</strong><span>Required</span></div></article>
        </div>}
      </section>
      <div className="forms-wizard-actions"><button type="button" className="inline-action" disabled={step === 0 || isSaving} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>{step < 2 ? <button type="button" className="primary-action" disabled={!title.trim() || isSaving} onClick={() => setStep((current) => Math.min(2, current + 1))}>Next</button> : <div className="action-row">{canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("draft")}>Save Draft</button>}{canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("active")}>{template?.id ? "Save Template" : "Save as Template"}</button>}{canPostForms && <button type="button" className="inline-action forms-post-outline" disabled={isSaving} onClick={() => post(false)}>Post Form</button>}{canPostForms && canManageTemplates && <button type="button" className="primary-action" disabled={isSaving} onClick={() => post(true)}>Save and Post</button>}</div>}</div>
    </div>
  );
}
export default function FormsDashboard({ data, user, isAdmin, mode = "myForms", initialFormId = null, onRefresh, setSaveMessage }) {
  const [view, setView] = useState(mode);
  const [builderTemplate, setBuilderTemplate] = useState(null);
  const [builderPostedForm, setBuilderPostedForm] = useState(null);
  const [activeFormId, setActiveFormId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(null);
  const [requiredErrors, setRequiredErrors] = useState([]);
  const [submissionFormFilter, setSubmissionFormFilter] = useState("all");
  const [submissionGroupFilter, setSubmissionGroupFilter] = useState("all");
  const [submissionDateFrom, setSubmissionDateFrom] = useState("");
  const [submissionDateTo, setSubmissionDateTo] = useState("");
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const progressTimerRef = useRef(null);

  useEffect(() => {
    if (mode === "manageForms") {
      setView((current) => ["formsCreate", "formTemplates", "postedForms", "formResponses"].includes(current) ? current : "formTemplates");
      return;
    }

    if (mode === "myForms") {
      setView((current) => ["myForms", "myFormDrafts", "mySubmittedForms"].includes(current) ? current : "myForms");
      return;
    }

    setView(mode);
  }, [mode]);

  const canManageTemplates = isAdmin || Boolean(user?.permissions?.manageFormTemplates);
  const canPostForms = isAdmin || Boolean(user?.permissions?.postForms);
  const canViewAllForms = isAdmin || Boolean(user?.permissions?.viewAllForms);
  const templates = data.formTemplates ?? [];
  const postedForms = data.postedForms ?? [];
  const submissions = data.formSubmissions ?? [];
  const visiblePostedForms = canViewAllForms || canPostForms ? postedForms : postedForms.filter((form) => form.approvalStatus === "open" && isTargetedToUser(form, user));
  const mySubmissions = submissions.filter((submission) => submission.submittedBy === user?.id);
  const activeForm = postedForms.find((form) => form.id === activeFormId);
  useEffect(() => {
    if (!initialFormId) return;
    const requested = postedForms.find((form) => form.id === initialFormId);
    if (!requested || requested.approvalStatus !== "open" || !isTargetedToUser(requested, user)) return;
    const existing = submissions.find((submission) => submission.postedFormId === requested.id && submission.submittedBy === user?.id);
    setView("myForms");
    setAnswers(existing?.answersJson ?? {});
    setRequiredErrors([]);
    setActiveFormId(requested.id);
  }, [initialFormId, postedForms, submissions, user]);
  const filteredSubmissions = useMemo(() => submissions.filter((submission) => {
    if (submissionFormFilter !== "all" && submission.postedFormId !== submissionFormFilter) return false;
    if (submissionGroupFilter !== "all" && submission.groupId !== submissionGroupFilter) return false;
    const value = submission.submittedAt || submission.updatedAt || submission.createdAt;
    if (submissionDateFrom && (!value || new Date(value) < new Date(`${submissionDateFrom}T00:00:00`))) return false;
    if (submissionDateTo && (!value || new Date(value) > new Date(`${submissionDateTo}T23:59:59`))) return false;
    return true;
  }), [submissions, submissionFormFilter, submissionGroupFilter, submissionDateFrom, submissionDateTo]);

  const closeBuilder = async (nextView = null) => {
    setBuilderTemplate(null);
    setBuilderPostedForm(null);
    setView(nextView ?? (mode === "manageForms" ? "formTemplates" : "myForms"));
    await onRefresh();
  };

  const openForm = (form) => {
    const existing = submissions.find((submission) => submission.postedFormId === form.id && submission.submittedBy === user?.id);
    setAnswers(existing?.answersJson ?? {});
    setRequiredErrors([]);
    setActiveFormId(form.id);
  };

  const submitCurrentForm = async (status = "submitted") => {
    if (!activeForm) return;
    const missing = activeForm.schemaJson.questions?.filter((question) => {
      const answer = answers[question.id];
      return question.required && (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && !answer.length));
    }) ?? [];
    if (status === "submitted" && missing.length) {
      const ids = missing.map((question) => question.id);
      setRequiredErrors(ids);
      setSaveMessage("Complete the highlighted required questions.");
      window.requestAnimationFrame(() => document.querySelector(`[data-question-id="${ids[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setRequiredErrors([]);
    setIsSaving(true);
    setSubmitProgress({ percent: 15, label: status === "draft" ? "Saving draft..." : "Submitting form..." });
    setSaveMessage(status === "draft" ? "Saving draft..." : "Submitting form...");
    try {
      setSubmitProgress({ percent: 48, label: "Saving answers securely..." });
      setSaveMessage("Saving answers securely...");
      await saveDashboardFormSubmission({ postedFormId: activeForm.id, submittedBy: user.id, groupId: user.groupId, answersJson: answers, status });
      setSubmitProgress({ percent: 82, label: "Refreshing..." });
      setSaveMessage("Refreshing...");
      setActiveFormId(null);
      await onRefresh();
      setSubmitProgress({ percent: 100, label: "Complete" });
      setSaveMessage(status === "draft" ? "Form draft saved." : "Form submitted.");
    } finally {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = window.setTimeout(() => setSubmitProgress(null), 700);
      setIsSaving(false);
    }
  };
  if (builderTemplate || builderPostedForm || view === "formsCreate") {
    return <FormBuilder data={data} user={user} isAdmin={isAdmin} canManageTemplates={canManageTemplates} canPostForms={canPostForms} template={builderTemplate} postedForm={builderPostedForm} onDone={closeBuilder} setSaveMessage={setSaveMessage} />;
  }

  if (activeForm) {
    const existing = submissions.find((submission) => submission.postedFormId === activeForm.id && submission.submittedBy === user?.id);
    const locked = activeForm.approvalStatus === "closed" || Boolean(existing?.lockedAt) || (existing?.approvalStatus === "submitted" && !activeForm.allowEdits);
    return (
      <div className="forms-fill-shell">
        <button type="button" className="inline-action" onClick={() => setActiveFormId(null)}>Back to forms</button>
        <FormPreview form={activeForm} answers={answers} disabled={locked} errorQuestionIds={requiredErrors} onAnswerChange={(questionId, value) => { setAnswers((current) => ({ ...current, [questionId]: value })); setRequiredErrors((current) => current.filter((id) => id !== questionId)); }} />
        {submitProgress && (
          <div className="upload-progress compact forms-submit-progress" aria-label={submitProgress.label}>
            <div><span style={{ width: `${submitProgress.percent}%` }} /></div>
            <strong>{submitProgress.percent}%</strong>
            <small>{submitProgress.label}</small>
          </div>
        )}
        <div className="action-row forms-fill-actions">
          <button type="button" className="inline-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("draft")}>{isSaving ? "Working..." : "Save Draft"}</button>
          <button type="button" className="primary-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("submitted")}>{isSaving ? "Submitting..." : existing?.approvalStatus === "submitted" ? "Update Response" : "Submit Form"}</button>
          {locked && <span className="helper-text">This form is locked because it is closed or editing is disabled.</span>}
        </div>
      </div>
    );
  }

  const manageTabs = [
    ...(canManageTemplates || canPostForms ? [["formsCreate", "Create Form"], ["formTemplates", "Templates"], ["postedForms", "Posted Forms"]] : []),
    ...(canViewAllForms || canPostForms ? [["formResponses", "Submissions"]] : [])
  ];
  const myTabs = [["myForms", "My Forms"], ["myFormDrafts", "My Drafts"], ["mySubmittedForms", "My Submissions"]];
  const tabs = mode === "manageForms" ? manageTabs : mode === "myForms" ? myTabs : [...manageTabs, ...myTabs];

  return (
    <div className="forms-dashboard cms-panel-stack">
      <div className="approval-type-tabs forms-section-tabs" role="tablist" aria-label="Forms sections">{tabs.map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>
      {view === "formTemplates" && <div className="forms-management-grid">{templates.length ? templates.map((template) => <article className="forms-management-card" key={template.id}><div className="forms-card-heading"><FileText size={22} /><span className="forms-count-badge">{safeSchema(template.schemaJson).questions.length} questions</span></div><div><p className="eyebrow">{template.status}</p><h3>{template.title}</h3><FormattedText text={template.description} fallback="No description." /></div><small>Last edited {formatDate(template.updatedAt)}</small><div className="action-row"><button type="button" className="primary-action" onClick={() => { setBuilderTemplate(template); setView("formsCreate"); }}>Use Template</button><button type="button" className="inline-action" onClick={async () => { await saveDashboardFormTemplate({ title: `${template.title} copy`, description: template.description, schemaJson: template.schemaJson, status: "active" }); setSaveMessage("Template duplicated."); await onRefresh(); }}>Save as New Template</button><button type="button" className="icon-button danger-action" title="Delete template" onClick={async () => { if (window.confirm("Delete this reusable template? Posted forms using it will remain available.")) { await deleteDashboardFormTemplate(template.id); setSaveMessage("Form template deleted."); await onRefresh(); } }}><Trash2 size={17} /></button></div></article>) : <EmptyFormsState title="No templates yet" text="Create a reusable form template to start." />}</div>}
      {view === "postedForms" && <div className="forms-management-grid">{visiblePostedForms.length ? visiblePostedForms.map((form) => { const formSubmissions = submissions.filter((submission) => submission.postedFormId === form.id); const eligible = (data.users ?? []).filter((profile) => profile.role === "chief" && isTargetedToUser(form, profile)).length; return <article className="forms-management-card" key={form.id}><div className="forms-card-heading"><span className={`forms-status-pill ${form.approvalStatus}`}>{form.approvalStatus}</span><small>{form.targetType === "groups" ? form.targetGroupIds.map((id) => getGroupName(data.groups, id)).join(", ") : "All chiefs"}</small></div><div><h3>{form.title}</h3><p className="forms-response-count"><Users size={16} />{formSubmissions.length}{eligible ? ` of ${eligible}` : ""} responded</p><p className="helper-text"><CalendarDays size={15} />Due {formatDate(form.dueDate)}</p></div><div className="action-row"><button type="button" className="inline-action" onClick={() => setBuilderPostedForm(form)}>Edit copy</button><button type="button" className="inline-action" onClick={() => openForm(form)}>Preview</button>{form.approvalStatus === "open" ? <button type="button" className="inline-action" onClick={async () => { if (window.confirm("Close this form? Chiefs will no longer be able to submit or edit responses.")) { await closeDashboardPostedForm(form.id); setSaveMessage("Form closed. Exports are now available."); await onRefresh(); } }}>Close</button> : <button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={async () => { if (window.confirm("Reopen this form? Targeted chiefs will be able to submit or edit again.")) { await reopenDashboardPostedForm(form.id); setSaveMessage("Form reopened."); await onRefresh(); } }}>Reopen</button>}<button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={() => downloadCsv({ form, submissions: formSubmissions, users: data.users, groups: data.groups })}>Export CSV</button><button type="button" className="icon-button danger-action" title="Delete posted form" onClick={async () => { if (window.confirm("Permanently delete this posted form and all responses? Its reusable template will be preserved.")) { await deleteDashboardPostedForm(form.id); setSaveMessage("Posted form deleted."); await onRefresh(); } }}><Trash2 size={17} /></button></div></article>; }) : <EmptyFormsState title="No posted forms yet" text="Posted and pending forms will appear here." />}</div>}
      {view === "formResponses" && <div className="forms-submissions-view"><div className="forms-filter-bar"><label><Search size={16} /><select value={submissionFormFilter} onChange={(event) => setSubmissionFormFilter(event.target.value)}><option value="all">All forms</option>{postedForms.map((form) => <option value={form.id} key={form.id}>{form.title}</option>)}</select></label><label><Users size={16} /><select value={submissionGroupFilter} onChange={(event) => setSubmissionGroupFilter(event.target.value)}><option value="all">All groups</option>{(data.groups ?? []).map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Date from<input type="date" value={submissionDateFrom} onChange={(event) => setSubmissionDateFrom(event.target.value)} /></label><label>Date to<input type="date" value={submissionDateTo} onChange={(event) => setSubmissionDateTo(event.target.value)} /></label></div><div className="table-panel forms-submissions-table"><table className="editable-table"><thead><tr><th>Select</th><th>Form</th><th>Submitted by</th><th>Group</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{filteredSubmissions.length ? filteredSubmissions.map((submission) => { const form = postedForms.find((item) => item.id === submission.postedFormId); const submitter = (data.users ?? []).find((item) => item.id === submission.submittedBy); return <tr key={submission.id}><td><input type="checkbox" checked={selectedSubmissionIds.includes(submission.id)} onChange={(event) => setSelectedSubmissionIds((current) => event.target.checked ? [...current, submission.id] : current.filter((id) => id !== submission.id))} /></td><td>{form?.title ?? "Unknown form"}</td><td>{submitter?.name ?? "Unknown user"}</td><td>{getGroupName(data.groups, submission.groupId ?? submitter?.groupId)}</td><td><span className={`forms-status-pill ${submission.approvalStatus}`}>{submission.approvalStatus}</span></td><td>{formatDate(submission.submittedAt ?? submission.updatedAt)}</td></tr>; }) : <tr><td colSpan="6">No submissions match these filters.</td></tr>}</tbody></table></div><article className="forms-ai-summary-card"><div className="forms-section-heading"><div><p className="eyebrow">Response analysis</p><h3>AI Summary</h3></div><span className="forms-coming-soon-badge">Coming Soon</span></div><p>{selectedSubmissionIds.length ? `${selectedSubmissionIds.length} responses selected.` : "Select responses above to prepare a future summary."}</p><div className="forms-ai-sections">{aiSummarySections.map((section) => <span key={section}>{section}</span>)}</div><button type="button" className="primary-action" disabled>Generate AI Summary</button></article></div>}
      {view === "myForms" && <FormsList forms={postedForms.filter((form) => form.approvalStatus === "open" && isTargetedToUser(form, user) && !mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} submissions={mySubmissions} type="pending" onOpen={openForm} empty="No pending forms right now." />}
      {view === "myFormDrafts" && <FormsList forms={postedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "draft"))} submissions={mySubmissions} type="draft" onOpen={openForm} empty="No saved form drafts." />}
      {view === "mySubmittedForms" && <FormsList forms={postedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} submissions={mySubmissions} type="submitted" onOpen={openForm} empty="No submitted forms yet." />}
    </div>
  );
}
function FormsList({ forms, submissions, type, onOpen, empty }) {
  if (!forms.length) return <EmptyFormsState title={empty} text="Forms posted to you will appear here." />;
  return <div className="forms-personal-list">{forms.map((form) => {
    const submission = submissions.find((item) => item.postedFormId === form.id);
    const buttonLabel = type === "draft" ? "Continue" : type === "submitted" ? (form.allowEdits && form.approvalStatus === "open" ? "Edit Response" : "View") : "Fill Out";
    return <article className="forms-personal-card" key={form.id}><div><span className={`forms-status-pill ${submission?.approvalStatus ?? form.approvalStatus}`}>{submission?.approvalStatus ?? form.approvalStatus}</span><h3>{form.title}</h3><FormattedText text={form.description} fallback="No description." /></div><div className="forms-personal-meta">{type === "draft" ? <span>Last saved {formatDate(submission?.updatedAt)}</span> : type === "submitted" ? <span>Submitted {formatDate(submission?.submittedAt ?? submission?.updatedAt)}</span> : <span>Due {formatDate(form.dueDate)}</span>}</div><button type="button" className="primary-action" onClick={() => onOpen(form)}><FileText size={17} />{buttonLabel}</button></article>;
  })}</div>;
}
function EmptyFormsState({ title, text }) {
  return <article className="admin-panel empty-approval-preview"><CheckCircle2 size={30} /><h3>{title}</h3><p>{text}</p></article>;
}
