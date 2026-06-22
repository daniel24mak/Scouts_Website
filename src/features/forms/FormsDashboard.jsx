import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, FileText, Plus, Trash2 } from "lucide-react";
import {
  closeDashboardPostedForm,
  deleteDashboardFormTemplate,
  deleteDashboardPostedForm,
  reopenDashboardPostedForm,
  saveDashboardFormSubmission,
  saveDashboardFormTemplate,
  saveDashboardPostedForm
} from "../../api/client.js";
import { blankFormSchema, formQuestionTypes } from "../../services/formService.js";

const optionQuestionTypes = new Set(["multiple_choice", "checkboxes", "dropdown"]);
const aiSummarySections = ["Recommendations", "Course of action", "What went wrong", "What was good", "Key risks", "Follow-up actions"];

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
    return <textarea disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Long answer text" />;
  }
  if (question.type === "number") {
    return <input disabled={disabled} type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  }
  if (question.type === "rating") {
    return (
      <div className="forms-choice-row">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating}><input disabled={disabled} type="radio" checked={String(value ?? "") === String(rating)} onChange={() => onChange(rating)} />{rating}</label>
        ))}
      </div>
    );
  }
  if (question.type === "yes_no") {
    return (
      <div className="forms-choice-row">
        {["Yes", "No"].map((choice) => <label key={choice}><input disabled={disabled} type="radio" checked={value === choice} onChange={() => onChange(choice)} />{choice}</label>)}
      </div>
    );
  }
  if (question.type === "multiple_choice") {
    return <div className="forms-choice-stack">{question.options.map((option) => <label key={option}><input disabled={disabled} type="radio" checked={value === option} onChange={() => onChange(option)} />{option}</label>)}</div>;
  }
  if (question.type === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return <div className="forms-choice-stack">{question.options.map((option) => <label key={option}><input disabled={disabled} type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}</div>;
  }
  if (question.type === "dropdown") {
    return <select disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)}><option value="">Choose</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  }
  if (question.type === "date") {
    return <input disabled={disabled} type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />;
  }
  return <input disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="Short answer text" />;
}

export function FormPreview({ form, answers = {}, onAnswerChange = null, disabled = false }) {
  const schema = safeSchema(form.schemaJson);
  return (
    <article className="forms-preview-card">
      <div className="forms-preview-header">
        <h2>{form.title || "Untitled form"}</h2>
        {form.description && <p>{form.description}</p>}
        {form.instructions && <small>{form.instructions}</small>}
      </div>
      {schema.questions.map((question, index) => (
        <div className="forms-fill-question" key={question.id}>
          <label>
            <span>{index + 1}. {question.text}{question.required && <em>*</em>}</span>
            <QuestionInput question={question} value={answers[question.id]} disabled={disabled || !onAnswerChange} onChange={(value) => onAnswerChange?.(question.id, value)} />
          </label>
        </div>
      ))}
    </article>
  );
}

function FormBuilder({ data, user, isAdmin, canManageTemplates, canPostForms, template, postedForm, onDone, setSaveMessage }) {
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

  const updateQuestion = (questionId, patch) => {
    setSchemaJson((current) => ({
      questions: current.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question)
    }));
  };
  const moveQuestion = (index, direction) => {
    setSchemaJson((current) => {
      const questions = [...current.questions];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= questions.length) return current;
      [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
      return { questions };
    });
  };
  const duplicateQuestion = (index) => {
    setSchemaJson((current) => {
      const copy = { ...current.questions[index], id: crypto.randomUUID(), text: `${current.questions[index].text} copy` };
      const questions = [...current.questions];
      questions.splice(index + 1, 0, copy);
      return { questions };
    });
  };
  const deleteQuestion = (questionId) => setSchemaJson((current) => ({ questions: current.questions.filter((question) => question.id !== questionId) }));

  const basePayload = () => ({ title, description, instructions, schemaJson: safeSchema(schemaJson), targetType, targetGroupIds, targetUserIds: [], dueDate, linkedEventId, allowEdits, generateAiSummary });

  const saveTemplate = async (status = "active", saveAsNew = false) => {
    setIsSaving(true);
    try {
      await saveDashboardFormTemplate({ id: saveAsNew ? undefined : template?.id, ...basePayload(), status });
      setSaveMessage(status === "draft" ? "Form template draft saved." : saveAsNew ? "Form saved as a new template." : "Form template saved.");
      await onDone("formTemplates");
    } finally {
      setIsSaving(false);
    }
  };

  const post = async (saveTemplateFirst = false) => {
    setIsSaving(true);
    try {
      let nextTemplate = template;
      if (saveTemplateFirst && canManageTemplates) {
        nextTemplate = await saveDashboardFormTemplate({ id: template?.id, ...basePayload(), status: "active" });
      }
      await saveDashboardPostedForm({
        id: postedForm?.id,
        ...basePayload(),
        templateId: nextTemplate?.id ?? template?.id ?? null,
        templateVersionId: nextTemplate?.currentVersionId ?? template?.currentVersionId ?? null,
        approvalStatus: isAdmin ? "open" : "pending"
      });
      setSaveMessage(isAdmin ? "Form posted and opened." : "Form sent for approval before posting.");
      await onDone("postedForms");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="forms-builder-shell">
      <div className="forms-builder-topbar">
        <button type="button" className="inline-action" onClick={() => onDone()}>Back</button>
        <div className="action-row">
          {canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("draft")}>Save Draft</button>}
          {canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("active")}>{template?.id ? "Save Template" : "Save as Template"}</button>}
          {canManageTemplates && template?.id && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("active", true)}>Save as New Template</button>}
          {canPostForms && <button type="button" className="primary-action" disabled={isSaving} onClick={() => post(false)}>Post Form</button>}
          {canPostForms && canManageTemplates && <button type="button" className="primary-action" disabled={isSaving} onClick={() => post(true)}>Save and Post</button>}
        </div>
      </div>
      <section className="forms-builder-canvas">
        <article className="forms-title-card">
          <input className="forms-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Form title" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Form description" />
        </article>
        {schemaJson.questions.map((question, index) => (
          <article className="forms-question-card" key={question.id}>
            <div className="forms-question-header">
              <input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Question" />
              <select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value, options: optionQuestionTypes.has(event.target.value) ? (question.options.length ? question.options : ["Option 1"]) : [] })}>
                {formQuestionTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            {optionQuestionTypes.has(question.type) && (
              <div className="forms-options-editor">
                {question.options.map((option, optionIndex) => (
                  <div key={`${question.id}-${optionIndex}`}>
                    <span>{optionIndex + 1}</span>
                    <input value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((item, idx) => idx === optionIndex ? event.target.value : item) })} />
                    <button type="button" className="icon-button" onClick={() => updateQuestion(question.id, { options: question.options.filter((_, idx) => idx !== optionIndex) })}><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" className="inline-action" onClick={() => updateQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}>Add option</button>
              </div>
            )}
            <div className="forms-question-actions">
              <button type="button" className="inline-action" onClick={() => moveQuestion(index, -1)}>Move up</button>
              <button type="button" className="inline-action" onClick={() => moveQuestion(index, 1)}>Move down</button>
              <button type="button" className="inline-action" onClick={() => duplicateQuestion(index)}><Copy size={15} />Duplicate</button>
              <label className="toggle-row"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />Required</label>
              <button type="button" className="inline-action danger-action" onClick={() => deleteQuestion(question.id)} disabled={schemaJson.questions.length === 1}>Delete</button>
            </div>
          </article>
        ))}
        <button type="button" className="primary-action forms-add-question" onClick={() => setSchemaJson((current) => ({ questions: [...current.questions, makeQuestion()] }))}><Plus size={17} />Add Question</button>
        {canPostForms && (
          <article className="forms-title-card">
            <h3>Posting settings</h3>
            <label>Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
            <div className="inline-editor-grid">
              <label>Audience<select value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="all_chiefs">All chiefs</option><option value="groups">Selected groups</option></select></label>
              <label>Due date<input type="date" value={dueDate ?? ""} onChange={(event) => setDueDate(event.target.value)} /></label>
              <label>Linked calendar event<select value={linkedEventId ?? ""} onChange={(event) => setLinkedEventId(event.target.value)}><option value="">None</option>{data.plannedEvents.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
            </div>
            {targetType === "groups" && <div className="forms-group-picker">{data.groups.map((group) => <label key={group.id}><input type="checkbox" checked={targetGroupIds.includes(group.id)} onChange={(event) => setTargetGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>)}</div>}
            <label className="toggle-row"><input type="checkbox" checked={allowEdits} onChange={(event) => setAllowEdits(event.target.checked)} />Chiefs can edit responses while open</label>
            <label className="toggle-row"><input type="checkbox" checked={generateAiSummary} onChange={(event) => setGenerateAiSummary(event.target.checked)} />Generate AI summary for this form</label>
          </article>
        )}
      </section>
      <aside className="forms-builder-preview">
        <p className="eyebrow">Live preview</p>
        <FormPreview form={{ title, description, instructions, schemaJson }} />
      </aside>
    </div>
  );
}

export default function FormsDashboard({ data, user, isAdmin, mode = "myForms", onRefresh, setSaveMessage }) {
  const [view, setView] = useState(mode);
  const [builderTemplate, setBuilderTemplate] = useState(null);
  const [builderPostedForm, setBuilderPostedForm] = useState(null);
  const [activeFormId, setActiveFormId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(null);

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

  const closeBuilder = async (nextView = null) => {
    setBuilderTemplate(null);
    setBuilderPostedForm(null);
    setView(nextView ?? (mode === "manageForms" ? "formTemplates" : "myForms"));
    await onRefresh();
  };

  const openForm = (form) => {
    const existing = submissions.find((submission) => submission.postedFormId === form.id && submission.submittedBy === user?.id);
    setAnswers(existing?.answersJson ?? {});
    setActiveFormId(form.id);
  };

  const submitCurrentForm = async (status = "submitted") => {
    if (!activeForm) return;
    const missing = activeForm.schemaJson.questions?.filter((question) => question.required && !answers[question.id]?.length && !answers[question.id]) ?? [];
    if (status === "submitted" && missing.length) {
      setSaveMessage(`Answer required questions before submitting: ${missing.map((question) => question.text).join(", ")}`);
      return;
    }
    setIsSaving(true);
    setSubmitProgress({ percent: 20, label: status === "draft" ? "Saving draft..." : "Submitting form..." });
    try {
      setSubmitProgress({ percent: 55, label: "Saving answers securely..." });
      await saveDashboardFormSubmission({ postedFormId: activeForm.id, submittedBy: user.id, groupId: user.groupId, answersJson: answers, status });
      setSubmitProgress({ percent: 85, label: "Refreshing forms..." });
      setSaveMessage(status === "draft" ? "Form draft saved." : "Form submitted.");
      setActiveFormId(null);
      await onRefresh();
      setSubmitProgress({ percent: 100, label: "Done" });
    } finally {
      window.setTimeout(() => setSubmitProgress(null), 450);
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
        <FormPreview form={activeForm} answers={answers} disabled={locked} onAnswerChange={(questionId, value) => setAnswers((current) => ({ ...current, [questionId]: value }))} />
        {submitProgress && (
          <div className="upload-progress compact forms-submit-progress" aria-label={submitProgress.label}>
            <div><span style={{ width: `${submitProgress.percent}%` }} /></div>
            <strong>{submitProgress.percent}%</strong>
            <small>{submitProgress.label}</small>
          </div>
        )}
        <div className="action-row">
          <button type="button" className="inline-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("draft")}>{isSaving ? "Working..." : "Save draft"}</button>
          <button type="button" className="primary-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("submitted")}>{isSaving ? "Submitting..." : existing?.approvalStatus === "submitted" ? "Update response" : "Submit form"}</button>
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
      <div className="approval-type-tabs" role="tablist" aria-label="Forms sections">
        {tabs.map(([id, label]) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}
      </div>

      {view === "formTemplates" && (
        <div className="dashboard-card-grid">
          {templates.length ? templates.map((template) => (
            <article className="admin-panel" key={template.id}>
              <p className="eyebrow">{template.status}</p>
              <h3>{template.title}</h3>
              <p>{template.description || "No description."}</p>
              <div className="action-row"><button type="button" className="inline-action" onClick={() => setBuilderTemplate(template)}>Edit</button><button type="button" className="primary-action" onClick={() => { setBuilderTemplate(template); setView("formsCreate"); }}>Use template</button><button type="button" className="inline-action danger-action" onClick={async () => { if (window.confirm("Delete this form template? Posted forms that used it will stay available.")) { await deleteDashboardFormTemplate(template.id); setSaveMessage("Form template deleted."); await onRefresh(); } }}>Delete</button></div>
            </article>
          )) : <EmptyFormsState title="No templates yet" text="Create a reusable form template to start." />}
        </div>
      )}

      {view === "postedForms" && (
        <div className="table-panel">
          <table className="editable-table"><thead><tr><th>Title</th><th>Status</th><th>Target</th><th>Submissions</th><th>Due</th><th>Actions</th></tr></thead><tbody>
            {visiblePostedForms.length ? visiblePostedForms.map((form) => {
              const formSubmissions = submissions.filter((submission) => submission.postedFormId === form.id);
              return <tr key={form.id}><td>{form.title}</td><td>{form.approvalStatus}</td><td>{form.targetType === "groups" ? form.targetGroupIds.map((id) => getGroupName(data.groups, id)).join(", ") : "All chiefs"}</td><td>{formSubmissions.length}</td><td>{formatDate(form.dueDate)}</td><td><div className="action-row"><button type="button" className="inline-action" onClick={() => setBuilderPostedForm(form)}>Edit copy</button><button type="button" className="inline-action" onClick={() => openForm(form)}>Preview</button><button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={() => downloadCsv({ form, submissions: formSubmissions, users: data.users, groups: data.groups })}>Export CSV</button><button type="button" className="inline-action" disabled={form.approvalStatus !== "open"} onClick={async () => { if (window.confirm("Close this form? Chiefs will no longer be able to submit or edit responses.")) { await closeDashboardPostedForm(form.id); setSaveMessage("Form closed. Exports are now available."); await onRefresh(); } }}>Close</button><button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={async () => { if (window.confirm("Reopen this form? Targeted chiefs will be able to submit or edit again.")) { await reopenDashboardPostedForm(form.id); setSaveMessage("Form reopened."); await onRefresh(); } }}>Reopen</button><button type="button" className="inline-action danger-action" onClick={async () => { if (window.confirm("Permanently delete this posted form and all its submissions? The reusable template will not be deleted.")) { await deleteDashboardPostedForm(form.id); setSaveMessage("Posted form deleted."); await onRefresh(); } }}>Delete</button></div></td></tr>;
            }) : <tr><td colSpan="6">No posted forms yet.</td></tr>}
          </tbody></table>
        </div>
      )}

      {view === "formResponses" && (
        <div className="dashboard-card-grid">
          {postedForms.map((form) => {
            const formSubmissions = submissions.filter((submission) => submission.postedFormId === form.id);
            return <article className="admin-panel" key={form.id}><p className="eyebrow">{form.approvalStatus}</p><h3>{form.title}</h3><p>{formSubmissions.length} submitted responses</p><div className="ai-summary-placeholder"><h4>AI Summary</h4><p>{form.generateAiSummary ? "AI summary will be generated for this form when configured." : "AI summary is disabled for this form."}</p>{form.generateAiSummary && aiSummarySections.map((section) => <span key={section}>{section}</span>)}<button type="button" className="inline-action" disabled>Generate AI Summary</button><button type="button" className="inline-action" disabled>Download AI Summary PDF</button></div></article>;
          })}
        </div>
      )}

      {view === "myForms" && <FormsList forms={postedForms.filter((form) => form.approvalStatus === "open" && isTargetedToUser(form, user) && !mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} onOpen={openForm} empty="No pending forms right now." />}
      {view === "myFormDrafts" && <FormsList forms={postedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "draft"))} onOpen={openForm} empty="No saved form drafts." />}
      {view === "mySubmittedForms" && <FormsList forms={postedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} onOpen={openForm} empty="No submitted forms yet." />}
    </div>
  );
}

function FormsList({ forms, onOpen, empty }) {
  if (!forms.length) return <EmptyFormsState title={empty} text="Forms posted to you will appear here." />;
  return <div className="dashboard-card-grid">{forms.map((form) => <article className="admin-panel" key={form.id}><p className="eyebrow">{form.approvalStatus}</p><h3>{form.title}</h3><p>{form.description || "No description."}</p><p className="helper-text">Due: {formatDate(form.dueDate)}</p><button type="button" className="primary-action" onClick={() => onOpen(form)}><FileText size={17} />Open form</button></article>)}</div>;
}

function EmptyFormsState({ title, text }) {
  return <article className="admin-panel empty-approval-preview"><CheckCircle2 size={30} /><h3>{title}</h3><p>{text}</p></article>;
}
