import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);
const icons = {
  error: XCircle,
  info: Info,
  success: CheckCircle2
};

function inferToastVariant(message) {
  const text = String(message ?? "").toLowerCase();
  if (["failed", "error", "unable", "could not", "please", "choose", "select", "only"].some((word) => text.includes(word))) {
    return "error";
  }
  if (["saving", "uploading", "optimizing", "deleting", "loading"].some((word) => text.includes(word))) {
    return "info";
  }
  return "success";
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    if (!message) return null;

    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const variant = options.variant ?? inferToastVariant(message);
    const toast = { id, message, variant };

    setToasts((current) => [...current.slice(-3), toast]);
    window.setTimeout(() => dismissToast(id), options.duration ?? 3800);
    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const Icon = icons[toast.variant] ?? Info;
          return (
            <div className={`toast-message ${toast.variant}`} key={toast.id}>
              <Icon size={18} aria-hidden="true" />
              <span>{toast.message}</span>
              <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}