import { CalendarDays, Images, MapPin } from "lucide-react";
import SafeImage from "../components/SafeImage.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getPublicGalleryPage } from "../api/publicClient.js";
import { usePublicData } from "../api/usePublicData.js";

const ALBUMS_PER_PAGE = 12;

export default function GalleryPage() {
  const [albumOffset, setAlbumOffset] = useState(0);
  const { data, isLoading, error, setData } = usePublicData(
    () => getPublicGalleryPage({ limit: ALBUMS_PER_PAGE, offset: 0 }),
    [],
    { albums: [], hasMore: false },
    ["gallery", ALBUMS_PER_PAGE, 0]
  );
  const albums = data?.albums ?? [];

  const loadMoreAlbums = async () => {
    const nextOffset = albumOffset + ALBUMS_PER_PAGE;
    const nextPage = await getPublicGalleryPage({ limit: ALBUMS_PER_PAGE, offset: nextOffset });
    setAlbumOffset(nextOffset);
    setData((current) => ({
      albums: [...(current?.albums ?? []), ...nextPage.albums],
      hasMore: nextPage.hasMore
    }));
  };

  return (
    <section className="page-section">
      <p className="eyebrow">Gallery</p>
      <h1>Photo albums from every event</h1>
      {error && <p className="empty-public-state">Albums could not be loaded: {error.message}</p>}
      <div className="album-grid" aria-busy={isLoading}>
        {isLoading && !albums.length ? Array.from({ length: 6 }, (_, index) => (
          <article className="album-card public-loading-card" key={`loading-album-${index}`}>
            <div className="loading-media" />
            <div className="album-card-body">
              <span>Loading album...</span>
              <i />
              <i className="short" />
            </div>
          </article>
        )) : albums.map((album) => (
          <Link className="album-card" to={`/gallery/${album.id}`} key={album.id}>
            <div className="album-card-media">
              {album.thumbnailUrl ? (
                <SafeImage
                  src={album.thumbnailUrl}
                  alt={`${album.title} album cover`}
                  className="album-card-image-frame"
                  imageClassName="album-card-image"
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="album-cover">
                  <Images size={34} aria-hidden="true" />
                  <span>{album.coverLabel}</span>
                </div>
              )}
            </div>
            <div className="album-card-body">
              <h2>{album.title}</h2>
              <div className="card-meta">
                <span><CalendarDays size={16} aria-hidden="true" />{album.eventDate}</span>
                <span><MapPin size={16} aria-hidden="true" />{album.location}</span>
                <span><Images size={16} aria-hidden="true" />{album.photoCount ? `${album.photoCount} photos` : "Photos"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!albums.length && !isLoading && <p className="empty-public-state">No approved albums are available yet.</p>}
      {data?.hasMore && (
        <div className="load-more-row">
          <button type="button" className="inline-action" onClick={loadMoreAlbums}>
            Load More Albums
          </button>
        </div>
      )}
    </section>
  );
}

