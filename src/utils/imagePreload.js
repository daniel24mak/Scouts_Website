import { notifySiteLoadError } from "../services/siteErrorService.js";

const preloadedImages = new Set();
const loadingImages = new Map();
const maxAttempts = 4;
const loadTimeoutMs = 12000;

function retrySource(src, attempt) {
  if (!attempt) return src;
  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("image_retry", `preload-${attempt}-${Date.now()}`);
    return url.toString();
  } catch {
    return `${src}${src.includes("?") ? "&" : "?"}image_retry=preload-${attempt}-${Date.now()}`;
  }
}

function loadAttempt(src, attempt) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      reject(new Error("An image took too long to load."));
    }, loadTimeoutMs);
    image.decoding = "async";
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(src);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("An image could not be loaded."));
    };
    image.src = retrySource(src, attempt);
  });
}

export function preloadImage(src) {
  if (!src || preloadedImages.has(src)) return Promise.resolve(src);
  if (loadingImages.has(src)) return loadingImages.get(src);

  const promise = (async () => {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        await loadAttempt(src, attempt);
        preloadedImages.add(src);
        return src;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) await new Promise((resolve) => window.setTimeout(resolve, Math.min(500 * (2 ** attempt), 4000)));
      }
    }

    notifySiteLoadError(lastError, {
      source: "public-image-load",
      kind: "images",
      autoReload: false,
      message: "Some images are not loading. You can reload the page to try again.",
      metadata: { imageUrl: src, preload: true }
    });
    throw lastError;
  })().finally(() => loadingImages.delete(src));

  loadingImages.set(src, promise);
  return promise;
}

export function preloadImages(sources) {
  return Promise.allSettled([...new Set((sources ?? []).filter(Boolean))].map(preloadImage));
}