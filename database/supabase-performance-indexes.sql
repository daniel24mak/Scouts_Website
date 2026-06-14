-- Optional indexes for Phase 1 public-page performance fixes.
-- Safe to run more than once.

CREATE INDEX IF NOT EXISTS idx_gallery_albums_status_event_date
  ON gallery_albums (status, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_images_album_status_sort
  ON gallery_images (album_id, status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
  ON posts (status, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_events_public_upcoming
  ON calendar_events (status, visibility, event_date);

CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_blog_id ON public.calendar_events(linked_blog_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_album_id ON public.calendar_events(linked_album_id);
