import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrandedLoader from "../components/BrandedLoader.jsx";
import scoutLogo from "../assets/smscouts_logo.png";
import { FormPreview, getVisibleQuestions } from "../features/forms/FormsDashboard.jsx";
import { validateEmailAnswer, validateExpectedAnswer, validatePhoneAnswer } from "../features/forms/formModel.js";
import { getRegistrationAvailability, normalizeUploadQuestion } from "../features/registration/registrationModel.js";
import { processRegistrationFile, releaseRegistrationPreview } from "../features/registration/registrationImageService.js";
import {
  clearRegistrationRecovery,
  getSerializableRegistrationAnswers,
  loadRegistrationRecovery,
  saveRegistrationRecovery
} from "../features/registration/registrationDraftRecovery.js";
import {
  getPublicRegistrationCampaign,
  loadRegistrationDraft,
  listPublicRegistrationCampaigns,
  saveRegistrationDraft,
  submitScoutRegistration
} from "../features/registration/registrationService.js";

function publicRegistrationErrorMessage(reason) {
  if (reason?.code === "PGRST202" || reason?.message?.includes("schema cache")) {
    return "Scout registration is not available yet. Please try again later.";
  }
  return reason?.message || "Scout registration could not be loaded. Please try again.";
}

function CampaignList() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listPublicRegistrationCampaigns().then(setCampaigns).catch((reason) => {
      console.error("Registration campaigns could not be loaded:", reason);
      setError(publicRegistrationErrorMessage(reason));
    });
  }, []);
  if (!campaigns && !error) return <BrandedLoader label="Loading registrations" />;
  return <main className="registration-public-page"><section className="registration-public-shell"><header className="registration-public-heading"><p className="eyebrow">Public registration</p><h1>Available registrations</h1><p>Choose an open registration form to continue.</p></header>{error && <p className="registration-load-error" role="alert">{error}</p>}<div className="registration-campaign-list">{campaigns?.map((campaign) => <Link key={campaign.slug} to={`/register/${campaign.slug}`}><CalendarDays /><div><strong>{campaign.title}</strong><span>{campaign.status}</span></div></Link>)}{campaigns?.length === 0 && <p className="empty-state">No public registration forms are open right now.</p>}</div></section></main>;
}

export default function ScoutRegistrationPage() {
  const { campaignSlug } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [path, setPath] = useState("");
  const [step, setStep] = useState("questions");
  const [answers, setAnswers] = useState({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [website, setWebsite] = useState("");
  const [draftToken, setDraftToken] = useState(() => window.sessionStorage.getItem(`registration-draft:${campaignSlug}`) ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [questionErrors, setQuestionErrors] = useState([]);
  const [formStarted, setFormStarted] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [lastQuestionPageId, setLastQuestionPageId] = useState("");

  useEffect(() => {
    if (!campaignSlug) return;
    getPublicRegistrationCampaign(campaignSlug).then(setCampaign).catch((reason) => {
      console.error("Registration campaign could not be loaded:", reason);
      setError(publicRegistrationErrorMessage(reason));
    });
  }, [campaignSlug]);

  useEffect(() => {
    if (!campaign || !campaignSlug) return undefined;
    let active = true;
    loadRegistrationRecovery(campaignSlug).then((recovery) => {
      if (!active || !recovery) return;
      setPath(recovery.path || "");
      setAnswers(recovery.answers ?? {});
      setFormStarted(Boolean(recovery.formStarted));
      if (Object.keys(recovery.answers ?? {}).length) {
        setRecoveryNotice("Your saved answers and uploads were restored on this device.");
      }
    }).finally(() => {
      if (active) setRecoveryChecked(true);
    });
    return () => {
      active = false;
    };
  }, [campaign, campaignSlug]);

  useEffect(() => {
    if (!campaign || !draftToken || !recoveryChecked) return;
    loadRegistrationDraft({ slug: campaignSlug, resumeToken: draftToken }).then((draft) => {
      if (!draft?.payload) return;
      setPath((current) => current || draft.registrationPath || "");
      setAnswers((current) => ({ ...(draft.payload.answers ?? {}), ...current }));
      setStep("questions");
    }).catch(() => {
      window.sessionStorage.removeItem(`registration-draft:${campaignSlug}`);
      setDraftToken("");
    });
  }, [campaign, campaignSlug, draftToken, recoveryChecked]);

  useEffect(() => {
    if (!campaign || !campaignSlug || !recoveryChecked || !path || step === "complete") return undefined;
    const timeout = window.setTimeout(() => {
      saveRegistrationRecovery(campaignSlug, { answers, path, formStarted }).catch(() => {});
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [answers, campaign, campaignSlug, formStarted, path, recoveryChecked, step]);

  useEffect(() => {
    if (!campaign?.settings.allowDrafts || !path || step === "complete") return undefined;
    const timeout = window.setTimeout(() => {
      saveRegistrationDraft({
        slug: campaignSlug,
        resumeToken: draftToken || undefined,
        registrationPath: path,
        payload: { answers: getSerializableRegistrationAnswers(answers) }
      }).then((saved) => {
        if (saved?.resumeToken) {
          setDraftToken(saved.resumeToken);
          window.sessionStorage.setItem(`registration-draft:${campaignSlug}`, saved.resumeToken);
        }
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [answers, campaign?.settings.allowDrafts, campaignSlug, draftToken, path, step]);

  useEffect(() => {
    const hasProgress = Object.values(answers).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? "").trim());
    if (!hasProgress || step === "complete") return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [answers, step]);

  const newAvailability = useMemo(() => campaign ? getRegistrationAvailability(campaign.settings, "new") : null, [campaign]);
  useEffect(() => {
    if (!campaign || !recoveryChecked || path) return;
    const nextPath = ["open", "waitlist"].includes(newAvailability?.state) ? "new" : "returning";
    setPath(nextPath);
    setStep("questions");
    setFormStarted(campaign.form?.schemaJson?.settings?.startScreen?.enabled === false);
  }, [campaign, newAvailability, path, recoveryChecked]);

  if (!campaignSlug) return <CampaignList />;
  if (!campaign && !error) return <BrandedLoader label="Loading registration" />;
  if (!campaign) return <main className="registration-public-page"><section className="registration-public-shell"><p className="form-error">{error}</p><Link className="inline-action" to="/register">View registrations</Link></section></main>;

  const submit = async () => {
    if (!consentAccepted || !signerName.trim()) return setError("Consent and the signer name are required.");
    setIsBusy(true);
    setError("");
    const processed = [];
    try {
      const serializableAnswers = { ...answers };
      for (const question of campaign.form.schemaJson?.questions ?? []) {
        const files = Array.isArray(answers[question.id]) ? answers[question.id].filter((item) => item instanceof File) : [];
        if (!files.length) continue;
        const uploadSettings = normalizeUploadQuestion(question);
        const uploadedNames = [];
        for (const file of files) {
          const item = await processRegistrationFile(file, uploadSettings);
          processed.push(item);
          uploadedNames.push(item.file.name);
          processed[processed.length - 1] = { ...item, questionId: question.id, documentType: uploadSettings.storageCategory };
        }
        serializableAnswers[question.id] = uploadedNames;
      }
      const response = await submitScoutRegistration({
        slug: campaignSlug,
        path,
        payload: {
          answers: serializableAnswers,
          resumeToken: draftToken || null,
          sourceSnapshot: {
            form: {
              id: campaign.form.id,
              title: campaign.form.title,
              description: campaign.form.description,
              instructions: campaign.form.instructions,
              schemaJson: campaign.form.schemaJson
            }
          }
        },
        consent: { accepted: true, signerName, relationship: "applicant", version: "1" },
        honeypot: website,
        files: processed.map((item) => ({ questionId: item.questionId, documentType: item.documentType, file: item.file }))
      });
      processed.forEach(releaseRegistrationPreview);
      window.sessionStorage.removeItem(`registration-draft:${campaignSlug}`);
      await clearRegistrationRecovery(campaignSlug);
      setResult(response);
      setStep("complete");
    } catch (reason) {
      processed.forEach(releaseRegistrationPreview);
      setError(reason.message);
    } finally {
      setIsBusy(false);
    }
  };

  const continueToConsent = () => {
    const visibleQuestions = getVisibleQuestions(campaign.form.schemaJson, answers);
    const missing = visibleQuestions.filter((question) => {
      if (question.type === "phone") return Boolean(validatePhoneAnswer(question, answers[question.id]));
      if (question.type === "email") return Boolean(validateEmailAnswer(question, answers[question.id]));
      if (validateExpectedAnswer(question, answers[question.id])) return true;
      if (!question.required) return false;
      const answer = answers[question.id];
      if (Array.isArray(answer)) return answer.length === 0;
      return answer == null || String(answer).trim() === "";
    });
    if (missing.length) {
      setQuestionErrors(missing.map((question) => question.id));
      setError(`Complete ${missing.length} required ${missing.length === 1 ? "question" : "questions"} before review.`);
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-question-id="${missing[0].id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setQuestionErrors([]);
    setError("");
    setStep("consent");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmRegistrationExit = async (destination) => {
    const hasProgress = Object.values(answers).some((value) => Array.isArray(value) ? value.length > 0 : String(value ?? "").trim());
    if (hasProgress && !window.confirm("Exit this registration? Your saved answers and uploads on this device will be removed.")) return;
    await clearRegistrationRecovery(campaignSlug);
    window.sessionStorage.removeItem(`registration-draft:${campaignSlug}`);
    navigate(destination);
  };

  const updateAnswer = (id, value) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setQuestionErrors((current) => current.filter((questionId) => questionId !== id));
    setRecoveryNotice("");
  };

  return (
    <>
    <header className="registration-form-topbar">
      <button type="button" className="registration-form-brand" onClick={() => confirmRegistrationExit("/")}>
        <img src={scoutLogo} alt="" />
        <strong>St. Mary&apos;s Scouts</strong>
      </button>
    </header>
    <main className="registration-public-page registration-form-page">
      <section className="registration-public-shell">
        <header className="registration-public-heading">
          <button type="button" className="registration-back-link" onClick={() => confirmRegistrationExit("/register")}><ArrowLeft size={18} /> Registrations</button>
          <p className="eyebrow">St. Mary&apos;s Scouts Dubai</p>
          <h1>{campaign.title}</h1>
          <div className="registration-trust-row"><span><ShieldCheck />Private by default</span><span><FileCheck2 />Secure documents</span><span><Users />Leader reviewed</span></div>
        </header>
        {recoveryNotice && <p className="registration-recovery-notice" role="status"><CheckCircle2 size={17} />{recoveryNotice}</p>}
        {error && <p className="form-error registration-public-error">{error}</p>}

        {step === "questions" && <section className="registration-form-stage"><FormPreview form={campaign.form} answers={answers} errorQuestionIds={questionErrors} onAnswerChange={updateAnswer} showHeader embeddedHeader publicMode isStarted={formStarted} onStart={() => setFormStarted(true)} initialPageId={lastQuestionPageId} onPageStateChange={({ currentPageId }) => setLastQuestionPageId(currentPageId)} finalPageAction={formStarted ? { label: "Review and consent", onClick: continueToConsent } : null} /></section>}

        {step === "consent" && <section className="registration-step-card"><p className="eyebrow">Review and consent</p><h2>Confirm this registration</h2><div className="registration-privacy-copy"><ShieldCheck /><div><strong>Privacy notice</strong><p>{campaign.settings.privacyText}</p><strong>Retention</strong><p>{campaign.settings.retentionText}</p></div></div><label>Signer full name<input value={signerName} onChange={(event) => setSignerName(event.target.value)} /></label><label className="registration-honeypot" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label><label className="toggle-row registration-consent"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />{campaign.settings.consentText}</label><div className="registration-stage-actions"><button type="button" className="inline-action" onClick={() => setStep("questions")}>Back</button><button type="button" className="primary-action" disabled={isBusy || !path} onClick={submit}>{isBusy ? "Submitting securely..." : "Submit registration"}</button></div></section>}

        {step === "complete" && <section className="registration-complete-card"><CheckCircle2 /><p className="eyebrow">Registration received</p><h2>Thank you</h2><p>Your reference is <strong>{result?.referenceNumber}</strong>.</p><span><Clock />Status: {result?.status?.replaceAll("_", " ")}</span>{result?.emailDelivery?.status === "failed" && <p className="status-message error">Your registration was saved, but the response email could not be sent.</p>}<Link className="primary-action" to="/">Return to website</Link></section>}
      </section>
    </main>
    </>
  );
}
