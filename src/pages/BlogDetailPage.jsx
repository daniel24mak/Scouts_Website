import { Copy, Images, Mail, Share2 } from "lucide-react";
import SafeImage from "../components/SafeImage.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { updateBlog } from "../api/client.js";
import { getPublicBlogDetailPage, getPublicBlogsPage } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import FormattedText from "../components/FormattedText.jsx";
import RichTextEditor from "../components/RichTextEditor.jsx";
import { canManageSystem, canPublishContent } from "../services/permissions.js";

const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

function formatPostCategory(value) {
  return String(value || "general")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPostCategory(post) {
  return formatPostCategory(post?.category || post?.categoryName || "general");
}

function getPostDate(post) {
  return post?.date || post?.createdAt || post?.updatedAt || "";
}

export default function BlogDetailPage() {
  const { slug } = useParams();
  const { data, isLoading, setData } = usePublicData(
    () => getPublicBlogDetailPage(slug),
    [slug],
    { post: null, linkedAlbum: null },
    ["blog-detail", slug]
  );
  const { data: relatedData } = usePublicData(
    () => getPublicBlogsPage({ limit: 6, offset: 0 }),
    [slug],
    { blogPosts: [], hasMore: false },
    ["blog-related", slug]
  );
  const { user } = useAuth();
  const { showToast } = useToast();
  const post = data?.post ?? null;
  const linkedAlbum = data?.linkedAlbum ?? null;
  const relatedPosts = (relatedData?.blogPosts ?? []).filter((item) => item.slug !== slug).slice(0, 3);
  const [isEditing, setIsEditing] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (message) {
      showToast(message);
    }
  }, [message, showToast]);

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
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareTitle = encodeURIComponent(post.title ?? "Scout blog post");
  const mailShareUrl = `mailto:?subject=${encodedShareTitle}&body=${encodedShareUrl}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Blog link copied.");
    } catch (error) {
      setMessage(`Could not copy link: ${error.message}`);
    }
  };

  const sharePost = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url: shareUrl });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }

    await copyShareLink();
  };

  const beginEdit = () => {
    setEditPost({
      title: post.title ?? "",
      slug: post.slug ?? "",
      postType: post.postType ?? post.contentType ?? "blog",
      category: post.category ?? "general",
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
    <article className="page-section blog-detail-page">
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
        <SafeImage
          src={post.thumbnailUrl}
          alt={post.title}
          className="blog-detail-banner-image-frame"
          imageClassName="blog-detail-banner-image"
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
        />
      ) : (
        <div className="blog-detail-banner-fallback" style={{ "--tile-color": post.thumbnailColor }}>
          <span>{post.title}</span>
        </div>
      )}
      <header className="blog-detail-header">
        <Link className="blog-back-link" to="/blogs">Back to News &amp; Blog</Link>
        <h1>{post.title}</h1>
        <div className="blog-detail-meta">
          <span className="blog-category-badge detail">{getPostCategory(post)}</span>
          <span>{getPostDate(post)}</span>
          {post.author && <span className="blog-author-byline"><UserAvatar name={post.author} imageUrl={post.authorProfilePictureUrl} size={30} />{post.author}</span>}
        </div>
        <div className="blog-share-row" aria-label="Share this blog post">
          <button type="button" className="blog-share-button" onClick={sharePost} aria-label="Share post">
            <Share2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="blog-share-button" onClick={copyShareLink} aria-label="Copy blog link">
            <Copy size={18} aria-hidden="true" />
          </button>
          <a className="blog-share-button" href={mailShareUrl} aria-label="Share by email">
            <Mail size={18} aria-hidden="true" />
          </a>
        </div>
      </header>
      {isEditing && editPost ? (
        <form className="editor-panel blog-detail-editor" onSubmit={saveEdit}>
          <label>
            Title
            <input required value={editPost.title} onChange={(event) => setEditPost((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <div className="inline-editor-grid compact">
            <label>
              Type
              <select value={editPost.postType ?? "blog"} onChange={(event) => setEditPost((current) => ({ ...current, postType: event.target.value }))}>
                <option value="blog">Blog</option>
                <option value="news">News</option>
              </select>
            </label>
            <label>
              Category
              <select value={editPost.category ?? "general"} onChange={(event) => setEditPost((current) => ({ ...current, category: event.target.value }))}>
                <option value="general">General</option>
                <option value="camp">Camp</option>
                <option value="weekly_meeting">Weekly meeting</option>
                <option value="church_mass">Church mass</option>
                <option value="celebration">Celebration</option>
                <option value="outdoor_activity">Outdoor activity</option>
                <option value="volunteering_work">Volunteering work</option>
              </select>
            </label>
          </div>
          <label>
            Excerpt
            <textarea rows="3" value={editPost.excerpt} onChange={(event) => setEditPost((current) => ({ ...current, excerpt: event.target.value }))} />
          </label>
          <RichTextEditor label="Full blog content" value={editPost.body} onChange={(value) => setEditPost((current) => ({ ...current, body: value }))} minHeight={260} placeholder="Edit the full blog post with links, headings, colors, and lists..." />
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
        <div className="blog-reading-column">
          <FormattedText text={post.body} className="detail-copy formatted-text" />
          {linkedAlbum && (
            <Link className="linked-album" to={`/gallery/${linkedAlbum.id}`}>
              <Images size={20} aria-hidden="true" />
              View linked album: {linkedAlbum.title}
            </Link>
          )}
        </div>
      )}
      {relatedPosts.length > 0 && (
        <section className="blog-related-section">
          <div className="blog-related-inner">
            <h2>You May Also Like</h2>
            <div className="blog-card-grid related">
              {relatedPosts.map((relatedPost) => (
                <Link className="blog-card" to={`/blogs/${relatedPost.slug}`} key={relatedPost.id}>
                  <div className="blog-card-media">
                    {relatedPost.thumbnailUrl ? (
                      <SafeImage
                        src={relatedPost.thumbnailUrl}
                        alt={relatedPost.title}
                        className="blog-card-image-frame"
                        imageClassName="blog-card-image"
                        loading="lazy"
                        sizes="(max-width: 680px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="blog-card-fallback" style={{ "--tile-color": relatedPost.thumbnailColor }}>
                        <Images size={34} aria-hidden="true" />
                      </div>
                    )}
                    <span className="blog-category-badge">{getPostCategory(relatedPost)}</span>
                  </div>
                  <div className="blog-card-body">
                    <h3>{relatedPost.title}</h3>
                    <div className="blog-card-meta">
                      <span>{getPostDate(relatedPost)}</span>
                    </div>
                    <p>{relatedPost.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
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






