import { plannedEvents } from "../data/calendar.js";
import { blogPosts, galleryAlbums } from "../data/content.js";
import { demoUsers } from "../data/users.js";
import { getPublicCalendarEvents } from "../services/calendarService.js";
import { getPublicPostBySlug, getPublicPosts } from "../services/contentService.js";
import {
  getPublicAlbumPhotos,
  getPublicGalleryAlbumById,
  getPublicGalleryAlbums
} from "../services/galleryService.js";
import { defaultFaqs, getPublicFaqs } from "../services/publicEngagementService.js";
import { defaultSiteContent, getWebsiteContent } from "../services/siteContentService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";

function approved(item) {
  return (item.approvalStatus ?? item.status ?? "approved") === "approved";
}

function fallbackWebsiteData() {
  return { siteContent: defaultSiteContent, leaders: [] };
}

export async function getPublicHomeData() {
  if (!isSupabaseConfigured) {
    return {
      ...fallbackWebsiteData(),
      plannedEvents: plannedEvents.filter((event) => event.visibility === "public").slice(0, 3),
      blogPosts: blogPosts.filter(approved).slice(0, 3),
      galleryAlbums: galleryAlbums.filter(approved).slice(0, 3),
      faqs: defaultFaqs
    };
  }

  const [websiteData, publicEvents, publicPosts, publicAlbums, faqs] = await Promise.all([
    getWebsiteContent().catch(() => fallbackWebsiteData()),
    getPublicCalendarEvents({ limit: 3 }).catch(() => []),
    getPublicPosts({ limit: 3 }).catch(() => []),
    getPublicGalleryAlbums({ limit: 3 }).catch(() => []),
    getPublicFaqs().catch(() => defaultFaqs)
  ]);

  return {
    ...websiteData,
    plannedEvents: publicEvents,
    blogPosts: publicPosts,
    galleryAlbums: publicAlbums,
    faqs: faqs.length ? faqs : defaultFaqs
  };
}

export async function getPublicAboutData() {
  if (!isSupabaseConfigured) {
    return { ...fallbackWebsiteData(), users: demoUsers };
  }

  return getWebsiteContent().catch(() => ({ ...fallbackWebsiteData(), users: [] }));
}

export async function getPublicGalleryPage({ limit = 12, offset = 0 } = {}) {
  if (!isSupabaseConfigured) {
    const page = galleryAlbums.filter(approved).slice(offset, offset + limit);
    return { albums: page, hasMore: galleryAlbums.filter(approved).length > offset + limit };
  }

  const rows = await getPublicGalleryAlbums({ limit: limit + 1, offset });
  return { albums: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function getPublicAlbumPage(albumId, { limit = 30, offset = 0 } = {}) {
  if (!isSupabaseConfigured) {
    const album = galleryAlbums.find((item) => item.id === albumId && approved(item)) ?? null;
    const photos = album?.photos?.slice(offset, offset + limit) ?? [];
    return { album: album ? { ...album, photos: [] } : null, photos, hasMore: Boolean(album?.photos?.length > offset + limit) };
  }

  const [album, photoPage] = await Promise.all([
    offset === 0 ? getPublicGalleryAlbumById(albumId) : Promise.resolve(null),
    getPublicAlbumPhotos(albumId, { limit, offset })
  ]);

  return { album, photos: photoPage.photos, hasMore: photoPage.hasMore };
}

export async function getPublicBlogsPage({ limit = 12, offset = 0 } = {}) {
  if (!isSupabaseConfigured) {
    const page = blogPosts.filter(approved).slice(offset, offset + limit);
    return { blogPosts: page, hasMore: blogPosts.filter(approved).length > offset + limit };
  }

  const posts = await getPublicPosts({ limit: limit + 1, offset });
  return { blogPosts: posts.slice(0, limit), hasMore: posts.length > limit };
}

export async function getPublicBlogDetailPage(slug) {
  if (!isSupabaseConfigured) {
    const post = blogPosts.find((item) => item.slug === slug && approved(item)) ?? null;
    const linkedAlbum = post?.albumId ? galleryAlbums.find((album) => album.id === post.albumId && approved(album)) ?? null : null;
    return { post, linkedAlbum };
  }

  const post = await getPublicPostBySlug(slug);
  const linkedAlbum = post?.albumId ? await getPublicGalleryAlbumById(post.albumId).catch(() => null) : null;
  return { post, linkedAlbum };
}
