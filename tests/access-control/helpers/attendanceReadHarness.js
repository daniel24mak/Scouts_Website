import fs from "node:fs";
import vm from "node:vm";
import { normalizeBootstrapData } from "../../../src/api/bootstrapData.js";

function moduleSource(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
    .replace(/export /g, "");
}

const attendanceSource = moduleSource("../../../src/services/attendanceService.js");
const clientSource = moduleSource("../../../src/api/client.js");

export const attendanceRows = {
  attendance_sessions: [{
    id: "scout-session", group_id: "wolves", equipe_id: null, scope: "group",
    date: "2026-10-11", topic: "Weekly meeting", taken_by: "current-user", created_at: "2026-10-11T09:00:00Z"
  }],
  attendance_records: [{ id: "scout-record", session_id: "scout-session", scout_id: "scout-one", status: "Absent" }],
  chief_attendance_sessions: [{
    id: "chief-session", date: "2026-10-11", topic: "Chief meeting",
    taken_by: "current-user", created_at: "2026-10-11T09:00:00Z"
  }],
  chief_attendance_records: [{ id: "chief-record", session_id: "chief-session", chief_id: "chief-one", status: "Excused" }]
};

// Evaluate the actual service and complete client module. Only remote row reads,
// unrelated domain services, and demo imports are supplied at their boundaries.
export function loadAttendanceReadPath({
  getSupabaseRows = async (table) => attendanceRows[table],
  isSupabaseConfigured = true,
  fetch = async () => { throw new Error("Unexpected local API request"); },
  otherServices = {}
} = {}) {
  const attendance = vm.runInNewContext(`${attendanceSource}\n({ getAttendanceData })`, { getSupabaseRows });
  const client = vm.runInNewContext(`${clientSource}\n({ getBootstrap, loadingData, fallbackData })`, {
    ...attendance,
    isSupabaseConfigured,
    fetch,
    normalizeBootstrapData,
    getCurrentSupabaseUserId: () => "current-user",
    getProfiles: async () => [{ id: "current-user", role: "chief" }],
    getScoutData: async () => ({ groups: [{ id: "wolves" }], registeredScouts: [], scoutYears: [], activeScoutYearId: null }),
    getCalendarEvents: async () => [],
    getPosts: async () => ({ allBlogPosts: [], blogPosts: [] }),
    getGallery: async () => ({ allGalleryAlbums: [], allGalleryPhotos: [], galleryAlbums: [], photoUploadBatches: [] }),
    getWebsiteContent: async () => ({ siteContent: {}, leaders: [] }),
    getPublicEngagementData: async () => ({ faqs: [], contactMessages: [] }),
    getEquipeData: async () => ({ equipes: [] }),
    getFormsData: async () => ({ formTemplates: [], formTemplateVersions: [], postedForms: [], formSubmissions: [], formAiSummaries: [] }),
    getNotifications: async () => [],
    getWebsiteContentRevisions: async () => [],
    getDocumentsWorkspaceData: async () => ({ documentCategories: [], documents: [], archivedYears: [] }),
    getBootstrapShadowAccess: async () => ({ effectiveAccess: null, authorizationMigrationDifferences: [] }),
    attendanceMeetings: [{ id: "demo-session", records: { "demo-scout": "Present" } }],
    attendanceSheets: [],
    chiefAttendanceMeetings: [],
    chiefAttendanceSheet: [],
    plannedEvents: [],
    blogPosts: [],
    galleryAlbums: [],
    scoutGroups: [],
    groupingRulesStore: { rules: [] },
    registeredScouts: [],
    registrationImportSettings: {},
    demoUsers: [],
    defaultSiteContent: {},
    defaultFaqs: [],
    ...otherServices
  });
  return { ...attendance, ...client };
}
