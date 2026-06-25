import { useEffect, useMemo, useRef, useState } from "react";
import { notifySiteLoadError } from "../services/siteErrorService.js";

const imageLoadTimeoutMs = 12000;

function withRetryParam(src, attempt) {
  if (!src || attempt === 0) return src;
  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("image_retry", `${attempt}-${Date.now()}`);
    return url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}image_retry=${attempt}-${Date.now()}`;
  }
}

export default function SafeImage({ src, alt = "", className = "", imageClassName = "", loading = "lazy", decoding = "async", fetchPriority, width, height, sizes, retryCount = 4, objectFit, children }) {
  const [status, setStatus] = useState(src ? "loading" : "empty");
  const [attempt, setAttempt] = useState(0);
  const [isNearViewport, setIsNearViewport] = useState(loading !== "lazy");
  const retryTimerRef = useRef(null);
  const loadTimerRef = useRef(null);
  const frameRef = useRef(null);
  const notifiedRef = useRef(false);
  const imageSrc = useMemo(() => withRetryParam(src, attempt), [src, attempt]);

  useEffect(() => {
    window.clearTimeout(retryTimerRef.current);
    window.clearTimeout(loadTimerRef.current);
    setAttempt(0);
    setStatus(src ? "loading" : "empty");
    setIsNearViewport(loading !== "lazy");
    notifiedRef.current = false;
  }, [loading, src]);

  useEffect(() => {
    if (loading !== "lazy" || !frameRef.current || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [loading, src]);

  const handleFailure = (error = new Error("An image could not be loaded.")) => {
    window.clearTimeout(loadTimerRef.current);
    if (attempt < retryCount) {
      setStatus("retrying");
      retryTimerRef.current = window.setTimeout(() => {
        setAttempt((current) => current + 1);
        setStatus("loading");
      }, Math.min(500 * (2 ** attempt), 4000));
      return;
    }

    setStatus("error");
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      notifySiteLoadError(error, {
        source: "public-image-load",
        kind: "images",
        autoReload: false,
        message: "Some images are not loading. You can reload the page to try again.",
        metadata: { imageUrl: src, alt }
      });
    }
  };

  useEffect(() => {
    if (!src || status !== "loading" || !isNearViewport) return undefined;
    loadTimerRef.current = window.setTimeout(() => handleFailure(new Error("An image took too long to load.")), imageLoadTimeoutMs);
    return () => window.clearTimeout(loadTimerRef.current);
  }, [imageSrc, isNearViewport, src, status]);

  useEffect(() => {
    const handleOnline = () => {
      if (status === "error" && src) {
        notifiedRef.current = false;
        setAttempt(0);
        setStatus("loading");
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [src, status]);

  useEffect(() => () => {
    window.clearTimeout(retryTimerRef.current);
    window.clearTimeout(loadTimerRef.current);
  }, []);

  const frameClassName = ["safe-image-frame", status === "loaded" ? "loaded" : "loading", status === "empty" || status === "error" ? "empty" : "", className].filter(Boolean).join(" ");

  if (!src || status === "error") {
    return <div ref={frameRef} className={frameClassName} role={alt ? "img" : undefined} aria-label={alt || undefined}>{children}</div>;
  }

  return (
    <div ref={frameRef} className={frameClassName}>
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
        onLoad={() => {
          window.clearTimeout(loadTimerRef.current);
          setStatus("loaded");
        }}
        onError={() => handleFailure()}
      />
    </div>
  );
}