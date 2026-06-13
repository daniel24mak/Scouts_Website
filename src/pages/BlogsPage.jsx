import { Images } from "lucide-react";
import { Link } from "react-router-dom";
import { useBootstrap } from "../api/useBootstrap.js";

export default function BlogsPage() {
  const { data } = useBootstrap();

  return (
    <section className="page-section">
      <p className="eyebrow">Blogs</p>
      <h1>Latest group updates</h1>
      <div className="card-list">
        {data.blogPosts.map((post) => (
          <article className="card" key={post.id}>
            {post.thumbnailUrl ? (
              <img className="blog-thumb-image" src={post.thumbnailUrl} alt={post.title} />
            ) : (
              <div className="blog-thumb" style={{ "--tile-color": post.thumbnailColor }}>
                <span>{post.title}</span>
              </div>
            )}
            <div className="card-meta">
              <span>{post.date}</span>
              <span>{post.author}</span>
              {post.albumId && (
                <span>
                  <Images size={16} aria-hidden="true" />
                  linked album
                </span>
              )}
            </div>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <Link className="inline-action" to={`/blogs/${post.slug}`}>
              Open blog
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
