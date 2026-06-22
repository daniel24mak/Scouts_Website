import { insertSupabaseRow, isSupabaseConfigured } from "./supabaseClient.js";

const maxTextLength = 4000;
const siteLoadErrorEvent = "scouts:site-load-error";

function limitText(value) {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, maxTextLength);
}

function serializeError(error) {
  return {
    message: limitText(error?.message || error || "Unknown site error"),
    stack: limitText(error?.stack || ""),
    name: limitText(error?.name || "")
  };
}

export function getErrorSignature(error, source = "client") {
  const serialized = serializeError(error);
  return `${source}:${serialized.name}:${serialized.message}`.slice(0, 240);
}

export async function logSiteError(error, context = {}) {
  if (!isSupabaseConfigured) return null;

  const serialized = serializeError(error);
  const row = {
    message: serialized.message,
    stack: serialized.stack,
    source: limitText(context.source || "client"),
    page_url: typeof window !== "undefined" ? limitText(window.location.href) : "",
    user_agent: typeof navigator !== "undefined" ? limitText(navigator.userAgent) : "",
    metadata: {
      ...(context.metadata || {}),
      errorName: serialized.name
    }
  };

  try {
    return await insertSupabaseRow("site_error_messages", row);
  } catch (loggingError) {
    console.warn("[site-error-log] Failed to save site error", loggingError);
    return null;
  }
}

export function notifySiteLoadError(error, context = {}) {
  logSiteError(error, context);

  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(siteLoadErrorEvent, {
    detail: {
      error,
      source: context.source || "client",
      message: error?.message || "Some page content could not be loaded."
    }
  }));
}

export { siteLoadErrorEvent };
