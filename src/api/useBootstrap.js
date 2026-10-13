import { useEffect, useRef, useState } from "react";
import { getBootstrap, loadingData } from "./client.js";
import { normalizeBootstrapData } from "./bootstrapData.js";
import { notifySiteLoadError } from "../services/siteErrorService.js";
import { getCurrentSupabaseUserId } from "../services/supabaseClient.js";

let cachedBootstrap = null;
let cachedBootstrapUserId = null;
let inFlightBootstrap = null;
let inFlightBootstrapUserId = null;
let bootstrapRequestGeneration = 0;
let latestBootstrapRequest = null;

function currentCache() {
  const userId = getCurrentSupabaseUserId();
  if (!userId || cachedBootstrapUserId !== userId) return null;
  return cachedBootstrap;
}

function isCurrentBootstrapRequest(generation, userId) {
  return generation === bootstrapRequestGeneration && userId === getCurrentSupabaseUserId();
}

function loadBootstrap({ force = false, requireAttendance = false } = {}) {
  const userId = getCurrentSupabaseUserId();
  if (!force && currentCache()) {
    return Promise.resolve(cachedBootstrap);
  }

  if (!force && inFlightBootstrap && inFlightBootstrapUserId === userId) {
    return inFlightBootstrap;
  }

  console.debug("[dashboard] bootstrap fetch start", { force });

  const generation = ++bootstrapRequestGeneration;
  const previousRequest = latestBootstrapRequest;
  let supersede;
  const superseded = new Promise((resolve) => { supersede = resolve; });
  inFlightBootstrapUserId = userId;
  const request = getBootstrap({ requireAttendance: requireAttendance === true })
    .then((nextData) => {
      const safeData = normalizeBootstrapData(nextData, loadingData);
      if (isCurrentBootstrapRequest(generation, userId)) {
        cachedBootstrap = safeData;
        cachedBootstrapUserId = userId;
      }
      console.debug("[dashboard] bootstrap fetch complete");
      return safeData;
    })
    .catch((error) => {
      if (isCurrentBootstrapRequest(generation, userId)) {
        console.error("[dashboard] bootstrap fetch failed", error);
        notifySiteLoadError(error, { source: "dashboard-bootstrap" });
      }
      throw error;
    })
    .finally(() => {
      if (inFlightBootstrap === request) {
        inFlightBootstrap = null;
        inFlightBootstrapUserId = null;
      }
    });
  inFlightBootstrap = request;
  latestBootstrapRequest = { generation, userId, promise: request, superseded, supersede };
  previousRequest?.supersede();

  return request;
}

export function useBootstrap() {
  const safeCachedBootstrap = currentCache();
  const [data, setData] = useState(safeCachedBootstrap ?? loadingData);
  const [isLoading, setIsLoading] = useState(!safeCachedBootstrap);
  const [error, setError] = useState(null);
  const refreshGenerationRef = useRef(0);
  const isActiveRef = useRef(true);

  const ownsHook = (hookGeneration, userId) => isActiveRef.current && hookGeneration === refreshGenerationRef.current && userId === getCurrentSupabaseUserId();

  async function settleCanonicalLoad(request, userId, hookGeneration, isCancelled = () => false) {
    while (ownsHook(hookGeneration, userId) && !isCancelled()) {
      const outcome = await Promise.race([
        request.promise.then((nextData) => ({ data: nextData }), (nextError) => ({ error: nextError })),
        request.superseded.then(() => ({ superseded: true }))
      ]);
      if (!ownsHook(hookGeneration, userId) || isCancelled()) return;
      if ("superseded" in outcome || request.generation !== bootstrapRequestGeneration) {
        // A newer same-user request owns the shared cache and rendered state.
        if (latestBootstrapRequest?.userId !== userId) return;
        request = latestBootstrapRequest;
        continue;
      }
      if ("error" in outcome) {
        setError(outcome.error);
      } else {
        setData(outcome.data);
        setError(null);
      }
      setIsLoading(false);
      return;
    }
  }

  async function refresh(options = {}) {
    const hookGeneration = ++refreshGenerationRef.current;
    const userId = getCurrentSupabaseUserId();
    let generation;
    const isCurrent = () => ownsHook(hookGeneration, userId) && isCurrentBootstrapRequest(generation, userId);
    setError(null);
    try {
      const request = loadBootstrap({ force: true, requireAttendance: options?.requireAttendance === true });
      generation = bootstrapRequestGeneration;
      // Observe supersession immediately, even if this caller's own request
      // remains pending. Its original await/return/rejection contract stays intact.
      settleCanonicalLoad(latestBootstrapRequest, userId, hookGeneration);
      const nextData = await request;
      if (isCurrent()) setData(nextData);
      return nextData;
    } catch (nextError) {
      if (isCurrent()) setError(nextError);
      if (options?.throwOnError === true) throw nextError;
      return data;
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    isActiveRef.current = true;
    const userId = getCurrentSupabaseUserId();
    const hookGeneration = refreshGenerationRef.current;
    const cleanup = () => {
      cancelled = true;
      isActiveRef.current = false;
    };

    // A refresh started before the initial effect already owns this hook's state.
    if (hookGeneration !== 0) return cleanup;

    const safeCache = currentCache();
    if (safeCache) {
      setData(safeCache);
      setIsLoading(false);
      setError(null);
      return cleanup;
    }

    loadBootstrap();
    settleCanonicalLoad(latestBootstrapRequest, userId, hookGeneration, () => cancelled);

    return cleanup;
  }, []);

  return { data, isLoading, error, refresh };
}
