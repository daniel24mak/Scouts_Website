import { CalendarDays, ChevronLeft, ChevronRight, Images, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { deletePhotos, updateAlbum } from "../api/client.js";
import { getPublicAlbumPage } from "../api/publicClient.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { canManageSystem, canPublishContent } from "../services/permissions.js";
import { preloadImage, preloadImages } from "../utils/imagePreload.js";

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const PHOTOS_PER_PAGE = 30;

export default function AlbumDetailPage() {
  const { albumId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoOffset, setPhotoOffset] = useState(0);
  const [hasMorePhotos, setHasMorePhotos] = useState(false);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(true);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState(null);
  const [isLightboxImageLoading, setIsLightboxImageLoading] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isEditingAlbum, setIsEditingAlbum] = useState(false);
  const [albumEdit, setAlbumEdit] = useState(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isAdmin = canManageSystem(user);
  const activePhoto = activePhotoIndex === null ? null : photos[activePhotoIndex];

  useEffect(() => {
    if (message) {
      showToast(message);
    }
  }, [message, showToast]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAlbumPage() {
      setIsLoadingAlbum(true);
      setIsLoadingPhotos(true);
      setLoadError(null);
      setAlbum(null);
      setPhotos([]);
      setPhotoOffset(0);
      setHasMorePhotos(false);
      setActivePhotoIndex(null);
      setSelectedPhotoIds([]);

      try {
        const page = await getPublicAlbumPage(albumId, { limit: PHOTOS_PER_PAGE, offset: 0 });
if (cancelled) return;
        setAlbum(page.album);
        setPhotos(page.photos);
        setPhotoOffset(page.photos.length);
        setHasMorePhotos(page.hasMore);
      } catch (error) {
if (!cancelled) setLoadError(error);
      } finally {
if (!cancelled) {
          setIsLoadingAlbum(false);
          setIsLoadingPhotos(false);
        }
      }
    }

    loadInitialAlbumPage();

    return () => {
      cancelled = true;
    };
  }, [albumId]);

  useEffect(() => {
    preloadImages(photos.slice(0, 8).flatMap((photo) => [photo.thumbnailUrl, photo.url]));
  }, [photos]);

  useEffect(() => {
    if (activePhotoIndex === null || !photos.length) return;

    const nearbyIndexes = [activePhotoIndex, activePhotoIndex + 1, activePhotoIndex - 1, activePhotoIndex + 2, activePhotoIndex - 2]
      .map((index) => (index + photos.length) % photos.length);
    const nearbySources = nearbyIndexes.flatMap((index) => [photos[index]?.thumbnailUrl, photos[index]?.url]);

    preloadImages(nearbySources);
  }, [activePhotoIndex, photos]);

  useEffect(() => {
    if (!activePhoto) {
      setLightboxImageUrl(null);
      setIsLightboxImageLoading(false);
      return;
    }

    const previewUrl = activePhoto.thumbnailUrl ?? activePhoto.url ?? null;
    const fullUrl = activePhoto.url ?? previewUrl;

    setLightboxImageUrl(previewUrl);
    setIsLightboxImageLoading(Boolean(fullUrl && fullUrl !== previewUrl));

    if (!fullUrl || fullUrl === previewUrl) {
      return;
    }

    let cancelled = false;
    preloadImage(fullUrl)
      .then(() => {
        if (!cancelled) {
          setLightboxImageUrl(fullUrl);
          setIsLightboxImageLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLightboxImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePhoto]);
  const reloadAlbumPage = async () => {
    const page = await getPublicAlbumPage(albumId, { limit: Math.max(PHOTOS_PER_PAGE, photoOffset), offset: 0 });
    setAlbum(page.album);
    setPhotos(page.photos);
    setPhotoOffset(page.photos.length);
    setHasMorePhotos(page.hasMore);
  };

  const loadMorePhotos = async () => {
if (isLoadingPhotos || !hasMorePhotos) return;

    try {
      setIsLoadingPhotos(true);
      const page = await getPublicAlbumPage(albumId, { limit: PHOTOS_PER_PAGE, offset: photoOffset });
      setPhotos((current) => {
        const seen = new Set(current.map((photo) => photo.id));
        return [...current, ...page.photos.filter((photo) => !seen.has(photo.id))];
      });
      setPhotoOffset((current) => current + page.photos.length);
      setHasMorePhotos(page.hasMore);
    } catch (error) {
      setMessage(`More photos could not be loaded: ${error.message}`);
    } finally {
      setIsLoadingPhotos(false);
    }
  };
if (isLoadingAlbum) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Album</p>
        <h1>Loading album...</h1>
      </section>
    );
  }
if (loadError) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Album</p>
        <h1>Album could not be loaded</h1>
        <p className="helper-text">{loadError.message}</p>
        <Link className="inline-action" to="/gallery">Back to gallery</Link>
      </section>
    );
  }
if (!album) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Album</p>
        <h1>Album not found</h1>
        <Link className="inline-action" to="/gallery">
          Back to gallery
        </Link>
      </section>
    );
  }

  const coverImage = album.thumbnailUrl ?? photos[0]?.thumbnailUrl ?? photos[0]?.url;
  const showPreviousPhoto = () => {
    setActivePhotoIndex((current) =>
      current === null ? null : (current - 1 + photos.length) % photos.length
    );
  };
  const showNextPhoto = () => {
    setActivePhotoIndex((current) =>
      current === null ? null : (current + 1) % photos.length
    );
  };
  const togglePhotoSelection = (photoId) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]
    );
  };
  const deleteSelectedPhotos = async () => {
    try {
      setIsSaving(true);
      setMessage("Deleting selected photos...");
      await deletePhotos(selectedPhotoIds);
      setMessage(`${selectedPhotoIds.length} photo${selectedPhotoIds.length === 1 ? "" : "s"} deleted.`);
      setSelectedPhotoIds([]);
      await reloadAlbumPage();
    } finally {
      setIsSaving(false);
    }
  };
  const canEditAlbum = Boolean(user && (isAdmin || (canPublishContent(user) && album.submittedBy === user.id)));
  const beginAlbumEdit = () => {
    setAlbumEdit({
      title: album.title ?? "",
      eventDate: album.eventDate ?? "",
      location: album.location ?? "",
      category: album.category ?? "",
      description: album.description ?? "",
      thumbnailUrl: album.thumbnailUrl ?? null,
      thumbnailPath: album.thumbnailPath ?? null,
      thumbnailFile: null,
      coverLabel: album.coverLabel ?? "",
      approvalStatus: album.approvalStatus ?? "pending",
      isRevision: album.isRevision,
      revisionId: album.revisionId,
      originalId: album.originalId
    });
    setIsEditingAlbum(true);
  };
  const saveAlbumEdit = async (event) => {
    event.preventDefault();
    const requestedStatus = event.nativeEvent.submitter?.value ?? "pending";
    const shouldCreateRevision = !isAdmin && album.approvalStatus === "approved";
    const nextStatus = requestedStatus === "draft" ? "draft" : shouldCreateRevision ? "pending_update" : "pending";

    try {
      setIsSaving(true);
      setMessage(albumEdit.thumbnailFile ? "Optimizing and uploading album thumbnail..." : "Saving album...");
      await updateAlbum(album.revisionId ?? album.id, {
        ...albumEdit,
        approvalStatus: isAdmin ? albumEdit.approvalStatus : nextStatus,
        revisionOfId: shouldCreateRevision ? album.id : undefined
      });
      setMessage(nextStatus === "draft" ? "Album draft saved." : "Album sent for approval.");
      setIsEditingAlbum(false);
      await reloadAlbumPage();
    } catch (error) {
      setMessage(`Album save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-section">
      {coverImage ? (
        <img
          className="album-detail-cover-image"
          src={coverImage}
          alt={album.title}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          sizes="100vw"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : (
        <div className="album-detail-cover">
          <span>{album.coverLabel}</span>
        </div>
      )}
      <p className="eyebrow">Album</p>
      <h1>{album.title}</h1>
      {canEditAlbum && !isEditingAlbum && (
        <div className="floating-editor-actions">
          <button type="button" className="inline-action" onClick={beginAlbumEdit}>Edit album</button>
        </div>
      )}
      <div className="card-meta">
        <span><CalendarDays size={16} aria-hidden="true" />{album.eventDate}</span>
        <span><MapPin size={16} aria-hidden="true" />{album.location}</span>
        <span><Images size={16} aria-hidden="true" />{album.photoCount || photos.length} photos</span>
      </div>
      {message && <p className="helper-text">{message}</p>}
      {isSaving && <UploadLoadingState message={message || "Saving album..."} />}
      {isEditingAlbum && albumEdit && (
        <form className="editor-panel blog-detail-editor" onSubmit={saveAlbumEdit}>
          <label>Album title<input required value={albumEdit.title} onChange={(event) => setAlbumEdit((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Event date<input type="date" value={albumEdit.eventDate} onChange={(event) => setAlbumEdit((current) => ({ ...current, eventDate: event.target.value }))} /></label>
          <label>Location<input value={albumEdit.location} onChange={(event) => setAlbumEdit((current) => ({ ...current, location: event.target.value }))} /></label>
          <label>Category<input value={albumEdit.category} onChange={(event) => setAlbumEdit((current) => ({ ...current, category: event.target.value }))} /></label>
          <label>Description<textarea rows="3" value={albumEdit.description} onChange={(event) => setAlbumEdit((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className="file-picker">Replace album thumbnail<input type="file" accept={acceptedImageTypes} onChange={(event) => setAlbumEdit((current) => ({ ...current, thumbnailFile: event.target.files?.[0] ?? null }))} /></label>
          {albumEdit.thumbnailFile && <span className="helper-text">{albumEdit.thumbnailFile.name}</span>}
          {isAdmin && (
            <label>Status<select value={albumEdit.approvalStatus} onChange={(event) => setAlbumEdit((current) => ({ ...current, approvalStatus: event.target.value }))}>{["draft", "pending", "pending_update", "needs_changes", "approved", "rejected", "archived"].map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
          )}
          <div className="blog-submit-actions">
            {!isAdmin && <button type="submit" value="draft" disabled={isSaving}>Save draft</button>}
            <button type="submit" value="pending" disabled={isSaving}>{isSaving ? "Saving..." : isAdmin ? "Save changes" : "Send for approval"}</button>
            <button type="button" className="secondary-action" disabled={isSaving} onClick={() => setIsEditingAlbum(false)}>Cancel</button>
          </div>
        </form>
      )}
      {isAdmin && (
        <div className="album-admin-actions">
          <span>{selectedPhotoIds.length} selected</span>
          <button type="button" className="inline-action" onClick={() => setSelectedPhotoIds(photos.map((photo) => photo.id))}>Select loaded</button>
          <button type="button" className="inline-action" onClick={() => setSelectedPhotoIds([])}>Clear</button>
          <button type="button" className="inline-action danger-action" disabled={!selectedPhotoIds.length || isSaving} onClick={deleteSelectedPhotos}>{isSaving ? "Deleting..." : "Delete selected"}</button>
        </div>
      )}
      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <article className={`gallery-tile selectable-photo ${selectedPhotoIds.includes(photo.id) ? "selected" : ""}`} key={photo.id}>
            {isAdmin && (
              <label className="photo-select-checkbox">
                <input type="checkbox" checked={selectedPhotoIds.includes(photo.id)} onChange={() => togglePhotoSelection(photo.id)} />
                <span>Select photo</span>
              </label>
            )}
            {photo.thumbnailUrl || photo.url ? (
              <button type="button" className="gallery-photo-button" onClick={() => setActivePhotoIndex(index)} aria-label={`Open photo ${index + 1}`}>
                <img
                  className="gallery-photo"
                  src={photo.thumbnailUrl ?? photo.url}
                  alt=""
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
                  width={480}
                  height={320}
                  sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </button>
            ) : (
              <button type="button" className="photo-placeholder" onClick={() => setActivePhotoIndex(index)} aria-label={`Open photo ${index + 1}`}>
                <span>{index + 1}</span>
              </button>
            )}
          </article>
        ))}
      </div>
      {!photos.length && !isLoadingPhotos && <p className="empty-public-state">No approved photos are available in this album yet.</p>}
      {hasMorePhotos && (
        <div className="load-more-row">
          <button type="button" className="inline-action" onClick={loadMorePhotos} disabled={isLoadingPhotos}>
            {isLoadingPhotos ? "Loading photos..." : "Load More Photos"}
          </button>
          <span>{photos.length} photos loaded</span>
        </div>
      )}
      {activePhoto && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button type="button" className="lightbox-close" aria-label="Close photo viewer" onClick={() => setActivePhotoIndex(null)}><X size={24} aria-hidden="true" /></button>
          <button type="button" className="lightbox-nav previous" aria-label="Previous photo" onClick={showPreviousPhoto}><ChevronLeft size={34} aria-hidden="true" /></button>
          {lightboxImageUrl ? (
            <>
              <img
                key={`${activePhoto.id}-${lightboxImageUrl}`}
                className={`lightbox-image ${isLightboxImageLoading ? "loading-next" : ""}`}
                src={lightboxImageUrl}
                alt={activePhoto.title || "Selected album photo"}
                decoding="async"
                width={activePhoto.width || undefined}
                height={activePhoto.height || undefined}
              />
              {isLightboxImageLoading && <span className="lightbox-loading-note">Loading sharper image...</span>}
            </>
          ) : <div className="lightbox-missing">Photo preview unavailable</div>}
          <button type="button" className="lightbox-nav next" aria-label="Next photo" onClick={showNextPhoto}><ChevronRight size={34} aria-hidden="true" /></button>
          <div className="lightbox-count">{activePhotoIndex + 1} / {photos.length}</div>
        </div>
      )}
    </section>
  );
}

function UploadLoadingState({ message }) {
  return (
    <div className="upload-loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{message}</strong>
        <small>Keep this page open while the action finishes.</small>
      </div>
    </div>
  );
}

