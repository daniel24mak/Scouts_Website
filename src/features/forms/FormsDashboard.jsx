import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, CheckCircle2, Clock, Copy, FileText, GripVertical, Plus, Save, Search, Send, ShieldCheck, Star, Trash2, Users } from "lucide-react";
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
const defaultCondition = { enabled: false, sourceQuestionId: "", operator: "equals", value: "" };
const defaultFormSettings = {
  appearance: {
    accentColor: "#4055a6",
    backgroundColor: "#eef3fb",
    cardColor: "#ffffff",
    headerImageUrl: "",
    logoUrl: "",
    darkLogoUrl: "",
    organizationName: "St. Mary's Scouts Dubai",
    subtitle: "",
    headerAlignment: "left",
    logoSize: "medium",
    fontStyle: "system",
    cornerRadius: "medium",
    shadowStrength: "soft",
    headerMode: "compact_later"
  },
  startScreen: {
    enabled: true,
    buttonLabel: "Start form",
    estimatedMinutes: "",
    notice: "Your response is saved securely and can only be viewed by authorized leaders.",
    requireConfirmation: false,
    confirmationLabel: "I have read the instructions and understand this form."
  },
  behavior: {
    requiredNotice: true,
    progressDisplay: "bar",
    hiddenAnswerMode: "preserve"
  }
};

function normalizeFormSettings(settings = {}) {
  return {
    appearance: { ...defaultFormSettings.appearance, ...(settings.appearance ?? {}) },
    startScreen: { ...defaultFormSettings.startScreen, ...(settings.startScreen ?? {}) },
    behavior: { ...defaultFormSettings.behavior, ...(settings.behavior ?? {}) }
  };
}

function getFormSettings(schema) {
  return normalizeFormSettings(schema?.settings);
}

function getFormThemeStyle(settings) {
  const appearance = normalizeFormSettings(settings).appearance;
  return {
    "--form-accent": appearance.accentColor || defaultFormSettings.appearance.accentColor,
    "--form-page-bg": appearance.backgroundColor || defaultFormSettings.appearance.backgroundColor,
    "--form-card-bg": appearance.cardColor || defaultFormSettings.appearance.cardColor,
    "--form-radius": appearance.cornerRadius === "large" ? "28px" : appearance.cornerRadius === "small" ? "14px" : "20px",
    "--form-shadow": appearance.shadowStrength === "strong" ? "0 28px 70px rgb(15 23 42 / 0.2)" : appearance.shadowStrength === "none" ? "none" : "0 18px 44px rgb(15 23 42 / 0.12)"
  };
}

function getLogoSizeClass(size) {
  if (size === "small") return "small";
  if (size === "large") return "large";
  return "medium";
}

function makePage(order = 0) {
  return {
    id: crypto.randomUUID(),
    title: `Page ${order + 1}`,
    description: "",
    order,
    conditionalLogic: { ...defaultCondition }
  };
}

function makeQuestion(type = "short_text", pageId = null, order = 0) {
  return {
    id: crypto.randomUUID(),
    pageId,
    order,
    type,
    text: "Untitled question",
    description: "",
    helperText: "",
    placeholder: "",
    required: false,
    options: optionQuestionTypes.has(type) ? ["Option 1"] : [],
    conditionalLogic: { ...defaultCondition }
  };
}

function normalizeConditionalLogic(rule) {
  return {
    enabled: Boolean(rule?.enabled),
    sourceQuestionId: rule?.sourceQuestionId ?? "",
    operator: rule?.operator ?? "equals",
    value: Array.isArray(rule?.value) ? rule.value : rule?.value ?? ""
  };
}

function safeSchema(schema) {
  const nextSchema = schema?.questions?.length ? schema : blankFormSchema();
  const fallbackPageId = nextSchema.pages?.[0]?.id || nextSchema.questions?.[0]?.pageId || "page-default";
  const pages = (Array.isArray(nextSchema.pages) && nextSchema.pages.length ? nextSchema.pages : [{ id: fallbackPageId, title: "Page 1", description: "", order: 0 }])
    .map((page, index) => ({
      id: page.id || `page-${index + 1}`,
      title: page.title ?? `Page ${index + 1}`,
      description: page.description ?? "",
      order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
      conditionalLogic: normalizeConditionalLogic(page.conditionalLogic)
    }))
    .sort((a, b) => a.order - b.order)
    .map((page, index) => ({ ...page, order: index }));
  const pageIds = new Set(pages.map((page) => page.id));
  const primaryPageId = pages[0]?.id || fallbackPageId;
  return {
    settings: normalizeFormSettings(nextSchema.settings),
    pages,
    questions: nextSchema.questions.map((question) => ({
      id: question.id || crypto.randomUUID(),
      pageId: pageIds.has(question.pageId) ? question.pageId : primaryPageId,
      order: Number.isFinite(Number(question.order)) ? Number(question.order) : 0,
      type: question.type || "short_text",
      text: question.text ?? "Untitled question",
      description: question.description ?? "",
      helperText: question.helperText ?? "",
      placeholder: question.placeholder ?? "",
      required: Boolean(question.required),
      options: Array.isArray(question.options) ? question.options : [],
      conditionalLogic: normalizeConditionalLogic(question.conditionalLogic)
    })).sort((a, b) => a.order - b.order).map((question, index, list) => ({
      ...question,
      order: list.filter((item) => item.pageId === question.pageId).findIndex((item) => item.id === question.id)
    }))
  };
}

function getOrderedQuestions(schema) {
  const normalized = safeSchema(schema);
  return normalized.pages.flatMap((page) => normalized.questions.filter((question) => question.pageId === page.id).sort((a, b) => a.order - b.order));
}

function getQuestionsForPage(schema, pageId) {
  const normalized = safeSchema(schema);
  return normalized.questions.filter((question) => question.pageId === pageId).sort((a, b) => a.order - b.order);
}

function valueList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function hasMeaningfulText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}

function conditionMatches(rule, answers, questions) {
  const condition = normalizeConditionalLogic(rule);
  if (!condition.enabled || !condition.sourceQuestionId) return true;
  const sourceQuestion = questions.find((question) => question.id === condition.sourceQuestionId);
  if (!sourceQuestion) return true;
  const answer = answers?.[sourceQuestion.id];
  const expected = condition.value;
  const expectedList = valueList(expected);
  const answerList = valueList(answer);

  if (condition.operator === "is_answered") return isAnswerFilled(answer);
  if (condition.operator === "is_not_answered") return !isAnswerFilled(answer);
  if (condition.operator === "not_equals") return String(answer ?? "") !== String(expected ?? "");
  if (condition.operator === "contains") return answerList.includes(String(expected ?? ""));
  if (condition.operator === "does_not_contain") return !answerList.includes(String(expected ?? ""));
  if (condition.operator === "contains_any") return expectedList.some((item) => answerList.includes(item));
  if (condition.operator === "contains_all") return expectedList.every((item) => answerList.includes(item));
  if (condition.operator === "greater_than") return Number(answer) > Number(expected);
  if (condition.operator === "less_than") return Number(answer) < Number(expected);
  return String(answer ?? "") === String(expected ?? "");
}

function getVisiblePages(schema, answers = {}) {
  const normalized = safeSchema(schema);
  const orderedQuestions = getOrderedQuestions(normalized);
  const visible = normalized.pages.filter((page, index) => index === 0 || conditionMatches(page.conditionalLogic, answers, orderedQuestions));
  return visible.length ? visible : normalized.pages.slice(0, 1);
}

function getVisibleQuestionsForPage(schema, pageId, answers = {}) {
  const orderedQuestions = getOrderedQuestions(schema);
  return orderedQuestions.filter((question) => question.pageId === pageId && conditionMatches(question.conditionalLogic, answers, orderedQuestions));
}

function getVisibleQuestions(schema, answers = {}) {
  return getVisiblePages(schema, answers).flatMap((page) => getVisibleQuestionsForPage(schema, page.id, answers));
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
  if (form.targetType === "groups") return [user.groupId, ...(user.coordinatorGroupIds ?? [])].filter(Boolean).some((groupId) => form.targetGroupIds?.includes(groupId));
  if (form.targetType === "users") return form.targetUserIds?.includes(user.id);
  return false;
}


function isAnswerFilled(value) {
  return !(value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length));
}

function getQuestionTypeLabel(type) {
  return formQuestionTypes.find(([id]) => id === type)?.[1] ?? "Question";
}

function matchesSearch(item, query, fields) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return fields.some((field) => {
    const value = typeof field === "function" ? field(item) : item?.[field];
    return String(value ?? "").toLowerCase().includes(term);
  });
}

function getQuestionPlaceholder(question) {
  if (question.placeholder) return question.placeholder;
  if (question.type === "number") return "Enter a number";
  if (question.type === "date") return "Select a date";
  if (question.type === "dropdown") return "Select an option";
  if (question.type === "long_text") return "Type your response here...";
  return /name/i.test(question.text ?? "") ? "Enter full name" : "Type your answer...";
}

function getQuestionHelper(question) {
  if (question.helperText) return question.helperText;
  if (question.required) return "This question is required.";
  if (question.type === "number") return "Numbers only.";
  if (question.type === "rating") return "Choose one rating from 1 to 5.";
  if (question.type === "checkboxes") return "Select all options that apply.";
  if (question.type === "multiple_choice") return "Select one option.";
  return "";
}

function getFormStats(form, answers) {
  const questions = getVisibleQuestions(form.schemaJson, answers);
  const completed = questions.filter((question) => isAnswerFilled(answers[question.id])).length;
  const required = questions.filter((question) => question.required).length;
  const missingRequired = questions.filter((question) => question.required && !isAnswerFilled(answers[question.id]));
  return {
    questions,
    completed,
    required,
    missingRequired,
    optionalUnanswered: questions.filter((question) => !question.required && !isAnswerFilled(answers[question.id])).length,
    percent: questions.length ? Math.round((completed / questions.length) * 100) : 0,
    estimateMinutes: Math.max(2, Math.ceil(questions.length * 0.7))
  };
}
function answerToText(value) {
  if (Array.isArray(value)) return value.join("; ");
  return value ?? "";
}

function downloadCsv({ form, submissions, users, groups }) {
  const questions = getOrderedQuestions(form.schemaJson);
  const headers = ["Name", "Group", "Submitted At", "Edited At", "Submission Status", ...questions.map((question) => question.text || "Untitled question")];
  const rows = submissions.map((submission) => {
    const submitter = users.find((item) => item.id === submission.submittedBy);
    const visibleIds = new Set(getVisibleQuestions(form.schemaJson, submission.answersJson ?? {}).map((question) => question.id));
    return [
      submitter?.name ?? "Unknown user",
      getGroupName(groups, submission.groupId ?? submitter?.groupId),
      formatDate(submission.submittedAt),
      formatDate(submission.editedAt),
      submission.approvalStatus,
      ...questions.map((question) => visibleIds.has(question.id) ? answerToText(submission.answersJson?.[question.id]) : "")
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
  const placeholder = getQuestionPlaceholder(question);
  if (question.type === "long_text") {
    if (disabled) return value ? <FormattedText text={value} className="formatted-text forms-rich-answer" /> : <div className="forms-rich-answer-placeholder">Long answer</div>;
    return <div className="forms-premium-rich-input"><RichTextEditor value={value ?? ""} onChange={onChange} minHeight={150} placeholder={placeholder} /></div>;
  }
  if (question.type === "number") return <input className="forms-premium-input" disabled={disabled} type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
  if (question.type === "rating") {
    return <div className="forms-rating-control premium" role="radiogroup" aria-label={question.text}>{[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} disabled={disabled} className={String(value ?? "") === String(rating) ? "selected" : ""} onClick={() => onChange(rating)} aria-label={`${rating} out of 5`}><Star size={19} fill={String(value ?? "") === String(rating) ? "currentColor" : "none"} /><span>{rating}</span></button>)}</div>;
  }
  if (question.type === "yes_no") return <div className="forms-segmented-control premium">{["Yes", "No"].map((choice) => <button type="button" key={choice} disabled={disabled} className={value === choice ? "selected" : ""} onClick={() => onChange(choice)}>{choice}</button>)}</div>;
  if (question.type === "multiple_choice") return <div className="forms-choice-stack premium">{question.options.map((option) => <label key={option}><input disabled={disabled} type="radio" checked={value === option} onChange={() => onChange(option)} /><span />{option}</label>)}</div>;
  if (question.type === "checkboxes") {
    const selected = Array.isArray(value) ? value : [];
    return <div className="forms-choice-stack premium checkboxes">{question.options.map((option) => <label key={option}><input disabled={disabled} type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span />{option}</label>)}</div>;
  }
  if (question.type === "dropdown") return <select className="forms-premium-input" disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (question.type === "date") return <input className="forms-premium-input" disabled={disabled} type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)} aria-label={placeholder} />;
  return <input className="forms-premium-input" disabled={disabled} value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function FormBrandHeader({ form, settings, compact = false, meta = null }) {
  const appearance = settings.appearance;
  const logo = appearance.logoUrl || appearance.darkLogoUrl;
  const alignment = appearance.headerAlignment === "center" ? "center" : appearance.headerAlignment === "right" ? "right" : "left";
  const hasVisualHeader = Boolean(appearance.headerImageUrl || logo || appearance.organizationName || appearance.subtitle);

  if (!hasVisualHeader && compact) return null;

  return (
    <div className={`forms-brand-header ${compact ? "compact" : ""} align-${alignment}`}>
      {appearance.headerImageUrl && !compact && <img className="forms-brand-banner" src={appearance.headerImageUrl} alt={`${form.title || "Form"} banner`} />}
      <div className="forms-brand-lockup">
        {logo && <img className={`forms-brand-logo ${getLogoSizeClass(appearance.logoSize)}`} src={logo} alt={`${appearance.organizationName || form.title || "Form"} logo`} />}
        <div>
          {appearance.organizationName && <span>{appearance.organizationName}</span>}
          <strong>{compact ? form.title || "Untitled form" : appearance.subtitle || form.title || "Untitled form"}</strong>
          {meta?.postedAt && !compact && <small>Posted {formatDate(meta.postedAt)}</small>}
        </div>
      </div>
    </div>
  );
}

function FormReviewAnswerGroups({ form, answers }) {
  const schema = safeSchema(form.schemaJson);
  const visiblePages = getVisiblePages(schema, answers);

  return (
    <div className="forms-review-answer-list grouped">
      {visiblePages.map((page, pageIndex) => {
        const questions = getVisibleQuestionsForPage(schema, page.id, answers);
        const pageTitle = page.title && !/^page\s*\d+$/i.test(page.title.trim()) ? page.title : "";
        if (!questions.length) return null;
        return (
          <section className="forms-review-page-group" key={page.id}>
            {pageTitle && <header><strong>{pageTitle}</strong></header>}
            {questions.map((question, index) => (
              <article key={question.id}>
                <div className="forms-review-question-title">
                  <span>{index + 1}</span>
                  <FormattedText text={question.text} fallback="Untitled question" />
                  {question.required && <em aria-label="Required">*</em>}
                </div>
                {question.description && <FormattedText text={question.description} className="forms-review-question-description" />}
                {isAnswerFilled(answers[question.id])
                  ? question.type === "long_text"
                    ? <FormattedText text={answers[question.id]} className="forms-review-answer-rich" />
                    : <p>{answerToText(answers[question.id])}</p>
                  : <p>Not answered</p>}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function FormPreview({ form, answers = {}, onAnswerChange = null, disabled = false, errorQuestionIds = [], meta = null, showHeader = true, isStarted = null, onStart = null }) {
  const schema = safeSchema(form.schemaJson);
  const settings = getFormSettings(schema);
  const themeStyle = getFormThemeStyle(settings);
  const visiblePages = getVisiblePages(schema, answers);
  const formTopRef = useRef(null);
  const showStartScreen = showHeader && settings.startScreen.enabled !== false;
  const [internalStarted, setInternalStarted] = useState(!showStartScreen);
  const [confirmedStart, setConfirmedStart] = useState(false);
  const [currentPageId, setCurrentPageId] = useState(visiblePages[0]?.id ?? schema.pages[0]?.id);
  const [pageErrors, setPageErrors] = useState([]);
  const currentPage = visiblePages.find((page) => page.id === currentPageId) ?? visiblePages[0] ?? schema.pages[0];
  const currentPageIndex = visiblePages.findIndex((page) => page.id === currentPage?.id);
  const visibleQuestions = currentPage ? getVisibleQuestionsForPage(schema, currentPage.id, answers) : [];
  const stats = getFormStats(form, answers);
  const combinedErrors = [...new Set([...errorQuestionIds, ...pageErrors])];
  const started = !showStartScreen || (isStarted ?? internalStarted);
  const startDisabled = settings.startScreen.requireConfirmation && !confirmedStart;
  const progressPercent = stats.percent;
  const progressDisplay = settings.behavior.progressDisplay;
  const showProgressBar = visiblePages.length > 1 && progressDisplay !== "minimal" && progressDisplay !== "dots";
  const showProgressDots = visiblePages.length > 1 && (progressDisplay === "dots" || (progressDisplay === "bar" && visiblePages.length <= 5));
  const firstPageIntroVisible = !showStartScreen && currentPageIndex === 0 && (hasMeaningfulText(form.description) || hasMeaningfulText(form.instructions));
  const pageTitle = currentPage?.title && !/^page\s*\d+$/i.test(currentPage.title.trim()) ? currentPage.title : "";

  const scrollFormToTop = () => {
    window.requestAnimationFrame(() => {
      const container = formTopRef.current?.closest(".forms-fill-shell");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (!visiblePages.some((page) => page.id === currentPageId)) {
      setCurrentPageId(visiblePages[0]?.id ?? schema.pages[0]?.id);
      scrollFormToTop();
    }
  }, [currentPageId, schema.pages, visiblePages]);

  useEffect(() => {
    if (started) scrollFormToTop();
  }, [currentPageId, started]);

  const validateCurrentPage = () => {
    const missing = visibleQuestions.filter((question) => question.required && !isAnswerFilled(answers[question.id]));
    if (!missing.length) {
      setPageErrors([]);
      return true;
    }
    const ids = missing.map((question) => question.id);
    setPageErrors(ids);
    window.requestAnimationFrame(() => document.querySelector(`[data-question-id="${ids[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return false;
  };

  const goToPage = (direction) => {
    if (direction > 0 && !validateCurrentPage()) return;
    const nextIndex = Math.max(0, Math.min(visiblePages.length - 1, currentPageIndex + direction));
    setCurrentPageId(visiblePages[nextIndex]?.id);
    setPageErrors([]);
    scrollFormToTop();
  };

  const startForm = () => {
    setInternalStarted(true);
    onStart?.();
  };

  if (showStartScreen && !started) {
    return (
      <article className="forms-preview-card premium-form-card forms-start-card google-form-canvas" style={themeStyle}>
        <FormBrandHeader form={form} settings={settings} meta={meta} />
        <div className="forms-preview-header premium-form-header">
          <p className="eyebrow">Form introduction</p>
          <h2>{form.title || "Untitled form"}</h2>
          <FormattedText text={form.description} fallback="No description provided." />
          {form.instructions && <div className="forms-preview-instructions premium"><strong>Instructions</strong><FormattedText text={form.instructions} /></div>}
          <div className="premium-form-meta-grid">
            <span><Users size={16} />Assigned by <strong>{meta?.assignedBy ?? "Scouts Admin"}</strong></span>
            <span><CalendarDays size={16} />Due <strong>{formatDate(form.dueDate)}</strong></span>
            <span><Clock size={16} />Estimated <strong>{settings.startScreen.estimatedMinutes || stats.estimateMinutes} min</strong></span>
            <span><FileText size={16} />Structure <strong>{visiblePages.length} pages / {stats.questions.length} questions</strong></span>
            <span><ShieldCheck size={16} />Editing <strong>{form.allowEdits ? "Allowed while open" : "Locked after submit"}</strong></span>
          </div>
          {settings.startScreen.notice && <p className="forms-start-notice">{settings.startScreen.notice}</p>}
          {settings.startScreen.requireConfirmation && <label className="forms-start-confirm"><input type="checkbox" checked={confirmedStart} onChange={(event) => setConfirmedStart(event.target.checked)} />{settings.startScreen.confirmationLabel}</label>}
          <button type="button" className="primary-action forms-start-button" disabled={startDisabled} onClick={startForm}>{settings.startScreen.buttonLabel || "Start form"}</button>
        </div>
      </article>
    );
  }

  return (
    <article className="forms-preview-card premium-form-card google-form-canvas" style={themeStyle} ref={formTopRef}>
      {(settings.appearance.headerMode === "repeat" || currentPageIndex === 0 || settings.appearance.headerMode === "compact_later") && (
        <FormBrandHeader form={form} settings={settings} compact={currentPageIndex > 0 && settings.appearance.headerMode === "compact_later"} meta={meta} />
      )}
      {currentPage && <div className={`forms-page-fill-header ${showProgressBar || showProgressDots ? "" : "single-column"}`}>
        <div>
          <p className="eyebrow">{form.title || "Untitled form"}</p>
          <h3>{pageTitle || "Questions"}</h3>
          {firstPageIntroVisible && <div className="forms-page-intro">
            {hasMeaningfulText(form.description) && <FormattedText text={form.description} fallback="" />}
            {hasMeaningfulText(form.instructions) && <div className="forms-preview-instructions premium"><strong>Instructions</strong><FormattedText text={form.instructions} /></div>}
          </div>}
          {currentPage.description && <div className="forms-page-instructions"><strong>Instructions</strong><FormattedText text={currentPage.description} /></div>}
          {settings.behavior.requiredNotice && <small className="forms-required-note">* Indicates a required question</small>}
        </div>
        {(showProgressBar || showProgressDots) && <div className="forms-page-progress-block">
          {showProgressBar && <div className="premium-form-progress"><div><span style={{ width: `${progressPercent}%` }} /></div><strong>{progressPercent}%</strong></div>}
          {showProgressDots && <div className="forms-page-dots" aria-label="Visible form pages">{visiblePages.map((page, index) => <button type="button" key={page.id} className={page.id === currentPage.id ? "active" : ""} aria-label={`Go to ${page.title}`} onClick={() => { if (index <= currentPageIndex || validateCurrentPage()) { setCurrentPageId(page.id); setPageErrors([]); scrollFormToTop(); } }}>{index + 1}</button>)}</div>}
        </div>}
      </div>}
      <div className="forms-preview-questions premium-question-stack">
        {visibleQuestions.map((question, index) => (
          <section className={`forms-fill-question premium-question-card ${combinedErrors.includes(question.id) ? "has-error" : ""}`} key={question.id} data-question-id={question.id}>
            <div className="premium-question-topline">
              <span className="premium-question-number">{String(index + 1).padStart(2, "0")}</span>
              {question.required && <em aria-label="Required">*</em>}
            </div>
            <label>
              <span className="premium-question-title">{question.text}</span>
              {question.description && <FormattedText text={question.description} className="premium-question-description" />}
              {(combinedErrors.includes(question.id) || getQuestionHelper(question)) && <small className="premium-question-helper">{combinedErrors.includes(question.id) ? "This question is required before submission." : getQuestionHelper(question)}</small>}
              <QuestionInput question={question} value={answers[question.id]} disabled={disabled || !onAnswerChange} onChange={(nextValue) => { onAnswerChange?.(question.id, nextValue); setPageErrors((current) => current.filter((id) => id !== question.id)); }} />
              {combinedErrors.includes(question.id) && <small className="forms-field-error">This question is required.</small>}
            </label>
          </section>
        ))}
      </div>
      {visiblePages.length > 1 && <div className="forms-page-navigation">
        <button type="button" className="inline-action" disabled={currentPageIndex <= 0} onClick={() => goToPage(-1)}>Previous</button>
        <span>{stats.percent}% complete</span>
        <button type="button" className="primary-action" disabled={currentPageIndex >= visiblePages.length - 1} onClick={() => goToPage(1)}>Next</button>
      </div>}
    </article>
  );
}
function WizardStepper({ step }) {
  return <div className="forms-wizard-stepper" aria-label={`Step ${step + 1} of ${builderSteps.length}`}>{builderSteps.map((label, index) => <div className={`forms-wizard-step ${index < step ? "complete" : ""} ${index === step ? "current" : ""}`} key={label}><span>{index < step ? <CheckCircle2 size={18} /> : index + 1}</span><small>{label}</small></div>)}</div>;
}

function TemplatePicker({ templates, onUse }) {
  return <div className="forms-template-picker">{templates.length ? templates.map((template) => <article className="forms-template-mini-card" key={template.id}><FileText size={22} /><div><strong>{template.title}</strong><small>{safeSchema(template.schemaJson).pages.length} pages / {getOrderedQuestions(template.schemaJson).length} questions</small></div><button type="button" className="inline-action" onClick={() => onUse(template)}>Use Template</button></article>) : <p className="empty-state">No templates are available yet.</p>}</div>;
}

function ConditionalLogicEditor({ label, item, questions, onChange, helper, disabled = false, disabledReason = "" }) {
  const rule = normalizeConditionalLogic(item.conditionalLogic);
  const availableQuestions = questions.filter((question) => question.id !== item.id);
  const sourceQuestion = availableQuestions.find((question) => question.id === rule.sourceQuestionId);
  const sourceOptions = sourceQuestion?.type === "yes_no" ? ["Yes", "No"] : optionQuestionTypes.has(sourceQuestion?.type) ? sourceQuestion.options : [];
  const canCreateRule = !disabled && availableQuestions.length > 0;
  const operators = sourceQuestion?.type === "checkboxes"
    ? [["contains", "contains"], ["does_not_contain", "does not contain"], ["contains_any", "contains any"], ["contains_all", "contains all"], ["is_answered", "is answered"], ["is_not_answered", "is not answered"]]
    : sourceQuestion?.type === "number"
      ? [["equals", "equals"], ["not_equals", "does not equal"], ["greater_than", "greater than"], ["less_than", "less than"], ["is_answered", "is answered"], ["is_not_answered", "is not answered"]]
      : [["equals", "equals"], ["not_equals", "does not equal"], ["is_answered", "is answered"], ["is_not_answered", "is not answered"]];
  const needsValue = !["is_answered", "is_not_answered"].includes(rule.operator);

  return (
    <div className="forms-conditional-editor">
      <label className="toggle-row">
        <input type="checkbox" checked={rule.enabled && canCreateRule} disabled={!canCreateRule} onChange={(event) => onChange({ ...rule, enabled: event.target.checked })} />
        {label}
      </label>
      {rule.enabled && canCreateRule && <div className="forms-conditional-grid">
        <label>Source question<select value={rule.sourceQuestionId} onChange={(event) => onChange({ ...rule, sourceQuestionId: event.target.value, value: "" })}><option value="">Choose a question</option>{availableQuestions.map((question) => <option key={question.id} value={question.id}>{question.text}</option>)}</select></label>
        <label>Condition<select value={rule.operator} onChange={(event) => onChange({ ...rule, operator: event.target.value })}>{operators.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>
        {needsValue && <label>Answer/value{sourceOptions.length ? <select value={rule.value ?? ""} onChange={(event) => onChange({ ...rule, value: event.target.value })}><option value="">Choose value</option>{sourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={rule.value ?? ""} onChange={(event) => onChange({ ...rule, value: event.target.value })} placeholder="Value to compare" />}</label>}
        <button type="button" className="inline-action" onClick={() => onChange({ ...defaultCondition })}>Clear rule</button>
      </div>}
      <small>{disabled ? disabledReason : !availableQuestions.length ? "Add another question first, then choose what answer controls this item." : helper ?? "Hidden questions and pages do not block required validation."}</small>
    </div>
  );
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

  const formSettings = getFormSettings(schemaJson);
  const orderedQuestions = getOrderedQuestions(schemaJson);
  const builderIssues = useMemo(() => {
    const issues = [];
    if (!title.trim()) issues.push({ id: "form-title", step: 0, label: "Form title", message: "Add a form title." });
    if (!hasMeaningfulText(description)) issues.push({ id: "form-description", step: 0, label: "Form description", message: "Add a short form description." });
    orderedQuestions.forEach((question, index) => {
      if (!question.text.trim()) {
        issues.push({ id: `question-${question.id}`, step: 1, label: `Question ${index + 1}`, message: "Add question text." });
      }
    });
    return issues;
  }, [description, orderedQuestions, title]);
  const builderIssueIds = new Set(builderIssues.map((issue) => issue.id));
  const updateSettings = (patch) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    return safeSchema({ ...schema, settings: normalizeFormSettings({ ...schema.settings, ...patch }) });
  });
  const updateAppearance = (patch) => updateSettings({ appearance: { ...formSettings.appearance, ...patch } });
  const updateStartScreen = (patch) => updateSettings({ startScreen: { ...formSettings.startScreen, ...patch } });
  const updateBehavior = (patch) => updateSettings({ behavior: { ...formSettings.behavior, ...patch } });
  const updatePage = (id, patch) => setSchemaJson((current) => safeSchema({ ...current, pages: current.pages.map((page) => page.id === id ? { ...page, ...patch } : page) }));
  const updateQuestion = (id, patch) => setSchemaJson((current) => safeSchema({ ...current, questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question) }));
  const movePage = (index, direction) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const pages = [...schema.pages];
    const next = index + direction;
    if (next < 0 || next >= pages.length) return schema;
    [pages[index], pages[next]] = [pages[next], pages[index]];
    return safeSchema({ ...schema, pages: pages.map((page, pageIndex) => ({ ...page, order: pageIndex })) });
  });
  const duplicatePage = (pageId) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const sourcePage = schema.pages.find((page) => page.id === pageId);
    if (!sourcePage) return schema;
    const nextPage = { ...sourcePage, id: crypto.randomUUID(), title: `${sourcePage.title} copy`, order: sourcePage.order + 1 };
    const questions = getQuestionsForPage(schema, pageId).map((question, index) => ({ ...question, id: crypto.randomUUID(), pageId: nextPage.id, order: index, text: `${question.text} copy` }));
    const pages = [...schema.pages];
    pages.splice(sourcePage.order + 1, 0, nextPage);
    return safeSchema({ pages: pages.map((page, index) => ({ ...page, order: index })), questions: [...schema.questions, ...questions] });
  });
  const deletePage = (pageId) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    if (schema.pages.length === 1) return schema;
    const pages = schema.pages.filter((page) => page.id !== pageId).map((page, index) => ({ ...page, order: index }));
    const questions = schema.questions.filter((question) => question.pageId !== pageId);
    return safeSchema({ pages, questions: questions.length ? questions : [makeQuestion("short_text", pages[0].id, 0)] });
  });
  const addPage = () => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const page = makePage(schema.pages.length);
    return safeSchema({ ...schema, pages: [...schema.pages, page], questions: [...schema.questions, makeQuestion("short_text", page.id, 0)] });
  });
  const moveQuestion = (pageId, index, direction) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const pageQuestions = getQuestionsForPage(schema, pageId);
    const next = index + direction;
    if (next < 0 || next >= pageQuestions.length) return schema;
    [pageQuestions[index], pageQuestions[next]] = [pageQuestions[next], pageQuestions[index]];
    const reordered = pageQuestions.map((question, questionIndex) => ({ ...question, order: questionIndex }));
    return safeSchema({ ...schema, questions: schema.questions.map((question) => reordered.find((item) => item.id === question.id) ?? question) });
  });
  const dropQuestion = (pageId, toIndex) => {
    if (!draggedIndex || draggedIndex.pageId !== pageId || draggedIndex.index === toIndex) return;
    setSchemaJson((current) => {
      const schema = safeSchema(current);
      const pageQuestions = getQuestionsForPage(schema, pageId);
      const [moved] = pageQuestions.splice(draggedIndex.index, 1);
      pageQuestions.splice(toIndex, 0, moved);
      const reordered = pageQuestions.map((question, questionIndex) => ({ ...question, order: questionIndex }));
      return safeSchema({ ...schema, questions: schema.questions.map((question) => reordered.find((item) => item.id === question.id) ?? question) });
    });
    setDraggedIndex(null);
  };
  const duplicateQuestion = (pageId, index) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const pageQuestions = getQuestionsForPage(schema, pageId);
    pageQuestions.splice(index + 1, 0, { ...pageQuestions[index], id: crypto.randomUUID(), text: `${pageQuestions[index].text} copy` });
    const reordered = pageQuestions.map((question, questionIndex) => ({ ...question, order: questionIndex }));
    return safeSchema({ ...schema, questions: [...schema.questions.filter((question) => question.pageId !== pageId), ...reordered] });
  });
  const deleteQuestion = (id) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    if (schema.questions.length === 1) return schema;
    return safeSchema({ ...schema, questions: schema.questions.filter((question) => question.id !== id) });
  });
  const addQuestionToPage = (pageId) => setSchemaJson((current) => {
    const schema = safeSchema(current);
    const order = getQuestionsForPage(schema, pageId).length;
    return safeSchema({ ...schema, questions: [...schema.questions, makeQuestion(addQuestionType, pageId, order)] });
  });
  const payload = () => ({ title, description, instructions, schemaJson: safeSchema(schemaJson), targetType, targetGroupIds, targetUserIds: postedForm?.targetUserIds ?? [], dueDate, linkedEventId, allowEdits, generateAiSummary });
  const jumpToBuilderIssue = (issue) => {
    setStep(issue.step);
    if (issue.step === 1) setQuestionMode("edit");
    window.setTimeout(() => {
      const target = document.querySelector(`[data-builder-field="${issue.id}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.querySelector("input, textarea, [contenteditable='true']")?.focus?.();
    }, 80);
  };
  const validateBuilderBeforePublishing = () => {
    if (!builderIssues.length) return true;
    jumpToBuilderIssue(builderIssues[0]);
    setSaveMessage("Fix the highlighted form fields before posting or saving as an active template.");
    return false;
  };

  const useTemplate = (nextTemplate) => {
    setTitle(nextTemplate.title);
    setDescription(nextTemplate.description ?? "");
    setSchemaJson(safeSchema(nextTemplate.schemaJson));
    setShowTemplates(false);
    setSaveMessage(`Template "${nextTemplate.title}" loaded.`);
  };
  const saveTemplate = async (status = "active", saveAsNew = false) => {
    if (status !== "draft" && !validateBuilderBeforePublishing()) return;
    setIsSaving(true);
    try {
      await saveDashboardFormTemplate({ id: saveAsNew ? undefined : template?.id, ...payload(), status });
      setSaveMessage(status === "draft" ? "Form template draft saved." : saveAsNew ? "Form saved as a new template." : "Form template saved.");
      await onDone("formTemplates");
    } finally { setIsSaving(false); }
  };
  const post = async (saveTemplateFirst = false) => {
    if (!validateBuilderBeforePublishing()) return;
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
          <div className="forms-builder-settings-grid forms-builder-details-layout">
            <section className="forms-builder-settings-card forms-builder-primary-card">
              <div className="forms-section-heading compact"><div><p className="eyebrow">Basics</p><h3>Information users see first</h3></div></div>
              <label className={`forms-field-label ${builderIssueIds.has("form-title") ? "has-error" : ""}`} data-builder-field="form-title">Form title<input className="forms-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Camp evaluation, yearly commitment..." />{builderIssueIds.has("form-title") && <small className="forms-field-error">Form title is required before posting.</small>}</label>
              <div className={`forms-builder-field ${builderIssueIds.has("form-description") ? "has-error" : ""}`} data-builder-field="form-description"><RichTextEditor label="Description" value={description} onChange={setDescription} minHeight={150} placeholder="Explain the purpose of this form..." />{builderIssueIds.has("form-description") && <small className="forms-field-error">Form description is required before posting.</small>}</div>
              <RichTextEditor label="Instructions" value={instructions} onChange={setInstructions} minHeight={130} placeholder="Add instructions for chiefs..." />
            </section>

            <aside className="forms-builder-side-rail" aria-label="Form display settings">
            <section className="forms-builder-settings-card">
              <div className="forms-section-heading compact"><div><p className="eyebrow">Branding</p><h3>Appearance and header</h3></div></div>
              <div className="forms-appearance-grid">
                <label>Accent color<input type="color" value={formSettings.appearance.accentColor} onChange={(event) => updateAppearance({ accentColor: event.target.value })} /></label>
                <label>Page background<input type="color" value={formSettings.appearance.backgroundColor} onChange={(event) => updateAppearance({ backgroundColor: event.target.value })} /></label>
                <label>Card color<input type="color" value={formSettings.appearance.cardColor} onChange={(event) => updateAppearance({ cardColor: event.target.value })} /></label>
                <label>Header alignment<select value={formSettings.appearance.headerAlignment} onChange={(event) => updateAppearance({ headerAlignment: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                <label>Logo size<select value={formSettings.appearance.logoSize} onChange={(event) => updateAppearance({ logoSize: event.target.value })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
                <label>Header behavior<select value={formSettings.appearance.headerMode} onChange={(event) => updateAppearance({ headerMode: event.target.value })}><option value="compact_later">Full first page, compact later</option><option value="repeat">Repeat full header</option><option value="first_only">First page only</option></select></label>
                <label>Organization name<input value={formSettings.appearance.organizationName} onChange={(event) => updateAppearance({ organizationName: event.target.value })} placeholder="St. Mary's Scouts Dubai" /></label>
                <label>Subtitle<input value={formSettings.appearance.subtitle} onChange={(event) => updateAppearance({ subtitle: event.target.value })} placeholder="Optional label, event, or category" /></label>
                <label>Logo URL<input value={formSettings.appearance.logoUrl} onChange={(event) => updateAppearance({ logoUrl: event.target.value })} placeholder="https://..." /></label>
                <label>Dark logo URL<input value={formSettings.appearance.darkLogoUrl} onChange={(event) => updateAppearance({ darkLogoUrl: event.target.value })} placeholder="Optional dark-mode logo" /></label>
                <label className="wide">Banner image URL<input value={formSettings.appearance.headerImageUrl} onChange={(event) => updateAppearance({ headerImageUrl: event.target.value })} placeholder="Optional header or cover image URL" /></label>
              </div>
            </section>

            <section className="forms-builder-settings-card">
              <div className="forms-section-heading compact"><div><p className="eyebrow">Start experience</p><h3>Before users begin</h3></div></div>
              <label className="toggle-row"><input type="checkbox" checked={formSettings.startScreen.enabled} onChange={(event) => updateStartScreen({ enabled: event.target.checked })} />Show start screen before the form begins</label>
              <div className="inline-editor-grid">
                <label>Start button label<input value={formSettings.startScreen.buttonLabel} onChange={(event) => updateStartScreen({ buttonLabel: event.target.value })} placeholder="Start form" /></label>
                <label>Estimated minutes<input type="number" min="1" value={formSettings.startScreen.estimatedMinutes} onChange={(event) => updateStartScreen({ estimatedMinutes: event.target.value })} placeholder="Auto" /></label>
              </div>
              <label>Privacy or notice<textarea value={formSettings.startScreen.notice} onChange={(event) => updateStartScreen({ notice: event.target.value })} placeholder="Explain who can see responses and what happens after submission." /></label>
              <label className="toggle-row"><input type="checkbox" checked={formSettings.startScreen.requireConfirmation} onChange={(event) => updateStartScreen({ requireConfirmation: event.target.checked })} />Require confirmation checkbox before starting</label>
              {formSettings.startScreen.requireConfirmation && <label>Confirmation text<input value={formSettings.startScreen.confirmationLabel} onChange={(event) => updateStartScreen({ confirmationLabel: event.target.value })} /></label>}
            </section>

            <section className="forms-builder-settings-card">
              <div className="forms-section-heading compact"><div><p className="eyebrow">Behavior</p><h3>Progress and hidden answers</h3></div></div>
              <label className="toggle-row"><input type="checkbox" checked={formSettings.behavior.requiredNotice} onChange={(event) => updateBehavior({ requiredNotice: event.target.checked })} />Show required-question notice</label>
              <label>Progress display<select value={formSettings.behavior.progressDisplay} onChange={(event) => updateBehavior({ progressDisplay: event.target.value })}><option value="bar">Progress bar</option><option value="dots">Dots for short forms</option><option value="minimal">Minimal page count</option></select></label>
              <label>Hidden conditional answers<select value={formSettings.behavior.hiddenAnswerMode} onChange={(event) => updateBehavior({ hiddenAnswerMode: event.target.value })}><option value="preserve">Preserve answers when hidden</option><option value="clear">Clear answers when hidden later</option></select></label>
              <div className="forms-theme-preview" style={getFormThemeStyle(formSettings)}><span />Theme preview</div>
            </section>
            </aside>
          </div>
        </div>}

        {step === 1 && <div className="forms-wizard-panel">
          <div className="forms-section-heading"><div><p className="eyebrow">Step 2</p><h2>Build questions</h2></div><div className="forms-mode-toggle" role="tablist" aria-label="Question builder mode"><button type="button" className={questionMode === "edit" ? "active" : ""} aria-pressed={questionMode === "edit"} onClick={() => setQuestionMode("edit")}>Edit</button><button type="button" className={questionMode === "preview" ? "active" : ""} aria-pressed={questionMode === "preview"} onClick={() => setQuestionMode("preview")}>Preview</button></div></div>
          {questionMode === "preview" ? <FormPreview form={{ title, description, instructions, schemaJson }} /> : <>
            <div className="forms-page-builder-list">{schemaJson.pages.map((page, pageIndex) => {
              const pageQuestions = getQuestionsForPage(schemaJson, page.id);
              return <article className="forms-page-builder-card" key={page.id}>
                <div className="forms-page-builder-header">
                  <span className="forms-page-index">Page {pageIndex + 1}</span>
                  <div className="forms-question-icon-actions">
                    <button type="button" className="icon-button" title="Move page up" disabled={pageIndex === 0} onClick={() => movePage(pageIndex, -1)}><ArrowUp size={16} /></button>
                    <button type="button" className="icon-button" title="Move page down" disabled={pageIndex === schemaJson.pages.length - 1} onClick={() => movePage(pageIndex, 1)}><ArrowDown size={16} /></button>
                    <button type="button" className="icon-button" title="Duplicate page" onClick={() => duplicatePage(page.id)}><Copy size={16} /></button>
                    <button type="button" className="icon-button danger-action" title="Delete page" onClick={() => deletePage(page.id)} disabled={schemaJson.pages.length === 1}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="forms-page-fields">
                  <label>Page title<input value={page.title} onChange={(event) => updatePage(page.id, { title: event.target.value })} /></label>
                  <label>Page instructions<textarea value={page.description} onChange={(event) => updatePage(page.id, { description: event.target.value })} placeholder="Tell users what to do on this page" /></label>
                </div>
                <ConditionalLogicEditor label="Show this page when..." item={page} questions={orderedQuestions} onChange={(rule) => updatePage(page.id, { conditionalLogic: rule })} helper="This page appears only when the selected answer matches." disabled={pageIndex === 0} disabledReason="The first page always remains available so users can start the form." />
                <div className="forms-question-list">{pageQuestions.map((question, index) => <article className={`forms-question-card ${builderIssueIds.has(`question-${question.id}`) ? "has-error" : ""}`} key={question.id} data-builder-field={`question-${question.id}`} draggable onDragStart={() => setDraggedIndex({ pageId: page.id, index })} onDragOver={(event) => event.preventDefault()} onDrop={() => dropQuestion(page.id, index)}>
                  <div className="forms-question-card-topline"><span className="forms-drag-handle" title="Drag to reorder"><GripVertical size={20} /></span><span className="forms-question-number">Question {index + 1}</span><div className="forms-question-icon-actions"><button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveQuestion(page.id, index, -1)}><ArrowUp size={16} /></button><button type="button" className="icon-button" title="Move down" disabled={index === pageQuestions.length - 1} onClick={() => moveQuestion(page.id, index, 1)}><ArrowDown size={16} /></button><button type="button" className="icon-button" title="Duplicate" onClick={() => duplicateQuestion(page.id, index)}><Copy size={16} /></button><button type="button" className="icon-button danger-action" title="Delete" onClick={() => deleteQuestion(question.id)} disabled={schemaJson.questions.length === 1}><Trash2 size={16} /></button></div></div>
                  <div className="forms-question-header"><label>Question<input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} placeholder="Write the question" />{builderIssueIds.has(`question-${question.id}`) && <small className="forms-field-error">Question text is required before posting.</small>}</label><label>Answer type<select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value, options: optionQuestionTypes.has(event.target.value) ? (question.options.length ? question.options : ["Option 1"]) : [] })}>{formQuestionTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Page<select value={question.pageId} onChange={(event) => updateQuestion(question.id, { pageId: event.target.value, order: getQuestionsForPage(schemaJson, event.target.value).length })}>{schemaJson.pages.map((schemaPage) => <option key={schemaPage.id} value={schemaPage.id}>{schemaPage.title || `Page ${schemaPage.order + 1}`}</option>)}</select></label></div>
                  <details className="forms-question-advanced">
                    <summary>Question guidance and placeholder</summary>
                    <div className="forms-question-support-grid">
                      <label>Description<textarea value={question.description} onChange={(event) => updateQuestion(question.id, { description: event.target.value })} placeholder="Optional context shown under the question title" /></label>
                      <label>Helper text<input value={question.helperText} onChange={(event) => updateQuestion(question.id, { helperText: event.target.value })} placeholder="Example: Use numbers only" /></label>
                      <label>Placeholder<input value={question.placeholder} onChange={(event) => updateQuestion(question.id, { placeholder: event.target.value })} placeholder="Example answer or input hint" /></label>
                    </div>
                  </details>
                  {optionQuestionTypes.has(question.type) && <div className="forms-options-editor">{question.options.map((option, optionIndex) => <div key={`${question.id}-${optionIndex}`}><span>{optionIndex + 1}</span><input value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((item, idx) => idx === optionIndex ? event.target.value : item) })} /><button type="button" className="icon-button" onClick={() => updateQuestion(question.id, { options: question.options.filter((_, idx) => idx !== optionIndex) })}><Trash2 size={15} /></button></div>)}<button type="button" className="inline-action" onClick={() => updateQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}>Add option</button></div>}
                  <ConditionalLogicEditor label="Show this question when..." item={question} questions={orderedQuestions} onChange={(rule) => updateQuestion(question.id, { conditionalLogic: rule })} />
                  <label className="toggle-row"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />Required when visible</label>
                </article>)}</div>
                <div className="forms-add-question-row"><select value={addQuestionType} onChange={(event) => setAddQuestionType(event.target.value)}>{formQuestionTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button type="button" className="primary-action" onClick={() => addQuestionToPage(page.id)}><Plus size={17} />Add Question to {page.title}</button></div>
              </article>;
            })}</div>
            <button type="button" className="inline-action forms-add-page-button" onClick={addPage}><Plus size={17} />Add Page</button>
          </>}
        </div>}

        {step === 2 && <div className="forms-wizard-panel">
          <div className="forms-section-heading"><div><p className="eyebrow">Step 3</p><h2>Posting settings and review</h2></div></div>
          {canPostForms ? <div className="forms-posting-settings"><div className="inline-editor-grid"><label>Audience<select value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="all_chiefs">All chiefs</option><option value="groups">Selected groups</option></select></label><label>Due date<input type="date" value={dueDate ?? ""} onChange={(event) => setDueDate(event.target.value)} /></label><label>Linked calendar event<select value={linkedEventId ?? ""} onChange={(event) => setLinkedEventId(event.target.value)}><option value="">None</option>{(data.plannedEvents ?? []).map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label></div>
            {targetType === "groups" && <div className="forms-group-picker">{(data.groups ?? []).map((group) => <label key={group.id}><input type="checkbox" checked={targetGroupIds.includes(group.id)} onChange={(event) => setTargetGroupIds((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} />{group.name}</label>)}</div>}
            <label className="toggle-row"><input type="checkbox" checked={allowEdits} onChange={(event) => setAllowEdits(event.target.checked)} />Allow chiefs to edit submitted responses while open</label><label className="toggle-row forms-coming-soon-toggle"><input type="checkbox" checked={generateAiSummary} onChange={(event) => setGenerateAiSummary(event.target.checked)} />Generate AI summary <span>Coming Soon</span></label></div> : <p className="helper-text">Posting requires the Post Forms permission.</p>}
          <article className="forms-final-review"><div><p className="eyebrow">Final review</p><h3>{title || "Untitled form"}</h3><FormattedText text={description} fallback="No description provided." /></div><div className="forms-review-stat"><strong>{schemaJson.pages.length}</strong><span>Pages</span></div><div className="forms-review-stat"><strong>{schemaJson.questions.length}</strong><span>Questions</span></div><div className="forms-review-stat"><strong>{schemaJson.questions.filter((question) => question.required).length}</strong><span>Required</span></div></article>
          {builderIssues.length ? <article className="forms-review-warning forms-builder-review-warning"><strong>Fix before posting</strong>{builderIssues.map((issue) => <button type="button" key={issue.id} onClick={() => jumpToBuilderIssue(issue)}>{issue.label}: {issue.message}</button>)}</article> : <article className="forms-review-ready"><CheckCircle2 size={22} /><span>This form is ready to post.</span></article>}
        </div>}
      </section>
      <div className="forms-wizard-actions"><button type="button" className="inline-action" disabled={step === 0 || isSaving} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>{step < 2 ? <button type="button" className="primary-action" disabled={isSaving} onClick={() => setStep((current) => Math.min(2, current + 1))}>Next</button> : <div className="action-row">{canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("draft")}>Save Draft</button>}{canManageTemplates && <button type="button" className="inline-action" disabled={isSaving} onClick={() => saveTemplate("active")}>{template?.id ? "Save Template" : "Save as Template"}</button>}{canPostForms && <button type="button" className="inline-action forms-post-outline" disabled={isSaving} onClick={() => post(false)}>Post Form</button>}{canPostForms && canManageTemplates && <button type="button" className="primary-action" disabled={isSaving} onClick={() => post(true)}>Save and Post</button>}</div>}</div>
    </div>
  );
}
export default function FormsDashboard({ data, user, isAdmin, mode = "myForms", initialFormId = null, onRefresh, setSaveMessage, searchQuery = "" }) {
  const [view, setView] = useState(mode);
  const [builderTemplate, setBuilderTemplate] = useState(null);
  const [builderPostedForm, setBuilderPostedForm] = useState(null);
  const [activeFormId, setActiveFormId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(null);
  const [requiredErrors, setRequiredErrors] = useState([]);
  const [isReviewingForm, setIsReviewingForm] = useState(false);
  const [isFormStarted, setIsFormStarted] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(null);
  const [submissionFormFilter, setSubmissionFormFilter] = useState("all");
  const [submissionGroupFilter, setSubmissionGroupFilter] = useState("all");
  const [submissionDateFrom, setSubmissionDateFrom] = useState("");
  const [submissionDateTo, setSubmissionDateTo] = useState("");
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const progressTimerRef = useRef(null);
  const handledInitialFormIdRef = useRef(null);

  useEffect(() => {
    setActiveFormId(null);
    setRequiredErrors([]);
    setIsReviewingForm(false);
    setIsFormStarted(false);
    setSubmittedSuccess(null);
    setSubmitProgress(null);

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
  const templates = (data.formTemplates ?? []).filter((template) => matchesSearch(template, searchQuery, ["title", "description", "status", (item) => JSON.stringify(item.schemaJson ?? {})]));
  const postedForms = data.postedForms ?? [];
  const searchedPostedForms = postedForms.filter((form) => matchesSearch(form, searchQuery, ["title", "description", "approvalStatus", "targetType", "dueDate", (item) => JSON.stringify(item.schemaJson ?? {})]));
  const submissions = data.formSubmissions ?? [];
  const visiblePostedForms = canViewAllForms || canPostForms ? searchedPostedForms : searchedPostedForms.filter((form) => form.approvalStatus === "open" && isTargetedToUser(form, user));
  const mySubmissions = submissions.filter((submission) => submission.submittedBy === user?.id);
  const activeForm = postedForms.find((form) => form.id === activeFormId);
  useEffect(() => {
    if (!initialFormId) {
      handledInitialFormIdRef.current = null;
      return;
    }
    if (mode !== "myForms" || handledInitialFormIdRef.current === initialFormId) return;
    const requested = postedForms.find((form) => form.id === initialFormId);
    if (!requested || requested.approvalStatus !== "open" || !isTargetedToUser(requested, user)) return;
    const existing = submissions.find((submission) => submission.postedFormId === requested.id && submission.submittedBy === user?.id);
    if (activeFormId === requested.id) {
      handledInitialFormIdRef.current = initialFormId;
      return;
    }
    setView("myForms");
    setAnswers(existing?.answersJson ?? {});
    setRequiredErrors([]);
    setIsReviewingForm(false);
    setSubmittedSuccess(null);
    handledInitialFormIdRef.current = initialFormId;
    setActiveFormId(requested.id);
  }, [initialFormId, mode, postedForms, submissions, user, activeFormId]);
  const filteredSubmissions = useMemo(() => submissions.filter((submission) => {
    if (submissionFormFilter !== "all" && submission.postedFormId !== submissionFormFilter) return false;
    if (submissionGroupFilter !== "all" && submission.groupId !== submissionGroupFilter) return false;
    const value = submission.submittedAt || submission.updatedAt || submission.createdAt;
    if (submissionDateFrom && (!value || new Date(value) < new Date(`${submissionDateFrom}T00:00:00`))) return false;
    if (submissionDateTo && (!value || new Date(value) > new Date(`${submissionDateTo}T23:59:59`))) return false;
    const form = postedForms.find((item) => item.id === submission.postedFormId);
    const submitter = (data.users ?? []).find((item) => item.id === submission.submittedBy);
    if (!matchesSearch(submission, searchQuery, [
      "approvalStatus",
      "submittedAt",
      "updatedAt",
      "createdAt",
      (item) => form?.title,
      (item) => submitter?.name,
      (item) => submitter?.email,
      (item) => getGroupName(data.groups, item.groupId ?? submitter?.groupId),
      (item) => JSON.stringify(item.answersJson ?? {})
    ])) return false;
    return true;
  }), [data.groups, data.users, postedForms, searchQuery, submissions, submissionFormFilter, submissionGroupFilter, submissionDateFrom, submissionDateTo]);

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
    setIsReviewingForm(false);
    setIsFormStarted(false);
    setSubmittedSuccess(null);
    setActiveFormId(form.id);
  };

  const submitCurrentForm = async (status = "submitted", options = {}) => {
    if (!activeForm) return;
    const quiet = Boolean(options.quiet);
    const keepOpen = Boolean(options.keepOpen);
    const missing = getVisibleQuestions(activeForm.schemaJson, answers).filter((question) => {
      const answer = answers[question.id];
      return question.required && (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && !answer.length));
    });
    if (status === "submitted" && missing.length) {
      const ids = missing.map((question) => question.id);
      setRequiredErrors(ids);
      setSaveMessage("Complete the highlighted required questions.");
      window.requestAnimationFrame(() => document.querySelector(`[data-question-id="${ids[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setRequiredErrors([]);
    if (status === "submitted" && !options.confirmed) {
      setIsReviewingForm(true);
      return;
    }
    setIsSaving(true);
    if (!quiet) {
      setSubmitProgress({ percent: 15, label: status === "draft" ? "Saving draft..." : "Submitting form..." });
      setSaveMessage(status === "draft" ? "Saving draft..." : "Submitting form...");
    }
    try {
      if (!quiet) {
        setSubmitProgress({ percent: 48, label: "Saving answers securely..." });
        setSaveMessage("Saving answers securely...");
      }
      await saveDashboardFormSubmission({ postedFormId: activeForm.id, submittedBy: user.id, groupId: user.groupId, answersJson: answers, status });
      if (!quiet) {
        setSubmitProgress({ percent: 82, label: "Refreshing..." });
        setSaveMessage("Refreshing...");
      }
      await onRefresh();
      if (!quiet) setSubmitProgress({ percent: 100, label: "Complete" });
      if (status === "submitted") {
        setIsReviewingForm(false);
        setSubmittedSuccess({ title: activeForm.title, timestamp: new Date().toISOString(), locked: !activeForm.allowEdits });
      } else if (!keepOpen) {
        setActiveFormId(null);
      }
      if (!quiet) setSaveMessage(status === "draft" ? "Form draft saved." : "Form submitted.");
    } finally {
      window.clearTimeout(progressTimerRef.current);
      if (!quiet) progressTimerRef.current = window.setTimeout(() => setSubmitProgress(null), 700);
      setIsSaving(false);
    }
  };
  if (builderTemplate || builderPostedForm || view === "formsCreate") {
    return <FormBuilder data={data} user={user} isAdmin={isAdmin} canManageTemplates={canManageTemplates} canPostForms={canPostForms} template={builderTemplate} postedForm={builderPostedForm} onDone={closeBuilder} setSaveMessage={setSaveMessage} />;
  }

  if (activeForm) {
    const existing = submissions.find((submission) => submission.postedFormId === activeForm.id && submission.submittedBy === user?.id);
    const locked = activeForm.approvalStatus === "closed" || Boolean(existing?.lockedAt) || (existing?.approvalStatus === "submitted" && !activeForm.allowEdits);
    const stats = getFormStats(activeForm, answers);
    const assignedBy = getUserName(data.users ?? [], activeForm.createdBy ?? activeForm.submittedBy);
    const returnToForms = () => { setSubmittedSuccess(null); setIsReviewingForm(false); setIsFormStarted(false); setActiveFormId(null); };
    const saveDraftAndReturn = async () => {
      const hasDraftableAnswers = Object.values(answers).some(isAnswerFilled);
      if (!locked && activeForm && (hasDraftableAnswers || existing?.approvalStatus === "draft")) {
        try {
          await submitCurrentForm("draft", { quiet: true, keepOpen: true });
          setSaveMessage("Form draft saved.");
        } catch (error) {
          setSaveMessage(`Draft could not be saved: ${error.message}`);
        }
      }
      returnToForms();
    };

    if (submittedSuccess) {
      return createPortal(<div className="forms-fill-shell premium-completion-shell"><article className="forms-submission-success-card"><div className="forms-success-icon"><CheckCircle2 size={42} /></div><p className="eyebrow">Submission complete</p><h2>{submittedSuccess.title}</h2><p>Your response was submitted successfully and saved securely.</p><div className="premium-form-meta-grid"><span><CalendarDays size={16} />Submitted <strong>{formatDate(submittedSuccess.timestamp)}</strong></span><span><ShieldCheck size={16} />Editing <strong>{submittedSuccess.locked ? "Locked" : "Available while open"}</strong></span></div><button type="button" className="primary-action" onClick={returnToForms}>Return to My Forms</button></article></div>, document.body);
    }

    if (isReviewingForm) {
      return createPortal(<div className="forms-fill-shell premium-review-shell"><button type="button" className="inline-action premium-back-link" disabled={isSaving} onClick={saveDraftAndReturn}><ArrowLeft size={16} />Back to forms</button><article className="forms-review-experience"><div className="premium-form-kicker"><ShieldCheck size={18} /><span>Final review</span></div><h2>Review your answers before submitting</h2><p>Check the summary below. You can still go back and edit anything before final submission.</p><div className="forms-review-stats-grid compact"><div><strong>{stats.completed}</strong><span>Completed</span></div><div><strong>{stats.questions.length}</strong><span>Total questions</span></div><div><strong>{stats.missingRequired.length}</strong><span>Missing required</span></div></div>{stats.missingRequired.length ? <div className="forms-review-warning"><strong>Missing required answers</strong>{stats.missingRequired.map((question) => <button type="button" key={question.id} onClick={() => { setIsReviewingForm(false); setRequiredErrors(stats.missingRequired.map((item) => item.id)); window.requestAnimationFrame(() => document.querySelector(`[data-question-id="${question.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }}>{question.text}</button>)}</div> : <div className="forms-review-ready"><CheckCircle2 size={22} /><span>All required questions are complete.</span></div>}<FormReviewAnswerGroups form={activeForm} answers={answers} /><div className="forms-fill-actions premium-sticky-actions review"><button type="button" className="inline-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("draft")}><Save size={15} /><span className="form-action-full">{isSaving ? "Working..." : "Save Draft"}</span><span className="form-action-short">{isSaving ? "Saving" : "Save"}</span></button><button type="button" className="inline-action" onClick={() => setIsReviewingForm(false)}><ArrowLeft size={15} /><span className="form-action-full">Edit Answers</span><span className="form-action-short">Edit</span></button><button type="button" className="primary-action" disabled={isSaving || locked || Boolean(stats.missingRequired.length)} onClick={() => submitCurrentForm("submitted", { confirmed: true })}><Send size={17} /><span className="form-action-full">{isSaving ? "Submitting..." : "Submit Form"}</span><span className="form-action-short">{isSaving ? "Sending" : "Submit"}</span></button></div></article></div>, document.body);
    }

    return createPortal((
      <div className="forms-fill-shell premium-form-experience">
        <button type="button" className="inline-action premium-back-link" disabled={isSaving} onClick={saveDraftAndReturn}><ArrowLeft size={16} />Back to forms</button>
        <FormPreview form={activeForm} answers={answers} disabled={locked} errorQuestionIds={requiredErrors} meta={{ assignedBy, postedAt: activeForm.postedAt ?? activeForm.createdAt }} isStarted={isFormStarted} onStart={() => setIsFormStarted(true)} onAnswerChange={(questionId, value) => { setAnswers((current) => ({ ...current, [questionId]: value })); setRequiredErrors((current) => current.filter((id) => id !== questionId)); }} />
        {submitProgress && (
          <div className="upload-progress compact forms-submit-progress premium" aria-label={submitProgress.label}>
            <div><span style={{ width: `${submitProgress.percent}%` }} /></div>
            <strong>{submitProgress.percent}%</strong>
            <small>{submitProgress.label}</small>
          </div>
        )}
        {isFormStarted && <div className="forms-fill-actions premium-sticky-actions">
          <div><strong>{stats.percent}% complete</strong><span>{stats.completed} of {stats.questions.length} answered</span></div>
          <button type="button" className="inline-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("draft")}><Save size={17} /><span className="form-action-full">{isSaving ? "Working..." : "Save Draft"}</span><span className="form-action-short">{isSaving ? "Saving" : "Save"}</span></button>
          <button type="button" className="inline-action" disabled={isSaving} onClick={() => submitCurrentForm("submitted")}><ShieldCheck size={17} /><span className="form-action-full">Review Answers</span><span className="form-action-short">Review</span></button>
          <button type="button" className="primary-action" disabled={isSaving || locked} onClick={() => submitCurrentForm("submitted")}><Send size={17} /><span className="form-action-full">{isSaving ? "Submitting..." : existing?.approvalStatus === "submitted" ? "Update Response" : "Submit Form"}</span><span className="form-action-short">{isSaving ? "Sending" : existing?.approvalStatus === "submitted" ? "Update" : "Submit"}</span></button>
          {locked && <span className="helper-text">This form is locked because it is closed or editing is disabled.</span>}
        </div>}
      </div>
    ), document.body);
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
      {view === "formTemplates" && <div className="forms-management-grid">{templates.length ? templates.map((template) => <article className="forms-management-card" key={template.id}><div className="forms-card-heading"><FileText size={22} /><span className="forms-count-badge">{safeSchema(template.schemaJson).pages.length} pages / {getOrderedQuestions(template.schemaJson).length} questions</span></div><div><p className="eyebrow">{template.status}</p><h3>{template.title}</h3><FormattedText text={template.description} fallback="No description." /></div><small>Last edited {formatDate(template.updatedAt)}</small><div className="action-row"><button type="button" className="primary-action" onClick={() => { setBuilderTemplate(template); setView("formsCreate"); }}>Use Template</button><button type="button" className="inline-action" onClick={async () => { await saveDashboardFormTemplate({ title: `${template.title} copy`, description: template.description, schemaJson: template.schemaJson, status: "active" }); setSaveMessage("Template duplicated."); await onRefresh(); }}>Save as New Template</button><button type="button" className="icon-button danger-action" title="Delete template" onClick={async () => { if (window.confirm("Delete this reusable template? Posted forms using it will remain available.")) { await deleteDashboardFormTemplate(template.id); setSaveMessage("Form template deleted."); await onRefresh(); } }}><Trash2 size={17} /></button></div></article>) : <EmptyFormsState title="No templates yet" text="Create a reusable form template to start." />}</div>}
      {view === "postedForms" && <div className="forms-management-grid">{visiblePostedForms.length ? visiblePostedForms.map((form) => { const formSubmissions = submissions.filter((submission) => submission.postedFormId === form.id); const eligible = (data.users ?? []).filter((profile) => (profile.role === "chief" || profile.roles?.includes?.("chief") || profile.assignedGroupIds?.length || profile.coordinatorGroupIds?.length) && isTargetedToUser(form, profile)).length; return <article className="forms-management-card" key={form.id}><div className="forms-card-heading"><span className={`forms-status-pill ${form.approvalStatus}`}>{form.approvalStatus}</span><small>{form.targetType === "groups" ? form.targetGroupIds.map((id) => getGroupName(data.groups, id)).join(", ") : "All chiefs"}</small></div><div><h3>{form.title}</h3><p className="forms-response-count"><Users size={16} />{formSubmissions.length}{eligible ? ` of ${eligible}` : ""} responded</p><p className="helper-text"><CalendarDays size={15} />Due {formatDate(form.dueDate)}</p></div><div className="action-row"><button type="button" className="inline-action" onClick={() => setBuilderPostedForm(form)}>Edit copy</button><button type="button" className="inline-action" onClick={() => openForm(form)}>Preview</button>{form.approvalStatus === "open" ? <button type="button" className="inline-action" onClick={async () => { if (window.confirm("Close this form? Chiefs will no longer be able to submit or edit responses.")) { await closeDashboardPostedForm(form.id); setSaveMessage("Form closed. Exports are now available."); await onRefresh(); } }}>Close</button> : <button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={async () => { if (window.confirm("Reopen this form? Targeted chiefs will be able to submit or edit again.")) { await reopenDashboardPostedForm(form.id); setSaveMessage("Form reopened."); await onRefresh(); } }}>Reopen</button>}<button type="button" className="inline-action" disabled={form.approvalStatus !== "closed"} onClick={() => downloadCsv({ form, submissions: formSubmissions, users: data.users, groups: data.groups })}>Export CSV</button><button type="button" className="icon-button danger-action" title="Delete posted form" onClick={async () => { if (window.confirm("Permanently delete this posted form and all responses? Its reusable template will be preserved.")) { await deleteDashboardPostedForm(form.id); setSaveMessage("Posted form deleted."); await onRefresh(); } }}><Trash2 size={17} /></button></div></article>; }) : <EmptyFormsState title="No posted forms yet" text="Posted and pending forms will appear here." />}</div>}
      {view === "formResponses" && <div className="forms-submissions-view"><div className="forms-filter-bar"><label><Search size={16} /><select value={submissionFormFilter} onChange={(event) => setSubmissionFormFilter(event.target.value)}><option value="all">All forms</option>{postedForms.map((form) => <option value={form.id} key={form.id}>{form.title}</option>)}</select></label><label><Users size={16} /><select value={submissionGroupFilter} onChange={(event) => setSubmissionGroupFilter(event.target.value)}><option value="all">All groups</option>{(data.groups ?? []).map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label>Date from<input type="date" value={submissionDateFrom} onChange={(event) => setSubmissionDateFrom(event.target.value)} /></label><label>Date to<input type="date" value={submissionDateTo} onChange={(event) => setSubmissionDateTo(event.target.value)} /></label></div><div className="table-panel forms-submissions-table"><table className="editable-table"><thead><tr><th>Select</th><th>Form</th><th>Submitted by</th><th>Group</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{filteredSubmissions.length ? filteredSubmissions.map((submission) => { const form = postedForms.find((item) => item.id === submission.postedFormId); const submitter = (data.users ?? []).find((item) => item.id === submission.submittedBy); return <tr key={submission.id}><td><input type="checkbox" checked={selectedSubmissionIds.includes(submission.id)} onChange={(event) => setSelectedSubmissionIds((current) => event.target.checked ? [...current, submission.id] : current.filter((id) => id !== submission.id))} /></td><td>{form?.title ?? "Unknown form"}</td><td>{submitter?.name ?? "Unknown user"}</td><td>{getGroupName(data.groups, submission.groupId ?? submitter?.groupId)}</td><td><span className={`forms-status-pill ${submission.approvalStatus}`}>{submission.approvalStatus}</span></td><td>{formatDate(submission.submittedAt ?? submission.updatedAt)}</td></tr>; }) : <tr><td colSpan="6">No submissions match these filters.</td></tr>}</tbody></table></div><article className="forms-ai-summary-card"><div className="forms-section-heading"><div><p className="eyebrow">Response analysis</p><h3>AI Summary</h3></div><span className="forms-coming-soon-badge">Coming Soon</span></div><p>{selectedSubmissionIds.length ? `${selectedSubmissionIds.length} responses selected.` : "Select responses above to prepare a future summary."}</p><div className="forms-ai-sections">{aiSummarySections.map((section) => <span key={section}>{section}</span>)}</div><button type="button" className="primary-action" disabled>Generate AI Summary</button></article></div>}
      {view === "myForms" && <FormsList forms={searchedPostedForms.filter((form) => form.approvalStatus === "open" && isTargetedToUser(form, user) && !mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} submissions={mySubmissions} type="pending" onOpen={openForm} empty="No pending forms match this search." />}
      {view === "myFormDrafts" && <FormsList forms={searchedPostedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "draft"))} submissions={mySubmissions} type="draft" onOpen={openForm} empty="No saved form drafts match this search." />}
      {view === "mySubmittedForms" && <FormsList forms={searchedPostedForms.filter((form) => mySubmissions.some((submission) => submission.postedFormId === form.id && submission.approvalStatus === "submitted"))} submissions={mySubmissions} type="submitted" onOpen={openForm} empty="No submitted forms match this search." />}
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
