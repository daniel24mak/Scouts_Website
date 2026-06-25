import { useEffect, useMemo, useState } from "react";
import { clearRecoveryReloads } from "../components/SiteRecoveryPrompt.jsx";
import { notifySiteLoadError } from "../services/siteErrorService.js";

const cacheTtlMs = 60 * 1000;
const staleCacheTtlMs = 24 * 60 * 60 * 1000;
const requestTimeoutMs = 15000;
const maxLoadAttempts = 3;
const publicDataCache = new Map();
const publicDataRequests = new Map();
const sessionCachePrefix = "scouts-public-data:";

function stableKeyPart(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableKeyPart).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${key}:${stableKeyPart(value[key])}`).join(",")}}`;
}

function makeCacheKey(cacheKey, dependencies) {
  if (cacheKey) return Array.isArray(cacheKey) ? stableKeyPart(cacheKey) : String(cacheKey);
  return stableKeyPart(dependencies);
}

function sessionCacheKey(key) {
  return `${sessionCachePrefix}${key}`;
}

function readSessionCache(key) {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(sessionCacheKey(key)) || "null");
    if (!cached?.createdAt || Date.now() - cached.createdAt > staleCacheTtlMs) {
      window.sessionStorage.removeItem(sessionCacheKey(key));
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  const cached = { data, createdAt: Date.now() };
  publicDataCache.set(key, cached);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(sessionCacheKey(key), JSON.stringify(cached));
  } catch {
    // Large gallery responses may exceed session storage. Memory caching still works.
  }
}

function getCachedEntry(key) {
  const memoryCached = publicDataCache.get(key);
  if (memoryCached) return memoryCached;
  const sessionCached = readSessionCache(key);
  if (sessionCached) publicDataCache.set(key, sessionCached);
  return sessionCached;
}

function getFreshCachedData(key) {
  const cached = getCachedEntry(key);
  if (!cached || Date.now() - cached.createdAt > cacheTtlMs) return null;
  return cached.data;
}

function getStaleCachedData(key) {
  const cached = getCachedEntry(key);
  if (!cached || Date.now() - cached.createdAt > staleCacheTtlMs) return null;
  return cached.data;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function withTimeout(promise, timeoutMs = requestTimeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("The page content request took too long.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

async function loadWithRetry(loader) {
  let lastError;
  for (let attempt = 0; attempt < maxLoadAttempts; attempt += 1) {
    try {
      return await withTimeout(Promise.resolve().then(loader));
    } catch (error) {
      lastError = error;
      if (attempt < maxLoadAttempts - 1) await delay(500 * (2 ** attempt));
    }
  }
  throw lastError;
}

function loadPublicData(key, loader, { force = false } = {}) {
  if (!force) {
    const cached = getFreshCachedData(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = publicDataRequests.get(key);
    if (inFlight) return inFlight;
  }

  const request = loadWithRetry(loader)
    .then((nextData) => {
      writeCache(key, nextData);
      clearRecoveryReloads();
      return nextData;
    })
    .finally(() => publicDataRequests.delete(key));

  publicDataRequests.set(key, request);
  return request;
}

export function usePublicData(loader, dependencies = [], initialData = null, cacheKey = null) {
  const requestKey = useMemo(() => makeCacheKey(cacheKey, dependencies), [cacheKey, ...dependencies]);
  const cachedData = getFreshCachedData(requestKey) ?? getStaleCachedData(requestKey);
  const [data, setData] = useState(cachedData ?? initialData);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextData = await loadPublicData(requestKey, loader, { force: true });
      setData(nextData);
      return nextData;
    } catch (nextError) {
      const stale = getStaleCachedData(requestKey);
      if (stale) setData(stale);
      setError(nextError);
      notifySiteLoadError(nextError, { source: "public-data-reload", metadata: { requestKey, staleContentShown: Boolean(stale) } });
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fresh = getFreshCachedData(requestKey);
    const stale = getStaleCachedData(requestKey);

    if (fresh) {
      setData(fresh);
      setIsLoading(false);
      setError(null);
      return () => { cancelled = true; };
    }

    if (stale) setData(stale);
    else setData(initialData);
    setIsLoading(!stale);
    setError(null);

    loadPublicData(requestKey, loader)
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          const fallback = getStaleCachedData(requestKey);
          if (fallback) setData(fallback);
          setError(nextError);
          setIsLoading(false);
          notifySiteLoadError(nextError, { source: "public-data-load", metadata: { requestKey, staleContentShown: Boolean(fallback) } });
        }
      });

    return () => { cancelled = true; };
  }, [requestKey]);

  return { data, isLoading, error, setData, reload };
}