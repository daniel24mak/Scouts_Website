import {
  IMAGE_CACHE_CONTROL,
  optimizedImagePath,
  optimizeImageForUpload
} from "./imageOptimizationService.js";
import { uploadSupabaseFile } from "./supabaseClient.js";

function safeSegment(value, fallback) {
  return String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

export function formImageFolder(kind = "question", ownerId = "new") {
  return `forms/optimized/${safeSegment(kind, "question")}/${safeSegment(ownerId, "new")}`;
}

export async function uploadFormImage(file, { kind = "question", ownerId = "new" } = {}) {
  const optimized = await optimizeImageForUpload(file, kind === "header" ? "hero" : "website_content");
  const storagePath = optimizedImagePath(formImageFolder(kind, ownerId), file);
  const imageUrl = await uploadSupabaseFile(storagePath, optimized.file, "gallery", {
    cacheControl: IMAGE_CACHE_CONTROL
  });

  return {
    imageUrl,
    storagePath,
    width: optimized.width,
    height: optimized.height,
    originalFileName: optimized.originalFileName,
    optimizedSize: optimized.optimizedSize,
    format: optimized.optimizedFormat
  };
}
