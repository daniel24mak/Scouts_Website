import { useEffect, useState } from "react";
import { addAlbumPhotos, createAlbum, createBlog } from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import RichTextEditor from "../components/RichTextEditor.jsx";

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const wizardSteps = ["Details", "Media", "Review"];

function WizardStepper({ step }) {
  return (
    <div className="wizard-stepper" aria-label={`Step ${step + 1} of ${wizardSteps.length}`}>
      <div className="wizard-stepper-desktop">
        {wizardSteps.map((label, index) => (
          <span className={`wizard-step ${index < step ? "complete" : ""} ${index === step ? "current" : ""}`} key={label}>
            <i>{index + 1}</i>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <div className="wizard-stepper-mobile">
        <strong>Step {step + 1} of {wizardSteps.length}</strong>
        <div><span style={{ width: `${((step + 1) / wizardSteps.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

function WizardControls({ step, setStep, isSubmitting = false, submitLabel = "Submit" }) {
  return (
    <div className="wizard-actions">
      {step > 0 && <button type="button" className="secondary-action" onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>}
      {step < 2 ? (
        <button type="button" className="primary-action" onClick={() => setStep((current) => Math.min(2, current + 1))}>Next</button>
      ) : (
        <button type="submit" className="primary-action" disabled={isSubmitting}>{isSubmitting ? "Working..." : submitLabel}</button>
      )}
    </div>
  );
}

function ReviewGrid({ items }) {
  return (
    <div className="review-grid">
      {items.map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value || "Not set"}</strong>
        </span>
      ))}
    </div>
  );
}

export default function ChiefContentDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, refresh } = useBootstrap();
  const availableAlbums = data.allGalleryAlbums ?? data.galleryAlbums;
  const [message, setMessage] = useState("");
  const [blog, setBlog] = useState({ title: "", excerpt: "", body: "", albumId: "" });
  const [blogWizardStep, setBlogWizardStep] = useState(0);
  const [album, setAlbum] = useState({
    title: "",
    eventDate: "",
    location: "",
    category: "",
    description: ""
  });
  const [albumWizardStep, setAlbumWizardStep] = useState(0);
  const [albumThumbnailFile, setAlbumThumbnailFile] = useState(null);
  const [photoAlbumId, setPhotoAlbumId] = useState(availableAlbums[0]?.id ?? "");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoUploadProgress, setPhotoUploadProgress] = useState({ completed: 0, total: 0, percent: 0 });
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (message) {
      showToast(message);
    }
  }, [message, showToast]);

  useEffect(() => {
    if (!photoAlbumId && availableAlbums[0]?.id) {
      setPhotoAlbumId(availableAlbums[0].id);
    }
  }, [availableAlbums, photoAlbumId]);

  const setFiles = (files) => {
    const incoming = Array.from(files ?? []);
    setPhotoFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !seen.has(`${file.name}-${file.size}-${file.lastModified}`))];
    });
  };

  const removeFile = (fileToRemove) => {
    setPhotoFiles((current) => current.filter((file) => file !== fileToRemove));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setFiles(event.dataTransfer.files);
  };

  const handleBlogSubmit = async (event) => {
    event.preventDefault();
    try {
      setUploadStatus("Submitting blog for review...");
      await createBlog({
        title: blog.title,
        excerpt: blog.excerpt,
        body: blog.body || blog.excerpt,
        albumId: blog.albumId || null,
        author: user.name
      });
      setBlog({ title: "", excerpt: "", body: "", albumId: "" });
      setBlogWizardStep(0);
      setMessage("Blog submitted for admin approval.");
      await refresh();
    } catch (error) {
      setMessage(`Blog submit failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };

  const handleAlbumSubmit = async (event) => {
    event.preventDefault();
    try {
    if (!albumThumbnailFile) {
        setMessage("Please upload an album thumbnail.");
        return;
      }
    if (!photoFiles.length) {
        setMessage("Please upload at least one photo.");
        return;
      }

      setUploadStatus("Creating album and optimizing photos...");
      setPhotoUploadProgress({ completed: 0, total: photoFiles.length, percent: 0 });
      const created = await createAlbum({
        title: album.title,
        eventDate: album.eventDate,
        location: album.location,
        category: album.category,
        description: album.description,
        thumbnailFile: albumThumbnailFile,
        coverLabel: album.category || "Album"
      });
      const albumId = Array.isArray(created) ? created[0]?.id : created?.id;
      await addAlbumPhotos(albumId, {
        photos: photoFiles,
        onProgress: (progress) => {
          setPhotoUploadProgress(progress);
          setUploadStatus(`Uploading optimized photos: ${progress.completed} of ${progress.total}`);
        }
      });
      setAlbum({ title: "", eventDate: "", location: "", category: "", description: "" });
      setAlbumThumbnailFile(null);
      setPhotoFiles([]);
      setAlbumWizardStep(0);
      setPhotoUploadProgress({ completed: 0, total: 0, percent: 0 });
      setMessage("Album and photo bundle submitted for admin approval.");
      await refresh();
    } catch (error) {
      setMessage(`Album upload failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };

  const handlePhotosSubmit = async (event) => {
    event.preventDefault();
    try {
      setUploadStatus("Optimizing and uploading photos...");
      setPhotoUploadProgress({ completed: 0, total: photoFiles.length, percent: 0 });
      await addAlbumPhotos(photoAlbumId, {
        photos: photoFiles,
        onProgress: (progress) => {
          setPhotoUploadProgress(progress);
          setUploadStatus(`Uploading optimized photos: ${progress.completed} of ${progress.total}`);
        }
      });
      setPhotoFiles([]);
      setPhotoUploadProgress({ completed: 0, total: 0, percent: 0 });
      setMessage("Photos submitted for admin approval.");
      await refresh();
    } catch (error) {
      setMessage(`Photo upload failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };

  return (
    <section className="page-section">
      <p className="eyebrow">Publishing dashboard</p>
      <h1>Add blogs and event photo albums</h1>
      {message && <p className="helper-text">{message}</p>}
      {uploadStatus && <UploadLoadingState message={uploadStatus} progress={photoUploadProgress.total ? photoUploadProgress : null} />}
      <div className="content-grid">
        <form className="editor-panel wizard-form" onSubmit={handleBlogSubmit}>
          <h2>New blog post</h2>
          <WizardStepper step={blogWizardStep} />
          {blogWizardStep === 0 && (
            <div className="wizard-panel">
              <label>
                Title
                <input type="text" required placeholder="Activity title" value={blog.title} onChange={(event) => setBlog((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Summary
                <textarea rows="3" required placeholder="Short update for the blogs page" value={blog.excerpt} onChange={(event) => setBlog((current) => ({ ...current, excerpt: event.target.value }))} />
              </label>
              <RichTextEditor label="Full blog content" required value={blog.body} onChange={(value) => setBlog((current) => ({ ...current, body: value }))} minHeight={220} placeholder="Write the full blog with links, headings, colors, lists, and emojis..." />
            </div>
          )}
          {blogWizardStep === 1 && (
            <div className="wizard-panel">
              <label>
                Linked album
                <select value={blog.albumId} onChange={(event) => setBlog((current) => ({ ...current, albumId: event.target.value }))}>
                  <option value="">No linked album</option>
                  {availableAlbums.map((albumItem) => <option key={albumItem.id} value={albumItem.id}>{albumItem.title}</option>)}
                </select>
              </label>
            </div>
          )}
          {blogWizardStep === 2 && (
            <div className="wizard-panel">
              <h3>Review blog</h3>
              <ReviewGrid items={[
                ["Title", blog.title],
                ["Summary", blog.excerpt],
                ["Linked album", availableAlbums.find((albumItem) => albumItem.id === blog.albumId)?.title]
              ]} />
            </div>
          )}
          <WizardControls step={blogWizardStep} setStep={setBlogWizardStep} isSubmitting={Boolean(uploadStatus)} submitLabel="Submit blog" />
        </form>
        <form className="editor-panel wizard-form" onSubmit={handleAlbumSubmit}>
          <h2>New event album</h2>
          <WizardStepper step={albumWizardStep} />
          {albumWizardStep === 0 && (
            <div className="wizard-panel">
              <label>Event name<input type="text" required placeholder="Badge Ceremony" value={album.title} onChange={(event) => setAlbum((current) => ({ ...current, title: event.target.value }))} /></label>
              <label>Event date<input type="date" required value={album.eventDate} onChange={(event) => setAlbum((current) => ({ ...current, eventDate: event.target.value }))} /></label>
              <label>Location<input type="text" required placeholder="Main Hall" value={album.location} onChange={(event) => setAlbum((current) => ({ ...current, location: event.target.value }))} /></label>
              <label>Category<input type="text" required placeholder="Camps" value={album.category} onChange={(event) => setAlbum((current) => ({ ...current, category: event.target.value }))} /></label>
              <RichTextEditor label="Album description" value={album.description} onChange={(value) => setAlbum((current) => ({ ...current, description: value }))} minHeight={180} placeholder="Optional formatted album description with links, lists, and emojis..." />
            </div>
          )}
          {albumWizardStep === 1 && (
            <div className="wizard-panel">
              <label className="file-picker">Album thumbnail<input type="file" required accept={acceptedImageTypes} onChange={(event) => setAlbumThumbnailFile(event.target.files?.[0] ?? null)} /></label>
              {albumThumbnailFile && <span className="helper-text">{albumThumbnailFile.name}</span>}
              <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                <strong>Drop album photos here</strong>
                <span>or choose multiple images before submitting the album</span>
                <label className="file-picker">Choose photos<input type="file" accept={acceptedImageTypes} multiple onChange={(event) => { setFiles(event.target.files); event.target.value = ""; }} /></label>
              </div>
              <div className="upload-preview" aria-label="Selected album photos">
                {photoFiles.map((file) => <span key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}<button type="button" onClick={() => removeFile(file)}>Remove</button></span>)}
              </div>
              {photoUploadProgress.total > 0 && (
                <div className="upload-progress" aria-label="Photo upload progress">
                  <div><span style={{ width: `${photoUploadProgress.percent}%` }} /></div>
                  <strong>{photoUploadProgress.percent}%</strong>
                  <small>{photoUploadProgress.completed} of {photoUploadProgress.total} photos uploaded</small>
                </div>
              )}
            </div>
          )}
          {albumWizardStep === 2 && (
            <div className="wizard-panel">
              <h3>Review album</h3>
              <ReviewGrid items={[["Event name", album.title], ["Date", album.eventDate], ["Location", album.location], ["Category", album.category], ["Thumbnail", albumThumbnailFile?.name], ["Photos", `${photoFiles.length} selected`]]} />
            </div>
          )}
          <WizardControls step={albumWizardStep} setStep={setAlbumWizardStep} isSubmitting={Boolean(uploadStatus)} submitLabel="Submit album and photos" />
        </form>
        <form className="editor-panel" onSubmit={handlePhotosSubmit}>
          <h2>Bulk add photos</h2>
          <label>
            Album
            <select value={photoAlbumId} onChange={(event) => setPhotoAlbumId(event.target.value)}>
              {availableAlbums.map((albumItem) => (
                <option key={albumItem.id} value={albumItem.id}>
                  {albumItem.title}
                </option>
              ))}
            </select>
          </label>
          <div
            className="upload-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <strong>Drop event photos here</strong>
            <span>or select multiple image files from your device</span>
            <label className="file-picker">
              Choose photos
              <input
                type="file"
                accept={acceptedImageTypes}
                multiple
                onChange={(event) => {
                  setFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="upload-preview" aria-label="Selected upload preview">
            {photoFiles.map((file) => (
              <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                {file.name}
                <button type="button" onClick={() => removeFile(file)}>Remove</button>
              </span>
            ))}
          </div>
          {photoUploadProgress.total > 0 && (
            <div className="upload-progress" aria-label="Photo upload progress">
              <div><span style={{ width: `${photoUploadProgress.percent}%` }} /></div>
              <strong>{photoUploadProgress.percent}%</strong>
              <small>{photoUploadProgress.completed} of {photoUploadProgress.total} photos uploaded</small>
            </div>
          )}
          <button type="submit" disabled={Boolean(uploadStatus) || !photoFiles.length || !photoAlbumId}>
            {uploadStatus ? "Uploading..." : "Upload selected photos"}
          </button>
        </form>
      </div>
    </section>
  );
}

function UploadLoadingState({ message, progress = null }) {
  return (
    <div className="upload-loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{message}</strong>
        <small>Keep this page open while the upload finishes.</small>
      </div>
      {progress && (
        <div className="upload-progress compact" aria-label="Current upload progress">
          <div><span style={{ width: `${progress.percent}%` }} /></div>
          <strong>{progress.percent}%</strong>
          <small>{progress.completed} of {progress.total} uploaded</small>
        </div>
      )}
    </div>
  );
}


