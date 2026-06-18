const preloadedImages = new Set();
const loadingImages = new Map();

export function preloadImage(src) {
  if (!src || preloadedImages.has(src)) {
    return Promise.resolve(src);
  }

  if (loadingImages.has(src)) {
    return loadingImages.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      preloadedImages.add(src);
      loadingImages.delete(src);
      resolve(src);
    };
    image.onerror = () => {
      loadingImages.delete(src);
      reject(new Error("Image could not be preloaded."));
    };
    image.src = src;
  });

  loadingImages.set(src, promise);
  return promise;
}

export function preloadImages(sources) {
  return Promise.allSettled((sources ?? []).filter(Boolean).map(preloadImage));
}