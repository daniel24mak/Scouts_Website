import { useEffect, useState } from "react";
import { getBootstrap, loadingData } from "./client.js";

let cachedBootstrap = null;
let inFlightBootstrap = null;

function loadBootstrap({ force = false } = {}) {
  if (!force && cachedBootstrap) {
    return Promise.resolve(cachedBootstrap);
  }

  if (!force && inFlightBootstrap) {
    return inFlightBootstrap;
  }

  inFlightBootstrap = getBootstrap()
    .then((nextData) => {
      cachedBootstrap = nextData;
      return nextData;
    })
    .finally(() => {
      inFlightBootstrap = null;
    });

  return inFlightBootstrap;
}

export function useBootstrap() {
  const [data, setData] = useState(cachedBootstrap ?? loadingData);
  const [isLoading, setIsLoading] = useState(!cachedBootstrap);

  async function refresh() {
    const nextData = await loadBootstrap({ force: true });
    setData(nextData);
    setIsLoading(false);
    return nextData;
  }

  useEffect(() => {
    let cancelled = false;

    if (cachedBootstrap) {
      setData(cachedBootstrap);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    loadBootstrap().then((nextData) => {
      if (!cancelled) {
        setData(nextData);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, refresh };
}
