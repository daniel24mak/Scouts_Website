import { useEffect, useMemo, useState } from "react";

function withRetryParam(src, attempt) {
  if (!src || attempt === 0) return src;

  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("image_retry", String(attempt));
    return url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}image_retry=${attempt}`;
  }
}

export default function SafeImage({
  src,
  alt = "",
  className = "",
  imageClassName = "",
  loading = "lazy",
  decoding = "async",
  fetchPriority,
  width,
  height,
  sizes,
  retryCount = 2,
  objectFit,
  children
}) {
  const [status, setStatus] = useState(src ? "loading" : "empty");
  const [attempt, setAttempt] = useState(0);
  const imageSrc = useMemo(() => withRetryParam(src, attempt), [src, attempt]);

  useEffect(() => {
    setAttempt(0);
    setStatus(src ? "loading" : "empty");
  }, [src]);

  const handleError = () => {
    if (attempt < retryCount) {
      setAttempt((current) => current + 1);
      setStatus("loading");
      return;
    }

    setStatus("error");
  };

  const frameClassName = [
    "safe-image-frame",
    status === "loaded" ? "loaded" : "loading",
    status === "empty" || status === "error" ? "empty" : "",
    className
  ].filter(Boolean).join(" ");

  if (!src || status === "error") {
    return (
      <div className={frameClassName} role={alt ? "img" : undefined} aria-label={alt || undefined}>
        {children}
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        key={imageSrc}
        className={imageClassName}
        src={imageSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        sizes={sizes}
        style={objectFit ? { objectFit } : undefined}
        onLoad={() => setStatus("loaded")}
        onError={handleError}
      />
    </div>
  );
}
