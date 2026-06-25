import {
  deleteSupabaseFile,
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabaseRows,
  insertSupabaseRow,
  patchSupabaseRows,
  uploadSupabaseFile,
  upsertSupabaseRows
} from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

export const defaultSiteContent = {
  home_hero_title: {
    sectionName: "home",
    contentKey: "home_hero_title",
    textValue: "Building Faith, Leadership, and Community Through Scouting"
  },
  home_hero_subtitle: {
    sectionName: "home",
    contentKey: "home_hero_subtitle",
    textValue:
      "Welcome to St. Mary's Scouts Dubai, a scouting family based at St. Mary's Catholic Church, Dubai. We help young people grow through faith, teamwork, discipline, service, and unforgettable scouting experiences."
  },
  home_about_text: {
    sectionName: "home",
    contentKey: "home_about_text",
    textValue:
      "St. Mary's Scouts Dubai is a church-based scouting group connected to St. Mary's Catholic Church, Dubai. We bring together children and youth in a safe, supportive, and inspiring environment where they can learn leadership, responsibility, teamwork, and service."
  },
  home_location_text: {
    sectionName: "home",
    contentKey: "home_location_text",
    textValue: "Located at St. Mary's Catholic Church, Dubai, United Arab Emirates."
  },
  home_hero_cta_text: { sectionName: "home", contentKey: "home_hero_cta_text", textValue: "Learn About Us" },
  home_hero_cta_link: { sectionName: "home", contentKey: "home_hero_cta_link", textValue: "/about" },
  home_events_heading: { sectionName: "home", contentKey: "home_events_heading", textValue: "What's happening next" },
  home_events_subtitle: { sectionName: "home", contentKey: "home_events_subtitle", textValue: "Stay updated with our upcoming scout meetings, church events, ceremonies, activities, and special gatherings." },
  home_blogs_heading: { sectionName: "home", contentKey: "home_blogs_heading", textValue: "Stories from our scouting community" },
  home_blogs_subtitle: { sectionName: "home", contentKey: "home_blogs_subtitle", textValue: "Read the latest updates, announcements, activities, and stories from our scouting community." },
  home_albums_heading: { sectionName: "home", contentKey: "home_albums_heading", textValue: "Photos from meetings, camps, and ceremonies" },
  home_albums_subtitle: { sectionName: "home", contentKey: "home_albums_subtitle", textValue: "Explore photos from our meetings, ceremonies, camps, activities, and special scout events." },
  home_contact_heading: { sectionName: "home", contentKey: "home_contact_heading", textValue: "Got any questions, suggestions, or want to volunteer?" },
  home_contact_intro: { sectionName: "home", contentKey: "home_contact_intro", textValue: "We'd love to hear from you. Send us a message and our team will get back to you soon." },
  home_contact_email: { sectionName: "home", contentKey: "home_contact_email", textValue: "Email placeholder" },
  home_contact_phone: { sectionName: "home", contentKey: "home_contact_phone", textValue: "Phone placeholder" },
  home_contact_location: { sectionName: "home", contentKey: "home_contact_location", textValue: "St. Mary's Catholic Church, Dubai, United Arab Emirates" },
  about_page_title: { sectionName: "about", contentKey: "about_page_title", textValue: "About Us" },
  about_values: { sectionName: "about", contentKey: "about_values", textValue: "" },
  about_scout_groups: { sectionName: "about", contentKey: "about_scout_groups", textValue: "" },  about_hero_image: {
    sectionName: "about",
    contentKey: "about_hero_image",
    imageUrl: null,
    storagePath: null,
    textValue: ""
  },
  about_intro_text: {
    sectionName: "about",
    contentKey: "about_intro_text",
    textValue:
      "St. Mary's Scouts Dubai is a scouting group based at St. Mary's Catholic Church, Dubai. Our mission is to guide young people as they grow in faith, leadership, responsibility, teamwork, and service."
  },
  about_history_text: {
    sectionName: "about",
    contentKey: "about_history_text",
    textValue:
      "St. Mary's Scouts Dubai was created to give young people a place where they can grow through scouting values, faith, friendship, and service. From its beginning, the group has been connected to the church community and has worked to support children and youth through meaningful activities and leadership development."
  },
  about_history_milestones: {
    sectionName: "about",
    contentKey: "about_history_milestones",
    textValue: ""
  },
  about_mission_text: {
    sectionName: "about",
    contentKey: "about_mission_text",
    textValue:
      "Our mission is to help young people grow into responsible, confident, faithful, and service-minded individuals through scouting activities, leadership opportunities, teamwork, and community involvement."
  }
};

function normalizeSiteContent(row) {
  return {
    id: row.id,
    sectionName: row.section_name,
    contentKey: row.content_key,
    textValue: row.text_value ?? "",
    imageUrl: row.image_url ?? null,
    storagePath: row.storage_path ?? null,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function normalizeLeader(row) {
  return {
    id: row.id,
    name: row.full_name,
    title: row.title,
    photoUrl: row.photo_url ?? null,
    storagePath: row.storage_path ?? null,
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

export function contentText(siteContent, key, fallback = "") {
  return siteContent?.[key]?.textValue || fallback;
}

export function contentImage(siteContent, key, fallback = "") {
  return siteContent?.[key]?.imageUrl || fallback;
}

export async function getWebsiteContent() {
  const [contentRows, leaderRows] = await Promise.all([
    getSupabaseRows("site_content", "select=id,section_name,content_key,text_value,image_url,storage_path,updated_by,updated_at&order=section_name.asc,content_key.asc"),
    getSupabaseRows("leaders", "select=id,full_name,title,photo_url,storage_path,display_order,is_active,created_at,updated_at&is_active=eq.true&order=display_order.asc,full_name.asc")
  ]);
  const siteContent = Object.fromEntries(
    [...Object.values(defaultSiteContent).map((item) => ({ ...item, id: item.contentKey })), ...contentRows.map(normalizeSiteContent)].map(
      (item) => [item.contentKey, item]
    )
  );

  return {
    siteContent,
    leaders: leaderRows.map(normalizeLeader).filter((leader) => leader.isActive)
  };
}

function siteContentImageType(contentKey) {
  const key = String(contentKey ?? "");

  if (key.includes("hero")) return "hero";
  if (key.includes("activity")) return "card";
  return "website_content";
}

export async function saveSiteContentItem(item) {
  const currentUserId = getCurrentSupabaseUserId();
  let imageUrl = item.imageUrl ?? null;
  let storagePath = item.storagePath ?? null;
  const previousStoragePath = item.storagePath ?? null;

  if (item.file) {
    const imageType = siteContentImageType(item.contentKey);
    const optimized = await optimizeImageForUpload(item.file, imageType);
    storagePath = optimizedImagePath(`site-images/optimized/${item.contentKey}`, item.file);
    imageUrl = await uploadSupabaseFile(storagePath, optimized.file, "site-images", { cacheControl: IMAGE_CACHE_CONTROL });
  }

  const saved = await upsertSupabaseRows(
    "site_content",
    [
      {
        section_name: item.sectionName,
        content_key: item.contentKey,
        text_value: item.textValue ?? "",
        image_url: imageUrl,
        storage_path: storagePath,
        updated_by: currentUserId,
        updated_at: new Date().toISOString()
      }
    ],
    "section_name,content_key"
  );

  if (item.file && previousStoragePath && previousStoragePath !== storagePath) {
    deleteSupabaseFile(previousStoragePath, "site-images").catch(() => {});
  }

  return saved;
}

export async function createLeader(leader) {
  const inserted = await insertSupabaseRow("leaders", {
    full_name: leader.name,
    title: leader.title,
    display_order: Number(leader.displayOrder ?? 0),
    is_active: true
  });
  const created = inserted[0];

  if (!leader.file) {
    return inserted;
  }

  const optimized = await optimizeImageForUpload(leader.file, "leader_headshot");
  const storagePath = optimizedImagePath(`leader-headshots/optimized/${created.id}`, leader.file);
  const photoUrl = await uploadSupabaseFile(storagePath, optimized.file, "leader-headshots", { cacheControl: IMAGE_CACHE_CONTROL });
  return patchSupabaseRows("leaders", `id=eq.${encodeURIComponent(created.id)}`, {
    photo_url: photoUrl,
    storage_path: storagePath,
    updated_at: new Date().toISOString()
  });
}

export async function updateLeader(leaderId, leader) {
  let photoUrl = leader.photoUrl ?? null;
  let storagePath = leader.storagePath ?? null;
  const previousStoragePath = leader.storagePath ?? null;

  if (leader.file) {
    const optimized = await optimizeImageForUpload(leader.file, "leader_headshot");
    storagePath = optimizedImagePath(`leader-headshots/optimized/${leaderId}`, leader.file);
    photoUrl = await uploadSupabaseFile(storagePath, optimized.file, "leader-headshots", { cacheControl: IMAGE_CACHE_CONTROL });
  }

  const saved = await patchSupabaseRows("leaders", `id=eq.${encodeURIComponent(leaderId)}`, {
    full_name: leader.name,
    title: leader.title,
    photo_url: photoUrl,
    storage_path: storagePath,
    display_order: Number(leader.displayOrder ?? 0),
    is_active: leader.isActive !== false,
    updated_at: new Date().toISOString()
  });

  if (leader.file && previousStoragePath && previousStoragePath !== storagePath) {
    deleteSupabaseFile(previousStoragePath, "leader-headshots").catch(() => {});
  }

  return saved;
}

export function deactivateLeader(leaderId) {
  return patchSupabaseRows("leaders", `id=eq.${encodeURIComponent(leaderId)}`, {
    is_active: false,
    updated_at: new Date().toISOString()
  });
}

export function deleteLeader(leaderId) {
  return getSupabaseRows("leaders", `select=storage_path&id=eq.${encodeURIComponent(leaderId)}`)
    .catch(() => [])
    .then(async (rows) => {
      const deleted = await deleteSupabaseRows("leaders", `id=eq.${encodeURIComponent(leaderId)}`);
      await Promise.all(
        rows
          .map((row) => row.storage_path)
          .filter(Boolean)
          .map((path) => deleteSupabaseFile(path, "leader-headshots").catch(() => {}))
      );
      return deleted;
    });
}


