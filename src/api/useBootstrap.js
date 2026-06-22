import { useEffect, useState } from "react";
import { getBootstrap, loadingData } from "./client.js";
import { notifySiteLoadError } from "../services/siteErrorService.js";

let cachedBootstrap = null;
let inFlightBootstrap = null;

function loadBootstrap({ force = false } = {}) {
  if (!force && cachedBootstrap) {
    return Promise.resolve(cachedBootstrap);
  }

  if (!force && inFlightBootstrap) {
    return inFlightBootstrap;
  }

  console.debug("[dashboard] bootstrap fetch start", { force });

  inFlightBootstrap = getBootstrap()
    .then((nextData) => {
      cachedBootstrap = nextData;
      console.debug("[dashboard] bootstrap fetch complete");
      return nextData;
    })
    .catch((error) => {
      console.error("[dashboard] bootstrap fetch failed", error);
      notifySiteLoadError(error, { source: "dashboard-bootstrap" });
      throw error;
    })
    .finally(() => {
      inFlightBootstrap = null;
    });

  return inFlightBootstrap;
}

export function useBootstrap() {
  const [data, setData] = useState(cachedBootstrap ?? loadingData);
  const [isLoading, setIsLoading] = useState(!cachedBootstrap);
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

    if (cachedBootstrap) {
      setData(cachedBootstrap);
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
