import {
  normalizeAlbum,
  normalizeAlbumRevision,
  normalizePhoto,
  normalizePhotoUploadBatch
} from "./supabaseMappers.js";
import {
  deleteSupabaseFile,
  deleteSupabaseFiles,
  deleteSupabaseRows,
  getSupabaseRows,
  getCurrentSupabaseUserId,
  insertSupabaseRow,
  insertSupabaseRows,
  patchSupabaseRows,
  uploadSupabaseFile
} from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}


const publicAlbumSelect = "select=id,title,event_date,location,category,description,cover_label,thumbnail_url,thumbnail_storage_path,thumbnail_source,status,created_at,updated_at";
const publicPhotoSelect = "select=id,album_id,title,public_url,storage_path,thumbnail_url,thumbnail_storage_path,optimized_width,optimized_height,optimized_file_size,thumbnail_file_size,status,created_at,sort_order";

export async function getPublicGalleryAlbums({ limit = 12, offset = 0 } = {}) {
  const rows = await getSupabaseRows(
    "gallery_albums",
    `${publicAlbumSelect}&status=eq.approved&order=event_date.desc&limit=${Number(limit)}&offset=${Number(offset)}`
  );

  return rows.map((album) => normalizeAlbum(album, []));
}

export async function getPublicGalleryAlbumById(albumId) {
  const rows = await getSupabaseRows(
    "gallery_albums",
    `${publicAlbumSelect}&id=eq.${encodeURIComponent(albumId)}&status=eq.approved&limit=1`
  );

  return rows[0] ? normalizeAlbum(rows[0], []) : null;
}

export async function getPublicAlbumPhotos(albumId, { limit = 30, offset = 0 } = {}) {
  const pageSize = Number(limit);
  const rows = await getSupabaseRows(
    "gallery_images",
    `${publicPhotoSelect}&album_id=eq.${encodeURIComponent(albumId)}&status=eq.approved&order=sort_order.asc,created_at.asc&limit=${pageSize + 1}&offset=${Number(offset)}`
  );
  const pageRows = rows.slice(0, pageSize);

  return {
    photos: pageRows.map(normalizePhoto),
    hasMore: rows.length > pageSize
  };
}

async function prepareAlbumData(album) {
  let thumbnailUrl = album.thumbnailUrl ?? null;
  let thumbnailPath = album.thumbnailPath ?? null;

  if (album.thumbnailFile instanceof File) {
    const optimized = await optimizeImageForUpload(album.thumbnailFile, "album_thumbnail");
    thumbnailPath = optimizedImagePath("album-thumbnails/optimized", album.thumbnailFile);
    thumbnailUrl = await uploadSupabaseFile(thumbnailPath, optimized.file, "album-thumbnails", { cacheControl: IMAGE_CACHE_CONTROL });
  }

  return {
    title: album.title,
    event_date: album.eventDate,
    location: album.location,
    category: album.category,
    description: album.description ?? "",
    cover_label: album.coverLabel || album.category || "Album",
    thumbnail_url: thumbnailUrl,
    thumbnail_storage_path: thumbnailPath,
    thumbnail_source: thumbnailUrl ? "custom" : "placeholder"
  };
}

export async function getGallery() {
  const [albumRows, imageRows, revisionRows, batchRows] = await Promise.all([
    getSupabaseRows("gallery_albums", "select=*&order=event_date.desc"),
    getSupabaseRows("gallery_images", "select=id,album_id,upload_batch_id,title,public_url,storage_path,thumbnail_url,thumbnail_storage_path,original_file_name,optimized_width,optimized_height,optimized_file_size,thumbnail_file_size,status,reviewer_comment,submitted_by,created_at,sort_order&order=sort_order.asc").catch(() =>
      getSupabaseRows("gallery_photos", "select=*&order=sort_order.asc")
    ),
    getSupabaseRows("album_revisions", "select=*&order=updated_at.desc").catch(() => []),
    getSupabaseRows("photo_upload_batches", "select=*&order=updated_at.desc").catch(() => [])
  ]);
  const photos = imageRows.map(normalizePhoto);
  const albums = albumRows.map((album) =>
    normalizeAlbum(
      album,
      photos.filter((photo) => photo.albumId === album.id)
    )
  );
  const revisions = revisionRows.map((revision) => {
    const originalAlbum = albumRows.find((album) => album.id === (revision.original_content_id ?? revision.originalContentId));
    const originalPhotos = photos.filter((photo) => photo.albumId === originalAlbum?.id);

    return normalizeAlbumRevision(revision, originalAlbum, originalPhotos);
  });
  const allGalleryAlbums = [...revisions, ...albums];
  const photoUploadBatches = batchRows.map((batch) => {
    const album = albums.find((item) => item.id === (batch.album_id ?? batch.albumId));
    const batchPhotos = photos.filter((photo) => photo.uploadBatchId === batch.id);
    return normalizePhotoUploadBatch(batch, album, batchPhotos);
  });

  return {
    allGalleryPhotos: photos,
    allGalleryAlbums,
    photoUploadBatches,
    galleryAlbums: albums
      .filter((album) => album.approvalStatus === "approved")
      .map((album) => ({
        ...album,
        photos: album.photos.filter((photo) => photo.approvalStatus === "approved")
      }))
  };
}

export async function createGalleryAlbum(album) {
  const currentUserId = getCurrentSupabaseUserId();
  const albumData = await prepareAlbumData(album);

  return insertSupabaseRow("gallery_albums", {
    ...albumData,
    status: album.approvalStatus ?? "pending",
    submitted_by: currentUserId
  });
}

export async function updateGalleryAlbum(albumId, album) {
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(album.approvalStatus);
  const previousThumbnailPath = album.thumbnailPath ?? album.currentVersion?.thumbnailPath ?? null;
  const albumData = await prepareAlbumData(album);
  const proposedData = {
    ...album,
    thumbnailUrl: albumData.thumbnail_url,
    thumbnailPath: albumData.thumbnail_storage_path,
    thumbnailFile: undefined
  };

  if (album.isRevision || album.revisionId) {
    const revisionId = album.revisionId ?? albumId;

    if (album.approvalStatus === "approved") {
      return patchSupabaseRows("gallery_albums", `id=eq.${encodeURIComponent(album.originalId)}`, {
        ...albumData,
        status: "approved",
        reviewer_comment: album.reviewerComment ?? "",
        reviewed_by: getCurrentSupabaseUserId(),
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).then(() =>
        patchSupabaseRows("album_revisions", `id=eq.${encodeURIComponent(revisionId)}`, {
          status: "approved",
          reviewer_comment: album.reviewerComment ?? "",
          approved_by: getCurrentSupabaseUserId(),
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      ).then((result) => {
        if (albumData.thumbnail_storage_path && previousThumbnailPath && previousThumbnailPath !== albumData.thumbnail_storage_path) {
          deleteSupabaseFile(previousThumbnailPath, "album-thumbnails").catch(() => {});
        }
        return result;
      });
    }

    return patchSupabaseRows("album_revisions", `id=eq.${encodeURIComponent(revisionId)}`, {
      status: album.approvalStatus ?? "pending_update",
      proposed_data: proposedData,
      reviewer_comment: album.reviewerComment ?? "",
      reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });
  }

  if (album.revisionOfId || album.approvalStatus === "pending_update") {
    return insertSupabaseRow("album_revisions", {
      original_content_id: album.revisionOfId ?? albumId,
      submitted_by: getCurrentSupabaseUserId(),
      status: "pending_update",
      proposed_data: proposedData,
      reviewer_comment: album.reviewerComment ?? ""
    });
  }

  const saved = await patchSupabaseRows("gallery_albums", `id=eq.${encodeURIComponent(albumId)}`, {
    ...albumData,
    status: album.approvalStatus ?? "pending",
    reviewer_comment: album.reviewerComment ?? "",
    reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  });

  if (albumData.thumbnail_storage_path && previousThumbnailPath && previousThumbnailPath !== albumData.thumbnail_storage_path) {
    deleteSupabaseFile(previousThumbnailPath, "album-thumbnails").catch(() => {});
  }

  return saved;
}

export async function updatePhotoUploadBatch(batchId, batch) {
  const status = batch.approvalStatus ?? "pending";
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(status);
  const photoStatus = status === "approved" ? "approved" : status === "archived" ? "archived" : status === "rejected" ? "rejected" : "pending";

  await patchSupabaseRows("photo_upload_batches", `id=eq.${encodeURIComponent(batchId)}`, {
    status,
    reviewer_comment: batch.reviewerComment ?? "",
    reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  });

  if (["approved", "rejected", "archived"].includes(status)) {
    await patchSupabaseRows("gallery_images", `upload_batch_id=eq.${encodeURIComponent(batchId)}`, {
      status: photoStatus,
      reviewer_comment: batch.reviewerComment ?? "",
      reviewed_by: getCurrentSupabaseUserId(),
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}

export function updateGalleryPhoto(photoId, photo) {
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(photo.approvalStatus);

  return patchSupabaseRows("gallery_images", `id=eq.${encodeURIComponent(photoId)}`, {
    title: photo.title ?? "",
    sort_order: Number(photo.sortOrder ?? 0),
    status: photo.approvalStatus ?? "pending",
    reviewer_comment: photo.reviewerComment ?? "",
    reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
    reviewed_at: reviewed ? new Date().toISOString() : null
  });
}

export async function deleteGalleryPhotos(photoIds) {
  const ids = (photoIds ?? []).filter(Boolean);

  if (!ids.length) {
    return Promise.resolve([]);
  }

  const filter = ids.map(encodeURIComponent).join(",");
  const rows = await getSupabaseRows(
    "gallery_images",
    `select=storage_path,thumbnail_storage_path&id=in.(${encodeURIComponent(filter)})`
  ).catch(() => []);
  const deleted = await Promise.all(
    ids.map((photoId) => deleteSupabaseRows("gallery_images", `id=eq.${encodeURIComponent(photoId)}`))
  );
  const paths = rows.flatMap((row) => [row.storage_path, row.thumbnail_storage_path]).filter(Boolean);

  if (paths.length) {
    await deleteSupabaseFiles(paths, "gallery").catch(() => {});
  }

  return deleted;
}

export async function deleteGalleryAlbum(albumId) {
  const [albumRows, photoRows] = await Promise.all([
    getSupabaseRows("gallery_albums", `select=thumbnail_storage_path&id=eq.${encodeURIComponent(albumId)}`).catch(() => []),
    getSupabaseRows("gallery_images", `select=storage_path,thumbnail_storage_path&album_id=eq.${encodeURIComponent(albumId)}`).catch(() => [])
  ]);
  await deleteSupabaseRows("gallery_images", `album_id=eq.${encodeURIComponent(albumId)}`).catch(() =>
    deleteSupabaseRows("gallery_photos", `album_id=eq.${encodeURIComponent(albumId)}`)
  );
  const deleted = await deleteSupabaseRows("gallery_albums", `id=eq.${encodeURIComponent(albumId)}`);
  const galleryPaths = photoRows.flatMap((row) => [row.storage_path, row.thumbnail_storage_path]).filter(Boolean);
  const albumThumbnailPaths = albumRows.map((row) => row.thumbnail_storage_path).filter(Boolean);

  if (galleryPaths.length) {
    await deleteSupabaseFiles(galleryPaths, "gallery").catch(() => {});
  }
  if (albumThumbnailPaths.length) {
    await deleteSupabaseFiles(albumThumbnailPaths, "album-thumbnails").catch(() => {});
  }

  return deleted;
}

export async function createGalleryPhotos(albumId, photos, approvalStatus = "pending", onProgress) {
  const currentUserId = getCurrentSupabaseUserId();

  if (!albumId) {
    throw new Error("Choose an album before uploading photos.");
  }

  const uploaded = [];
  const total = photos.length;
  const batchRows = await insertSupabaseRow("photo_upload_batches", {
    album_id: albumId,
    submitted_by: currentUserId,
    status: approvalStatus,
    photo_count: total
  });
  const batch = batchRows[0];

  for (const [index, photo] of photos.entries()) {
    const title = photo?.name ?? String(photo);

    if (photo instanceof File) {
      const optimized = await optimizeImageForUpload(photo, "gallery");
      const thumbnail = await optimizeImageForUpload(photo, "gallery_thumbnail");
      const storagePath = optimizedImagePath(`gallery/optimized/${albumId}`, photo);
      const thumbnailPath = optimizedImagePath(`gallery/thumbnails/${albumId}`, photo, "-thumb");
      const publicUrl = await uploadSupabaseFile(storagePath, optimized.file, "gallery", { cacheControl: IMAGE_CACHE_CONTROL });
      const thumbnailUrl = await uploadSupabaseFile(thumbnailPath, thumbnail.file, "gallery", { cacheControl: IMAGE_CACHE_CONTROL });

      uploaded.push(
        await insertSupabaseRow("gallery_images", {
          album_id: albumId,
          upload_batch_id: batch.id,
          title,
          storage_path: storagePath,
          public_url: publicUrl,
          thumbnail_storage_path: thumbnailPath,
          thumbnail_url: thumbnailUrl,
          original_file_name: optimized.originalFileName,
          original_format: optimized.originalFormat,
          original_file_size: optimized.originalSize,
          optimized_format: optimized.optimizedFormat,
          optimized_width: optimized.width,
          optimized_height: optimized.height,
          optimized_file_size: optimized.optimizedSize,
          thumbnail_file_size: thumbnail.optimizedSize,
          quality_used: optimized.quality,
          sort_order: index,
          status: approvalStatus,
          submitted_by: currentUserId
        })
      );
    } else {
      uploaded.push(
        await insertSupabaseRow("gallery_images", {
          album_id: albumId,
          upload_batch_id: batch.id,
          title,
          sort_order: index,
          status: approvalStatus,
          submitted_by: currentUserId
        })
      );
    }

    onProgress?.({
      completed: index + 1,
      total,
      percent: total ? Math.round(((index + 1) / total) * 100) : 100
    });
  }

  return uploaded;
}

