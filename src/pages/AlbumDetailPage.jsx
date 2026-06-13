import { CalendarDays, ChevronLeft, ChevronRight, Images, MapPin, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { deletePhotos } from "../api/client.js";
import { updateAlbum } from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { canManageSystem, canPublishContent } from "../services/permissions.js";

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const initialPhotoLimit = 30;
const photoPageSize = 30;

export default function AlbumDetailPage() {
  const { albumId } = useParams();
  const { data, refresh } = useBootstrap();
  const { user } = useAuth();
  const allAlbums = data.allGalleryAlbums ?? data.galleryAlbums;
  const album =
    allAlbums.find((item) => item.id === albumId && (item.approvalStatus === "approved" || item.submittedBy === user?.id || canManageSystem(user))) ??
    data.galleryAlbums.find((item) => item.id === albumId);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isEditingAlbum, setIsEditingAlbum] = useState(false);
  const [albumEdit, setAlbumEdit] = useState(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [visiblePhotoLimit, setVisiblePhotoLimit] = useState(initialPhotoLimit);
  const isAdmin = canManageSystem(user);

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

  const visiblePhotos = album.photos.slice(0, visiblePhotoLimit);
  const hasMorePhotos = visiblePhotoLimit < album.photos.length;
  const activePhoto = activePhotoIndex === null ? null : album.photos[activePhotoIndex];
  const coverImage = album.thumbnailUrl ?? album.photos[0]?.thumbnailUrl ?? album.photos[0]?.url;
  const showPreviousPhoto = () => {
    setActivePhotoIndex((current) =>
      current === null ? null : (current - 1 + album.photos.length) % album.photos.length
    );
  };
  const showNextPhoto = () => {
    setActivePhotoIndex((current) =>
      current === null ? null : (current + 1) % album.photos.length
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
      await refresh();
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
      await refresh();
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
        <span>
          <CalendarDays size={16} aria-hidden="true" />
          {album.eventDate}
        </span>
        <span>
          <MapPin size={16} aria-hidden="true" />
          {album.location}
        </span>
        <span>
          <Images size={16} aria-hidden="true" />
          {album.photoCount} photos
        </span>
      </div>
      {message && <p className="helper-text">{message}</p>}
      {isSaving && <UploadLoadingState message={message || "Saving album..."} />}
      {isEditingAlbum && albumEdit && (
        <form className="editor-panel blog-detail-editor" onSubmit={saveAlbumEdit}>
          <label>
            Album title
            <input required value={albumEdit.title} onChange={(event) => setAlbumEdit((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            Event date
            <input type="date" value={albumEdit.eventDate} onChange={(event) => setAlbumEdit((current) => ({ ...current, eventDate: event.target.value }))} />
          </label>
          <label>
            Location
            <input value={albumEdit.location} onChange={(event) => setAlbumEdit((current) => ({ ...current, location: event.target.value }))} />
          </label>
          <label>
            Category
            <input value={albumEdit.category} onChange={(event) => setAlbumEdit((current) => ({ ...current, category: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea rows="3" value={albumEdit.description} onChange={(event) => setAlbumEdit((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="file-picker">
            Replace album thumbnail
            <input type="file" accept={acceptedImageTypes} onChange={(event) => setAlbumEdit((current) => ({ ...current, thumbnailFile: event.target.files?.[0] ?? null }))} />
          </label>
          {albumEdit.thumbnailFile && <span className="helper-text">{albumEdit.thumbnailFile.name}</span>}
          {isAdmin && (
            <label>
              Status
              <select value={albumEdit.approvalStatus} onChange={(event) => setAlbumEdit((current) => ({ ...current, approvalStatus: event.target.value }))}>
                {["draft", "pending", "pending_update", "needs_changes", "approved", "rejected", "archived"].map((status) => (
                  <option value={status} key={status}>{status}</option>
                ))}
              </select>
            </label>
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
          <button type="button" className="inline-action" onClick={() => setSelectedPhotoIds(album.photos.map((photo) => photo.id))}>
            Select all
          </button>
          <button type="button" className="inline-action" onClick={() => setSelectedPhotoIds([])}>
            Clear
          </button>
          <button type="button" className="inline-action danger-action" disabled={!selectedPhotoIds.length || isSaving} onClick={deleteSelectedPhotos}>
            {isSaving ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      )}
      <div className="gallery-grid">
        {visiblePhotos.map((photo, index) => (
          <article className={`gallery-tile selectable-photo ${selectedPhotoIds.includes(photo.id) ? "selected" : ""}`} key={photo.id}>
            {isAdmin && (
              <label className="photo-select-checkbox">
                <input type="checkbox" checked={selectedPhotoIds.includes(photo.id)} onChange={() => togglePhotoSelection(photo.id)} />
                <span>Select photo</span>
              </label>
            )}
            {photo.thumbnailUrl || photo.url ? (
              <button
                type="button"
                className="gallery-photo-button"
                onClick={() => setActivePhotoIndex(index)}
                aria-label={`Open photo ${index + 1}`}
              >
                <img
                  className="gallery-photo"
                  src={photo.thumbnailUrl ?? photo.url}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </button>
            ) : (
              <button
                type="button"
                className="photo-placeholder"
                onClick={() => setActivePhotoIndex(index)}
                aria-label={`Open photo ${index + 1}`}
              >
                <span>{index + 1}</span>
              </button>
            )}
          </article>
        ))}
      </div>
      {activePhoto && (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button
            type="button"
            className="lightbox-close"
            aria-label="Close photo viewer"
            onClick={() => setActivePhotoIndex(null)}
          >
            <X size={24} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="lightbox-nav previous"
            aria-label="Previous photo"
            onClick={showPreviousPhoto}
          >
            <ChevronLeft size={34} aria-hidden="true" />
          </button>
          {activePhoto.url ? (
            <img className="lightbox-image" src={activePhoto.url} alt={activePhoto.title || "Selected album photo"} decoding="async" />
          ) : (
            <div className="lightbox-missing">Photo preview unavailable</div>
          )}
          <button
            type="button"
            className="lightbox-nav next"
            aria-label="Next photo"
            onClick={showNextPhoto}
          >
            <ChevronRight size={34} aria-hidden="true" />
          </button>
          <div className="lightbox-count">
            {activePhotoIndex + 1} / {album.photos.length}
          </div>
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
