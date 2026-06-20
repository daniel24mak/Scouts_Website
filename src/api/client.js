import { attendanceMeetings, attendanceSheets, chiefAttendanceMeetings, chiefAttendanceSheet } from "../data/attendance.js";
import { plannedEvents } from "../data/calendar.js";
import { blogPosts, galleryAlbums } from "../data/content.js";
import { scoutGroups } from "../data/groups.js";
import { groupingRulesStore, registeredScouts, registrationImportSettings } from "../data/registration.js";
import { demoUsers } from "../data/users.js";
import { deleteSupabaseAttendanceSession, getAttendanceData, saveSupabaseChiefAttendance, saveSupabaseScoutAttendance, updateSupabaseAttendanceSessionDate, updateSupabaseAttendanceSessionLabel } from "../services/attendanceService.js";
import {
  createSupabaseCalendarEvent,
  deleteSupabaseCalendarEvent,
  getCalendarEvents,
  updateSupabaseCalendarEvent
} from "../services/calendarService.js";
import { createPost, deletePost, getPosts, updatePost } from "../services/contentService.js";
import {
  archiveEquipe,
  assignScoutsToEquipe,
  createEquipe,
  getEquipeData,
  updateEquipe
} from "../services/equipeService.js";
import {
  createGalleryAlbum,
  createGalleryPhotos,
  deleteGalleryAlbum,
  deleteGalleryPhotos,
  getGallery,
  updateGalleryAlbum,
  updateGalleryPhoto,
  updatePhotoUploadBatch
} from "../services/galleryService.js";
import {
  getScoutData,
  createScout,
  createScoutYear,
  importRegistrationSheetToSupabase,
  saveGroupingRules,
  setActiveScoutYear,
  updateScout
} from "../services/scoutService.js";
import {
  createFaq,
  deactivateFaq,
  defaultFaqs,
  deleteContactMessage,
  deleteFaq,
  getPublicEngagementData,
  submitContactMessage,
  updateContactMessage,
  updateFaq
} from "../services/publicEngagementService.js";
import { updateCurrentUserPassword } from "../services/authService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";
import {
  createLeader,
  deactivateLeader,
  defaultSiteContent,
  getWebsiteContent,
  saveSiteContentItem,
  updateLeader
} from "../services/siteContentService.js";
import { adminResetUserPassword, createDashboardUser, createProfile, getProfiles, reviewProfileChangeRequest, submitProfileChangeRequest, updateProfile } from "../services/userService.js";

export const fallbackData = {
  users: demoUsers,
  groups: scoutGroups,
  registeredScouts,
  registrationImportSettings,
  scoutYears: [],
  activeScoutYearId: null,
  groupingRulesStore,
  attendanceMeetings,
  attendanceSheets,
  chiefAttendanceMeetings,
  chiefAttendanceSheet,
  plannedEvents,
  blogPosts,
  galleryAlbums,
  siteContent: defaultSiteContent,
  leaders: [],
  faqs: defaultFaqs,
  contactMessages: [],
  equipes: []
};

export const loadingData = {
  ...fallbackData,
  users: [],
  registeredScouts: [],
  attendanceMeetings: [],
  attendanceSheets: [],
  chiefAttendanceMeetings: [],
  chiefAttendanceSheet: [],
  plannedEvents: [],
  blogPosts: [],
  galleryAlbums: [],
  siteContent: {},
  leaders: [],
  faqs: [],
  contactMessages: [],
  equipes: [],
  contentSubmissions: []
};

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function getBootstrap() {
  if (isSupabaseConfigured) {
    const results = await Promise.allSettled([
      getProfiles(),
      getScoutData(),
      getAttendanceData(),
      getCalendarEvents(),
      getPosts(),
      getGallery(),
      getWebsiteContent(),
      getPublicEngagementData(),
      getEquipeData()
    ]);
    const valueAt = (index, fallback) =>
      results[index].status === "fulfilled" ? results[index].value : fallback;
    const users = valueAt(0, []);
    const scoutData = valueAt(1, {
      groups: scoutGroups,
      registeredScouts: [],
      registrationImportSettings,
  scoutYears: [],
  activeScoutYearId: null,
      groupingRulesStore
    });
    const attendanceData = valueAt(2, {
      attendanceMeetings: [],
      attendanceSheets: [],
      chiefAttendanceMeetings: [],
      chiefAttendanceSheet: []
    });
    const plannedEvents = valueAt(3, []);
    const contentData = valueAt(4, { allBlogPosts: [], blogPosts: [] });
    const galleryData = valueAt(5, { allGalleryAlbums: [], allGalleryPhotos: [], galleryAlbums: [], photoUploadBatches: [] });
    const websiteData = valueAt(6, { siteContent: {}, leaders: [] });
    const engagementData = valueAt(7, { faqs: [], contactMessages: [] });
    const equipeData = valueAt(8, { equipes: [] });

    return {
      users,
      ...scoutData,
      ...attendanceData,
      plannedEvents,
      ...contentData,
      ...galleryData,
      ...websiteData,
      ...engagementData,
      ...equipeData,
      contentSubmissions: [
        ...(contentData.allBlogPosts ?? []).map((post) => ({ ...post, contentType: "blog" })),
        ...(galleryData.allGalleryAlbums ?? []).map((album) => ({ ...album, contentType: "album" }))
      ]
    };
  }

  try {
    return await request("/bootstrap");
  } catch {
    return fallbackData;
  }
}

export function addFaq(payload) {
  if (isSupabaseConfigured) {
    return createFaq(payload);
  }

  return Promise.resolve(payload);
}

export function saveFaq(faqId, payload) {
  if (isSupabaseConfigured) {
    return updateFaq(faqId, payload);
  }

  return Promise.resolve(payload);
}

export function removeFaq(faqId) {
  if (isSupabaseConfigured) {
    return deactivateFaq(faqId);
  }

  return Promise.resolve(faqId);
}

export function destroyFaq(faqId) {
  if (isSupabaseConfigured) {
    return deleteFaq(faqId);
  }

  return Promise.resolve(faqId);
}

export function sendContactMessage(payload) {
  if (isSupabaseConfigured) {
    return submitContactMessage(payload);
  }

  return Promise.resolve(payload);
}

export function saveContactMessage(messageId, payload) {
  if (isSupabaseConfigured) {
    return updateContactMessage(messageId, payload);
  }

  return Promise.resolve(payload);
}

export function removeContactMessage(messageId) {
  if (isSupabaseConfigured) {
    return deleteContactMessage(messageId);
  }

  return Promise.resolve(messageId);
}

export function saveWebsiteContent(payload) {
  if (isSupabaseConfigured) {
    return saveSiteContentItem(payload);
  }

  return Promise.resolve(payload);
}

export function addLeader(payload) {
  if (isSupabaseConfigured) {
    return createLeader(payload);
  }

  return Promise.resolve(payload);
}

export function saveLeader(leaderId, payload) {
  if (isSupabaseConfigured) {
    return updateLeader(leaderId, payload);
  }

  return Promise.resolve(payload);
}

export function removeLeader(leaderId) {
  if (isSupabaseConfigured) {
    return deactivateLeader(leaderId);
  }

  return Promise.resolve(leaderId);
}

export function createCalendarEvent(payload) {
  if (isSupabaseConfigured) {
    return createSupabaseCalendarEvent(payload).catch(() =>
      request("/calendar/events", { method: "POST", body: JSON.stringify(payload) })
    );
  }

  return request("/calendar/events", { method: "POST", body: JSON.stringify(payload) });
}

export function deleteCalendarEvent(eventId) {
  if (isSupabaseConfigured) {
    return deleteSupabaseCalendarEvent(eventId).catch(() =>
      request(`/calendar/events/${eventId}`, { method: "DELETE" })
    );
  }

  return request(`/calendar/events/${eventId}`, { method: "DELETE" });
}

export function updateCalendarEvent(eventId, payload) {
  if (isSupabaseConfigured) {
    return updateSupabaseCalendarEvent(eventId, payload).catch(() =>
      request(`/calendar/events/${eventId}`, { method: "PUT", body: JSON.stringify(payload) })
    );
  }

  return request(`/calendar/events/${eventId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function saveScoutAttendance(payload) {
  if (isSupabaseConfigured) {
    return saveSupabaseScoutAttendance(payload).catch(() =>
      request("/attendance/scouts", { method: "POST", body: JSON.stringify(payload) })
    );
  }

  return request("/attendance/scouts", { method: "POST", body: JSON.stringify(payload) });
}


export function updateAttendanceSessionLabel(sessionId, topic) {
  if (isSupabaseConfigured) {
    return updateSupabaseAttendanceSessionLabel(sessionId, topic);
  }

  return Promise.resolve({ id: sessionId, topic });
}
export function updateAttendanceSessionDate(sessionId, date) {
  if (isSupabaseConfigured) {
    return updateSupabaseAttendanceSessionDate(sessionId, date);
  }

  return Promise.resolve({ id: sessionId, date });
}

export function deleteAttendanceSession(sessionId) {
  if (isSupabaseConfigured) {
    return deleteSupabaseAttendanceSession(sessionId);
  }

  return Promise.resolve({ id: sessionId });
}
export function saveChiefAttendance(payload) {
  if (isSupabaseConfigured) {
    return saveSupabaseChiefAttendance(payload).catch(() =>
      request("/attendance/chiefs", { method: "POST", body: JSON.stringify(payload) })
    );
  }

  return request("/attendance/chiefs", { method: "POST", body: JSON.stringify(payload) });
}

export function saveAdminRules(payload) {
  if (isSupabaseConfigured) {
    return saveGroupingRules(payload).catch(() =>
      request("/admin/rules", { method: "PUT", body: JSON.stringify(payload) })
    );
  }

  return request("/admin/rules", { method: "PUT", body: JSON.stringify(payload) });
}


export function createScoutingYear(name) {
  const label = String(typeof name === "string" ? name : name?.label ?? "").trim();

  if (isSupabaseConfigured) {
    return createScoutYear(label);
  }

  return Promise.resolve({ id: crypto.randomUUID(), label, is_active: false });
}

export function activateScoutingYear(yearId) {
  if (isSupabaseConfigured) {
    return setActiveScoutYear(yearId);
  }

  return Promise.resolve({ id: yearId, is_active: true });
}
export function uploadRegistrationSheet(payload) {
  if (isSupabaseConfigured) {
    return request("/registration/parse", { method: "POST", body: JSON.stringify(payload) }).then(
      (parsed) =>
        importRegistrationSheetToSupabase({
          fileName: payload.fileName ?? "registered-scouts.xlsx",
          contentBase64: payload.contentBase64,
          scouts: parsed.scouts ?? [],
          scoutYearId: payload.scoutYearId,
          newScoutYear: payload.newScoutYear
        })
    );
  }

  return request("/registration/upload", { method: "POST", body: JSON.stringify(payload) });
}

export function moveRegisteredScout(scoutId, payload) {
  return request(`/registration/scouts/${scoutId}/group`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function updateRegisteredScout(scoutId, payload) {
  if (isSupabaseConfigured) {
    return updateScout(scoutId, payload).catch(() =>
      request(`/registration/scouts/${scoutId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      })
    );
  }

  return request(`/registration/scouts/${scoutId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function addRegisteredScout(payload) {
  if (isSupabaseConfigured) {
    return createScout(payload).catch(() =>
      request("/registration/scouts", { method: "POST", body: JSON.stringify(payload) })
    );
  }

  return request("/registration/scouts", { method: "POST", body: JSON.stringify(payload) });
}

export function addChief(payload) {
  if (isSupabaseConfigured) {
    return createDashboardUser(payload);
  }

  return request("/admin/chiefs", { method: "POST", body: JSON.stringify(payload) });
}

export function requestProfileChange(user, payload) {
  if (isSupabaseConfigured) {
    return submitProfileChangeRequest(user, payload);
  }

  return Promise.resolve(payload);
}

export function reviewProfileChange(profile, status, comment) {
  if (isSupabaseConfigured) {
    return reviewProfileChangeRequest(profile, status, comment);
  }

  return Promise.resolve(profile);
}

export function changeOwnPassword(newPassword) {
  if (isSupabaseConfigured) {
    return updateCurrentUserPassword(newPassword);
  }

  return Promise.resolve();
}
export function resetUserPassword(userId, temporaryPassword) {
  if (isSupabaseConfigured) {
    return adminResetUserPassword(userId, temporaryPassword);
  }

  return Promise.resolve();
}


export function updateChief(chiefId, payload) {
  if (isSupabaseConfigured) {
    return updateProfile(chiefId, payload);
  }

  return request(`/admin/chiefs/${chiefId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function createBlog(payload) {
  if (isSupabaseConfigured) {
    return createPost(payload);
  }

  return request("/blogs", { method: "POST", body: JSON.stringify(payload) });
}

export function updateBlog(postId, payload) {
  if (isSupabaseConfigured) {
    return updatePost(postId, payload);
  }

  return request(`/blogs/${postId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteBlog(postId) {
  if (isSupabaseConfigured) {
    return deletePost(postId).catch(() => request(`/blogs/${postId}`, { method: "DELETE" }));
  }

  return request(`/blogs/${postId}`, { method: "DELETE" });
}

export function createAlbum(payload) {
  if (isSupabaseConfigured) {
    return createGalleryAlbum(payload).catch(() =>
      request("/albums", { method: "POST", body: JSON.stringify(payload) })
    );
  }

  return request("/albums", { method: "POST", body: JSON.stringify(payload) });
}

export function updateAlbum(albumId, payload) {
  if (isSupabaseConfigured) {
    return updateGalleryAlbum(albumId, payload).catch(() =>
      request(`/albums/${albumId}`, { method: "PUT", body: JSON.stringify(payload) })
    );
  }

  return request(`/albums/${albumId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function updatePhoto(photoId, payload) {
  if (isSupabaseConfigured) {
    return updateGalleryPhoto(photoId, payload);
  }

  return Promise.resolve(payload);
}

export function updatePhotoBatch(batchId, payload) {
  if (isSupabaseConfigured) {
    return updatePhotoUploadBatch(batchId, payload);
  }

  return Promise.resolve(payload);
}

export function deleteAlbum(albumId) {
  if (isSupabaseConfigured) {
    return deleteGalleryAlbum(albumId).catch(() => request(`/albums/${albumId}`, { method: "DELETE" }));
  }

  return request(`/albums/${albumId}`, { method: "DELETE" });
}

export function addAlbumPhotos(albumId, payload) {
  if (isSupabaseConfigured) {
    return createGalleryPhotos(albumId, payload.photos ?? [], payload.approvalStatus, payload.onProgress).catch(() =>
      request(`/albums/${albumId}/photos`, { method: "POST", body: JSON.stringify(payload) })
    );
  }

  payload.onProgress?.({
    completed: payload.photos?.length ?? 0,
    total: payload.photos?.length ?? 0,
    percent: 100
  });

  return request(`/albums/${albumId}/photos`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      photos: (payload.photos ?? []).map((photo) => photo?.name ?? String(photo))
    })
  });
}

export function deletePhotos(photoIds) {
  if (isSupabaseConfigured) {
    return deleteGalleryPhotos(photoIds);
  }

  return Promise.resolve(photoIds);
}

export function addEquipe(payload) {
  if (isSupabaseConfigured) {
    return createEquipe(payload);
  }

  return Promise.resolve(payload);
}

export function saveEquipe(equipeId, payload) {
  if (isSupabaseConfigured) {
    return updateEquipe(equipeId, payload);
  }

  return Promise.resolve(payload);
}

export function removeEquipe(equipeId) {
  if (isSupabaseConfigured) {
    return archiveEquipe(equipeId);
  }

  return Promise.resolve(equipeId);
}

export function assignEquipeScouts(payload) {
  if (isSupabaseConfigured) {
    return assignScoutsToEquipe(payload);
  }

  return Promise.resolve(payload);
}





