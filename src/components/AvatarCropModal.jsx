import { useEffect, useRef, useState } from "react";
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

async function cropToFile(imageSrc, crop, zoom, fileName = "profile-picture.webp") {
  const image = await loadImage(imageSrc);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (size - width) / 2 + crop.x * size;
  const y = (size - height) / 2 + crop.y * size;

  context.drawImage(image, x, y, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) throw new Error("Could not crop profile picture.");

  return new File([blob], fileName.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

export default function AvatarCropModal({ file, title = "Crop profile picture", onCancel, onConfirm }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [zoom, setZoom] = useState(1.15);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    setPreviewError("");
    setZoom(1.15);
    setCrop({ x: 0, y: 0 });

    if (!file) return undefined;

    getReadableImageFile(file)
      .then(readFileAsDataUrl)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch((error) => {
        if (!cancelled) setPreviewError(error?.message || "This image could not be previewed. Try a JPG, PNG, WebP, HEIC, or HEIF image.");
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return null;

  const beginDrag = (event) => {
    if (!previewUrl) return;
    const point = event.touches?.[0] ?? event;
    setDragStart({ clientX: point.clientX, clientY: point.clientY, crop });
  };

  const moveDrag = (event) => {
    if (!dragStart || !frameRef.current) return;
    const point = event.touches?.[0] ?? event;
    const bounds = frameRef.current.getBoundingClientRect();
    const dx = (point.clientX - dragStart.clientX) / bounds.width;
    const dy = (point.clientY - dragStart.clientY) / bounds.height;
    setCrop({ x: clamp(dragStart.crop.x + dx, -0.5, 0.5), y: clamp(dragStart.crop.y + dy, -0.5, 0.5) });
  };

  const finishDrag = () => setDragStart(null);

  const confirmCrop = async () => {
    if (!previewUrl) return;
    try {
      setIsSaving(true);
      const cropped = await cropToFile(previewUrl, crop, zoom, file.name || "profile-picture.webp");
      onConfirm(cropped);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-modal-backdrop avatar-crop-backdrop" role="presentation" onMouseMove={moveDrag} onMouseUp={finishDrag} onMouseLeave={finishDrag} onTouchMove={moveDrag} onTouchEnd={finishDrag}>
      <div className="profile-modal avatar-crop-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div
          ref={frameRef}
          className="avatar-crop-frame"
          onMouseDown={beginDrag}
          onTouchStart={beginDrag}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" draggable="false" style={{ transform: `translate(${crop.x * 100}%, ${crop.y * 100}%) scale(${zoom})` }} />
          ) : (
            <span>{previewError || "Loading image..."}</span>
          )}
        </div>
        <label className="avatar-zoom-control">
          Zoom
          <input type="range" min="1" max="2.6" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={!previewUrl} />
        </label>
        <div className="action-row">
          <button type="button" className="inline-action" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button type="button" className="primary-action" onClick={confirmCrop} disabled={isSaving || !previewUrl}>{isSaving ? "Cropping..." : "Use picture"}</button>
        </div>
      </div>
    </div>
  );
}


