import { Images } from "lucide-react";
import SafeImage from "../components/SafeImage.jsx";
import { Link } from "react-router-dom";
import { getPublicBlogsPage } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";

export default function BlogsPage() {
  const { data, isLoading, error } = usePublicData(
    () => getPublicBlogsPage({ limit: 24, offset: 0 }),
    [],
    { blogPosts: [], hasMore: false },
    ["blogs", 24, 0]
  );
  const posts = data?.blogPosts ?? [];

  return (
    <section className="page-section">
      <p className="eyebrow">Blogs</p>
      <h1>Latest group updates</h1>
      {error && <p className="empty-public-state">Blogs could not be loaded: {error.message}</p>}
      <div className="card-list" aria-busy={isLoading}>
        {isLoading && !posts.length ? Array.from({ length: 4 }, (_, index) => (
          <article className="card public-loading-card" key={`loading-blog-${index}`}>
            <div className="loading-media" />
            <div>
              <span>Loading post...</span>
              <i />
              <i className="wide" />
              <i className="short" />
            </div>
          </article>
        )) : posts.map((post) => (
          <article className="card" key={post.id}>
            {post.thumbnailUrl ? (
              <SafeImage
                src={post.thumbnailUrl}
                alt={post.title}
                className="blog-thumb-image-frame"
                imageClassName="blog-thumb-image"
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 360px"
              />
            ) : (
              <div className="card-thumb" style={{ "--tile-color": post.thumbnailColor }}>
                <Images size={32} aria-hidden="true" />
              </div>
            )}
            <div>
              <p className="eyebrow">{post.date}</p>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <Link className="inline-action" to={`/blogs/${post.slug}`}>Read post</Link>
            </div>
          </article>
        ))}
      </div>
      {!posts.length && !isLoading && <p className="empty-public-state">No approved blog posts are available yet.</p>}
    </section>
  );
}

