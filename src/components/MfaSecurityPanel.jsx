import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  challengeAndVerifyMfa,
  enrollTotpMfa,
  getMfaStatus,
  removeMfaFactor
} from "../services/authService.js";
import { toMfaQrImageSource } from "../utils/mfaQr.js";

export default function MfaSecurityPanel({ onSessionUpgraded }) {
  const [status, setStatus] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(true);

  const loadStatus = useCallback(async () => {
    setIsBusy(true);
    setError("");
    try {
      setStatus(await getMfaStatus());
    } catch (nextError) {
      setError(nextError.message || "MFA status could not be loaded.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const activeFactor = useMemo(
    () => status?.verifiedFactors?.[0] ?? enrollment ?? null,
    [enrollment, status]
  );

  const beginEnrollment = async () => {
    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      const latestStatus = await getMfaStatus();
      const unfinishedFactors = latestStatus.factors.filter((factor) => factor.status !== "verified");
      await Promise.all(unfinishedFactors.map((factor) => removeMfaFactor(factor.id).catch(() => null)));
      const nextEnrollment = await enrollTotpMfa();
      setEnrollment(nextEnrollment);
      setCode("");
    } catch (nextError) {
      setError(nextError.message || "Authenticator setup could not be started.");
    } finally {
      setIsBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      await challengeAndVerifyMfa(activeFactor?.id, code);
      setEnrollment(null);
      setCode("");
      setMessage("This session is MFA verified. High-risk account actions are now unlocked.");
      await loadStatus();
      onSessionUpgraded?.();
    } catch (nextError) {
      setError(nextError.message || "The authenticator code could not be verified.");
      setIsBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (enrollment?.id) {
      await removeMfaFactor(enrollment.id).catch(() => null);
    }
    setEnrollment(null);
    setCode("");
    setError("");
    await loadStatus();
  };

  if (isBusy && !status && !enrollment) {
    return <div className="mfa-security-loading"><LoaderCircle className="spin" size={20} aria-hidden="true" /> Loading security status...</div>;
  }

  const isVerifiedSession = status?.currentLevel === "aal2";
  const hasVerifiedFactor = Boolean(status?.verifiedFactors?.length);

  return (
    <section className="mfa-security-panel" aria-labelledby="mfa-security-title">
      <div className="mfa-security-heading">
        <span className="mfa-security-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
        <div>
          <h3 id="mfa-security-title">Authenticator security</h3>
          <p>Use a time-based code from Google Authenticator, Microsoft Authenticator, Authy, or a compatible app.</p>
        </div>
      </div>

      {error && <p className="mfa-security-error" role="alert">{error}</p>}
      {message && <p className="mfa-security-success" role="status"><CheckCircle2 size={17} aria-hidden="true" /> {message}</p>}

      {isVerifiedSession && !enrollment ? (
        <div className="mfa-security-state success">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div><strong>MFA verified for this session</strong><span>You can now retry the protected People &amp; Access action.</span></div>
        </div>
      ) : enrollment ? (
        <div className="mfa-enrollment-flow">
          <ol className="mfa-steps">
            <li><strong>Scan the QR code</strong><span>Open your authenticator app and add a new account.</span></li>
            <li><strong>Enter its 6-digit code</strong><span>The code changes about every 30 seconds.</span></li>
          </ol>
          {toMfaQrImageSource(enrollment.totp?.qr_code) ? (
            <div className="mfa-qr-wrap">
              <img src={toMfaQrImageSource(enrollment.totp.qr_code)} alt="QR code for authenticator setup" />
            </div>
          ) : (
            <p className="error-text">The QR image could not be rendered. Use the manual secret below.</p>
          )}
          <div className="mfa-manual-secret">
            <span>Manual secret</span>
            <code>{enrollment.totp?.secret}</code>
          </div>
          <form className="mfa-code-form" onSubmit={verify}>
            <label htmlFor="mfa-enrollment-code">Authenticator code</label>
            <input id="mfa-enrollment-code" inputMode="numeric" autoComplete="one-time-code" maxLength="6" pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            <div className="action-row">
              <button type="button" className="inline-action" onClick={cancelEnrollment} disabled={isBusy}>Cancel</button>
              <button type="submit" className="primary-action" disabled={isBusy || code.length !== 6}>{isBusy ? "Verifying..." : "Enable MFA"}</button>
            </div>
          </form>
        </div>
      ) : hasVerifiedFactor ? (
        <form className="mfa-code-form" onSubmit={verify}>
          <div className="mfa-security-state">
            <KeyRound size={20} aria-hidden="true" />
            <div><strong>MFA is enabled</strong><span>Verify this session before changing roles, deleting users, or resetting passwords.</span></div>
          </div>
          <label htmlFor="mfa-session-code">Authenticator code</label>
          <input id="mfa-session-code" inputMode="numeric" autoComplete="one-time-code" maxLength="6" pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button type="submit" className="primary-action" disabled={isBusy || code.length !== 6}>{isBusy ? "Verifying..." : "Verify this session"}</button>
        </form>
      ) : (
        <div className="mfa-security-state">
          <KeyRound size={20} aria-hidden="true" />
          <div><strong>MFA is not enabled</strong><span>Set it up once, then use a current code whenever a high-risk action requires it.</span></div>
          <button type="button" className="primary-action" onClick={beginEnrollment} disabled={isBusy}>Set up authenticator</button>
        </div>
      )}
    </section>
  );
}
