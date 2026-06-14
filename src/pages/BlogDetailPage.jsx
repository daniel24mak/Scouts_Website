import { Images } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { updateBlog } from "../api/client.js";
import { getPublicBlogDetailPage } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import FormattedText from "../components/FormattedText.jsx";
import { canManageSystem, canPublishContent } from "../services/permissions.js";

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

export default function BlogDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, setData } = usePublicData(
    () => getPublicBlogDetailPage(slug),
    [slug],
    { post: null, linkedAlbum: null },
    ["blog-detail", slug]
  );
  const { user } = useAuth();
  const post = data?.post ?? null;
  const linkedAlbum = data?.linkedAlbum ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Blog</p>
        <h1>Loading blog...</h1>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="page-section narrow">
        <p className="eyebrow">Blog</p>
        <h1>Blog post not found</h1>
        <Link className="inline-action" to="/blogs">
          Back to blogs
        </Link>
      </section>
    );
  }

  const albumOptions = linkedAlbum ? [linkedAlbum] : [];
  const canEditPost = Boolean(user && (canManageSystem(user) || (canPublishContent(user) && post.submittedBy === user.id)));
  const beginEdit = () => {
    setEditPost({
      title: post.title ?? "",
      slug: post.slug ?? "",
      author: post.author ?? user?.name ?? "",
      excerpt: post.excerpt ?? "",
      body: post.body ?? "",
      thumbnailColor: post.thumbnailColor ?? "#2f7d6d",
      thumbnailUrl: post.thumbnailUrl ?? "",
      thumbnailPath: post.thumbnailPath ?? "",
      thumbnailFile: null,
      albumId: post.albumId ?? "",
      approvalStatus: post.approvalStatus ?? "pending",
      isRevision: post.isRevision,
      revisionId: post.revisionId,
      originalId: post.originalId
    });
    setIsEditing(true);
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    const requestedStatus = event.nativeEvent.submitter?.value ?? "pending";
    const shouldCreateRevision = !canManageSystem(user) && post.approvalStatus === "approved";
    const nextStatus = requestedStatus === "draft" ? "draft" : shouldCreateRevision ? "pending_update" : "pending";

    try {
      setIsSaving(true);
      setMessage(editPost.thumbnailFile ? "Optimizing and uploading thumbnail..." : "Saving blog...");
      await updateBlog(post.revisionId ?? post.id, {
        ...editPost,
        approvalStatus: canManageSystem(user) ? editPost.approvalStatus : nextStatus,
        revisionOfId: shouldCreateRevision ? post.id : undefined
      });
      setMessage(nextStatus === "draft" ? "Draft saved." : "Blog sent for approval.");
      setIsEditing(false);
      const nextPage = await getPublicBlogDetailPage(slug).catch(() => data);
      setData(nextPage);
    } catch (error) {
      setMessage(`Blog save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="page-section narrow">
      {canEditPost && !isEditing && (
        <div className="floating-editor-actions">
          <button type="button" className="inline-action" onClick={beginEdit}>
            Edit blog
          </button>
        </div>
      )}
      {message && <p className="helper-text">{message}</p>}
      {isSaving && <UploadLoadingState message={message || "Saving blog..."} />}
      {post.thumbnailUrl ? (
        <img
          className="blog-hero-image"
          src={post.thumbnailUrl}
          alt={post.title}
          decoding="async"
          sizes="(max-width: 768px) 100vw, 760px"
        />
      ) : (
        <div className="blog-hero-thumb" style={{ "--tile-color": post.thumbnailColor }}>
          <span>{post.title}</span>
        </div>
      )}
      <p className="eyebrow">Blog</p>
      <h1>{post.title}</h1>
      <div className="card-meta">
        <span>{post.date}</span>
        <span>{post.author}</span>
        {post.approvalStatus && <StatusText status={post.approvalStatus} />}
      </div>
      {isEditing && editPost ? (
        <form className="editor-panel blog-detail-editor" onSubmit={saveEdit}>
          <label>
            Title
            <input required value={editPost.title} onChange={(event) => setEditPost((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            Excerpt
            <textarea rows="3" value={editPost.excerpt} onChange={(event) => setEditPost((current) => ({ ...current, excerpt: event.target.value }))} />
          </label>
          <label>
            Full blog content
            <textarea rows="9" value={editPost.body} onChange={(event) => setEditPost((current) => ({ ...current, body: event.target.value }))} />
            <small className="formatting-help">Formatting: **bold**, *italic*, `code`, - bullet lines, # headings, emojis, and [blog link](/blogs/post-slug).</small>
          </label>
          <label>
            Author
            <input value={editPost.author} onChange={(event) => setEditPost((current) => ({ ...current, author: event.target.value }))} />
          </label>
          <label className="file-picker">
            Thumbnail image
            <input type="file" accept={acceptedImageTypes} onChange={(event) => setEditPost((current) => ({ ...current, thumbnailFile: event.target.files?.[0] ?? null }))} />
          </label>
          {editPost.thumbnailFile && <p className="helper-text">{editPost.thumbnailFile.name}</p>}
          <label>
            Linked album
            <select value={editPost.albumId ?? ""} onChange={(event) => setEditPost((current) => ({ ...current, albumId: event.target.value }))}>
              <option value="">No linked album</option>
              {albumOptions.map((album) => (
                <option value={album.id} key={album.id}>{album.title}</option>
              ))}
            </select>
          </label>
          {canManageSystem(user) && (
            <label>
              Status
              <select value={editPost.approvalStatus} onChange={(event) => setEditPost((current) => ({ ...current, approvalStatus: event.target.value }))}>
                {["draft", "pending", "pending_update", "needs_changes", "approved", "rejected", "archived"].map((status) => (
                  <option value={status} key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
          <div className="blog-submit-actions">
            {!canManageSystem(user) && <button type="submit" value="draft" disabled={isSaving}>Save draft</button>}
            <button type="submit" value="pending" disabled={isSaving}>{isSaving ? "Saving..." : canManageSystem(user) ? "Save changes" : "Send for approval"}</button>
            <button type="button" className="secondary-action" disabled={isSaving} onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <FormattedText text={post.body} className="detail-copy formatted-text" />
      )}
      {linkedAlbum && (
        <Link className="linked-album" to={`/gallery/${linkedAlbum.id}`}>
          <Images size={20} aria-hidden="true" />
          View linked album: {linkedAlbum.title}
        </Link>
      )}
    </article>
  );
}

function UploadLoadingState({ message }) {
  return (
    <div className="upload-loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{message}</strong>
        <small>Keep this page open while the save finishes.</small>
      </div>
    </div>
  );
}

function StatusText({ status }) {
  return <span>{String(status).replace("_", " ")}</span>;
}

