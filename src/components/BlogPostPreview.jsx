import SafeImage from "./SafeImage.jsx";
import UserAvatar from "./UserAvatar.jsx";
import FormattedText from "./FormattedText.jsx";

function formatPostCategory(value) {
  return String(value || "general")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPostDate(post) {
  const raw = post?.date || post?.publishedAt || post?.createdAt || post?.updatedAt || "";
  if (!raw) return "Not published yet";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw).slice(0, 16);

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export default function BlogPostPreview({ post, linkedAlbum, compact = false, showBackLink = false, actions = null }) {
  if (!post) return null;

  const authorName = post.author || post.submitterName || "Unknown author";

  return (
    <article className={`blog-post-preview${compact ? " compact" : ""}`}>
      {post.thumbnailUrl ? (
        <SafeImage
          src={post.thumbnailUrl}
          alt={post.title}
          className="blog-detail-banner-image-frame"
          imageClassName="blog-detail-banner-image"
          loading={compact ? "lazy" : "eager"}
          fetchPriority={compact ? undefined : "high"}
          sizes="100vw"
        />
      ) : (
        <div className="blog-detail-banner-fallback" style={{ "--tile-color": post.thumbnailColor }}>
          <span>{post.title}</span>
        </div>
      )}
      <header className="blog-detail-header">
        {showBackLink && <a className="blog-back-link" href="/blogs">Back to News &amp; Blog</a>}
        <h1>{post.title}</h1>
        <div className="blog-detail-meta">
          <span className="blog-category-badge detail">{formatPostCategory(post.category || post.categoryName)}</span>
          <span>{formatPostDate(post)}</span>
          <span className="blog-author-byline">
            <UserAvatar name={authorName} imageUrl={post.authorProfilePictureUrl || post.submitterProfilePictureUrl} size={30} />
            {authorName}
          </span>
        </div>
        {actions}
      </header>
      <div className="blog-reading-column">
        <FormattedText text={post.body} fallback={post.excerpt} className="detail-copy formatted-text" />
        {linkedAlbum && (
          <a className="linked-album" href={`/gallery/${linkedAlbum.id}`}>
            View linked album: {linkedAlbum.title}
          </a>
        )}
      </div>
    </article>
  );
}
