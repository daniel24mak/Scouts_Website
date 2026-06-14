import { normalizeEvent } from "./supabaseMappers.js";
import {
  deleteSupabaseFile,
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabaseRows,
  insertSupabaseRow,
  patchSupabaseRows,
  uploadSupabaseFile
} from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

async function prepareEventImage(event) {
  if (!(event.imageFile instanceof File)) {
    return {
      image_url: event.imageUrl ?? null,
      storage_path: event.storagePath ?? null
    };
  }

  const optimized = await optimizeImageForUpload(event.imageFile, "event");
  const storagePath = optimizedImagePath("event-images/optimized", event.imageFile);
  const imageUrl = await uploadSupabaseFile(storagePath, optimized.file, "event-images", { cacheControl: IMAGE_CACHE_CONTROL });

  return {
    image_url: imageUrl,
    storage_path: storagePath
  };
}

export async function getCalendarEvents() {
  const rows = await getSupabaseRows("calendar_events", "select=*&order=event_date.asc");
  return rows.map(normalizeEvent);
}

export async function getPublicCalendarEvents({ limit = 3 } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getSupabaseRows(
    "calendar_events",
    `select=id,title,event_date,date_from,date_to,start_time,end_time,event_type,visibility,location,description,image_url,storage_path,status,linked_blog_id,linked_album_id&status=eq.approved&visibility=eq.public&event_date=gte.${today}&order=event_date.asc&limit=${Number(limit)}`
  );

  return rows.map(normalizeEvent);
}

export async function createSupabaseCalendarEvent(event) {
  const currentUserId = getCurrentSupabaseUserId();
  const eventImage = await prepareEventImage(event);

  return insertSupabaseRow("calendar_events", {
    title: event.title,
    event_date: event.date ?? event.dateFrom,
    date_from: event.dateFrom ?? event.date,
    date_to: event.dateTo ?? event.dateFrom ?? event.date,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    event_type: event.type ?? "event",
    visibility: event.visibility ?? "public",
    group_id: event.groupId || null,
    visible_group_ids: event.visibleGroupIds ?? [],
    linked_blog_id: event.linkedBlogId || null,
    linked_album_id: event.linkedAlbumId || null,
    location: event.location ?? "Scout Hall",
    description: event.description ?? "",
    ...eventImage,
    status: event.approvalStatus ?? "approved",
    submitted_by: currentUserId,
    created_by: currentUserId
  });
}

export async function deleteSupabaseCalendarEvent(eventId) {
  const rows = await getSupabaseRows("calendar_events", `select=storage_path&id=eq.${encodeURIComponent(eventId)}`).catch(() => []);
  const deleted = await deleteSupabaseRows("calendar_events", `id=eq.${encodeURIComponent(eventId)}`);
  const paths = rows.map((row) => row.storage_path).filter(Boolean);

  await Promise.all(paths.map((path) => deleteSupabaseFile(path, "event-images").catch(() => {})));

  return deleted;
}

export async function updateSupabaseCalendarEvent(eventId, event) {
  const approvalStatus = event.approvalStatus ?? event.status ?? "pending";
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(approvalStatus);
  const previousStoragePath = event.storagePath ?? null;
  const eventImage = await prepareEventImage(event);

  const saved = await patchSupabaseRows("calendar_events", `id=eq.${encodeURIComponent(eventId)}`, {
    title: event.title,
    event_date: event.date ?? event.dateFrom,
    date_from: event.dateFrom ?? event.date,
    date_to: event.dateTo ?? event.dateFrom ?? event.date,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    event_type: event.type ?? "event",
    visibility: event.visibility ?? "public",
    group_id: event.groupId || null,
    visible_group_ids: event.visibleGroupIds ?? [],
    linked_blog_id: event.linkedBlogId || null,
    linked_album_id: event.linkedAlbumId || null,
    location: event.location ?? "",
    description: event.description ?? "",
    ...eventImage,
    status: approvalStatus,
    reviewer_comment: event.reviewerComment ?? "",
    reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  });

  if (event.imageFile instanceof File && previousStoragePath && previousStoragePath !== eventImage.storage_path) {
    deleteSupabaseFile(previousStoragePath, "event-images").catch(() => {});
  }

  return saved;
}

