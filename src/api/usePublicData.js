import { useEffect, useMemo, useState } from "react";

const cacheTtlMs = 60 * 1000;
const publicDataCache = new Map();
const publicDataRequests = new Map();

function stableKeyPart(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableKeyPart).join(",")}]`;

  return `{${Object.keys(value).sort().map((key) => `${key}:${stableKeyPart(value[key])}`).join(",")}}`;
}

function makeCacheKey(cacheKey, dependencies) {
  if (cacheKey) {
    return Array.isArray(cacheKey) ? stableKeyPart(cacheKey) : String(cacheKey);
  }

  return stableKeyPart(dependencies);
}

function getFreshCachedData(key) {
  const cached = publicDataCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.createdAt > cacheTtlMs) {
    publicDataCache.delete(key);
    return null;
  }

  return cached.data;
}

function loadPublicData(key, loader, { force = false } = {}) {
  if (!force) {
    const cached = getFreshCachedData(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    const inFlight = publicDataRequests.get(key);
    if (inFlight) {
      return inFlight;
    }
  }

  const request = loader()
    .then((nextData) => {
      publicDataCache.set(key, { data: nextData, createdAt: Date.now() });
      return nextData;
    })
    .finally(() => {
      publicDataRequests.delete(key);
    });

  publicDataRequests.set(key, request);
  return request;
}

export function usePublicData(loader, dependencies = [], initialData = null, cacheKey = null) {
  const requestKey = useMemo(() => makeCacheKey(cacheKey, dependencies), [cacheKey, ...dependencies]);
  const cachedData = getFreshCachedData(requestKey);
  const [data, setData] = useState(cachedData ?? initialData);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    const nextData = await loadPublicData(requestKey, loader, { force: true });
    setData(nextData);
    setIsLoading(false);
    return nextData;
  };

  useEffect(() => {
    let cancelled = false;
    const cached = getFreshCachedData(requestKey);

    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setData(initialData);
    setIsLoading(true);
    setError(null);

    loadPublicData(requestKey, loader)
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
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
  }, [requestKey]);

  return { data, isLoading, error, setData, reload };
}
