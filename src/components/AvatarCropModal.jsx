import { useEffect, useMemo, useRef, useState } from "react";
import { getReadableImageFile } from "../services/imageOptimizationService.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function coverGeometry(sourceWidth, sourceHeight, frameWidth, frameHeight, zoom, crop) {
  if (!sourceWidth || !sourceHeight || !frameWidth || !frameHeight) return null;
  const baseScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const scale = baseScale * zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const maxX = Math.max(0, (width - frameWidth) / (2 * frameWidth));
  const maxY = Math.max(0, (height - frameHeight) / (2 * frameHeight));
  const boundedCrop = { x: clamp(crop.x, -maxX, maxX), y: clamp(crop.y, -maxY, maxY) };
  return {
    width,
    height,
    left: (frameWidth - width) / 2 + boundedCrop.x * frameWidth,
    top: (frameHeight - height) / 2 + boundedCrop.y * frameHeight,
    maxX,
    maxY,
    crop: boundedCrop
  };
}

async function cropToFile(imageSrc, crop, zoom, fileName = "cropped-image.webp", aspectRatio = 1) {
  const image = await loadImage(imageSrc);
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const longestSide = 1200;
  const outputWidth = safeAspectRatio >= 1 ? longestSide : Math.round(longestSide * safeAspectRatio);
  const outputHeight = safeAspectRatio >= 1 ? Math.round(longestSide / safeAspectRatio) : longestSide;
  const geometry = coverGeometry(image.naturalWidth, image.naturalHeight, outputWidth, outputHeight, zoom, crop);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, geometry.left, geometry.top, geometry.width, geometry.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Could not crop this image.");
  return new File([blob], fileName.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

export default function AvatarCropModal({ file, title = "Edit image", aspectRatio = 1, shape = "square", confirmLabel = "Replace image", onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [croppedFile, setCroppedFile] = useState(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState("");
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    setPreviewError("");
    setSourceSize({ width: 0, height: 0 });
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedFile(null);
    if (!file) return undefined;
    getReadableImageFile(file)
      .then(readFileAsDataUrl)
      .then(async (url) => {
        const image = await loadImage(url);
        if (!cancelled) {
          setPreviewUrl(url);
          setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
        }
      })
      .catch((error) => { if (!cancelled) setPreviewError(error?.message || "This image could not be previewed."); });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    if (!frameRef.current) return undefined;
    const update = () => {
      const bounds = frameRef.current?.getBoundingClientRect();
      if (bounds) setFrameSize({ width: bounds.width, height: bounds.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [previewUrl, croppedFile, aspectRatio]);

  useEffect(() => () => {
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
  }, [croppedPreviewUrl]);

  const geometry = useMemo(() => coverGeometry(sourceSize.width, sourceSize.height, frameSize.width, frameSize.height, zoom, crop), [sourceSize, frameSize, zoom, crop]);

  useEffect(() => {
    if (geometry && (geometry.crop.x !== crop.x || geometry.crop.y !== crop.y)) setCrop(geometry.crop);
  }, [geometry, crop]);

  if (!file) return null;

  const beginDrag = (event) => {
    if (!previewUrl || croppedFile) return;
    const point = event.touches?.[0] ?? event;
    setDragStart({ clientX: point.clientX, clientY: point.clientY, crop });
  };
  const moveDrag = (event) => {
    if (!dragStart || !frameSize.width || croppedFile) return;
    const point = event.touches?.[0] ?? event;
    const next = {
      x: dragStart.crop.x + (point.clientX - dragStart.clientX) / frameSize.width,
      y: dragStart.crop.y + (point.clientY - dragStart.clientY) / frameSize.height
    };
    const bounds = coverGeometry(sourceSize.width, sourceSize.height, frameSize.width, frameSize.height, zoom, next);
    setCrop(bounds?.crop ?? next);
  };
  const prepareReplacement = async () => {
    if (!previewUrl) return;
    try {
      setIsSaving(true);
      setPreviewError("");
      const nextFile = await cropToFile(previewUrl, crop, zoom, file.name || "cropped-image.webp", aspectRatio);
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
      setCroppedFile(nextFile);
      setCroppedPreviewUrl(URL.createObjectURL(nextFile));
    } catch (error) {
      setPreviewError(error?.message || "The cropped image could not be prepared.");
    } finally {
      setIsSaving(false);
    }
  };

  return <div className="profile-modal-backdrop avatar-crop-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }} onMouseMove={moveDrag} onMouseUp={() => setDragStart(null)} onMouseLeave={() => setDragStart(null)} onTouchMove={moveDrag} onTouchEnd={() => setDragStart(null)}>
    <div className="profile-modal avatar-crop-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div><p className="eyebrow">{croppedFile ? "Confirm replacement" : "Crop and position"}</p><h2>{croppedFile ? "Replace the current image?" : title}</h2><p className="helper-text">{croppedFile ? "This is the exact image that will be saved." : "Drag to position the image. The locked frame is the exact saved crop."}</p></div>
      <div ref={frameRef} className={`avatar-crop-frame ${shape === "circle" ? "circle" : ""}`} style={{ aspectRatio }} onMouseDown={beginDrag} onTouchStart={beginDrag}>
        {croppedFile ? <img className="avatar-crop-result" src={croppedPreviewUrl} alt="Final cropped image" draggable="false" /> : previewUrl && geometry ? <img src={previewUrl} alt="" draggable="false" style={{ width: geometry.width, height: geometry.height, left: geometry.left, top: geometry.top }} /> : <span>{previewError || "Loading image..."}</span>}
      </div>
      {!croppedFile && <label className="avatar-zoom-control">Image size<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={!previewUrl} /></label>}
      {previewError && <p className="form-status error">{previewError}</p>}
      <div className="action-row">{croppedFile ? <button type="button" className="inline-action" onClick={() => setCroppedFile(null)}>Back to crop</button> : <button type="button" className="inline-action" onClick={onCancel}>Cancel</button>}{croppedFile ? <button type="button" className="primary-action" onClick={() => onConfirm(croppedFile)}>{confirmLabel}</button> : <button type="button" className="primary-action" onClick={prepareReplacement} disabled={isSaving || !previewUrl}>{isSaving ? "Preparing..." : "Preview crop"}</button>}</div>
    </div>
  </div>;
}