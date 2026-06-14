import { Images } from "lucide-react";
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
      <div className="card-list">
        {posts.map((post) => (
          <article className="card" key={post.id}>
            {post.thumbnailUrl ? (
              <img
                className="blog-thumb-image"
                src={post.thumbnailUrl}
                alt={post.title}
                loading="lazy"
                decoding="async"
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
