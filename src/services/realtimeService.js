import { isSupabaseConfigured } from "./supabaseClient.js";

export function subscribeDashboardRealtime(onRefresh, options = {}) {
  const intervalMs = options.intervalMs ?? (isSupabaseConfigured ? 12000 : 30000);
  let lastRefresh = 0;

  const refresh = (reason) => {
    const now = Date.now();

    if (now - lastRefresh < 2500) {
      return;
    }

    lastRefresh = now;
    onRefresh(reason);
  };

  const interval = window.setInterval(() => refresh("interval"), intervalMs);
  const handleFocus = () => refresh("focus");
  const handleVisibility = () => {
    if (!document.hidden) {
      refresh("visible");
    }
  };

  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
