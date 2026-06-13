import { useEffect, useState } from "react";
import { getBootstrap, loadingData } from "./client.js";

let cachedBootstrap = null;

export function useBootstrap() {
  const [data, setData] = useState(cachedBootstrap ?? loadingData);
  const [isLoading, setIsLoading] = useState(!cachedBootstrap);

  async function refresh() {
    const nextData = await getBootstrap();
    cachedBootstrap = nextData;
    setData(nextData);
    setIsLoading(false);
    return nextData;
  }

  useEffect(() => {
    let cancelled = false;

    getBootstrap().then((nextData) => {
      if (!cancelled) {
        cachedBootstrap = nextData;
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
