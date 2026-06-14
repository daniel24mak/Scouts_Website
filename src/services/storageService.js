import { uploadSupabaseFile } from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

export function uploadRegistrationFile(fileName, file) {
  return uploadSupabaseFile(`registration/${Date.now()}-${fileName}`, file);
}

export async function uploadGalleryImage(albumId, file) {
  const optimized = await optimizeImageForUpload(file, "gallery");
  return uploadSupabaseFile(optimizedImagePath(`gallery/optimized/${albumId}`, file), optimized.file, "gallery", { cacheControl: IMAGE_CACHE_CONTROL });
}

export async function uploadSiteImage(contentKey, file) {
  const optimized = await optimizeImageForUpload(file, contentKey?.includes("hero") ? "hero" : "website_content");
  return uploadSupabaseFile(optimizedImagePath(`site-images/optimized/${contentKey}`, file), optimized.file, "site-images", { cacheControl: IMAGE_CACHE_CONTROL });
}

export async function uploadLeaderHeadshot(leaderId, file) {
  const optimized = await optimizeImageForUpload(file, "leader_headshot");
  return uploadSupabaseFile(optimizedImagePath(`leader-headshots/optimized/${leaderId || "new"}`, file), optimized.file, "leader-headshots", { cacheControl: IMAGE_CACHE_CONTROL });
}

export function uploadDocument(file) {
  return uploadSupabaseFile(`documents/${Date.now()}-${file.name}`, file);
}

