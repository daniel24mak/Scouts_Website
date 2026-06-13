import { CalendarDays, Images, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useBootstrap } from "../api/useBootstrap.js";

export default function GalleryPage() {
  const { data } = useBootstrap();

  return (
    <section className="page-section">
      <p className="eyebrow">Gallery</p>
      <h1>Photo albums from every event</h1>
      <div className="album-grid">
        {data.galleryAlbums.map((album, albumIndex) => {
          const coverImage = album.thumbnailUrl ?? album.photos[0]?.thumbnailUrl ?? album.photos[0]?.url;

          return (
          <article className="album-card" key={album.id}>
            {coverImage ? (
              <img
                className="album-cover-image"
                src={coverImage}
                alt={album.title}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : (
              <div className="album-cover">
                <span>{album.coverLabel}</span>
              </div>
            )}
            <div className="album-body">
              <div className="card-meta">
                <span>
                  <CalendarDays size={16} aria-hidden="true" />
                  {album.eventDate}
                </span>
                <span>
                  <Images size={16} aria-hidden="true" />
                  {album.photoCount} photos
                </span>
              </div>
              <h2>{album.title}</h2>
              <p>
                <MapPin size={16} aria-hidden="true" />
                {album.location}
              </p>
              <div className="photo-strip" aria-label={`${album.title} preview photos`}>
                {album.photos.slice(0, 4).map((photo) => (
                  photo.thumbnailUrl || photo.url ? (
                    <img key={photo.id} src={photo.thumbnailUrl ?? photo.url} alt={photo.title} loading="lazy" decoding="async" sizes="72px" />
                  ) : (
                    <span key={photo.id}>{photo.title}</span>
                  )
                ))}
              </div>
              <Link className="inline-action" to={`/gallery/${album.id}`}>
                Open album
              </Link>
            </div>
          </article>
        );
        })}
      </div>
    </section>
  );
}
