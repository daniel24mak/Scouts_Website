import { useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { getErrorSignature, siteLoadErrorEvent } from "../services/siteErrorService.js";

const reloadStorageKey = "scouts-site-recovery-attempts";
const maxAutoReloads = 2;

function readReloadAttempts() {
  try {
    return JSON.parse(window.sessionStorage.getItem(reloadStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writeReloadAttempts(attempts) {
  window.sessionStorage.setItem(reloadStorageKey, JSON.stringify(attempts));
}

export function clearRecoveryReloads() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(reloadStorageKey);
}

export function reloadWithRecoveryLimit(error, source = "client") {
  if (typeof window === "undefined") return false;

  const signature = getErrorSignature(error, source);
  const attempts = readReloadAttempts();
  const currentAttempts = attempts[signature] || 0;

  if (currentAttempts >= maxAutoReloads) {
    return false;
  }

  attempts[signature] = currentAttempts + 1;
  writeReloadAttempts(attempts);
  window.location.reload();
  return true;
}

export default function SiteRecoveryPrompt() {
  const [recoveryError, setRecoveryError] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [isAutoReloading, setIsAutoReloading] = useState(false);

  useEffect(() => {
    const handleLoadError = (event) => {
      setDismissed(false);
      setIsAutoReloading(false);
      setRecoveryError(event.detail || { message: "Some page content could not be loaded." });
    };

    window.addEventListener(siteLoadErrorEvent, handleLoadError);
    return () => window.removeEventListener(siteLoadErrorEvent, handleLoadError);
  }, []);

  useEffect(() => {
    if (!recoveryError) return undefined;

    const reloadTimer = window.setTimeout(() => {
      const reloading = reloadWithRecoveryLimit(recoveryError.error || recoveryError.message, recoveryError.source || "client");
      if (reloading) {
        setIsAutoReloading(true);
      }
    }, 1800);

    return () => window.clearTimeout(reloadTimer);
  }, [recoveryError]);

  const message = useMemo(() => (
    recoveryError?.message || recoveryError?.error?.message || "Some page content could not be loaded."
  ), [recoveryError]);

  if (!recoveryError || dismissed) return null;

  return (
    <aside className="site-recovery-prompt" role="alert" aria-live="assertive">
      <div className="site-recovery-card">
        <button
          type="button"
          className="site-recovery-close"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss loading message"
        >
          <X size={18} />
        </button>
        <p className="eyebrow">Page not loading properly?</p>
        <h2>Reload this page</h2>
        <p>{isAutoReloading ? "Trying to reload automatically..." : message}</p>
        <button type="button" className="primary-action" onClick={() => window.location.reload()}>
          <RefreshCw size={18} />
          Reload page
        </button>
      </div>
    </aside>
  );
}
