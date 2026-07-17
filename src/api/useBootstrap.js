import { useEffect, useState } from "react";
import { getBootstrap, loadingData } from "./client.js";
import { normalizeBootstrapData } from "./bootstrapData.js";
import { notifySiteLoadError } from "../services/siteErrorService.js";
import { getCurrentSupabaseUserId } from "../services/supabaseClient.js";

let cachedBootstrap = null;
let cachedBootstrapUserId = null;
let inFlightBootstrap = null;
let inFlightBootstrapUserId = null;

function currentCache() {
  const userId = getCurrentSupabaseUserId();
  if (!userId || cachedBootstrapUserId !== userId) return null;
  return cachedBootstrap;
}

function loadBootstrap({ force = false } = {}) {
  const userId = getCurrentSupabaseUserId();
  if (!force && currentCache()) {
    return Promise.resolve(cachedBootstrap);
  }

  if (!force && inFlightBootstrap && inFlightBootstrapUserId === userId) {
    return inFlightBootstrap;
  }

  console.debug("[dashboard] bootstrap fetch start", { force });

  inFlightBootstrapUserId = userId;
  const request = getBootstrap()
    .then((nextData) => {
      const safeData = normalizeBootstrapData(nextData, loadingData);
      cachedBootstrap = safeData;
      cachedBootstrapUserId = userId;
      console.debug("[dashboard] bootstrap fetch complete");
      return safeData;
    })
    .catch((error) => {
      console.error("[dashboard] bootstrap fetch failed", error);
      notifySiteLoadError(error, { source: "dashboard-bootstrap" });
      throw error;
    })
    .finally(() => {
      if (inFlightBootstrap === request) {
        inFlightBootstrap = null;
        inFlightBootstrapUserId = null;
      }
    });
  inFlightBootstrap = request;

  return request;
}

export function useBootstrap() {
  const safeCachedBootstrap = currentCache();
  const [data, setData] = useState(safeCachedBootstrap ?? loadingData);
  const [isLoading, setIsLoading] = useState(!safeCachedBootstrap);
  const [error, setError] = useState(null);

  async function refresh() {
    setError(null);
    try {
      const nextData = await loadBootstrap({ force: true });
      setData(nextData);
      return nextData;
    } catch (nextError) {
      setError(nextError);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const safeCache = currentCache();
    if (safeCache) {
      setData(safeCache);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    loadBootstrap()
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error, refresh };
}
