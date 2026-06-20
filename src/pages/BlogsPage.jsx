import { Images, Search } from "lucide-react";
import SafeImage from "../components/SafeImage.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getPublicBlogsPage } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";

const pageSize = 9;

function formatPostCategory(value) {
  return String(value || "general")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPostCategory(post) {
  return formatPostCategory(post.category || post.categoryName || "general");
}

function getPostDate(post) {
  return post.date || post.createdAt || post.updatedAt || "";
}

export default function BlogsPage() {
  const { data, isLoading, error } = usePublicData(
    () => getPublicBlogsPage({ limit: 24, offset: 0 }),
    [],
    { blogPosts: [], hasMore: false },
    ["blogs", 24, 0]
  );
  const posts = data?.blogPosts ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const categories = useMemo(() => {
    const names = posts.map(getPostCategory).filter(Boolean);
    return ["All", ...Array.from(new Set(names))];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return posts.filter((post) => {
      const category = getPostCategory(post);
      const matchesCategory = activeCategory === "All" || category === activeCategory;
      const searchableText = [post.title, post.excerpt, post.author, category, getPostDate(post)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [activeCategory, posts, searchQuery]);

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredPosts.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [activeCategory, searchQuery]);

  return (
    <section className="page-section blog-listing-page">
      <div className="blog-page-header">
        <p className="eyebrow">News</p>
        <h1>News &amp; Blog</h1>
      </div>
      <div className="blog-filter-bar">
        <label className="blog-search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search blog posts</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search posts"
          />
        </label>
        <div className="blog-category-pills" aria-label="Blog categories">
          {categories.map((category) => (
            <button
              type="button"
              className={`blog-category-pill${activeCategory === category ? " active" : ""}`}
              onClick={() => setActiveCategory(category)}
              key={category}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="empty-public-state">Blogs could not be loaded: {error.message}</p>}
      <div className="blog-card-grid" aria-busy={isLoading}>
        {isLoading && !posts.length ? Array.from({ length: 6 }, (_, index) => (
          <article className="blog-card public-loading-card" key={`loading-blog-${index}`}>
            <div className="loading-media" />
            <div>
              <span>Loading post...</span>
              <i />
              <i className="wide" />
              <i className="short" />
            </div>
          </article>
        )) : visiblePosts.map((post) => (
          <Link className="blog-card" to={`/blogs/${post.slug}`} key={post.id}>
            <div className="blog-card-media">
              {post.thumbnailUrl ? (
                <SafeImage
                  src={post.thumbnailUrl}
                  alt={post.title}
                  className="blog-card-image-frame"
                  imageClassName="blog-card-image"
                  loading="lazy"
                  sizes="(max-width: 680px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="blog-card-fallback" style={{ "--tile-color": post.thumbnailColor }}>
                  <Images size={34} aria-hidden="true" />
                </div>
              )}
              <span className="blog-category-badge">{getPostCategory(post)}</span>
            </div>
            <div className="blog-card-body">
              <h2>{post.title}</h2>
              <div className="blog-card-meta blog-author-meta">
                <span>{getPostDate(post)}</span>
                {post.author && (
                  <span className="blog-author-byline">
                    <UserAvatar name={post.author} imageUrl={post.authorProfilePictureUrl} size={28} />
                    {post.author}
                  </span>
                )}
              </div>
              <p>{post.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
      {!filteredPosts.length && !isLoading && (
        <p className="empty-public-state">No approved blog posts match that search yet.</p>
      )}
      {canLoadMore && (
        <div className="blog-load-more-row">
          <button type="button" className="blog-load-more-button" onClick={() => setVisibleCount((count) => count + pageSize)}>
            Load More
          </button>
        </div>
      )}
    </section>
  );
}



