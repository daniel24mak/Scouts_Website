import {
  Archive,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Folder,
  GalleryHorizontal,
  MonitorSmartphone,
  Moon,
  Image,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  MoreHorizontal,
  Menu,
  X,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Search,
  Settings,
  Sparkles,
  ShieldCheck,
  Sun,
  Upload,
  Trash2,
  Download,
  Eye,
  Plus,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import scoutLogo from "../assets/smscouts_logo.png";
import {
  addAlbumPhotos,
  addChief,
  addEquipe,
  addFaq,
  addLeader,
  addRegisteredScout,
  changeOwnPassword,
  resetUserPassword,
  removeDashboardUser,
  assignEquipeScouts,
  createAlbum,
  createBlog,
  deleteAlbum,
  deleteBlog,
  deletePhotos,
  destroyFaq,
  removeEquipe,
  saveAdminRules,
  saveContactMessage,
  saveEquipe,
  saveFaq,
  saveLeader,
  saveWebsiteContent,
  completeDashboardEntityNotifications,
  deleteDashboardNotification,
  readDashboardNotification,
  readAllDashboardNotifications,
  submitDashboardWebsiteContentRevision,
  reviewDashboardWebsiteContentRevision,
  removeContactMessage,
  removeFaq,
  removeLeader,
  requestProfileChange,
  reviewProfileChange,
  activateScoutingYear,
  createScoutingYear,
  updateAlbum,
  updateBlog,
  updateCalendarEvent,
  updateChief,
  updatePhoto,
  updatePhotoBatch,
  updateRegisteredScout,
  uploadRegistrationSheet,
  loadDashboardReports,
  removeArchivedYearSnapshot,
  removeDashboardDocument,
  removeDashboardDocumentCategory,
  saveArchivedYearSnapshot,
  saveDashboardDocument,
  saveDashboardDocumentCategory,
  uploadDashboardDocumentFiles
} from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import ScoutAttendanceManager from "../features/attendance/ScoutAttendanceManager.jsx";
import AttendanceSheetsManager from "../features/attendance/AttendanceSheetsManager.jsx";
import ChiefAttendanceManager from "../features/attendance/ChiefAttendanceManager.jsx";
import CalendarManagement from "../features/calendar/CalendarManagement.jsx";
import FormsDashboard, { FormPreview } from "../features/forms/FormsDashboard.jsx";
import PeopleAccessWorkspace from "../features/people-access/PeopleAccessWorkspace.jsx";
import { normalizePeopleAccessInvitation, normalizePeopleAccessWorkspace, normalizeUserAccessDetails } from "../features/people-access/peopleAccessModel.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import AvatarCropModal from "../components/AvatarCropModal.jsx";
import BlogPostPreview from "../components/BlogPostPreview.jsx";
import FormattedText from "../components/FormattedText.jsx";
import RichTextEditor from "../components/RichTextEditor.jsx";
import MfaSecurityPanel from "../components/MfaSecurityPanel.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import WebsiteContentEditor, { getSiteImageCropConfig } from "../components/WebsiteContentEditor.jsx";
import { logAuditEvent } from "../services/auditService.js";
import { PERMISSIONS } from "../services/accessControlCatalog.js";
import { hasEffectivePermission } from "../services/accessControlResolver.js";
import {
  canCreateGroupMeetings,
  canEditScouts,
  canManageSystem,
  canManageFormTemplates,
  canPostForms,
  canPublishContent,
  canTakeAttendance,
  canUseForms,
  canViewAllForms,
  isAdmin as hasAdminRole,
  isChief as hasChiefRole
} from "../services/permissions.js";
import { subscribeDashboardRealtime } from "../services/realtimeService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";
import { isStructuredSiteContentKey } from "../services/siteContentService.js";
import {
  decideAccessReview,
  getPeopleAccessWorkspace,
  getUserAccessDetails,
  revokeUserGroupAssignment,
  revokeUserRoleAssignment,
  revokeUserTeamMembership,
  resolveAuthorizationDifference,
  saveAccessRole,
  saveAccessTeam,
  saveUserGroupAssignment,
  saveUserRoleAssignment,
  saveUserTeamMembership
} from "../services/peopleAccessService.js";

const emptyScout = {
  name: "",
  schoolGrade: "",
  age: "",
  gender: "",
  school: "",
  groupId: "",
  parentName: "",
  parentPhone: "",
  status: "Registered"
};

const emptyChief = {
  id: "",
  name: "",
  email: "",  role: "chief",
  groupId: "",
  assignedGroupIds: [],
  coordinatorGroupIds: [],
  chiefLevel: "chief",
  accountStatus: "active",
  profilePictureFile: null,
  profilePictureUrl: "",
  canPublish: false,
  canCreateGroupMeetings: false,
  canEditScouts: false
};

const postTypeOptions = [
  ["blog", "Blog"],
  ["news", "News"]
];

const postCategoryOptions = [
  ["general", "General"],
  ["camp", "Camp"],
  ["weekly_meeting", "Weekly meeting"],
  ["church_mass", "Church mass"],
  ["celebration", "Celebration"],
  ["outdoor_activity", "Outdoor activity"],
  ["volunteering_work", "Volunteering work"]
];

const emptyPost = {
  title: "",
  slug: "",
  postType: "blog",
  category: "general",
  author: "Group Admin",
  excerpt: "",
  body: "",
  thumbnailColor: "#2f7d6d",
  thumbnailUrl: "",
  thumbnailPath: "",
  thumbnailFile: null,
  albumId: "",
  approvalStatus: "approved"
};

const emptyAlbum = {
  title: "",
  eventDate: "",
  location: "",
  category: "",
  description: "",
  coverLabel: "",
  approvalStatus: "approved"
};

const emptyLeader = {
  name: "",
  title: "",
  displayOrder: 0,
  isActive: true,
  file: null
};

const emptyFaq = {
  question: "",
  answer: "",
  displayOrder: 0,
  isActive: true
};

const websiteContentFields = [
  ["home", "home_hero_image", "Hero background", "image"],
  ["home", "home_hero_title", "Hero headline", "text"],
  ["home", "home_hero_subtitle", "Hero subheading", "textarea"],
  ["home", "home_hero_cta_text", "Hero CTA text", "text"],
  ["home", "home_hero_cta_link", "Hero CTA destination", "text"],
  ["home", "home_about_text", "About snippet", "textarea"],
  ["home", "home_about_image", "About snippet image", "image"],
  ["home", "home_events_heading", "Upcoming events heading", "text"],
  ["home", "home_events_subtitle", "Upcoming events subtitle", "textarea"],
  ["home", "home_blogs_heading", "Latest news heading", "text"],
  ["home", "home_blogs_subtitle", "Latest news subtitle", "textarea"],
  ["home", "home_albums_heading", "Albums heading", "text"],
  ["home", "home_albums_subtitle", "Albums subtitle", "textarea"],
  ["home", "home_contact_heading", "Contact heading", "text"],
  ["home", "home_contact_intro", "Contact introduction", "textarea"],
  ["home", "home_contact_email", "Contact email", "text"],
  ["home", "home_contact_phone", "Contact phone", "text"],
  ["home", "home_contact_location", "Contact location", "text"],
  ["about", "about_hero_image", "About banner image", "image"],
  ["about", "about_page_title", "About page title", "text"],
  ["about", "about_intro_text", "Our story", "textarea"],
  ["about", "about_intro_image", "Our story image", "image"],
  ["about", "about_history_text", "History introduction", "textarea"],
  ["about", "about_history_milestones", "History timeline", "textarea"],
  ["about", "about_mission_text", "Mission statement", "textarea"],
  ["about", "about_values", "Values", "textarea"],
  ["about", "about_scout_groups", "Scout groups", "textarea"]
];
const sections = [
  ["overview", "Overview", LayoutDashboard, "all"],
  ["aiAssistant", "AI Assistant", Sparkles, "all"],
  ["myGroup", "My Group", Users, "chief"],
  ["scoutAttendance", "Scout Attendance", CheckCircle2, "attendance"],
  ["attendanceSheets", "Attendance Sheets", FileText, "attendance"],
  ["chiefAttendance", "Chief Attendance", ShieldCheck, "admin"],
  ["scouts", "Scouts", Users, "scouts"],
  ["equipes", "Equipe Management", ShieldCheck, "chief"],
  ["calendar", "Calendar Events", CalendarDays, "all"],
  ["posts", "Posts / Blogs", FileText, "publish"],
  ["gallery", "Gallery / Albums", GalleryHorizontal, "publish"],
  ["manageForms", "Manage Forms", FileText, "forms_manage"],
  ["formsCreate", "Create Form", FileText, "forms_manage"],
  ["formTemplates", "Form Templates", FileText, "forms_manage"],
  ["postedForms", "Posted Forms", FileText, "forms_post"],
  ["formResponses", "Form Responses", FileText, "forms_view"],
  ["myForms", "My Forms", FileText, "forms"],
  ["myFormDrafts", "My Form Drafts", FileText, "forms"],
  ["mySubmittedForms", "Submitted Forms", FileText, "forms"],
  ["approvals", "Approval Requests", CheckCircle2, "admin"],
  ["notifications", "Notifications", Bell, "all"],
  ["contactMessages", "Contact Messages", MessageSquare, "admin"],
  ["settings", "Settings", Settings, "admin"],
  ["usersPermissions", "People & Access", LockKeyhole, "settings"],
  ["websiteContent", "Website Content", Image, "settings"],
  ["upload", "Registered Scout Upload", Upload, "settings"],
  ["rules", "Groups & Sorting Rules", Settings, "settings"],  ["documents", "Documents", Folder, "settings"],
  ["reports", "Reports", Archive, "settings"],
  ["archives", "Archived Years", Archive, "settings"]
];

const settingSections = [
  ["usersPermissions", "People & Access", LockKeyhole, "Manage people, scouting assignments, teams, roles, reviews, and effective access."],
  ["scouts", "Scouts", Users, "Add, edit, and assign scout records."],
  ["upload", "Registered Scout Upload", Upload, "Upload the active scout registration sheet and preserve historical lists."],
  ["rules", "Groups & Sorting Rules", Settings, "Control automatic grouping by school grade, age, and gender rules."],
  ["websiteContent", "Website Content", Image, "Edit public website text, images, leader headshots, and content blocks."],  ["documents", "Documents", Folder, "Store and prepare document publishing workflows."],
  ["reports", "Reports", Archive, "Review attendance and yearly reporting modules."],
  ["archives", "Archived Years", Archive, "Review current active year and prepare future archive workflows."]
];

const contentStatuses = ["draft", "pending", "pending_update", "needs_changes", "approved", "rejected", "archived"];
const reviewStatuses = ["pending", "pending_update", "needs_changes", "rejected", "archived"];
const sidebarModeKey = "scouts-dashboard-sidebar-mode";
const dashboardThemeKey = "scouts-dashboard-theme";
const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const wizardSteps = ["Details", "Media", "Review"];

const sortLabels = {
  schoolGrade: "school grade",
  age: "age",
  school: "school",
  name: "name",
  groupId: "group"
};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function getCoordinatorGroupIds(user) {
  return Array.isArray(user?.coordinatorGroupIds) ? user.coordinatorGroupIds : [];
}

function getProfileAssignedGroupIds(user) {
  return Array.from(new Set([
    ...(Array.isArray(user?.assignedGroupIds) ? user.assignedGroupIds : []),
    user?.groupId,
    ...getCoordinatorGroupIds(user)
  ].filter(Boolean)));
}

function getUserRoles(user) {
  if (!user) return [];
  return Array.from(new Set([
    user.role === "admin" ? "admin" : null,
    user.role === "chief" || user.chiefLevel || getProfileAssignedGroupIds(user).length ? "chief" : null
  ].filter(Boolean)));
}

function getPrimaryRole(roles) {
  return roles.includes("admin") ? "admin" : "chief";
}

function getAssignableGroupIds(user) {
  if (!user) return [];
  return getProfileAssignedGroupIds(user);
}

function canAccessGroup(user, groupId) {
  return hasAdminRole(user) || getAssignableGroupIds(user).includes(groupId);
}

function chiefDefaults(level) {
  if (level === "head") {
    return { canPublish: true, canCreateGroupMeetings: true, canEditScouts: true, manageFormTemplates: true, viewAllForms: true, postForms: true };
  }
  if (level === "vice") {
    return { canPublish: true, canCreateGroupMeetings: true, canEditScouts: false, manageFormTemplates: false, viewAllForms: false, postForms: true };
  }

  return { canPublish: false, canCreateGroupMeetings: false, canEditScouts: false, manageFormTemplates: false, viewAllForms: false, postForms: false };
}

function toChiefForm(user) {
  const roles = getUserRoles(user);
  const assignedGroupIds = getProfileAssignedGroupIds(user);
  return {
    name: user.name,
    email: user.email ?? "",
    role: getPrimaryRole(roles),
    assignedGroupIds,
    groupId: assignedGroupIds[0] ?? "",
    coordinatorGroupIds: assignedGroupIds,
    chiefLevel: user.chiefLevel ?? "chief",
    accountStatus: user.accountStatus ?? "active",
    canPublish: Boolean(user.permissions.canPublish),
    canCreateGroupMeetings: Boolean(user.permissions.canCreateGroupMeetings),
    canEditScouts: Boolean(user.permissions.canEditScouts),
    manageFormTemplates: Boolean(user.permissions.manageFormTemplates),
    viewAllForms: Boolean(user.permissions.viewAllForms),
    postForms: Boolean(user.permissions.postForms),
    profilePictureUrl: user.profilePictureUrl ?? null,
    profilePictureFile: null,
    profilePicturePreview: ""
  };
}
function filterBySearch(items, search, fields) {
  const term = search.trim().toLowerCase();
    if (!term) {
    return items;
  }

  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? "").toLowerCase().includes(term))
  );
}

function auditMetaValue(metadata, side, key) {
  return metadata?.[side]?.[key] ?? metadata?.[`${side}_${key}`] ?? null;
}

function auditChangedFields(metadata) {
  return Array.isArray(metadata?.changed_fields) ? metadata.changed_fields : [];
}

function auditTitleFromMeta(metadata, fallback = "") {
  return (
    auditMetaValue(metadata, "new", "title") ||
    auditMetaValue(metadata, "old", "title") ||
    auditMetaValue(metadata, "new", "name") ||
    auditMetaValue(metadata, "old", "name") ||
    auditMetaValue(metadata, "new", "file_name") ||
    auditMetaValue(metadata, "old", "file_name") ||
    metadata?.title ||
    metadata?.name ||
    fallback
  );
}

function formatAuditDetails(details) {
  const entries = Object.entries(details ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  return entries.length ? entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" | ") : "";
}

function mapDashboardActivityLog(log, actorName) {
  const metadata = log.metadata ?? {};
  const table = metadata.table ?? log.entityType;
  const operation = metadata.operation ?? String(log.action ?? "").split("_")[0]?.toUpperCase();
  const changedFields = auditChangedFields(metadata);
  const oldRole = auditMetaValue(metadata, "old", "role");
  const newRole = auditMetaValue(metadata, "new", "role");
  const oldStatus = auditMetaValue(metadata, "old", "account_status") ?? auditMetaValue(metadata, "old", "status");
  const newStatus = auditMetaValue(metadata, "new", "account_status") ?? auditMetaValue(metadata, "new", "status");
  const oldGroupId = auditMetaValue(metadata, "old", "group_id");
  const newGroupId = auditMetaValue(metadata, "new", "group_id");
  const source = auditMetaValue(metadata, "new", "source") ?? metadata.source;
  const base = {
    actor: actorName,
    createdAt: formatDubaiDateTime(log.createdAt),
    entityId: log.entityId,
    details: ""
  };
  const makeRow = (category, action, details = {}) => ({
    ...base,
    category,
    action,
    entityType: category,
    details: formatAuditDetails(details)
  });

  if (log.action === "settings_changed") return makeRow("Settings / System-level", "Dashboard-wide setting changed", metadata);
  if (log.action === "active_scout_year_changed") return makeRow("Settings / System-level", "Dashboard-wide setting changed", { setting: "Active scouting year", from: metadata.previousYearId, to: metadata.yearId });
  if (log.action === "archive_created") return makeRow("Archived Years", "Year archived", { year: metadata.label, by: actorName });
  if (log.action === "documents_uploaded") return makeRow("Documents", "Document uploaded", { count: metadata.count, file: metadata.fileName, category: metadata.categoryName });
  if (log.action === "document_deleted") return makeRow("Documents", "Document deleted", { document: metadata.title });
  if (log.action === "document_category_created") return makeRow("Documents", "Document category created", { category: metadata.name });
  if (log.action === "document_category_updated") return makeRow("Documents", "Document category renamed", { category: metadata.name });
  if (log.action === "document_category_deleted") return makeRow("Documents", "Document category deleted", { category: metadata.name });
  if (log.action === "document_updated") return makeRow("Documents", "Document reassigned to a different category", { document: metadata.title, fields: changedFields });
  if (log.action === "blog_edited" || log.action === "blog_submitted") return makeRow("Content", log.action === "blog_edited" ? "Blog post edited" : "Blog post created", { title: metadata.title, status: metadata.status });
  if (log.action === "album_edited" || log.action === "album_submitted") return makeRow("Content", log.action === "album_edited" ? "Gallery album edited" : "Gallery album created", { title: metadata.title, status: metadata.status });
  if (log.action === "photo_batch_images_removed") return makeRow("Content", "Gallery photos deleted", { count: metadata.removedCount });
  if (log.action === "attendance_taken") return makeRow("Attendance", "Attendance record taken", { date: metadata.date, group: metadata.groupId, scope: metadata.scope });
  if (log.action === "attendance_updated_after_submission") return makeRow("Attendance", "Attendance record edited after submission", { date: metadata.date, group: metadata.groupId, scope: metadata.scope });

  if (table === "user_profiles") {
    if (operation === "INSERT") return makeRow("People & Access", "User account created", { role: newRole, status: newStatus });
    if (operation === "DELETE") return makeRow("People & Access", "User permanently deleted", { role: oldRole, status: oldStatus });
    if (operation === "UPDATE") {
      if (oldRole && newRole && oldRole !== newRole) return makeRow("People & Access", "Role changed", { before: oldRole, after: newRole });
      if (oldStatus && newStatus && oldStatus !== newStatus) return makeRow("People & Access", newStatus === "active" ? "User reactivated" : "User deactivated", { before: oldStatus, after: newStatus });
      if (changedFields.some((field) => ["roles", "assigned_group_ids", "coordinator_group_ids"].includes(field))) return makeRow("People & Access", "Coordinator access changed on user account", { fields: changedFields });
    }
  }
  if (table === "scouts") {
    if (operation === "INSERT" && source !== "excel") return makeRow("Scouts / Registration", "Scout record created manually", { scout: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "DELETE") return makeRow("Scouts / Registration", "Scout record deleted", { scout: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") {
      if (oldGroupId && newGroupId && oldGroupId !== newGroupId) return makeRow("Scouts / Registration", "Scout moved between groups", { scout: auditTitleFromMeta(metadata, log.entityId), from: oldGroupId, to: newGroupId });
      return makeRow("Scouts / Registration", "Scout record edited", { scout: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
    }
  }
  if (table === "registration_uploads" && operation === "INSERT") return makeRow("Scouts / Registration", "Bulk registration upload performed", { file: auditTitleFromMeta(metadata, log.entityId), records: metadata.count ?? metadata.successCount, failed: metadata.failCount });
  if (table === "groups") {
    if (operation === "INSERT") return makeRow("Groups & Sorting Rules", "Group created", { group: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") return makeRow("Groups & Sorting Rules", "Group renamed or edited", { group: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
    if (operation === "DELETE") return makeRow("Groups & Sorting Rules", "Group deleted", { group: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "grouping_rules") return makeRow("Groups & Sorting Rules", "Sorting rule changed", { fields: changedFields });
  if (table === "site_content_revisions") {
    if (operation === "INSERT") return makeRow("Website Content", "Content edit submitted for approval", { page: auditTitleFromMeta(metadata, log.entityId), status: newStatus });
    if (operation === "UPDATE" && newStatus === "approved") return makeRow("Website Content", "Content edit approved", { page: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE" && newStatus === "rejected") return makeRow("Website Content", "Content edit rejected", { page: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "site_content" && ["INSERT", "UPDATE"].includes(operation)) return makeRow("Website Content", "Content published live", { page: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
  if (table === "documents") {
    if (operation === "INSERT") return makeRow("Documents", "Document uploaded", { file: auditTitleFromMeta(metadata, log.entityId), category: auditMetaValue(metadata, "new", "category_id") });
    if (operation === "DELETE") return makeRow("Documents", "Document deleted", { file: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE" && changedFields.includes("category_id")) return makeRow("Documents", "Document reassigned to a different category", { file: auditTitleFromMeta(metadata, log.entityId), from: auditMetaValue(metadata, "old", "category_id"), to: auditMetaValue(metadata, "new", "category_id") });
  }
  if (table === "document_categories") {
    if (operation === "INSERT") return makeRow("Documents", "Document category created", { category: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") return makeRow("Documents", "Document category renamed", { category: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "DELETE") return makeRow("Documents", "Document category deleted", { category: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "posts") {
    if (operation === "INSERT") return makeRow("Content", "Blog post created", { title: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") return makeRow("Content", "Blog post edited", { title: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
    if (operation === "DELETE") return makeRow("Content", "Blog post deleted", { title: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "gallery_albums") {
    if (operation === "INSERT") return makeRow("Content", "Gallery album created", { title: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "DELETE") return makeRow("Content", "Gallery album deleted", { title: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") return makeRow("Content", "Gallery album edited", { title: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
  }
  if (table === "gallery_images" && operation === "INSERT") return makeRow("Content", "Gallery photos added", { album: auditMetaValue(metadata, "new", "album_id") });
  if (table === "calendar_events") {
    if (operation === "INSERT") return makeRow("Content", "Calendar event created", { title: auditTitleFromMeta(metadata, log.entityId), date: auditMetaValue(metadata, "new", "date_from") ?? auditMetaValue(metadata, "new", "date") });
    if (operation === "UPDATE") return makeRow("Content", "Calendar event edited", { title: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
    if (operation === "DELETE") return makeRow("Content", "Calendar event deleted", { title: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "form_templates" || table === "posted_forms") {
    if (operation === "INSERT") return makeRow("Forms", "Form created", { title: auditTitleFromMeta(metadata, log.entityId) });
    if (operation === "UPDATE") return makeRow("Forms", "Form edited", { title: auditTitleFromMeta(metadata, log.entityId), fields: changedFields });
    if (operation === "DELETE") return makeRow("Forms", "Form deleted", { title: auditTitleFromMeta(metadata, log.entityId) });
  }
  if (table === "form_submissions" && operation === "DELETE") return makeRow("Forms", "Form submission deleted", { form: auditMetaValue(metadata, "old", "posted_form_id") });
  if ((table === "attendance_sessions" || table === "chief_attendance_sessions") && operation === "UPDATE") return makeRow("Attendance", "Attendance record edited after submission", { date: auditMetaValue(metadata, "new", "date") ?? auditMetaValue(metadata, "old", "date"), group: auditMetaValue(metadata, "new", "group_id") ?? auditMetaValue(metadata, "old", "group_id"), fields: changedFields });
  if (table === "contact_messages" && operation === "DELETE") return makeRow("Contact Messages", "Contact message deleted", { subject: auditTitleFromMeta(metadata, log.entityId) });
  if (table === "archived_years" && operation === "INSERT") return makeRow("Archived Years", "Year archived", { year: auditTitleFromMeta(metadata, log.entityId), by: actorName });

  return null;
}

function sortScouts(scouts, sortBy) {
  return [...scouts].sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? "")));
}

function getSchoolGrade(scout) {
  const grade = String(scout?.schoolGrade ?? "").trim();
  const school = String(scout?.school ?? "").trim();
    if (grade && school && grade.toLowerCase() === school.toLowerCase()) {
    return grade;
  }

  return grade || school || "Unspecified";
}

function canSeeDashboardEvent(event, user) {
  if ((event.approvalStatus ?? "approved") === "draft" && event.submittedBy !== user?.id) {
    return false;
  }

  if (!hasAdminRole(user) && (event.approvalStatus ?? "approved") !== "approved") {
    return false;
  }

  if (event.visibility === "public") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (hasAdminRole(user)) {
    return true;
  }

  if (event.visibility === "logged-in") {
    return true;
  }

  if (event.visibility === "group") {
    return getAssignableGroupIds(user).some((groupId) => event.visibleGroupIds?.includes(groupId) || event.groupId === groupId);
  }

  return event.type !== "meeting";
}
function getEquipeName(scout, equipes) {
  return equipes.find((equipe) => equipe.id === scout?.equipeId)?.name ?? "Unassigned";
}

function hasChiefAccess(user) {
  return hasChiefRole(user) || Boolean(getProfileAssignedGroupIds(user).length && user?.chiefLevel);
}

function canManageEquipesForGroup(user, groupId) {
  return canManageSystem(user) || (
    canAccessGroup(user, groupId) &&
    (["head", "vice"].includes(user?.chiefLevel)) &&
    user?.accountStatus !== "disabled"
  );
}

function isSectionAllowed(section, user) {
  const [id, , , access] = section;
    if (!user || user.accountStatus === "disabled") {
    return false;
  }
    if (canManageSystem(user)) {
    return access !== "settings";
  }
    if (["documents", "archives"].includes(id)) {
    return hasChiefAccess(user);
  }
    if (id === "equipes") {
    return ["head", "vice"].includes(user?.chiefLevel) && getProfileAssignedGroupIds(user).length > 0;
  }
    if (access === "settings" || access === "admin") {
    return false;
  }
    if (access === "all") {
    return true;
  }
    if (access === "chief") {
    return hasChiefAccess(user);
  }
    if (access === "attendance") {
    return canTakeAttendance(user);
  }
    if (access === "publish") {
    return canPublishContent(user);
  }
    if (access === "scouts") {
    return canEditScouts(user);
  }
    if (access === "forms") {
    return canUseForms(user);
  }
    if (id === "manageForms") {
    return canManageFormTemplates(user) || canPostForms(user) || canViewAllForms(user);
  }
    if (access === "forms_manage") {
    return canManageFormTemplates(user) || canPostForms(user);
  }
    if (access === "forms_post") {
    return canPostForms(user) || canViewAllForms(user);
  }
    if (access === "forms_view") {
    return canViewAllForms(user) || canPostForms(user);
  }

  return false;
}

function canOpenSection(sectionId, user) {
  const section = sections.find(([id]) => id === sectionId);
    if (!section) {
    return false;
  }
    if (["documents", "archives"].includes(sectionId)) {
    return canManageSystem(user) || hasChiefAccess(user);
  }
    if (section[3] === "settings") {
    return canManageSystem(user);
  }

  return isSectionAllowed(section, user);
}

function formatRelativeTime(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function formatDubaiDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(date).reduce((current, part) => ({ ...current, [part.type]: part.value }), {});

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod?.toLowerCase() ?? ""}`.trim();
}


function formatFileSize(bytes) {
  const size = Number(bytes ?? 0);
  if (!size) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadCsvFile(fileName, rows) {
  const columns = Array.from(rows.reduce((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key));
    return keys;
  }, new Set()));
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(","))].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function summarizeArchiveSnapshot(snapshot = {}) {
  return [
    ["Events", snapshot.events?.length ?? 0],
    ["Scout attendance", snapshot.attendanceMeetings?.length ?? 0],
    ["Chief attendance", snapshot.chiefAttendanceMeetings?.length ?? 0],
    ["Posts", snapshot.posts?.length ?? 0],
    ["Albums", snapshot.albums?.length ?? 0]
  ];
}
function getReviewTimestamp(item) {
  return item.updatedAt || item.createdAt || item.profileChangeSubmittedAt || item.dateFrom || item.date || item.eventDate || "";
}
function isRecentOrPendingApproval(item) {
  const status = item.approvalStatus;
  if (["pending", "pending_update"].includes(status)) return true;
  const timestamp = new Date(getReviewTimestamp(item)).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 3 * 24 * 60 * 60 * 1000;
}
function WizardStepper({ step }) {
  return (
    <div className="wizard-stepper" aria-label={`Step ${step + 1} of ${wizardSteps.length}`}>
      <div className="wizard-stepper-desktop">
        {wizardSteps.map((label, index) => (
          <span className={`wizard-step ${index < step ? "complete" : ""} ${index === step ? "current" : ""}`} key={label}>
            <i>{index + 1}</i>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <div className="wizard-stepper-mobile">
        <strong>Step {step + 1} of {wizardSteps.length}</strong>
        <div><span style={{ width: `${((step + 1) / wizardSteps.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}

function WizardControls({ step, setStep, isSubmitting = false, submitLabel = "Submit", canProceed = true }) {
  return (
    <div className="wizard-actions">
      {step > 0 && (
        <button type="button" className="secondary-action" onClick={() => setStep((current) => Math.max(0, current - 1))}>
          Back
        </button>
      )}
      {step < wizardSteps.length - 1 ? (
        <button type="button" className="primary-action" disabled={!canProceed} onClick={() => setStep((current) => Math.min(wizardSteps.length - 1, current + 1))}>
          Next
        </button>
      ) : (
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : submitLabel}
        </button>
      )}
    </div>
  );
}

function ReviewGrid({ items }) {
  return (
    <div className="review-grid">
      {items.map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value || "Not set"}</strong>
        </span>
      ))}
    </div>
  );
}

function PendingWorkList({ items, getSubmitterName, getSubmitterPicture, onOpen }) {
  const visibleItems = items.slice(0, 5);
  return (
    <article className="dashboard-work-panel">
      <div className="panel-heading compact-heading">
        <div>
          <h2>Pending Work</h2>
          <p>Requests and drafts that need attention.</p>
        </div>
        <span>{items.length}</span>
      </div>
      <div className="pending-work-list">
        {visibleItems.length ? visibleItems.map((item) => (
          <div className="pending-work-row" key={`${item.contentType}-${item.id}`}>
            <span className="pending-type-badge"><FileText size={15} aria-hidden="true" />{item.contentType}</span>
            <strong>{item.title || item.name || "Untitled request"}</strong>
            <span className="pending-submitter">
              <UserAvatar name={getSubmitterName(item)} imageUrl={getSubmitterPicture(item)} size={28} />
              {getSubmitterName(item)}
            </span>
            <small>{formatRelativeTime(item.updatedAt || item.createdAt || item.dateFrom || item.date)}</small>
            <button type="button" className="inline-action" onClick={() => onOpen(item)}>{item.approvalStatus === "pending" ? "Review" : "View"}</button>
          </div>
        )) : <p className="empty-state">No pending work right now.</p>}
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { user, logout, loginWithPassword, refreshUsers } = useAuth();
  const { showToast } = useToast();
  const { data, isLoading: isDashboardLoading, error: dashboardError, refresh } = useBootstrap();
  const [activeSection, setActiveSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState(data.registrationImportSettings.sortBy);
  const [assignmentMode, setAssignmentMode] = useState(data.registrationImportSettings.assignmentMode);
  const [rules, setRules] = useState(data.groupingRulesStore.rules);
  const [scoutEdits, setScoutEdits] = useState({});
  const [newScout, setNewScout] = useState({ ...emptyScout, groupId: data.groups[0]?.id ?? "" });
  const [equipeEdits, setEquipeEdits] = useState({});
  const [newEquipe, setNewEquipe] = useState({ name: "", description: "" });
  const [isNewEquipeOpen, setIsNewEquipeOpen] = useState(false);
  const [expandedEquipeDescriptions, setExpandedEquipeDescriptions] = useState({});
  const [equipeScoutFilter, setEquipeScoutFilter] = useState("all");
  const [selectedEquipeId, setSelectedEquipeId] = useState("all");
  const [selectedScoutIds, setSelectedScoutIds] = useState([]);
  const [autoAssignMode, setAutoAssignMode] = useState("equal");
  const [customEquipeSizes, setCustomEquipeSizes] = useState({});
  const [genderBalance, setGenderBalance] = useState("auto");
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [isEquipeActionLoading, setIsEquipeActionLoading] = useState(false);
  const [chiefEdits, setChiefEdits] = useState({});
  const [newChief, setNewChief] = useState({ ...emptyChief, groupId: data.groups[0]?.id ?? "", assignedGroupIds: data.groups[0]?.id ? [data.groups[0].id] : [] });
  const [newChiefPreview, setNewChiefPreview] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [openMobileMoreGroups, setOpenMobileMoreGroups] = useState({});
  const [discardCloseRequest, setDiscardCloseRequest] = useState(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ name: user?.name ?? "", profilePictureFile: null, profilePicturePreview: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [avatarCropRequest, setAvatarCropRequest] = useState(null);
  const [postEdits, setPostEdits] = useState({});
  const [newPost, setNewPost] = useState(emptyPost);
  const [albumEdits, setAlbumEdits] = useState({});
  const [newAlbum, setNewAlbum] = useState(emptyAlbum);
  const [galleryUploadMode, setGalleryUploadMode] = useState("existing");
  const [albumThumbnailFile, setAlbumThumbnailFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoAlbumId, setPhotoAlbumId] = useState(data.galleryAlbums[0]?.id ?? "");
  const [photoUploadProgress, setPhotoUploadProgress] = useState({ completed: 0, total: 0, percent: 0 });
  const [siteContentEdits, setSiteContentEdits] = useState({});
  const [siteImageFiles, setSiteImageFiles] = useState({});
  const [siteImagePreviews, setSiteImagePreviews] = useState({});
  const [leaderEdits, setLeaderEdits] = useState({});
  const [newLeader, setNewLeader] = useState(emptyLeader);
  const [faqEdits, setFaqEdits] = useState({});
  const [newFaq, setNewFaq] = useState(emptyFaq);
  const [contactEdits, setContactEdits] = useState({});
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactInboxSearch, setContactInboxSearch] = useState("");
  const [contactInboxStatus, setContactInboxStatus] = useState("all");
  const [websiteEditorPage, setWebsiteEditorPage] = useState("home");
  const [websiteReviewOpen, setWebsiteReviewOpen] = useState(false);
  const [websiteCollections, setWebsiteCollections] = useState({ faqs: null, leaders: null });
  const [websiteEditorVersion, setWebsiteEditorVersion] = useState(0);
  const [requestedFormId, setRequestedFormId] = useState(null);
  const [activeSetting, setActiveSetting] = useState("usersPermissions");
  const [peopleAccessWorkspace, setPeopleAccessWorkspace] = useState(() => normalizePeopleAccessWorkspace());
  const [peopleAccessLoading, setPeopleAccessLoading] = useState(false);
  const [peopleAccessError, setPeopleAccessError] = useState("");
  const [peopleAccessWarning, setPeopleAccessWarning] = useState("");
  const [lastDashboardSection, setLastDashboardSection] = useState("overview");
  const [sidebarMode, setSidebarMode] = useState(() => window.localStorage.getItem(sidebarModeKey) ?? "expanded");
  const [dashboardTheme, setDashboardTheme] = useState(() => window.localStorage.getItem(dashboardThemeKey) ?? "light");
  const [openSidebarGroups, setOpenSidebarGroups] = useState({});
  const [collapsedFlyoutTop, setCollapsedFlyoutTop] = useState(null);
  const [sidebarTooltip, setSidebarTooltip] = useState(null);
  const [isSidebarTemporarilyExpanded, setIsSidebarTemporarilyExpanded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showMobileMenuBar, setShowMobileMenuBar] = useState(false);
  const [postWizardStep, setPostWizardStep] = useState(0);
  const [editingWizardPostId, setEditingWizardPostId] = useState(null);
  const [galleryWizardStep, setGalleryWizardStep] = useState(0);
  const [editingWizardAlbumId, setEditingWizardAlbumId] = useState(null);
  const [contentPreviewMode, setContentPreviewMode] = useState("web");
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [selectedApprovalPhotoIds, setSelectedApprovalPhotoIds] = useState([]);
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalTypeFilter, setApprovalTypeFilter] = useState("all");
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(user?.groupId ?? data.groups[0]?.id ?? "");
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [documentCategoryName, setDocumentCategoryName] = useState("");
  const [selectedDocumentCategory, setSelectedDocumentCategory] = useState("all");
  const [documentUploadCategoryId, setDocumentUploadCategoryId] = useState("");
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentEdits, setDocumentEdits] = useState({});
  const [reportsData, setReportsData] = useState({ auditLogs: [] });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [reportTab, setReportTab] = useState("approvals");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [archiveYearId, setArchiveYearId] = useState("");
  const [registrationTargetMode, setRegistrationTargetMode] = useState("existing");
  const [registrationYearId, setRegistrationYearId] = useState(data.activeScoutYearId ?? data.scoutYears?.[0]?.id ?? "");
  const [newScoutYearName, setNewScoutYearName] = useState("");

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    showToast(saveMessage);
    const messageTimer = window.setTimeout(() => setSaveMessage(""), 3600);

    return () => window.clearTimeout(messageTimer);
  }, [saveMessage, showToast]);

  const visibleSections = sections.filter((section) => isSectionAllowed(section, user));
  const isAdmin = canManageSystem(user);
  const canViewPeopleAccess = isAdmin || hasEffectivePermission(data.effectiveAccess, PERMISSIONS.USERS_VIEW);
  const peopleAccessCapabilities = useMemo(() => {
    const allowed = (permission) => isAdmin || hasEffectivePermission(data.effectiveAccess, permission);
    return {
      users: allowed(PERMISSIONS.USERS_VIEW),
      roles: allowed(PERMISSIONS.ROLES_VIEW),
      teams: allowed(PERMISSIONS.USERS_ASSIGN_TEAMS) || allowed(PERMISSIONS.ROLES_VIEW),
      reviews: allowed(PERMISSIONS.AUDIT_LOGS_VIEW),
      audit: allowed(PERMISSIONS.AUDIT_LOGS_VIEW),
      invite: allowed(PERMISSIONS.USERS_INVITE),
      createRole: allowed(PERMISSIONS.ROLES_CREATE),
      createTeam: allowed(PERMISSIONS.USERS_ASSIGN_TEAMS),
      assignRoles: allowed(PERMISSIONS.USERS_ASSIGN_ROLES),
      assignGroups: allowed(PERMISSIONS.USERS_ASSIGN_GROUPS),
      assignTeams: allowed(PERMISSIONS.USERS_ASSIGN_TEAMS),
      deleteUser: allowed(PERMISSIONS.USERS_DELETE),
      currentUserId: user?.id ?? null,
      resetPassword: allowed(PERMISSIONS.USERS_RESET_PASSWORD),
      editUser: allowed(PERMISSIONS.USERS_UPDATE_PROFILE)
    };
  }, [data.effectiveAccess, isAdmin, user?.id]);
  const legacyPeopleAccessFallback = useMemo(() => normalizePeopleAccessWorkspace({
    users: data.users ?? [],
    groups: data.groups ?? [],
    summary: {
      active_users: (data.users ?? []).filter((profile) => profile.accountStatus === "active").length,
      invited_users: (data.users ?? []).filter((profile) => profile.accountStatus === "invited").length,
      disabled_users: (data.users ?? []).filter((profile) => profile.accountStatus === "disabled").length
    }
  }), [data.groups, data.users]);
  const assignedGroupIds = isAdmin ? data.groups.map((group) => group.id) : getAssignableGroupIds(user);
  const dashboardGroupId = assignedGroupIds.includes(selectedGroupId) ? selectedGroupId : assignedGroupIds[0] ?? data.groups[0]?.id ?? "";
  const dashboardGroup = data.groups.find((group) => group.id === dashboardGroupId);
  const groupSwitcherGroups = data.groups.filter((group) => assignedGroupIds.includes(group.id));
  const usersById = useMemo(() => new Map((data.users ?? []).map((profile) => [profile.id, profile])), [data.users]);
  const getSubmitterProfile = (submittedBy) => usersById.get(submittedBy) ?? null;
  const getSubmitterName = (item) => item.submitterName || getSubmitterProfile(item.submittedBy)?.name || (item.submittedBy && !String(item.submittedBy).includes("-") ? item.submittedBy : "Unknown");
  const getSubmitterPicture = (item) => item.submitterProfilePictureUrl || item.profilePictureUrl || getSubmitterProfile(item.submittedBy)?.profilePictureUrl || null;
  const chiefs = data.users.filter((profile) => hasChiefAccess(profile));
  const groupEquipes = (data.equipes ?? []).filter((equipe) => equipe.groupId === dashboardGroupId && equipe.isActive);
  const groupChiefs = chiefs.filter((chief) => chief.groupId === dashboardGroupId);
  const allPosts = data.allBlogPosts ?? data.blogPosts;
  const allAlbums = data.allGalleryAlbums ?? data.galleryAlbums;
  const allPhotos = data.allGalleryPhotos ?? allAlbums.flatMap((album) => album.photos ?? []);
  const allPhotoBatches = data.photoUploadBatches ?? [];
  const allPostedForms = data.postedForms ?? [];
  const allWebsiteContentRevisions = data.siteContentRevisions ?? [];
  const allFormSubmissions = data.formSubmissions ?? [];
  const isPostedFormTargetedToUser = (form, targetUser = user) => {
    if (!targetUser) return false;
    if (form.targetType === "all_chiefs") return true;
    if (form.targetType === "groups") return getAssignableGroupIds(targetUser).some((groupId) => form.targetGroupIds?.includes(groupId));
    if (form.targetType === "users") return form.targetUserIds?.includes(targetUser.id);
    return false;
  };
  const reviewItems = [
    ...allPosts.filter((post) => post.approvalStatus !== "draft").map((post) => ({ ...post, contentType: "Blog post" })),
    ...allAlbums.filter((album) => album.approvalStatus !== "draft").map((album) => ({ ...album, contentType: "Album" })),
    ...allPhotoBatches.filter((batch) => batch.approvalStatus !== "draft").map((batch) => ({ ...batch, contentType: "Photo batch" })),
    ...data.plannedEvents.filter((event) => event.approvalStatus !== "draft").map((event) => ({ ...event, contentType: "Calendar event" })),
    ...allPostedForms.filter((form) => form.approvalStatus !== "draft").map((form) => ({
      ...form,
      contentType: "Posted form",
      submittedBy: form.submittedBy ?? form.createdBy,
      submitterName: form.submitterName ?? getSubmitterProfile(form.submittedBy ?? form.createdBy)?.name,
      submitterProfilePictureUrl: form.submitterProfilePictureUrl ?? getSubmitterProfile(form.submittedBy ?? form.createdBy)?.profilePictureUrl
    }))
    ,...allWebsiteContentRevisions.filter((revision) => revision.approvalStatus !== "draft").map((revision) => ({ ...revision, contentType: "Website Content" }))
  ];
  const profileReviewItems = (data.users ?? [])
    .filter((profile) => profile.profileChangeStatus === "pending")
    .map((profile) => ({
      ...profile,
      id: profile.id,
      title: profile.pendingName ? `Profile change for ${profile.name} -> ${profile.pendingName}` : `Profile picture change for ${profile.name}`,
      contentType: "Profile change",
      approvalStatus: "pending",
      submittedBy: profile.name,
      updatedAt: profile.profileChangeSubmittedAt ?? profile.updatedAt,
      description: profile.profileChangeComment ?? ""
    }));
  const pendingItems = [...reviewItems, ...profileReviewItems].filter((item) => ["pending", "pending_update", "needs_changes"].includes(item.approvalStatus));
  const openAssignedForms = allPostedForms
    .filter((form) => form.approvalStatus === "open" && isPostedFormTargetedToUser(form, user))
    .filter((form) => !allFormSubmissions.some((submission) => submission.postedFormId === form.id && submission.submittedBy === user?.id && submission.approvalStatus === "submitted"))
    .map((form) => ({ ...form, contentType: "Posted form", title: form.title || "Assigned form" }));
  const ownPendingItems = [
    ...allPosts,
    ...allAlbums,
    ...data.plannedEvents,
    ...allPostedForms.filter((form) => form.createdBy === user?.id || form.submittedBy === user?.id),
    ...allWebsiteContentRevisions.filter((revision) => revision.submittedBy === user?.id)
  ]
    .filter((item) => item.submittedBy === user?.id || item.createdBy === user?.id)
    .filter((item) => ["draft", "pending", "pending_update", "needs_changes", "rejected"].includes(item.approvalStatus))
    .map((item) => ({ ...item, contentType: item.contentType ?? (item.targetType ? "Posted form" : item.location ? "Calendar event" : item.photos ? "Album" : "Blog post") }));
  const pendingWorkItems = canOpenSection("approvals", user) ? [...pendingItems, ...openAssignedForms] : [...openAssignedForms, ...ownPendingItems];
  const isRelatedNotificationResolved = (notification) => {
    const entityType = notification?.entityType;
    const entityId = String(notification?.entityId ?? "");
    if (!entityType || !entityId) return false;

    if (entityType === "contact_message") {
      const message = (data.contactMessages ?? []).find((item) => String(item.id) === entityId);
      return !message || message.status !== "new";
    }

    if (entityType === "posted_form") {
      const form = allPostedForms.find((item) => String(item.id) === entityId);
      const submitted = allFormSubmissions.some((submission) => String(submission.postedFormId) === entityId && submission.submittedBy === user?.id && submission.approvalStatus === "submitted");
      if (!form) return true;
      if (notification.type === "form") return submitted || form.approvalStatus !== "open";
      if (notification.type === "approval") return !["pending", "pending_update"].includes(form.approvalStatus);
      return false;
    }

    if (entityType === "profile") {
      const profile = (data.users ?? []).find((item) => String(item.id) === entityId);
      return !profile || profile.profileChangeStatus !== "pending";
    }

    if (entityType === "site_content_revision") {
      const revision = allWebsiteContentRevisions.find((item) => String(item.id) === entityId);
      return !revision || !["pending", "pending_update"].includes(revision.approvalStatus);
    }

    const entityLists = {
      posts: allPosts,
      gallery_albums: allAlbums,
      calendar_events: data.plannedEvents ?? []
    };
    const item = entityLists[entityType]?.find((entry) => String(entry.id) === entityId);
    return !item || !["pending", "pending_update"].includes(item.approvalStatus);
  };
  const persistedNotifications = (data.notifications ?? []).map((item) => ({ ...item, isRead: item.isRead || isRelatedNotificationResolved(item) }));
  const hasPersistedEntityNotification = (entityType, entityId) => persistedNotifications.some((item) => item.entityType === entityType && String(item.entityId) === String(entityId) && !item.isRead);
  const formAttentionNotifications = openAssignedForms
    .filter((form) => !hasPersistedEntityNotification("posted_form", form.id))
    .map((form) => {
      const hasDueDate = Boolean(form.dueDate);
      const daysRemaining = hasDueDate ? Math.ceil((new Date(`${form.dueDate}T23:59:59`).getTime() - Date.now()) / 86400000) : null;
      const dueSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;
      return {
        id: `open-form-${form.id}`,
        type: "form",
        title: dueSoon ? "Form due soon" : "Open form assigned",
        message: hasDueDate ? `${form.title} is open and due ${form.dueDate}` : `${form.title} is open and waiting for your response`,
        entityType: "posted_form",
        entityId: form.id,
        targetSection: "myForms",
        isRead: false,
        createdAt: form.postedAt || form.updatedAt || form.createdAt
      };
    });
  const fallbackNotificationItems = (canOpenSection("approvals", user) ? pendingItems : ownPendingItems)
    .filter((item) => !hasPersistedEntityNotification(item.contentType === "Posted form" ? "posted_form" : null, item.id))
    .map((item) => ({ ...item, type: "approval", message: item.title, targetSection: canOpenSection("approvals", user) ? "approvals" : "overview", isRead: false, createdAt: item.updatedAt || item.createdAt }));
  const notificationItems = [...formAttentionNotifications, ...persistedNotifications, ...fallbackNotificationItems]
    .filter((item, index, items) => items.findIndex((candidate) => String(candidate.id) === String(item.id)) === index)
    .sort((a, b) => Number(Boolean(a.isRead)) - Number(Boolean(b.isRead)) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const activeNotificationItems = notificationItems.filter((item) => !item.isRead);
  const dashboardNotificationCount = activeNotificationItems.length;
  const selectedSection = sections.find(([id]) => id === activeSection);
  const sectionById = useMemo(() => new Map(sections.map((section) => [section[0], section])), []);
  const sidebarGroups = useMemo(() => {
    const item = (id) => sectionById.get(id);
    const available = (ids) => ids.map(item).filter(Boolean).filter((section) => (
      section[0] === "usersPermissions" ? canViewPeopleAccess : canOpenSection(section[0], user)
    ));
    const groups = [
      { id: "overview", type: "item", item: item("overview") },
      { id: "aiAssistant", type: "item", item: item("aiAssistant") },
      { id: "notifications", type: "item", item: item("notifications") },
      { id: "myGroupGroup", type: "group", label: "My Group", Icon: Users, children: available(["myGroup", "equipes"]) },
      { id: "attendanceGroup", type: "group", label: "Attendance", Icon: CheckCircle2, children: available(["scoutAttendance", "attendanceSheets", "chiefAttendance"]) },
      { id: "contentGroup", type: "group", label: "Content", Icon: FileText, children: available(["calendar", "posts", "gallery"]) },
      { id: "formsGroup", type: "group", label: "Forms", Icon: FileText, children: isAdmin || canManageFormTemplates(user) || canPostForms(user) || canViewAllForms(user) ? available(["manageForms", "myForms"]) : available(["myForms"]) }
    ];

    if (canOpenSection("approvals", user)) groups.push({ id: "approvals", type: "item", item: item("approvals") });
    if (canOpenSection("contactMessages", user)) groups.push({ id: "contactMessages", type: "item", item: item("contactMessages") });
    if (canViewPeopleAccess || isAdmin || canOpenSection("documents", user) || canOpenSection("archives", user)) {
      groups.push({
        id: "settingsGroup",
        type: "group",
        label: "Settings",
        Icon: Settings,
        children: available(["usersPermissions", "scouts", "upload", "rules", "websiteContent", "documents", "reports", "archives"])
      });
    }

    return groups.filter((group) => group.type === "item" ? group.item && canOpenSection(group.item[0], user) : group.children.length);
  }, [canViewPeopleAccess, isAdmin, sectionById, user]);
  const flatSidebarItems = useMemo(
    () => sidebarGroups.flatMap((group) => group.type === "item" ? [group.item] : group.children),
    [sidebarGroups]
  );
  useEffect(() => {
    const staleNotifications = (data.notifications ?? []).filter((notification) => !notification.isRead && isRelatedNotificationResolved(notification));
    if (!staleNotifications.length) return;

    staleNotifications.forEach((notification) => {
      completeDashboardEntityNotifications(notification.entityType, notification.entityId).catch(() => {});
    });
  }, [data.notifications, data.contactMessages, data.users, data.plannedEvents, allPostedForms, allFormSubmissions, allWebsiteContentRevisions, allPosts, allAlbums, user?.id]);

  useEffect(() => {
    setProfileEdit((current) => ({
      ...current,
      name: user?.name ?? "",
      profilePictureFile: null,
      profilePicturePreview: ""
    }));
  }, [user?.id, user?.name, user?.profilePictureUrl]);

  useEffect(() => {
    const previews = Object.fromEntries(
      Object.entries(siteImageFiles)
        .filter(([, file]) => file instanceof File)
        .map(([contentKey, file]) => [contentKey, URL.createObjectURL(file)])
    );

    setSiteImagePreviews(previews);

    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [siteImageFiles]);

  useEffect(() => {
    if (!photoAlbumId && allAlbums[0]?.id) {
      setPhotoAlbumId(allAlbums[0].id);
    }
  }, [allAlbums, photoAlbumId]);
  useEffect(() => {
    setStatusFilter("all");
  }, [activeSection]);
  useEffect(() => {
    window.localStorage.setItem(sidebarModeKey, sidebarMode);
  }, [sidebarMode]);
  useEffect(() => {
    window.localStorage.setItem(dashboardThemeKey, dashboardTheme);
  }, [dashboardTheme]);
  useEffect(() => {
    if (!canOpenSection(activeSection, user)) {
      setActiveSection("overview");
    }
  }, [activeSection, user]);
  useEffect(() => {
    if (!isSidebarTemporarilyExpanded) {
      return undefined;
    }

    const closeTemporarySidebar = (event) => {
      if (!event.target.closest?.(".admin-sidebar")) {
        setIsSidebarTemporarilyExpanded(false);
      }
    };

    document.addEventListener("mousedown", closeTemporarySidebar);
    document.addEventListener("touchstart", closeTemporarySidebar, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeTemporarySidebar);
      document.removeEventListener("touchstart", closeTemporarySidebar);
    };
  }, [isSidebarTemporarilyExpanded]);
  useEffect(() => {
    const hasOpenSidebarGroup = Object.values(openSidebarGroups).some(Boolean);

    if (sidebarMode !== "collapsed" || !hasOpenSidebarGroup) {
      return undefined;
    }

    const closeCollapsedFlyout = (event) => {
      if (event.target.closest?.(".admin-sidebar")) {
        return;
      }

      setOpenSidebarGroups({});
      setCollapsedFlyoutTop(null);
    };

    document.addEventListener("mousedown", closeCollapsedFlyout);
    document.addEventListener("touchstart", closeCollapsedFlyout, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeCollapsedFlyout);
      document.removeEventListener("touchstart", closeCollapsedFlyout);
    };
  }, [openSidebarGroups, sidebarMode]);
  useEffect(() => {
    if (!selectedGroupId && data.groups[0]?.id) {
      setSelectedGroupId(data.groups[0].id);
    }
  }, [data.groups, selectedGroupId]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeSection, activeSetting]);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileSidebarOpen(false);
        setIsMobileMoreOpen(false);
        setIsNotificationsOpen(false);
        setIsProfileMenuOpen(false);
        setIsMobileSearchOpen(false);
        setOpenSidebarGroups({});
        setCollapsedFlyoutTop(null);
      }
    };

    document.body.classList.toggle("dashboard-drawer-open", isMobileSidebarOpen);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("dashboard-drawer-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSidebarOpen]);
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastToggleY = window.scrollY;

    const handleDashboardScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const delta = currentScrollY - lastScrollY;
      const distanceFromToggle = Math.abs(currentScrollY - lastToggleY);
      const isScrollingUp = delta < -6 && distanceFromToggle > 18;
      const isScrollingDown = delta > 6 && currentScrollY > 120 && distanceFromToggle > 28;
      if (!isMobile || isMobileSidebarOpen) {
        setShowMobileMenuBar(false);
        lastToggleY = currentScrollY;
      } else if (currentScrollY < 180) {
        setShowMobileMenuBar(true);
        lastToggleY = currentScrollY;
      } else if (isScrollingUp) {
        setShowMobileMenuBar(true);
        lastToggleY = currentScrollY;
      } else if (isScrollingDown) {
        setShowMobileMenuBar(false);
        lastToggleY = currentScrollY;
      }

      lastScrollY = currentScrollY;
    };

    handleDashboardScroll();
    window.addEventListener("scroll", handleDashboardScroll, { passive: true });
    window.addEventListener("resize", handleDashboardScroll);

    return () => {
      window.removeEventListener("scroll", handleDashboardScroll);
      window.removeEventListener("resize", handleDashboardScroll);
    };
  }, [isMobileSidebarOpen]);
  useEffect(() => {
    if (!isProfileMenuOpen && !isNotificationsOpen && !isMobileSearchOpen) {
      return undefined;
    }

    const closeOpenTopbarMenus = (event) => {
      const target = event.target;
      if (!target.closest?.(".dashboard-profile-menu") && !target.closest?.(".dashboard-notification-menu")) {
        setIsProfileMenuOpen(false);
        setIsNotificationsOpen(false);
      }
      if (!target.closest?.(".dashboard-topbar-search") && !target.closest?.(".dashboard-mobile-search-toggle")) {
        setIsMobileSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOpenTopbarMenus);
    document.addEventListener("touchstart", closeOpenTopbarMenus, { passive: true });

    return () => {
      document.removeEventListener("mousedown", closeOpenTopbarMenus);
      document.removeEventListener("touchstart", closeOpenTopbarMenus);
    };
  }, [isProfileMenuOpen, isNotificationsOpen, isMobileSearchOpen]);
  useEffect(() => {
    const unsubscribe = subscribeDashboardRealtime(async () => {
      await refresh();
      setLastLiveUpdate(new Date());
    });

    return unsubscribe;
  }, []);

  const visibleScouts = useMemo(
    () => {
      const permittedScouts = isAdmin
        ? data.registeredScouts
        : data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId);
      const byEquipe =
        selectedEquipeId === "all"
          ? permittedScouts
          : selectedEquipeId === "unassigned"
            ? permittedScouts.filter((scout) => !scout.equipeId)
            : permittedScouts.filter((scout) => scout.equipeId === selectedEquipeId);

      return filterBySearch(byEquipe, search, ["name", "schoolGrade", "school", "groupId"]);
    },
    [data.registeredScouts, dashboardGroupId, isAdmin, search, selectedEquipeId]
  );
  const visiblePosts = useMemo(() => {
    const availablePosts = isAdmin ? allPosts.filter((post) => post.approvalStatus !== "draft" || post.submittedBy === user?.id) : allPosts.filter((post) => post.submittedBy === user?.id);
    const byStatus =
      statusFilter === "all"
        ? availablePosts
        : availablePosts.filter((post) => post.approvalStatus === statusFilter);
    return filterBySearch(byStatus, search, ["title", "author", "excerpt", "postType", "category", "approvalStatus"]);
  }, [allPosts, isAdmin, search, statusFilter, user?.id]);
  const visibleAlbums = useMemo(() => {
    const availableAlbums = isAdmin ? allAlbums.filter((album) => album.approvalStatus !== "draft" || album.submittedBy === user?.id) : allAlbums.filter((album) => album.submittedBy === user?.id);
    const byStatus =
      statusFilter === "all"
        ? availableAlbums
        : availableAlbums.filter((album) => album.approvalStatus === statusFilter);
    return filterBySearch(byStatus, search, ["title", "location", "category", "approvalStatus"]);
  }, [allAlbums, isAdmin, search, statusFilter, user?.id]);
  const visibleFaqs = useMemo(
    () => filterBySearch(data.faqs ?? [], search, ["question", "answer"]),
    [data.faqs, search]
  );
  const visibleContactMessages = useMemo(() => {
    const messages = data.contactMessages ?? [];
    const byStatus =
      statusFilter === "all" ? messages : messages.filter((message) => message.status === statusFilter);
    return filterBySearch(byStatus, search, ["name", "email", "subject", "message", "status"]);
  }, [data.contactMessages, search, statusFilter]);

  useEffect(() => {
    if (activeSection !== "reports" || !isAdmin) {
      return;
    }

    let ignore = false;
    setReportsLoading(true);
    setReportsError("");
    loadDashboardReports()
      .then((result) => {
        if (!ignore) setReportsData(result);
      })
      .catch((error) => {
        if (!ignore) setReportsError(error.message || "Reports could not be loaded.");
      })
      .finally(() => {
        if (!ignore) setReportsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeSection, isAdmin]);
  const visibleApprovalItems = useMemo(() => {
    const allReviewItems = [...reviewItems, ...profileReviewItems];
    const byType = approvalTypeFilter === "all" ? allReviewItems : allReviewItems.filter((item) => item.contentType === approvalTypeFilter);
    const byStatus =
      statusFilter === "all"
        ? byType
        : byType.filter((item) => item.approvalStatus === statusFilter);
    return filterBySearch(byStatus.filter(isRecentOrPendingApproval), search, ["title", "contentType", "approvalStatus", "submittedBy", "name", "pendingName"]).sort((a, b) => new Date(getReviewTimestamp(b)).getTime() - new Date(getReviewTimestamp(a)).getTime());
  }, [reviewItems, profileReviewItems, approvalTypeFilter, search, statusFilter]);


  const visibleDocuments = useMemo(() => {
    const categoryFiltered = selectedDocumentCategory === "all"
      ? data.documents ?? []
      : (data.documents ?? []).filter((document) => (document.categoryId || "uncategorized") === selectedDocumentCategory);
    return filterBySearch(categoryFiltered, search, ["title", "fileName", "categoryName", "fileType"]);
  }, [data.documents, search, selectedDocumentCategory]);

  const visibleChiefs = useMemo(
    () => filterBySearch(chiefs, search, ["name", "email", "role", "chiefLevel", "groupId", "accountStatus"]),
    [chiefs, search]
  );

  const visibleGroupEquipes = useMemo(
    () => filterBySearch(groupEquipes, search, ["name", "description", "leaderName", "coLeaderName"]),
    [groupEquipes, search]
  );

  const reportApprovalRows = useMemo(() => {
    return [...reviewItems, ...profileReviewItems]
      .map((item) => ({
        type: item.contentType,
        title: item.title,
        status: item.approvalStatus,
        submittedBy: getSubmitterName(item),
        createdAt: formatDubaiDateTime(item.createdAt),
        updatedAt: formatDubaiDateTime(getReviewTimestamp(item))
      }))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }, [reviewItems, profileReviewItems, usersById]);

  const reportActivityRows = useMemo(() => {
    return (reportsData.auditLogs ?? []).map((log) => {
      const actor = usersById.get(log.actorId);
      return mapDashboardActivityLog(log, actor?.name ?? "System");
    }).filter(Boolean);
  }, [reportsData.auditLogs, usersById]);

  const reportAuthorizationRows = useMemo(() => (
    (data.authorizationMigrationDifferences ?? []).map((difference) => ({
      user: usersById.get(difference.userId)?.name ?? difference.userId ?? "Unknown user",
      module: difference.module,
      permissionKey: difference.permissionKey,
      legacyResult: difference.legacyAllowed ? "Allowed" : "Denied",
      normalizedResult: difference.normalizedAllowed ? "Allowed" : "Denied",
      scope: difference.scopeId ? `${difference.scopeType}: ${difference.scopeId}` : difference.scopeType,
      reason: difference.details?.source ?? "Legacy and normalized access differ",
      createdAt: formatDubaiDateTime(difference.createdAt),
      status: difference.resolvedAt ? "Resolved" : "Review required"
    }))
  ), [data.authorizationMigrationDifferences, usersById]);

  const selectedArchive = (data.archivedYears ?? []).find((archive) => archive.id === selectedArchiveId) ?? (data.archivedYears ?? [])[0] ?? null;

  const createArchiveSnapshot = async () => {
    const year = data.scoutYears.find((item) => item.id === archiveYearId) ?? data.scoutYears.find((item) => item.isActive) ?? data.scoutYears[0];
    if (!year) {
      setSaveMessage("Create a scouting year before archiving.");
      return;
    }

    if (!window.confirm(`Create a read-only archive snapshot for ${year.label}? Live dashboard data will not be changed.`)) {
      return;
    }

    setUploadStatus("Creating archive snapshot...");
    const snapshot = {
      createdAt: new Date().toISOString(),
      scoutYear: year,
      groups: data.groups,
      scouts: data.registeredScouts,
      events: data.plannedEvents,
      attendanceMeetings: data.attendanceMeetings,
      attendanceSheets: data.attendanceSheets,
      chiefAttendanceMeetings: data.chiefAttendanceMeetings,
      chiefAttendanceSheet: data.chiefAttendanceSheet,
      posts: allPosts.filter((post) => post.approvalStatus === "approved"),
      albums: allAlbums.filter((album) => album.approvalStatus === "approved")
    };

    await saveArchivedYearSnapshot({ scoutYearId: year.id, label: year.label, snapshot });
    await logAuditEvent("archive_created", "Archived year", year.id, { label: year.label });
    setSaveMessage("Archived year snapshot created.");
    setUploadStatus(null);
    await refresh();
  };

  const deleteArchiveSnapshot = async (archive) => {
    const typed = window.prompt(`Type DELETE ${archive.label} to permanently hide this archive snapshot.`);
    if (typed !== `DELETE ${archive.label}`) {
      return;
    }

    await removeArchivedYearSnapshot(archive.id);
    await logAuditEvent("archive_deleted", "Archived year", archive.id, { label: archive.label });
    setSaveMessage("Archived year removed.");
    await refresh();
  };

  const createOrUpdateDocumentCategory = async (category = null) => {
    const name = category ? window.prompt("Rename document category", category.name) : documentCategoryName;
    if (!name?.trim()) return;
    await saveDashboardDocumentCategory({ id: category?.id, name });
    await logAuditEvent(category ? "document_category_updated" : "document_category_created", "Document category", category?.id ?? name, { name });
    setDocumentCategoryName("");
    setSaveMessage(category ? "Document category renamed." : "Document category created.");
    await refresh();
  };

  const removeDocumentCategory = async (category) => {
    if (!window.confirm(`Delete the ${category.name} category? Documents stay available and move to Uncategorized.`)) return;
    await removeDashboardDocumentCategory(category.id);
    await logAuditEvent("document_category_deleted", "Document category", category.id, { name: category.name });
    setSaveMessage("Document category deleted. Documents were kept.");
    await refresh();
  };

  const uploadDocuments = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    try {
      setUploadStatus(`Uploading ${files.length} document${files.length === 1 ? "" : "s"}...`);
      await uploadDashboardDocumentFiles(files, documentUploadCategoryId || null, data.activeScoutYearId);
      await logAuditEvent("documents_uploaded", "Documents", "batch", { count: files.length });
      setSaveMessage("Documents uploaded.");
      await refresh();
    } catch (error) {
      setSaveMessage(error.message || "Documents could not be uploaded.");
    } finally {
      setUploadStatus(null);
    }
  };

  const updateDocument = async (document) => {
    const edit = documentEdits[document.id] ?? document;
    await saveDashboardDocument(document.id, edit);
    await logAuditEvent("document_updated", "Document", document.id, { title: edit.title });
    setSaveMessage("Document updated.");
    await refresh();
  };

  const deleteDocument = async (document) => {
    if (!window.confirm(`Delete ${document.title}? This removes the file from storage too.`)) return;
    await removeDashboardDocument(document);
    await logAuditEvent("document_deleted", "Document", document.id, { title: document.title });
    setSaveMessage("Document deleted from the dashboard and storage.");
    await refresh();
  };
  const updateRule = (groupId, field, value) => {
    setRules((current) =>
      current.map((rule) =>
        rule.groupId === groupId
          ? {
              ...rule,
              [field]: ["gradeStart", "gradeEnd", "ageStart", "ageEnd"].includes(field)
                ? Number(value)
                : value
            }
          : rule
      )
    );
  };
  const handleSaveRules = async () => {
    await saveAdminRules({ sortBy, assignmentMode, rules, updatedBy: "Group Admin" });
    await logAuditEvent("settings_changed", "Grouping rules", "active", { sortBy, assignmentMode });
    setSaveMessage("Sorting and grouping rules saved.");
    await refresh();
  };
  const scopedUser = useMemo(() => ({
    ...user,
    groupId: dashboardGroupId
  }), [dashboardGroupId, user]);
  const renderCoordinatorGroupSwitcher = (label = "View group") => {
    if (groupSwitcherGroups.length <= 1) return null;
    return (
      <div className="cms-toolbar coordinator-group-switcher">
        <label>
          {label}
          <select value={dashboardGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
            {groupSwitcherGroups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
          </select>
        </label>
      </div>
    );
  };
  const openDashboardSection = (sectionId) => {
    setActiveSection(sectionId);
    setLastDashboardSection(sectionId);
  };
  const hasDirtyModalFields = (container) => {
    if (!container) return false;

    return Array.from(container.querySelectorAll("input, textarea, select, [contenteditable='true']")).some((field) => {
      if (field.matches("button, [type='button'], [type='submit'], [type='reset'], [type='hidden']")) return false;
      if (field.type === "file") return Boolean(field.files?.length);
      if (field.type === "checkbox" || field.type === "radio") return field.checked !== field.defaultChecked;
      if (field.isContentEditable) return field.textContent.trim().length > 0;
      return field.value !== field.defaultValue;
    });
  };
  const getBackdropKind = (backdrop) => {
    if (backdrop.classList.contains("dashboard-more-sheet-backdrop")) {
      return "mobileMore";
    }
    if (backdrop.classList.contains("profile-modal-backdrop")) {
      return isProfileModalOpen ? "profile" : "passwordReset";
    }
    if (backdrop.classList.contains("approval-modal-backdrop")) {
      if (websiteReviewOpen) return "websiteReview";
      if (documentPreview) return "documentPreview";
      if (selectedApproval) return "selectedApproval";
    }
    return null;
  };
  const closeBackdropByKind = (kind) => {
    if (kind === "mobileMore") {
      setIsMobileMoreOpen(false);
      return true;
    }
    if (kind === "profile") {
      setIsProfileModalOpen(false);
      return true;
    }
    if (kind === "passwordReset") {
      setPasswordResetUser(null);
      return true;
    }
    if (kind === "websiteReview") {
      setWebsiteReviewOpen(false);
      return true;
    }
    if (kind === "documentPreview") {
      setDocumentPreview(null);
      return true;
    }
    if (kind === "selectedApproval") {
      setSelectedApproval(null);
      return true;
    }
    return false;
  };
  const guardDashboardBackdropClose = (event) => {
    const backdrop = event.target;
    if (!(backdrop instanceof HTMLElement) || !backdrop.matches(".profile-modal-backdrop, .approval-modal-backdrop, .dashboard-more-sheet-backdrop")) {
      return;
    }
    if (backdrop !== event.target) return;

    if (hasDirtyModalFields(backdrop)) {
      event.preventDefault();
      event.stopPropagation();
      const kind = getBackdropKind(backdrop);
      if (kind) setDiscardCloseRequest({ kind });
    }
  };
  const selectSidebarItem = (id) => {
    setIsSidebarTemporarilyExpanded(false);
    setOpenSidebarGroups({});
    setOpenMobileMoreGroups({});
    setCollapsedFlyoutTop(null);
    if (settingSections.some(([settingId]) => settingId === id)) {
      setActiveSetting(id);
      setActiveSection(id);
    } else {
      openDashboardSection(id);
    }
    setIsMobileSidebarOpen(false);
    setIsMobileMoreOpen(false);
    setIsNotificationsOpen(false);
  };
  const toggleSidebarMode = async () => {
    setIsSidebarTemporarilyExpanded(false);
    setOpenSidebarGroups({});
    setCollapsedFlyoutTop(null);
    const nextMode = sidebarMode === "expanded" ? "collapsed" : "expanded";
    setSidebarMode(nextMode);
    await logAuditEvent("sidebar_preference_changed", "Dashboard", user?.id ?? "anonymous", { sidebarMode: nextMode });
  };
  const toggleSidebarGroup = (id) => {
    setOpenSidebarGroups((current) => (current[id] ? {} : { [id]: true }));
  };
  const toggleMobileMoreGroup = (id) => {
    setOpenMobileMoreGroups((current) => (current[id] ? {} : { [id]: true }));
  };
  const showSidebarTooltip = (label, event) => {
    if (sidebarMode !== "collapsed") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setSidebarTooltip({
      label,
      left: rect.right + 8,
      top: rect.top + rect.height / 2
    });
  };
  const hideSidebarTooltip = () => setSidebarTooltip(null);
  const sidebarTooltipHandlers = (label) => ({
    onMouseEnter: (event) => showSidebarTooltip(label, event),
    onMouseLeave: hideSidebarTooltip,
    onFocus: (event) => showSidebarTooltip(label, event),
    onBlur: hideSidebarTooltip
  });
  const openCollapsedSidebarGroup = (groupId, event) => {
    const triggerRect = event?.currentTarget?.getBoundingClientRect?.();
    if (triggerRect) {
      const group = sidebarGroups.find((item) => item.id === groupId);
      const itemCount = group?.children?.length ?? 1;
      const estimatedFlyoutHeight = Math.min(window.innerHeight - 48, itemCount * 72 + 28);
      const minimumTop = 16;
      const maximumTop = Math.max(minimumTop, window.innerHeight - estimatedFlyoutHeight - 24);
      const preferredTop = triggerRect.top;
      setCollapsedFlyoutTop(Math.max(minimumTop, Math.min(preferredTop, maximumTop)));
    }
    setOpenSidebarGroups((current) => (current[groupId] ? {} : { [groupId]: true }));
    hideSidebarTooltip();
  };
  const openPendingWorkItem = (item) => {
    if (!item) {
      return;
    }

    if (canOpenSection("approvals", user) && ["pending", "pending_update", "needs_changes"].includes(item.approvalStatus)) {
      setApprovalTypeFilter("all");
      setSelectedApproval(item);
      setSelectedApprovalPhotoIds([]);
      setApprovalComment(item.reviewerComment ?? "");
      openDashboardSection("approvals");
      return;
    }

    const sectionByContentType = {
      "Blog post": "posts",
      Album: "gallery",
      "Photo batch": "gallery",
      "Calendar event": "calendar",
      "Profile change": "usersPermissions",
      "Posted form": "myForms"
    };
    const targetSection = sectionByContentType[item.contentType] ?? "overview";
    if (item.contentType === "Posted form" && item.id) setRequestedFormId(item.id);
    openDashboardSection(canOpenSection(targetSection, user) ? targetSection : "overview");
  };
  const handleRegistrationUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const cleanedYearName = newScoutYearName.trim();
    if (registrationTargetMode === "existing" && !registrationYearId) {
        setSaveMessage("Choose a scouting year before uploading the registration list.");
        event.target.value = "";
        return;
      }
    if (registrationTargetMode === "new" && !cleanedYearName) {
        setSaveMessage("Please enter a scouting year name.");
        event.target.value = "";
        return;
      }

      const result = await uploadRegistrationSheet({
        fileName: file.name,
        contentBase64: arrayBufferToBase64(await file.arrayBuffer()),
        scoutYearId: registrationTargetMode === "existing" ? registrationYearId : undefined,
        newScoutYear: registrationTargetMode === "new" ? { label: cleanedYearName, useExistingIfPresent: true } : undefined
      });
      setSaveMessage(
        `Registration sheet uploaded. ${result.count} scouts loaded${
          result.scoutYear ? ` for ${result.scoutYear}` : ""
        }.`
      );
      await refresh();
      event.target.value = "";
    if (registrationTargetMode === "new") {
        setNewScoutYearName("");
        setRegistrationTargetMode("existing");
      }
    } catch (error) {
      setSaveMessage(`Registration upload failed: ${error.message}`);
    }
  };
  const createNewScoutYearOnly = async (event) => {
    event.preventDefault();

    const cleanedYearName = newScoutYearName.trim();
    if (!cleanedYearName) {
      setSaveMessage("Please enter a scouting year name.");
      return;
    }

    try {
      setUploadStatus("Creating scouting year...");
      const created = await createScoutingYear(cleanedYearName);
      setSaveMessage("Scouting year created successfully.");
      setNewScoutYearName("");
      setRegistrationYearId(created.id);
      await refresh();
    } catch (error) {
      setSaveMessage(`Scouting year creation failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const changeActiveScoutYear = async (yearId) => {
    const targetYear = data.scoutYears?.find((year) => year.id === yearId);
    const currentYear = data.scoutYears?.find((year) => year.isActive);
    if (!targetYear || targetYear.isActive) {
      return;
    }

    const confirmed = window.confirm(`Change the active scouting year from ${currentYear?.label ?? "the current year"} to ${targetYear.label}?\n\nThis changes the default year used across the dashboard, attendance, scouts, and reports.`);
    if (!confirmed) {
      return;
    }

    try {
      setUploadStatus("Setting active scouting year...");
      await activateScoutingYear(yearId);
      setSaveMessage(`Active scouting year changed to ${targetYear.label}.`);
      await logAuditEvent("active_scout_year_changed", "ScoutYear", yearId, {
        previousYear: currentYear?.label ?? null,
        nextYear: targetYear.label
      });
      await refresh();
    } catch (error) {
      setSaveMessage(`Unable to change the active scouting year: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const saveScout = async (scoutId) => {
    await updateRegisteredScout(scoutId, scoutEdits[scoutId]);
    setSaveMessage("Scout information saved.");
    await refresh();
  };
  const createScout = async (event) => {
    event.preventDefault();
    await addRegisteredScout(newScout);
    setNewScout({ ...emptyScout, groupId: data.groups[0]?.id ?? "" });
    setSaveMessage("Scout added.");
    await refresh();
  };
  const createDashboardEquipe = async (event) => {
    event.preventDefault();
    if (!canManageEquipesForGroup(user, dashboardGroupId)) {
      setSaveMessage("Only admins, head chiefs, and vice head chiefs can manage equipes for this group.");
      return;
    }

    try {
      setIsEquipeActionLoading(true);
      await addEquipe({ ...newEquipe, groupId: dashboardGroupId });
      setNewEquipe({ name: "", description: "" });
      setIsNewEquipeOpen(false);
      setSaveMessage("Equipe created.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const saveDashboardEquipe = async (equipeId) => {
    const payload = equipeEdits[equipeId] ?? groupEquipes.find((equipe) => equipe.id === equipeId);
    try {
      setIsEquipeActionLoading(true);
      await saveEquipe(equipeId, payload);
      setSaveMessage("Equipe saved.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const deleteDashboardEquipe = async (equipeId) => {
    const equipe = groupEquipes.find((item) => item.id === equipeId);
    const confirmed = window.confirm(`Permanently delete ${equipe?.name ?? "this equipe"}?` + "\n\nThis cannot be undone. Any currently assigned scouts will become unassigned.");
    if (!confirmed) {
      return;
    }

    try {
      setIsEquipeActionLoading(true);
      await removeEquipe(equipeId);
      setSelectedScoutIds([]);
      setSaveMessage("Equipe deleted and assigned scouts moved to Unassigned.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const assignSelectedScouts = async (equipeId) => {
    if (!selectedScoutIds.length) {
      setSaveMessage("Select at least one scout first.");
      return;
    }

    try {
      setIsEquipeActionLoading(true);
      await assignEquipeScouts({ scoutIds: selectedScoutIds, equipeId: equipeId || null, groupId: dashboardGroupId });
      setSelectedScoutIds([]);
      setSaveMessage(equipeId ? "Selected scouts assigned to equipe." : "Selected scouts moved to Unassigned.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const updateScoutEquipeAssignment = async (scoutId, equipeId) => {
    try {
      setIsEquipeActionLoading(true);
      await assignEquipeScouts({ scoutIds: [scoutId], equipeId: equipeId || null, groupId: dashboardGroupId });
      setSaveMessage(equipeId ? "Scout reassigned to equipe." : "Scout moved to Unassigned.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const toggleScoutSelection = (scoutId) => {
    setSelectedScoutIds((current) =>
      current.includes(scoutId) ? current.filter((id) => id !== scoutId) : [...current, scoutId]
    );
  };
  const buildAssignmentPreviewData = () => {
    const availableScouts = data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId);
    const activeEquipes = groupEquipes;
    if (!activeEquipes.length || !availableScouts.length) {
      setSaveMessage("Create equipes and make sure this group has scouts before randomizing.");
      return null;
    }

    const shuffled = [...availableScouts].sort(() => Math.random() - 0.5);
    const totalRequested = activeEquipes.reduce((sum, equipe) => {
      const fallback = Math.floor(availableScouts.length / activeEquipes.length);
      return sum + Number(customEquipeSizes[equipe.id] || fallback);
    }, 0);
    const equalTargets = Object.fromEntries(
      activeEquipes.map((equipe, index) => [
        equipe.id,
        Math.floor(availableScouts.length / activeEquipes.length) + (index < availableScouts.length % activeEquipes.length ? 1 : 0)
      ])
    );
    const targets = autoAssignMode === "custom"
      ? Object.fromEntries(activeEquipes.map((equipe) => [equipe.id, Number(customEquipeSizes[equipe.id] || 0)]))
      : equalTargets;
    const warning =
      autoAssignMode === "custom" && totalRequested > availableScouts.length
        ? "Custom equipe sizes exceed the number of available scouts."
        : "";
    if (warning) {
      setSaveMessage(warning);
      return null;
    }

    const males = shuffled.filter((scout) => String(scout.gender).toLowerCase() === "male");
    const females = shuffled.filter((scout) => String(scout.gender).toLowerCase() === "female");
    const others = shuffled.filter((scout) => !["male", "female"].includes(String(scout.gender).toLowerCase()));
    const maleRatio =
      genderBalance === "auto"
        ? males.length / Math.max(1, males.length + females.length)
        : Number(genderBalance) / 100;
    const assignments = Object.fromEntries(activeEquipes.map((equipe) => [equipe.id, []]));

    activeEquipes.forEach((equipe) => {
      const target = targets[equipe.id] ?? 0;
      const maleTarget = Math.round(target * maleRatio);
      const femaleTarget = target - maleTarget;

      while (assignments[equipe.id].length < target && assignments[equipe.id].filter((scout) => scout.gender === "male").length < maleTarget && males.length) {
        assignments[equipe.id].push(males.pop());
      }

      while (assignments[equipe.id].length < target && assignments[equipe.id].filter((scout) => scout.gender === "female").length < femaleTarget && females.length) {
        assignments[equipe.id].push(females.pop());
      }
    });

    activeEquipes.forEach((equipe) => {
      const target = targets[equipe.id] ?? 0;
      while (assignments[equipe.id].length < target && (males.length || females.length || others.length)) {
        assignments[equipe.id].push((males.length >= females.length ? males : females).pop() ?? others.pop());
      }
    });

    const assignedIds = new Set(Object.values(assignments).flat().map((scout) => scout.id));
    const unassigned = availableScouts.filter((scout) => !assignedIds.has(scout.id));
    const genderWarning = genderBalance !== "auto" && Object.values(assignments).some((items) => {
      const gendered = items.filter((scout) => ["male", "female"].includes(String(scout.gender).toLowerCase()));
      if (!gendered.length) return false;
      const actual = gendered.filter((scout) => scout.gender === "male").length / gendered.length;
      return Math.abs(actual - maleRatio) > 0.2;
    });

    return {
      assignments,
      unassigned,
      warning: genderWarning
        ? "Exact gender percentage could not be matched because of the available number of scouts. The closest balanced distribution was applied."
        : ""
    };
  };
  const buildRandomAssignmentPreview = () => {
    const preview = buildAssignmentPreviewData();
    if (preview) {
      setAssignmentPreview(preview);
    }
  };
  const saveAssignmentPreview = async (preview = assignmentPreview) => {
    if (!preview) {
      return;
    }

    try {
      setIsEquipeActionLoading(true);
      for (const [equipeId, scouts] of Object.entries(preview.assignments)) {
        await assignEquipeScouts({ scoutIds: scouts.map((scout) => scout.id), equipeId, groupId: dashboardGroupId });
      }

      await logAuditEvent("automatic_equipe_assignment_saved", "Group", dashboardGroupId, {
        equipeIds: Object.keys(preview.assignments)
      });
      setAssignmentPreview(null);
      setSaveMessage("Automatic equipe assignments saved.");
      await refresh();
    } finally {
      setIsEquipeActionLoading(false);
    }
  };
  const runAutomaticAssignment = async () => {
    if (isEquipeActionLoading) {
      return;
    }

    const preview = buildAssignmentPreviewData();
    if (!preview) {
      return;
    }

    await saveAssignmentPreview(preview);
  };
  const normalizeUserRolePayload = (profile) => {
    const assignedGroupIds = Array.from(new Set([
      ...(profile.assignedGroupIds ?? []),
      profile.groupId
    ].filter(Boolean)));
    const role = profile.role === "admin" ? "admin" : "chief";

    return {
      ...profile,
      role,
      assignedGroupIds,
      groupId: assignedGroupIds[0] ?? "",
      coordinatorGroupIds: assignedGroupIds,
      chiefLevel: role === "chief" || assignedGroupIds.length ? profile.chiefLevel ?? "chief" : null,
      isCoordinator: assignedGroupIds.length > 1
    };
  };

  const validateUserRolePayload = (profile) => {
    if (!profile.role) {
      throw new Error("Choose a role for this user.");
    }
    if (profile.role === "chief" && !profile.assignedGroupIds?.length) {
      throw new Error("Select at least one group for this chief.");
    }
  };

  const toggleAssignedGroup = (ids, groupId, checked) => {
    const currentIds = ids ?? [];
    return checked
      ? Array.from(new Set([...currentIds, groupId]))
      : currentIds.filter((id) => id !== groupId);
  };

  const startUserEdit = (chief) => {
    setChiefEdits((current) => ({ ...current, [chief.id]: current[chief.id] ?? toChiefForm(chief) }));
    setEditingUserId(chief.id);
    setPasswordResetUser(null);
  };
  const setChiefLevel = (chiefId, level) => {
    setChiefEdits((current) => ({
      ...current,
      [chiefId]: { ...current[chiefId], chiefLevel: level, ...chiefDefaults(level) }
    }));
  };
  const openAvatarCrop = (file, target) => {
    if (!file) return;
    setAvatarCropRequest({ file, target: target?.type === "siteContent" ? { ...target, cropConfig: getSiteImageCropConfig(target.contentKey, target.shape) } : target });
  };

  const applyCroppedAvatar = (file) => {
    const target = avatarCropRequest?.target;
    if (!target) return;

    if (target.type === "newChief") {
      if (newChiefPreview) URL.revokeObjectURL(newChiefPreview);
      setNewChief((current) => ({ ...current, profilePictureFile: file }));
      setNewChiefPreview(URL.createObjectURL(file));
    }

    if (target.type === "ownProfile") {
      if (profileEdit.profilePicturePreview) URL.revokeObjectURL(profileEdit.profilePicturePreview);
      setProfileEdit((current) => ({ ...current, profilePictureFile: file, profilePicturePreview: URL.createObjectURL(file) }));
    }

    if (target.type === "siteContent") {
      setSiteImageFiles((current) => ({ ...current, [target.contentKey]: file }));
    }
    if (target.type === "chief") {
      const chief = target.chief;
      const currentEdit = chiefEdits[chief.id] ?? toChiefForm(chief);
      if (currentEdit.profilePicturePreview) {
        URL.revokeObjectURL(currentEdit.profilePicturePreview);
      }
      setChiefEdits((current) => ({
        ...current,
        [chief.id]: {
          ...currentEdit,
          profilePictureFile: file,
          profilePicturePreview: URL.createObjectURL(file)
        }
      }));
    }

    setAvatarCropRequest(null);
  };

  const setNewChiefLevel = (level) => {
    setNewChief((current) => ({ ...current, chiefLevel: level, ...chiefDefaults(level) }));
  };
  const saveChief = async (chiefId) => {
    try {
      const payload = normalizeUserRolePayload(chiefEdits[chiefId] ?? toChiefForm(chiefs.find((chief) => chief.id === chiefId)));
      validateUserRolePayload(payload);
      await updateChief(chiefId, payload);
      setEditingUserId(null);
      setSaveMessage("User and permissions saved.");
      await refresh();
    } catch (error) {
      setSaveMessage(`User could not be saved: ${error.message}`);
    }
  };
  const createChief = async (event) => {
    event.preventDefault();
    try {
      if (!newChief.name.trim()) {
        throw new Error("Enter the user's full name.");
      }
      if (!newChief.email.trim()) {
        throw new Error("Enter the user's email address.");
      }
      const payload = normalizeUserRolePayload(newChief);
      validateUserRolePayload(payload);

      await addChief(payload);
      setNewChief({ ...emptyChief, groupId: data.groups[0]?.id ?? "", assignedGroupIds: data.groups[0]?.id ? [data.groups[0].id] : [] });
      setSaveMessage("Invitation sent and user added to People & Access.");
      await refresh();
    } catch (error) {
      setSaveMessage(`User was not fully created: ${error.message}`);
    }
  };
  const deleteChiefUser = async (chief) => {
    if (!chief?.id) return;
    const confirmed = window.confirm(`Delete ${chief.name}? This removes the dashboard user account and cannot be undone.`);
    if (!confirmed) return;

    try {
      await removeDashboardUser(chief.id);
      setSaveMessage("User deleted.");
      await refresh();
    } catch (error) {
      setSaveMessage(`User could not be deleted: ${error.message}`);
    }
  };
  const loadPeopleAccessWorkspace = async () => {
    setPeopleAccessLoading(true);
    setPeopleAccessError("");
    setPeopleAccessWarning("");
    try {
      setPeopleAccessWorkspace(await getPeopleAccessWorkspace());
    } catch (error) {
      setPeopleAccessWorkspace(legacyPeopleAccessFallback);
      setPeopleAccessWarning("Normalized access details are temporarily unavailable. The people list remains visible, but role, team, review, and effective-access changes require the People & Access SQL API.");
      if (!legacyPeopleAccessFallback.users.length) setPeopleAccessError(error.message || "People & Access could not be loaded.");
    } finally {
      setPeopleAccessLoading(false);
    }
  };
  const loadPeopleAccessUser = async (userId) => {
    try {
      return await getUserAccessDetails(userId);
    } catch {
      return normalizeUserAccessDetails({ user: (data.users ?? []).find((profile) => profile.id === userId) });
    }
  };
  const invitePeopleAccessUser = async (draft) => {
    const invitation = normalizePeopleAccessInvitation(draft);
    const selectedRoleKeys = invitation.roles.map((assignment) => peopleAccessWorkspace.roles.find((role) => role.id === assignment.roleId)?.key ?? assignment.roleId);
    const legacyRole = selectedRoleKeys.includes("system_administrator") ? "admin" : "chief";
    const legacyLevelByPosition = { head_chief: "head", vice_chief: "vice", chief: "chief", coordinator: "chief", equipe_leader: "chief", assistant: "chief" };
    const primaryGroup = invitation.groups.find((assignment) => assignment.isPrimary) ?? invitation.groups[0];
    const created = await addChief({
      name: invitation.name, email: invitation.email, role: legacyRole,
      groupId: primaryGroup?.groupId ?? "", assignedGroupIds: invitation.assignedGroupIds,
      coordinatorGroupIds: invitation.assignedGroupIds,
      chiefLevel: legacyLevelByPosition[primaryGroup?.position] ?? "chief", accountStatus: "invited",
      profilePictureFile: invitation.profilePictureFile
    });
    const createdUserId = created?.user?.id ?? created?.profile?.id ?? created?.id;
    let assignmentWarning = "";
    if (createdUserId) {
      try {
        const createdAccess = legacyRole === "chief"
          ? normalizeUserAccessDetails(await getUserAccessDetails(createdUserId))
          : null;
        for (const assignment of invitation.groups) {
          const existingAssignment = createdAccess?.groupAssignments.find((item) =>
            (item.groupId ?? item.group_id ?? item.key) === assignment.groupId
          );
          if (legacyRole === "chief" && !existingAssignment?.id) {
            throw new Error(`The created account is missing its ${assignment.groupId} group assignment.`);
          }
          await saveUserGroupAssignment({
            id: existingAssignment?.id,
            userId: createdUserId,
            ...assignment,
            reason: assignment.reason || invitation.reason
          });
        }
        for (const assignment of invitation.teams) {
          await saveUserTeamMembership({ userId: createdUserId, ...assignment, reason: assignment.reason || invitation.reason });
        }
        for (const assignment of invitation.roles) {
          const roleKey = peopleAccessWorkspace.roles.find((role) => role.id === assignment.roleId)?.key ?? assignment.roleId;
          const autoAssigned = (legacyRole === "admin" && roleKey === "system_administrator") || (legacyRole === "chief" && roleKey === "chief");
          if (!autoAssigned) await saveUserRoleAssignment({ userId: createdUserId, ...assignment });
        }
      } catch (error) {
        assignmentWarning = ` Invitation sent, but access setup needs attention: ${error.message}`;
      }
    }
    setSaveMessage(assignmentWarning || (createdUserId ? "Secure invitation sent and access assignments saved." : "Secure invitation sent. Open the user to finish normalized access assignments."));
    await refresh();
    await loadPeopleAccessWorkspace();
  };
  const handlePeopleAccessUserAction = async (action, profile) => {
    if (action === "passwordReset") {
      if (!peopleAccessCapabilities.resetPassword) throw new Error("You do not have permission to reset passwords.");
      await resetUserPassword(profile.id);
      setSaveMessage("Password recovery email sent.");
      return;
    }
    if (action === "delete") {
      if (!peopleAccessCapabilities.deleteUser) throw new Error("You do not have permission to delete users.");
      if (!profile?.id) throw new Error("This user account does not have a valid ID.");
      const confirmed = window.confirm(`Delete ${profile.name}? This permanently removes the dashboard account and cannot be undone.`);
      if (!confirmed) return false;
      await removeDashboardUser(profile.id);
      setSaveMessage("User deleted.");
      await refresh();
      await loadPeopleAccessWorkspace();
      return true;
    }
    if (action === "editProfile") {
      const legacyProfile = (data.users ?? []).find((item) => item.id === profile.id) ?? profile;
      startUserEdit(legacyProfile);
    }
  };
  const changePeopleAccessAssignment = async (kind, operation, profile, payload) => {
    const permissionByKind = { group: peopleAccessCapabilities.assignGroups, team: peopleAccessCapabilities.assignTeams, role: peopleAccessCapabilities.assignRoles };
    if (!permissionByKind[kind]) throw new Error(`You do not have permission to change ${kind} assignments.`);
    const reason = payload.reason || "People & Access account update";
    if (operation === "remove") {
      if (!payload.id || String(payload.id).startsWith("legacy-")) throw new Error("Run the access-control backfill before removing this legacy assignment.");
      if (kind === "group") await revokeUserGroupAssignment(payload.id, reason);
      if (kind === "team") await revokeUserTeamMembership(payload.id, reason);
      if (kind === "role") await revokeUserRoleAssignment(payload.id, reason);
    } else {
      if (kind === "group") await saveUserGroupAssignment({ userId: profile.id, ...payload, reason });
      if (kind === "team") await saveUserTeamMembership({ userId: profile.id, ...payload, reason });
      if (kind === "role") await saveUserRoleAssignment({ userId: profile.id, ...payload, reason });
    }
    setSaveMessage(`${kind[0].toUpperCase()}${kind.slice(1)} assignment ${operation === "remove" ? "removed" : "saved"}.`);
    await refresh();
    await loadPeopleAccessWorkspace();
    return getUserAccessDetails(profile.id);
  };
  const createPeopleAccessRole = async () => {
    const name = window.prompt("Role name");
    if (!name?.trim()) return;
    const key = window.prompt("Stable role key", name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
    if (!key?.trim()) return;
    await saveAccessRole({ id: key.trim(), name: name.trim(), description: "", category: "custom", riskLevel: "standard", permissionIds: [], supportedScopes: ["global"], isActive: true });
    setSaveMessage("Custom role created. Add permissions before assigning it.");
    await loadPeopleAccessWorkspace();
  };
  const createPeopleAccessTeam = async () => {
    const name = window.prompt("Team name");
    if (!name?.trim()) return;
    await saveAccessTeam({ name: name.trim(), key: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"), description: "", teamType: "committee", isActive: true });
    setSaveMessage("Team created.");
    await loadPeopleAccessWorkspace();
  };
  const decidePeopleAccessReview = async (item, decision) => {
    const notes = window.prompt("Reason for this decision");
    if (!notes?.trim()) return;
    if (item.source === "migration") await resolveAuthorizationDifference(item.id, decision, notes.trim());
    else await decideAccessReview(item.id, decision, notes.trim());
    setSaveMessage("Access review decision recorded.");
    await loadPeopleAccessWorkspace();
  };
  useEffect(() => {
    if (activeSection !== "usersPermissions" || !canViewPeopleAccess) return;
    loadPeopleAccessWorkspace();
    // The workspace intentionally refreshes when its section is opened; mutations refresh explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, canViewPeopleAccess]);
  const submitOwnProfileChange = async (event) => {
    event.preventDefault();
    try {
      setProfileMessage("Submitting profile change for approval...");
      await requestProfileChange(user, {
        name: profileEdit.name,
        profilePictureFile: profileEdit.profilePictureFile
      });
      setProfileEdit((current) => ({ ...current, profilePictureFile: null, profilePicturePreview: "" }));
      setProfileMessage("Profile change submitted for admin approval.");
      await refresh();
    } catch (error) {
      setProfileMessage(`Profile change failed: ${error.message}`);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!profileEdit.currentPassword) {
      setProfileMessage("Enter your current password before changing it.");
      return;
    }
    if (profileEdit.newPassword.length < 8) {
      setProfileMessage("New password must be at least 8 characters.");
      return;
    }
    if (profileEdit.newPassword !== profileEdit.confirmPassword) {
      setProfileMessage("New password confirmation does not match.");
      return;
    }

    try {
      setProfileMessage("Confirming current password...");
      await loginWithPassword(user.email, profileEdit.currentPassword);
      setProfileMessage("Updating password...");
      await changeOwnPassword(profileEdit.newPassword);
      setProfileEdit((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setProfileMessage("Password updated.");
    } catch (error) {
      setProfileMessage(`Password update failed: ${error.message}`);
    }
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    if (!passwordResetUser?.id) {
      setSaveMessage("Choose a user before resetting a password.");
      return;
    }
    try {
      await resetUserPassword(passwordResetUser.id);
      setPasswordResetUser(null);
      setSaveMessage(`Secure password-recovery email sent to ${passwordResetUser.name}.`);
      await refresh();
    } catch (error) {
      setSaveMessage(`Password reset failed: ${error.message}`);
    }
  };
  const loadPostDraftIntoWizard = (post) => {
    setEditingWizardPostId(post.id);
    setNewPost({
      ...emptyPost,
      ...post,
      postType: post.postType ?? post.contentType ?? "blog",
      category: post.category ?? "general",
      author: post.author ?? "Group Admin",
      albumId: post.albumId ?? "",
      approvalStatus: post.approvalStatus ?? "draft",
      thumbnailFile: null
    });
    setPostWizardStep(0);
    setActiveSection("posts");
    setSaveMessage(`Loaded draft "${post.title}" into the post wizard.`);
  };
  const resetPostWizard = () => {
    setNewPost(emptyPost);
    setEditingWizardPostId(null);
    setPostWizardStep(0);
  };
  const discardPostWizard = async () => {
    if (editingWizardPostId) {
      const confirmed = window.confirm("Delete this saved post draft? This cannot be undone.");
      if (!confirmed) return;
      await deleteBlog(editingWizardPostId);
      await refresh();
      setSaveMessage("Post draft deleted.");
    }
    resetPostWizard();
  };
  const createPost = async (event) => {
    event.preventDefault();
    const requestedStatus = event.nativeEvent.submitter?.value;
    if (postWizardStep < wizardSteps.length - 1) {
      setPostWizardStep(wizardSteps.length - 1);
      setSaveMessage("Review your post, then submit when ready.");
      return;
    }

    const nextStatus = isAdmin ? (requestedStatus || newPost.approvalStatus) : (requestedStatus || "pending");
    try {
      setUploadStatus(newPost.thumbnailFile ? "Optimizing and uploading blog thumbnail..." : "Saving blog post...");
      if (editingWizardPostId) {
        await updateBlog(editingWizardPostId, {
          ...newPost,
          approvalStatus: nextStatus
        });
      } else {
        await createBlog({
          ...newPost,
          approvalStatus: nextStatus
        });
      }
      resetPostWizard();
      setSaveMessage(nextStatus === "draft" ? "Post draft saved." : "Post sent for approval.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Post save failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };  const savePost = async (postId, payload, options = {}) => {
    const nextPayload = payload ?? postEdits[postId];
    const currentPost = allPosts.find((post) => post.id === postId);
    const shouldCreateRevision = !isAdmin && currentPost?.approvalStatus === "approved";
    const requestedStatus = options.status ?? "pending";
    const submissionStatus =
      requestedStatus === "draft" ? "draft" : shouldCreateRevision ? "pending_update" : "pending";

    await updateBlog(
      postId,
      isAdmin
        ? nextPayload
        : {
            ...nextPayload,
            approvalStatus: submissionStatus,
            revisionOfId: shouldCreateRevision ? postId : undefined
          }
    );
    await logAuditEvent(isAdmin ? "blog_edited" : "blog_submitted", "Blog post", postId, {
      title: nextPayload?.title,
      status: isAdmin ? nextPayload?.approvalStatus : submissionStatus
    });
    setSaveMessage(
      isAdmin
        ? "Post updated."
        : submissionStatus === "draft"
          ? "Blog draft saved."
          : "Blog sent for approval. The approved public version stays live until approval."
    );
    await refresh();
  };
  const appendPhotoFiles = (files) => {
    const incoming = Array.from(files ?? []);
    setPhotoFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...incoming.filter((file) => !seen.has(`${file.name}-${file.size}-${file.lastModified}`))];
    });
  };
  const removeSelectedPhotoFile = (fileToRemove) => {
    setPhotoFiles((current) => current.filter((file) => file !== fileToRemove));
  };
  const loadAlbumDraftIntoWizard = (album) => {
    setEditingWizardAlbumId(album.id);
    setGalleryUploadMode("new");
    setNewAlbum({
      ...emptyAlbum,
      ...album,
      category: album.category ?? "",
      approvalStatus: album.approvalStatus ?? "draft"
    });
    setAlbumThumbnailFile(null);
    setPhotoFiles([]);
    setGalleryWizardStep(0);
    setActiveSection("gallery");
    setSaveMessage(`Loaded draft "${album.title}" into the gallery wizard.`);
  };
  const resetGalleryWizard = () => {
    setNewAlbum(emptyAlbum);
    setAlbumThumbnailFile(null);
    setPhotoFiles([]);
    setEditingWizardAlbumId(null);
    setGalleryWizardStep(0);
  };
  const discardGalleryWizard = async () => {
    if (editingWizardAlbumId) {
      const confirmed = window.confirm("Delete this saved album draft? This cannot be undone.");
      if (!confirmed) return;
      await deleteAlbum(editingWizardAlbumId);
      await refresh();
      setSaveMessage("Album draft deleted.");
    }
    resetGalleryWizard();
  };
  const createGalleryAlbum = async (event) => {
    event.preventDefault();
    const requestedStatus = event.nativeEvent.submitter?.value;
    if (galleryWizardStep < wizardSteps.length - 1) {
      setGalleryWizardStep(wizardSteps.length - 1);
      setSaveMessage("Review your gallery upload, then submit when ready.");
      return;
    }

    try {
      if (galleryUploadMode === "existing" && !photoAlbumId) {
        setSaveMessage("Please choose an existing album.");
        return;
      }
      if (galleryUploadMode === "new") {
        if (!newAlbum.title.trim()) {
          setSaveMessage("Please enter an album title.");
          return;
        }
        if (!newAlbum.eventDate) {
          setSaveMessage("Please select an album date.");
          return;
        }
        if (!newAlbum.location.trim()) {
          setSaveMessage("Please enter the album location.");
          return;
        }
        if (!editingWizardAlbumId && !albumThumbnailFile) {
          setSaveMessage("Please upload an album thumbnail.");
          return;
        }
        if (!newAlbum.category.trim()) {
          setSaveMessage("Please select an album category.");
          return;
        }
      }
      if (!photoFiles.length && !editingWizardAlbumId) {
        setSaveMessage("Please upload at least one photo.");
        return;
      }

      setUploadStatus(galleryUploadMode === "new" ? "Saving album and optimizing photos..." : "Optimizing and uploading photo bundle...");
      setPhotoUploadProgress({ completed: 0, total: photoFiles.length, percent: 0 });
      let targetAlbumId = photoAlbumId;
      const approvalStatus = isAdmin ? (requestedStatus || newAlbum.approvalStatus) : (requestedStatus || "pending");
      if (galleryUploadMode === "new") {
        if (editingWizardAlbumId) {
          await updateAlbum(editingWizardAlbumId, {
            ...newAlbum,
            thumbnailFile: albumThumbnailFile,
            approvalStatus
          });
          targetAlbumId = editingWizardAlbumId;
        } else {
          const created = await createAlbum({
            ...newAlbum,
            thumbnailFile: albumThumbnailFile,
            approvalStatus
          });
          targetAlbumId = Array.isArray(created) ? created[0]?.id : created?.id;
        }
      }

      if (photoFiles.length) {
        await addAlbumPhotos(targetAlbumId, {
          photos: photoFiles,
          approvalStatus,
          submittedBy: user.name,
          onProgress: (progress) => {
            setPhotoUploadProgress(progress);
            setUploadStatus(`Uploading optimized photos: ${progress.completed} of ${progress.total}`);
          }
        });
      }

      resetGalleryWizard();
      setSaveMessage(approvalStatus === "draft" ? "Album draft saved." : galleryUploadMode === "new" ? "Album and photo bundle submitted." : "Photo bundle submitted.");
      setPhotoUploadProgress({ completed: 0, total: 0, percent: 0 });
      await refresh();
    } catch (error) {
      setSaveMessage(`Gallery upload failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };  const saveAlbum = async (albumId, payload) => {
    const nextPayload = payload ?? albumEdits[albumId];
    const currentAlbum = allAlbums.find((album) => album.id === albumId);
    const shouldCreateRevision = !isAdmin && currentAlbum?.approvalStatus === "approved";
    const submissionStatus = shouldCreateRevision ? "pending_update" : "pending";

    await updateAlbum(
      albumId,
      isAdmin
        ? nextPayload
        : {
            ...nextPayload,
            approvalStatus: submissionStatus,
            revisionOfId: shouldCreateRevision ? albumId : undefined
          }
    );
    await logAuditEvent(isAdmin ? "album_edited" : "album_submitted", "Album", albumId, {
      title: nextPayload?.title,
      status: isAdmin ? nextPayload?.approvalStatus : submissionStatus
    });
    setSaveMessage(isAdmin ? "Album updated." : "Album submitted for admin approval. The approved public version stays live until approval.");
    await refresh();
  };
  const saveEventApproval = async (eventId, payload) => {
    await updateCalendarEvent(eventId, payload);
    setSaveMessage("Calendar event updated.");
    await refresh();
  };
  const saveApprovalDecision = async (item, approvalStatus) => {
    const payload = {
      ...item,
      approvalStatus,
      reviewerComment: approvalComment.trim()
    };

    if (item.contentType === "Profile change") {
      await reviewProfileChange(item, approvalStatus, payload.reviewerComment);
    } else if (item.contentType === "Posted form") {
      await reviewDashboardPostedForm(item.id, approvalStatus === "approved" ? "open" : approvalStatus, payload.reviewerComment);
    } else if (item.contentType === "Website Content") {
      await reviewDashboardWebsiteContentRevision(item, approvalStatus, payload.reviewerComment);
    } else {
      const save =
        item.contentType === "Blog post"
          ? savePost
          : item.contentType === "Calendar event"
            ? saveEventApproval
            : item.contentType === "Photo batch"
              ? updatePhotoBatch
              : item.contentType === "Photo"
                ? updatePhoto
                : saveAlbum;

      await save(item.id, payload);
    }
    const notificationEntityType = item.contentType === "Posted form" ? "posted_form" : item.contentType === "Website Content" ? "site_content_revision" : item.contentType === "Profile change" ? "profile" : item.contentType === "Blog post" ? "posts" : item.contentType === "Calendar event" ? "calendar_events" : item.contentType === "Album" ? "gallery_albums" : null;
    if (notificationEntityType) await completeDashboardEntityNotifications(notificationEntityType, item.id).catch(() => {});
    await logAuditEvent(`content_${approvalStatus}`, item.contentType, item.id, {
      title: item.title,
      reviewerComment: payload.reviewerComment
    });
    setSaveMessage(`${item.contentType} marked ${approvalStatus.replace("_", " ")}.`);
    setSelectedApproval(null);
    setApprovalComment("");
    setSelectedApprovalPhotoIds([]);
    await refresh();
  };
  const toggleApprovalPhoto = (photoId) => {
    setSelectedApprovalPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]
    );
  };
  const removeSelectedApprovalPhotos = async () => {
    if (!selectedApprovalPhotoIds.length) {
      return;
    }

    await deletePhotos(selectedApprovalPhotoIds);
    await logAuditEvent("photo_batch_images_removed", "Photo batch", selectedApproval?.id, {
      removedPhotoIds: selectedApprovalPhotoIds
    });
    setSelectedApproval((current) =>
      current?.contentType === "Photo batch"
        ? {
            ...current,
            photos: (current.photos ?? []).filter((photo) => !selectedApprovalPhotoIds.includes(photo.id)),
            photoCount: Math.max(0, Number(current.photoCount ?? 0) - selectedApprovalPhotoIds.length)
          }
        : current
    );
    setSelectedApprovalPhotoIds([]);
    setSaveMessage("Selected batch photos removed.");
    await refresh();
  };
  const uploadPhotos = async (event) => {
    event.preventDefault();
    try {
      setUploadStatus("Optimizing and uploading photos...");
      setPhotoUploadProgress({ completed: 0, total: photoFiles.length, percent: 0 });
      await addAlbumPhotos(photoAlbumId, {
        photos: photoFiles,
        approvalStatus: isAdmin ? "approved" : "pending",
        submittedBy: user.name,
        onProgress: (progress) => {
          setPhotoUploadProgress(progress);
          setUploadStatus(`Uploading optimized photos: ${progress.completed} of ${progress.total}`);
        }
      });
      setPhotoFiles([]);
      setSaveMessage("Photos added.");
      setPhotoUploadProgress({ completed: 0, total: 0, percent: 0 });
      await refresh();
    } catch (error) {
      setSaveMessage(`Photo upload failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const saveContentField = async () => {
    setSaveMessage("Change kept in the pending website draft.");
  };
  const normalizeFaqCollection = (items) => (items ?? []).map((item, index) => ({ id: item.id, question: item.question ?? "", answer: item.answer ?? "", displayOrder: index, isActive: item.isActive !== false, isNew: Boolean(item.isNew) }));
  const normalizeLeaderCollection = (items) => (items ?? []).map((item, index) => ({ id: item.id, name: item.name ?? "", title: item.title ?? "", photoUrl: item.photoUrl ?? null, storagePath: item.storagePath ?? null, displayOrder: index, isActive: item.isActive !== false, isNew: Boolean(item.isNew), file: siteImageFiles[`leader:${item.id}`] ?? null }));
  const currentFaqCollection = normalizeFaqCollection(data.faqs);
  const editedFaqCollection = websiteCollections.faqs ? normalizeFaqCollection(websiteCollections.faqs) : null;
  const currentLeaderCollection = normalizeLeaderCollection(data.leaders);
  const editedLeaderCollection = websiteCollections.leaders ? normalizeLeaderCollection(websiteCollections.leaders) : null;
  const faqOperations = editedFaqCollection ? [
    ...editedFaqCollection.filter((item) => {
      const current = currentFaqCollection.find((entry) => entry.id === item.id);
      return item.isNew || !current || current.question !== item.question || current.answer !== item.answer || current.displayOrder !== item.displayOrder || current.isActive !== item.isActive;
    }).map((item) => ({ action: "upsert", ...item })),
    ...currentFaqCollection.filter((item) => !editedFaqCollection.some((entry) => entry.id === item.id)).map((item) => ({ action: "delete", id: item.id, question: item.question }))
  ] : [];
  const leaderOperations = editedLeaderCollection ? [
    ...editedLeaderCollection.filter((item) => {
      const current = currentLeaderCollection.find((entry) => entry.id === item.id);
      return item.isNew || Boolean(item.file) || !current || current.name !== item.name || current.title !== item.title || current.displayOrder !== item.displayOrder || current.isActive !== item.isActive;
    }).map((item) => ({ action: "upsert", ...item })),
    ...currentLeaderCollection.filter((item) => !editedLeaderCollection.some((entry) => entry.id === item.id)).map((item) => ({ action: "delete", id: item.id, name: item.name, storagePath: item.storagePath }))
  ] : [];
  const websitePendingChanges = [
    ...websiteContentFields
      .filter(([, contentKey]) => siteContentEdits[contentKey] || siteImageFiles[contentKey])
      .map(([sectionName, contentKey, label, fieldType]) => {
        const current = data.siteContent?.[contentKey] ?? { sectionName, contentKey, textValue: "", imageUrl: null, storagePath: null };
        const edit = siteContentEdits[contentKey] ?? current;
        return { sectionName, contentKey, label, fieldType, textValue: fieldType === "image" ? current.textValue ?? "" : edit.textValue ?? "", imageUrl: current.imageUrl ?? null, storagePath: current.storagePath ?? null, previousStoragePath: current.storagePath ?? null, file: siteImageFiles[contentKey] ?? null };
      }),
    ...(faqOperations.length ? [{ entityType: "faqChanges", contentKey: "faq_changes", label: "FAQ changes", operations: faqOperations }] : []),
    ...(leaderOperations.length ? [{ entityType: "leaderChanges", contentKey: "leader_changes", label: "Leader changes", operations: leaderOperations }] : [])
  ];  const publishWebsiteContent = async () => {
    if (!websitePendingChanges.length) {
      setSaveMessage("No website content changes to submit.");
      return;
    }
    setUploadStatus("Preparing website content approval request...");
    try {
      await submitDashboardWebsiteContentRevision({ pageKey: websiteEditorPage, title: `${websiteEditorPage[0].toUpperCase()}${websiteEditorPage.slice(1)} website changes`, changes: websitePendingChanges });
      setSiteContentEdits({});
      setSiteImageFiles({});
      setWebsiteCollections({ faqs: null, leaders: null });
      setWebsiteEditorVersion((current) => current + 1);
      setWebsiteReviewOpen(false);
      setSaveMessage("Website content changes submitted for approval. The live site has not changed yet.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Website content submission failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };  const getContentText = (contentKey, fallback = "") =>
    siteContentEdits[contentKey]?.textValue ?? data.siteContent?.[contentKey]?.textValue ?? fallback;
  const getContentImage = (contentKey) => siteImagePreviews[contentKey] ?? data.siteContent?.[contentKey]?.imageUrl ?? null;
  const createManagedLeader = async (event) => {
    event.preventDefault();

    try {
      setUploadStatus(newLeader.file ? "Optimizing and uploading leader headshot..." : "Saving leader...");
      await addLeader(newLeader);
      setNewLeader(emptyLeader);
      setSaveMessage("Leader saved.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Leader save failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const saveManagedLeader = async (leaderId) => {
    const edit = leaderEdits[leaderId];
    if (!edit) {
      return;
    }

    try {
      setUploadStatus(edit.file ? "Optimizing and uploading leader headshot..." : "Saving leader...");
      await saveLeader(leaderId, edit);
      setSaveMessage("Leader updated.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Leader update failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const hideManagedLeader = async (leaderId) => {
    await removeLeader(leaderId);
    setSaveMessage("Leader hidden from the About page.");
    await refresh();
  };
  const createFaqItem = async (event) => {
    event.preventDefault();
    await addFaq(newFaq);
    setNewFaq(emptyFaq);
    setSaveMessage("FAQ added.");
    await refresh();
  };
  const saveFaqItem = async (faqId) => {
    await saveFaq(faqId, faqEdits[faqId]);
    setSaveMessage("FAQ updated.");
    await refresh();
  };
  const hideFaqItem = async (faqId) => {
    await removeFaq(faqId);
    setSaveMessage("FAQ hidden from the public page.");
    await refresh();
  };
  const deleteFaqItem = async (faqId) => {
    await destroyFaq(faqId);
    setSaveMessage("FAQ deleted.");
    await refresh();
  };
  const saveContact = async (messageId, payload) => {
    await saveContactMessage(messageId, payload);
    if (payload.status !== "new") await completeDashboardEntityNotifications("contact_message", messageId).catch(() => {});
    setSaveMessage("Contact message updated.");
    await refresh();
  };
  const deleteContact = async (messageId) => {
    await removeContactMessage(messageId);
    await completeDashboardEntityNotifications("contact_message", messageId).catch(() => {});
    setSaveMessage("Contact message deleted.");
    await refresh();
  };
  const parseStructuredWebsiteList = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const renderStructuredWebsiteValue = (contentKey, value) => {
    const items = parseStructuredWebsiteList(value);
    if (!items.length) return <span className="empty-state">No entries</span>;

    if (contentKey === "about_history_milestones") {
      return <div className="website-change-operation-list structured-content-preview">{items.map((item, index) => <section key={item.id ?? `${item.year}-${index}`}><span className="forms-status-pill approved">{item.year || "Year"}</span><strong>{item.title || "Milestone"}</strong>{item.text && <p>{item.text}</p>}</section>)}</div>;
    }

    if (contentKey === "about_values") {
      return <div className="website-change-operation-list structured-content-preview">{items.map((item, index) => <section key={item.id ?? `${item.name}-${index}`}><strong>{item.name || "Value"}</strong>{item.description && <p>{item.description}</p>}</section>)}</div>;
    }

    if (contentKey === "about_scout_groups") {
      return <div className="website-change-operation-list structured-content-preview">{items.map((item, index) => <section key={item.id ?? `${item.name}-${index}`}><strong>{item.name || "Scout group"}</strong>{(item.ageRange || item.gradeRange) && <span>{item.ageRange || item.gradeRange}</span>}{item.description && <p>{item.description}</p>}</section>)}</div>;
    }

    return <pre className="structured-content-preview">{JSON.stringify(items, null, 2)}</pre>;
  };
  const renderWebsiteChangeComparison = (change) => {
    let current = data.siteContent?.[change.contentKey] ?? {};
    let label = change.label || change.contentKey?.replaceAll("_", " ") || change.entityType;
    let before = current.textValue ?? "";
    let after = change.textValue ?? "";
    if (change.entityType === "faqChanges") {
      return <article key="faq_changes"><h3>{label}</h3><div className="website-change-operation-list">{(change.operations ?? []).map((operation, index) => <section key={`${operation.action}-${operation.id ?? index}`}><span className={`forms-status-pill ${operation.action === "delete" ? "rejected" : "approved"}`}>{operation.action}</span><strong>{operation.question || "FAQ"}</strong>{operation.action === "upsert" && <FormattedText text={operation.answer} />}</section>)}</div></article>;
    }
    if (change.entityType === "leaderChanges") {
      return <article key="leader_changes"><h3>{label}</h3><div className="website-change-operation-list">{(change.operations ?? []).map((operation, index) => <section key={`${operation.action}-${operation.id ?? index}`}><span className={`forms-status-pill ${operation.action === "delete" ? "rejected" : "approved"}`}>{operation.action}</span>{operation.action === "upsert" && (siteImagePreviews[`leader:${operation.id}`] || operation.photoUrl) && <img src={siteImagePreviews[`leader:${operation.id}`] || operation.photoUrl} alt="" />}<strong>{operation.name || "Leader"}</strong>{operation.title && <span>{operation.title}</span>}</section>)}</div></article>;
    }
    if (change.entityType === "leader") {
      current = (data.leaders ?? []).find((item) => item.id === change.entityId) ?? {};
      before = `${current.name ?? ""} - ${current.title ?? ""}`;
      after = `${change.name ?? ""} - ${change.title ?? ""}`;
    } else if (change.entityType === "faq") {
      current = (data.faqs ?? []).find((item) => item.id === change.entityId) ?? {};
      before = `${current.question ?? ""}\n${current.answer ?? ""}`;
      after = `${change.question ?? ""}\n${change.answer ?? ""}`;
    }
    const isImage = change.fieldType === "image" || (!change.entityType && change.imageUrl);
    const isStructured = isStructuredSiteContentKey(change.contentKey);
    const afterImage = change.file ? siteImagePreviews[change.contentKey] : change.imageUrl;
    return <article key={change.contentKey ?? `${change.entityType}-${change.entityId}`}><h3>{label}</h3><div className="website-change-comparison"><div><small>Before</small>{isImage ? (current.imageUrl ? <img src={current.imageUrl} alt="" /> : <span>No image</span>) : isStructured ? renderStructuredWebsiteValue(change.contentKey, before) : <FormattedText text={before} fallback="Empty" />}</div><div><small>After</small>{isImage ? (afterImage ? <img src={afterImage} alt="" /> : <span>No image</span>) : isStructured ? renderStructuredWebsiteValue(change.contentKey, after) : <FormattedText text={after} fallback="Empty" />}</div></div></article>;
  };
  const renderWebsiteContent = () => {
    const setContentEdit = (contentKey, value) => {
      const sectionName = contentKey.startsWith("about_") ? "about" : "home";
      const current = data.siteContent?.[contentKey] ?? { sectionName, contentKey, textValue: "" };
      setSiteContentEdits((edits) => ({ ...edits, [contentKey]: { ...current, ...edits[contentKey], sectionName, contentKey, textValue: value } }));
    };
    return <div className="inline-site-editor">
      <div className="inline-editor-toolbar"><div><p className="eyebrow">Website content</p><strong>{websiteEditorPage === "home" ? "Home" : "About"}</strong><small>Every change stays private until it is approved.</small></div><button type="button" className="primary-action" disabled={!websitePendingChanges.length || Boolean(uploadStatus)} onClick={() => setWebsiteReviewOpen(true)}>Review Changes ({websitePendingChanges.length})</button></div>
      <WebsiteContentEditor key={`${websiteEditorPage}-${websiteEditorVersion}`} data={data} page={websiteEditorPage} onPageChange={setWebsiteEditorPage} valueFor={getContentText} imageFor={getContentImage} onFieldChange={setContentEdit} onChooseImage={(file, contentKey, shape) => openAvatarCrop(file, { type: "siteContent", contentKey, shape })} onCollectionsChange={(change) => setWebsiteCollections((current) => ({ ...current, ...change }))} />
      {websiteReviewOpen && <div className="approval-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWebsiteReviewOpen(false); }}><article className="approval-review-modal"><div className="approval-modal-header"><div><p className="eyebrow">Before submission</p><h2>Review Website Changes</h2></div><button type="button" className="modal-close-button" onClick={() => setWebsiteReviewOpen(false)}><X size={18} /></button></div><div className="approval-modal-body website-revision-preview">{websitePendingChanges.map(renderWebsiteChangeComparison)}</div><div className="approval-modal-footer"><button type="button" className="inline-action" onClick={() => setWebsiteReviewOpen(false)}>Back to editing</button><button type="button" className="primary-action" disabled={Boolean(uploadStatus)} onClick={publishWebsiteContent}>{uploadStatus ? "Submitting..." : "Submit for Approval"}</button></div></article></div>}
    </div>;
  };  const renderFaqs = () => (
    <div className="cms-panel-stack">
      <form className="cms-form" onSubmit={createFaqItem}>
        <h2>Create FAQ</h2>
        <input
          required
          placeholder="Question"
          value={newFaq.question}
          onChange={(event) => setNewFaq((current) => ({ ...current, question: event.target.value }))}
        />
        <textarea
          required
          rows="4"
          placeholder="Answer"
          value={newFaq.answer}
          onChange={(event) => setNewFaq((current) => ({ ...current, answer: event.target.value }))}
        />
        <input
          type="number"
          placeholder="Display order"
          value={newFaq.displayOrder}
          onChange={(event) => setNewFaq((current) => ({ ...current, displayOrder: event.target.value }))}
        />
        <button type="submit">Add FAQ</button>
      </form>
      <div className="table-panel">
        <table className="editable-table">
          <thead><tr><th>Question</th><th>Answer</th><th>Order</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleFaqs.length ? visibleFaqs.map((faq) => {
              const edit = faqEdits[faq.id] ?? faq;
              const setEdit = (field, value) => setFaqEdits((current) => ({ ...current, [faq.id]: { ...edit, [field]: value } }));

              return (
                <tr key={faq.id}>
                  <td><input value={edit.question ?? ""} onChange={(event) => setEdit("question", event.target.value)} /></td>
                  <td><textarea rows="3" value={edit.answer ?? ""} onChange={(event) => setEdit("answer", event.target.value)} /></td>
                  <td><input type="number" value={edit.displayOrder ?? 0} onChange={(event) => setEdit("displayOrder", event.target.value)} /></td>
                  <td><label className="checkbox-cell"><input type="checkbox" checked={edit.isActive !== false} onChange={(event) => setEdit("isActive", event.target.checked)} /></label></td>
                  <td className="table-actions">
                    <button type="button" className="inline-action" onClick={() => saveFaqItem(faq.id)}>Save</button>
                    <button type="button" className="inline-action danger-action" onClick={() => hideFaqItem(faq.id)}>Hide</button>
                    <button type="button" className="inline-action danger-action" onClick={() => deleteFaqItem(faq.id)}>Delete</button>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="5">No FAQs found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const openContactMessage = async (message) => {
    setSelectedContactId(message.id);
    if (message.status === "new") {
      setContactEdits((current) => ({ ...current, [message.id]: { ...message, status: "read" } }));
      await saveContactMessage(message.id, { ...message, status: "read" });
      await completeDashboardEntityNotifications("contact_message", message.id).catch(() => {});
      await refresh();
    }
  };

  const renderContactMessages = () => {
    const messages = (data.contactMessages ?? []).filter((message) => {
      const matchesStatus = contactInboxStatus === "all" || message.status === contactInboxStatus;
      const query = `${contactInboxSearch} ${search}`.trim().toLowerCase();
      const matchesSearch = !query || [message.name, message.email, message.subject, message.message].some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
    const selected = (data.contactMessages ?? []).find((message) => message.id === selectedContactId) ?? messages[0] ?? null;
    const edit = selected ? (contactEdits[selected.id] ?? selected) : null;
    const setEdit = (field, value) => selected && setContactEdits((current) => ({ ...current, [selected.id]: { ...edit, [field]: value } }));
    const statusOptions = ["all", "new", "read", "replied", "archived"];
    const contactStats = [
      { label: "Inbox", value: data.contactMessages?.length ?? 0 },
      { label: "New", value: (data.contactMessages ?? []).filter((message) => message.status === "new").length },
      { label: "Replied", value: (data.contactMessages ?? []).filter((message) => message.status === "replied").length },
      { label: "Archived", value: (data.contactMessages ?? []).filter((message) => message.status === "archived").length }
    ];

    return <div className={`contact-inbox-shell ${selectedContactId ? "mobile-detail-open" : ""}`}>
      <aside className="contact-inbox-list" aria-label="Contact message inbox">
        <div className="contact-inbox-summary">
          <div>
            <p className="eyebrow">Inbox</p>
            <h3>Visitor messages</h3>
          </div>
          <span>{messages.length}</span>
        </div>
        <div className="contact-inbox-stats" aria-label="Contact message status summary">
          {contactStats.map((stat) => <span key={stat.label}><strong>{stat.value}</strong>{stat.label}</span>)}
        </div>
        <div className="contact-inbox-filters">
          <label>
            <span>Search inbox</span>
            <input placeholder="Name, email, subject, or message" value={contactInboxSearch} onChange={(event) => setContactInboxSearch(event.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={contactInboxStatus} onChange={(event) => setContactInboxStatus(event.target.value)}>
              {statusOptions.map((status) => <option value={status} key={status}>{status === "all" ? "All messages" : status}</option>)}
            </select>
          </label>
        </div>
        <div className="contact-message-list">
          {messages.length ? messages.map((message, index) => (
            <button
              type="button"
              className={`contact-message-row ${selected?.id === message.id ? "active" : ""} ${message.status === "new" ? "unread" : ""}`}
              key={message.id}
              onClick={() => openContactMessage(message)}
              style={{ "--row-index": index }}
              aria-pressed={selected?.id === message.id}
            >
              <span className="contact-row-icon"><MessageSquare size={18} aria-hidden="true" /></span>
              <span className="contact-row-content">
                <span className="contact-row-topline"><strong>{message.name}</strong><span className={`contact-status-pill ${message.status}`}>{message.status}</span></span>
                <b>{message.subject}</b>
                <p>{message.message}</p>
                <small>{formatRelativeTime(message.createdAt)} · {message.email}</small>
              </span>
            </button>
          )) : <div className="empty-state contact-empty-state"><MessageSquare size={26} aria-hidden="true" /><strong>No messages match these filters.</strong><span>Try a different search term or status.</span></div>}
        </div>
      </aside>
      <section className="contact-message-detail" aria-label="Selected contact message">
        {selected && edit ? <>
          <button type="button" className="inline-action contact-mobile-back" onClick={() => setSelectedContactId(null)}><ArrowLeft size={16} />Back to messages</button>
          <div className="contact-detail-header">
            <div>
              <p className="eyebrow">Contact message</p>
              <h2>{selected.subject}</h2>
              <span>Received {formatDubaiDateTime(selected.createdAt)}</span>
            </div>
            <span className={`contact-status-pill ${edit.status}`}>{edit.status}</span>
          </div>
          <dl className="contact-sender-details">
            <div><dt>From</dt><dd>{selected.name}</dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>
            {selected.phone && <div><dt>Phone</dt><dd><a href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div>}
          </dl>
          <div className="contact-message-body">
            <p>{selected.message}</p>
          </div>
          <div className="contact-response-panel">
            <label className="contact-status-field">Status<select value={edit.status} onChange={(event) => setEdit("status", event.target.value)}>{["new", "read", "replied", "archived"].map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
            <label>Internal notes<textarea rows="6" value={edit.notes ?? ""} onChange={(event) => setEdit("notes", event.target.value)} placeholder="Private notes for administrators..." /></label>
          </div>
          <div className="action-row contact-detail-actions">
            <a className="inline-action" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}><Send size={16} />Reply by email</a>
            <button type="button" className="primary-action" onClick={() => saveContact(selected.id, edit)}>Save changes</button>
            <button type="button" className="inline-action danger-action" onClick={() => deleteContact(selected.id)}>Delete</button>
          </div>
        </> : <div className="empty-approval-preview contact-detail-empty"><MessageSquare size={34} /><h3>Select a message</h3><p>Choose a message from the inbox to view its details.</p></div>}
      </section>
    </div>;
  };

  const openNotification = async (notification) => {
    if ((data.notifications ?? []).some((item) => item.id === notification.id)) await readDashboardNotification(notification.id);
    setIsNotificationsOpen(false);
    if (notification.entityType === "posted_form" && notification.entityId) setRequestedFormId(notification.entityId);
    openDashboardSection(canOpenSection(notification.targetSection, user) ? notification.targetSection : "overview");
    await refresh();
  };

  const deleteNotificationItem = async (event, notification) => {
    event.stopPropagation();
    if (!notification?.id || String(notification.id).startsWith("open-form-")) return;
    if (!window.confirm("Delete this notification?")) return;
    await deleteDashboardNotification(notification.id);
    await refresh();
  };

  const notificationIcon = (notification, size = 18) => notification.type === "contact" ? <MessageSquare size={size} /> : notification.type === "form" ? <FileText size={size} /> : notification.type === "profile" ? <Users size={size} /> : <CheckCircle2 size={size} />;

  const filteredNotificationItems = filterBySearch(notificationItems, search, ["title", "message", "contentType", "type", "targetSection"]);

  const renderNotifications = () => (
    <div className="notifications-page">
      <div className="notifications-page-toolbar">
        <div>
          <p className="eyebrow">Updates</p>
          <h2>Notifications</h2>
        </div>
        <button type="button" className="inline-action" onClick={async () => { await readAllDashboardNotifications(); await refresh(); }}>Mark all as read</button>
      </div>
      <div className="notifications-full-list">
        {filteredNotificationItems.length ? filteredNotificationItems.map((notification) => (
          <div className={`notification-row notification-row-shell ${notification.isRead ? "" : "unread"}`} key={notification.id ?? `${notification.contentType}-${notification.entityId ?? notification.title}`}>
            <button type="button" className="notification-row-main" onClick={() => openNotification(notification)}>
              <span className="notification-type-icon">{notificationIcon(notification, 18)}</span>
              <div>
                <strong>{notification.title ?? notification.contentType}</strong>
                <p>{notification.message ?? notification.title}</p>
                <small>{formatRelativeTime(notification.createdAt)}</small>
              </div>
              {!notification.isRead && <i aria-label="Unread" />}
            </button>
            {notification.id && !String(notification.id).startsWith("open-form-") && (
              <button type="button" className="icon-button notification-delete-button danger-action" aria-label="Delete notification" onClick={(event) => deleteNotificationItem(event, notification)}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )) : <p className="empty-state">No notifications match this search.</p>}
      </div>
    </div>
  );  const renderMyGroup = () => {
    const groupScouts = filterBySearch(sortScouts(
      data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId),
      data.registrationImportSettings.sortBy
    ), search, ["name", "schoolGrade", "school", "groupId", "equipeId"]);

    return (
      <div className="cms-panel-stack my-group-reference">
{renderCoordinatorGroupSwitcher()}
        {canTakeAttendance(user) && (
          <div className="my-group-attendance-link">
            <button type="button" className="inline-action" onClick={() => setActiveSection("scoutAttendance")}>
              Take Attendance for {dashboardGroup?.name ?? "My Group"}
            </button>
          </div>
        )}
        <article className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>{dashboardGroup?.name ?? "My Group"}</h2>
              <p>Quick roster reference for the selected group.</p>
            </div>
            <span>{groupScouts.length} scouts</span>
          </div>
          <table>
            <thead><tr><th>Scout name</th><th>Grade</th><th>Age</th><th>Equipe</th></tr></thead>
            <tbody>
              {groupScouts.length ? groupScouts.map((scout) => (
                <tr key={scout.id}>
                  <td>{scout.name}</td>
                  <td>{getSchoolGrade(scout)}</td>
                  <td>{scout.age}</td>
                  <td>{getEquipeName(scout, groupEquipes)}</td>
                </tr>
              )) : <tr><td colSpan="4">No scouts found for this group.</td></tr>}
            </tbody>
          </table>
        </article>
      </div>
    );
  };
  const renderOverview = () => {
    const visibleUpcomingEvents = filterBySearch(data.plannedEvents
      .filter((event) => canSeeDashboardEvent(event, user))
      .filter((event) => (event.dateTo ?? event.dateFrom ?? event.date) >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => String(a.dateFrom ?? a.date).localeCompare(String(b.dateFrom ?? b.date))), search, ["title", "description", "location", "visibility", "approvalStatus"])
      .slice(0, 5);
    const visiblePendingWorkItems = filterBySearch(pendingWorkItems, search, ["title", "contentType", "approvalStatus", "name", "pendingName", "message"]);

    const ownSubmissions = [
      ...allPosts,
      ...allAlbums,
      ...data.plannedEvents
    ].filter((item) => item.submittedBy === user?.id);
    const overviewGroupIds = isAdmin ? data.groups.map((group) => group.id) : assignedGroupIds;
    const groupScouts = data.registeredScouts.filter((scout) => overviewGroupIds.includes(scout.groupId));
    const groupAttendance = data.attendanceMeetings.filter((meeting) => overviewGroupIds.includes(meeting.groupId));
    const stats = isAdmin
      ? [
          ["Active scouts", data.registeredScouts.length],
          ["Chiefs", chiefs.length],
          ["Attendance days", data.attendanceMeetings.length],
          ["Pending approvals", pendingItems.length]
        ]
      : [
          ["Assigned group", dashboardGroup?.name ?? "Unassigned"],
          ["Scouts", groupScouts.length],
          ["Attendance days", groupAttendance.length],
          ["My submissions", ownSubmissions.length]
        ];

    return (
      <>
        <div className="dashboard-stat-grid">
          {stats.map(([label, value]) => (
            <article className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="dashboard-overview-stack">
          <PendingWorkList
            items={visiblePendingWorkItems}
            getSubmitterName={isAdmin ? getSubmitterName : () => user.name}
            getSubmitterPicture={isAdmin ? getSubmitterPicture : () => user.profilePictureUrl}
            onOpen={openPendingWorkItem}
          />
          <article className="admin-panel dashboard-upcoming-events-panel">
            <div className="panel-heading compact-heading">
              <div>
                <h2>Upcoming Events</h2>
                <p>Events visible to this dashboard user.</p>
              </div>
              <span>{visibleUpcomingEvents.length}</span>
            </div>
            <div className="mini-list dashboard-event-list">
              {visibleUpcomingEvents.length ? visibleUpcomingEvents.map((event) => (
                <button type="button" key={event.id} onClick={() => setActiveSection("calendar")}>
                  <strong>{event.title}</strong>
                  <span>{event.dateFrom ?? event.date}</span>
                </button>
              )) : <span>No upcoming events visible right now.</span>}
            </div>
          </article>
          <div className="quick-shortcuts-row">
            {canTakeAttendance(user) && <button type="button" onClick={() => setActiveSection("scoutAttendance")}><CheckCircle2 size={17} aria-hidden="true" />Take Attendance</button>}
            {canPublishContent(user) && <button type="button" onClick={() => setActiveSection("posts")}><FileText size={17} aria-hidden="true" />New Blog Post</button>}
            {canCreateGroupMeetings(user) && <button type="button" onClick={() => setActiveSection("calendar")}><CalendarDays size={17} aria-hidden="true" />New Event</button>}
            {canPublishContent(user) && <button type="button" onClick={() => setActiveSection("gallery")}><GalleryHorizontal size={17} aria-hidden="true" />Upload Photos/Album</button>}
          </div>
        </div>
      </>
    );
  };
  const renderUpload = () => {
    const activeYear = data.scoutYears?.find((year) => year.isActive);
    const selectedUploadYear = data.scoutYears?.find((year) => year.id === registrationYearId);

    return (
      <div className="cms-panel-stack">
        <article className="admin-panel dashboard-upload-panel year-management-panel">
          <div className="panel-heading compact-heading">
            <div>
              <h2>Registered Scouts and Scouting Years</h2>
              <p>Active year is stored centrally in Supabase and remains locked until an admin changes it.</p>
            </div>
            <span>{activeYear?.label ?? data.registrationImportSettings.scoutYear}</span>
          </div>
          <div className="year-status-grid">
            <article className="stat-card">
              <span>Active Scouting Year</span>
              <strong>{activeYear?.label ?? data.registrationImportSettings.scoutYear}</strong>
              <small>Status: Locked</small>
            </article>
            <article className="stat-card">
              <span>Current Import</span>
              <strong>{data.registrationImportSettings.excelFileName}</strong>
              <small>{data.registeredScouts.length} active scouts</small>
            </article>
          </div>
        </article>

        <article className="table-panel">
          <div className="panel-heading compact-heading">
            <div>
              <h2>Scouting Years</h2>
              <p>Create years manually. Creating or uploading to a year does not automatically activate it.</p>
            </div>
          </div>
          <table className="editable-table">
            <thead><tr><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.scoutYears ?? []).length ? data.scoutYears.map((year) => (
                <tr key={year.id}>
                  <td><strong>{year.label}</strong></td>
                  <td><StatusBadge status={year.status} /></td>
                  <td className="table-actions">
                    <button type="button" className="inline-action" disabled={year.isActive || year.status === "archived" || Boolean(uploadStatus)} onClick={() => changeActiveScoutYear(year.id)}>
                      {year.isActive ? "Active" : "Set active"}
                    </button>
                  </td>
                </tr>
              )) : <tr><td colSpan="3">No scouting years found.</td></tr>}
            </tbody>
          </table>
        </article>

        <form className="admin-panel dashboard-upload-panel year-create-form" onSubmit={createNewScoutYearOnly}>
          <h2>Create New Scouting Year</h2>
          <div className="inline-editor-grid year-name-grid">
            <label>Scouting Year Name *<input required placeholder="2026-2027" value={newScoutYearName} onChange={(event) => setNewScoutYearName(event.target.value)} /></label>
          </div>
          <button type="submit" className="primary-action" disabled={Boolean(uploadStatus)}>Create New Scouting Year</button>
        </form>

        <article className="admin-panel dashboard-upload-panel">
          <h2>Upload Registration List</h2>
          <p>Choose the target scouting year first. Uploading a list does not change the active year.</p>
          <div className="segmented-control registration-target-control">
            <button type="button" className={registrationTargetMode === "existing" ? "active" : ""} onClick={() => setRegistrationTargetMode("existing")}>Existing year</button>
            <button type="button" className={registrationTargetMode === "new" ? "active" : ""} onClick={() => setRegistrationTargetMode("new")}>Create new year</button>
          </div>
          {registrationTargetMode === "existing" ? (
            <label className="compact-field">
              Select scouting year
              <select required value={registrationYearId} onChange={(event) => setRegistrationYearId(event.target.value)}>
                {(data.scoutYears ?? []).map((year) => <option key={year.id} value={year.id}>{year.label} - {year.status}</option>)}
              </select>
            </label>
          ) : (
            <div className="inline-editor-grid year-name-grid">
              <label>Scouting Year Name *<input required placeholder="2027-2028" value={newScoutYearName} onChange={(event) => setNewScoutYearName(event.target.value)} /></label>
            </div>
          )}
          <p className="helper-text">
            Target: {registrationTargetMode === "existing" ? selectedUploadYear?.label ?? "Choose a year" : newScoutYearName.trim() || "New inactive scouting year"}. Review the import carefully because existing scouts in that target year are archived before new rows are imported.
          </p>
          <label className="compact-field">
            Excel or CSV file
            <input type="file" accept=".xlsx,.xls,.xml,.csv,.tsv,.html" onChange={handleRegistrationUpload} disabled={Boolean(uploadStatus)} />
          </label>
        </article>
      </div>
    );
  };

  const renderRules = () => (
    <div className="cms-panel-stack">
      <div className="cms-toolbar">
        <label>
          Sort names
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="schoolGrade">School grade</option>
            <option value="age">Age</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Auto-group by
          <select value={assignmentMode} onChange={(event) => setAssignmentMode(event.target.value)}>
            <option value="schoolGrade">School grade</option>
            <option value="age">Age</option>
          </select>
        </label>
        <button type="button" className="primary-action" onClick={handleSaveRules}>
          Save rules
        </button>
      </div>
      <div className="rule-grid">
        {rules.map((rule) => {
          const group = data.groups.find((item) => item.id === rule.groupId);
          return (
            <article className="rule-card" key={rule.groupId}>
              <h3>{group?.name}</h3>
              <label>
                Basis
                <select
                  value={rule.assignmentBasis}
                  onChange={(event) => updateRule(rule.groupId, "assignmentBasis", event.target.value)}
                >
                  <option value="schoolGrade">School grade</option>
                  <option value="age">Age</option>
                </select>
              </label>
              <label>
                Gender
                <select
                  value={rule.genderFilter ?? "mixed"}
                  onChange={(event) => updateRule(rule.groupId, "genderFilter", event.target.value)}
                >
                  <option value="mixed">Mixed</option>
                  <option value="male">Male only</option>
                  <option value="female">Female only</option>
                </select>
              </label>
              <div className="rule-fields">
                {[
                  ["gradeStart", "Grade from"],
                  ["gradeEnd", "Grade to"],
                  ["ageStart", "Age from"],
                  ["ageEnd", "Age to"]
                ].map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      type="number"
                      value={rule[field]}
                      onChange={(event) => updateRule(rule.groupId, field, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  const renderScouts = () => (
    <div className="cms-panel-stack">
      <div className="cms-toolbar">
        <label>
          Filter by equipe
          <select value={selectedEquipeId} onChange={(event) => setSelectedEquipeId(event.target.value)}>
            <option value="all">All Equipes</option>
            <option value="unassigned">Unassigned</option>
            {(data.equipes ?? [])
              .filter((equipe) => isAdmin || assignedGroupIds.includes(equipe.groupId))
              .map((equipe) => <option value={equipe.id} key={equipe.id}>{equipe.name}</option>)}
          </select>
        </label>
      </div>
      <form className="inline-editor-grid" onSubmit={createScout}>
        <input required placeholder="Name" value={newScout.name} onChange={(event) => setNewScout((current) => ({ ...current, name: event.target.value }))} />
        <input placeholder="School Grade" value={newScout.schoolGrade} onChange={(event) => setNewScout((current) => ({ ...current, schoolGrade: event.target.value }))} />
        <input type="number" placeholder="Age" value={newScout.age} onChange={(event) => setNewScout((current) => ({ ...current, age: event.target.value }))} />
        <select value={newScout.gender} onChange={(event) => setNewScout((current) => ({ ...current, gender: event.target.value }))}>
          <option value="">Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select value={newScout.groupId} onChange={(event) => setNewScout((current) => ({ ...current, groupId: event.target.value }))}>
          {data.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
        </select>
        <button type="submit">Add scout</button>
      </form>
      <div className="table-panel">
        <table className="editable-table">
          <thead>
            <tr>
              <th>Name</th><th>School Grade</th><th>Age</th><th>Gender</th><th>Equipe</th><th>Group</th><th>Parent</th><th>Phone</th><th>Status</th><th>Save</th>
            </tr>
          </thead>
          <tbody>
            {visibleScouts.map((scout) => {
              const edit = scoutEdits[scout.id] ?? scout;
              const setEdit = (field, value) => setScoutEdits((current) => ({ ...current, [scout.id]: { ...edit, [field]: value } }));
              return (
                <tr key={scout.id}>
                  <td><input value={edit.name ?? ""} onChange={(event) => setEdit("name", event.target.value)} /></td>
                  <td><input value={edit.schoolGrade ?? ""} onChange={(event) => setEdit("schoolGrade", event.target.value)} /></td>
                  <td><input type="number" value={edit.age ?? ""} onChange={(event) => setEdit("age", event.target.value)} /></td>
                  <td><select value={edit.gender ?? ""} onChange={(event) => setEdit("gender", event.target.value)}><option value="">Unknown</option><option value="male">Male</option><option value="female">Female</option></select></td>
                  <td>
                    <select value={edit.equipeId ?? ""} onChange={(event) => setEdit("equipeId", event.target.value || null)}>
                      <option value="">Unassigned</option>
                      {(data.equipes ?? [])
                        .filter((equipe) => equipe.groupId === edit.groupId && equipe.isActive)
                        .map((equipe) => <option value={equipe.id} key={equipe.id}>{equipe.name}</option>)}
                    </select>
                  </td>
                  <td><select value={edit.groupId} onChange={(event) => setEdit("groupId", event.target.value)}>{data.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></td>
                  <td><input value={edit.parentName ?? ""} onChange={(event) => setEdit("parentName", event.target.value)} /></td>
                  <td><input value={edit.parentPhone ?? ""} onChange={(event) => setEdit("parentPhone", event.target.value)} /></td>
                  <td><input value={edit.status ?? ""} onChange={(event) => setEdit("status", event.target.value)} /></td>
                  <td><button type="button" className="inline-action" onClick={() => saveScout(scout.id)}>Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEquipes = () => {
    const canManageEquipes = canManageEquipesForGroup(user, dashboardGroupId);
    const groupScouts = sortScouts(
      data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId),
      "name"
    );
    const filteredAssignmentScouts = filterBySearch(
      groupScouts.filter((scout) => {
        if (equipeScoutFilter === "assigned") return Boolean(scout.equipeId);
        if (equipeScoutFilter === "unassigned") return !scout.equipeId;
        return true;
      }),
      search,
      ["name"]
    );
    const isMixedGroup =
      dashboardGroup?.genderFilter === "mixed" ||
      (groupScouts.some((scout) => scout.gender === "male") && groupScouts.some((scout) => scout.gender === "female"));
    const allFilteredSelected = filteredAssignmentScouts.length > 0 && filteredAssignmentScouts.every((scout) => selectedScoutIds.includes(scout.id));
    const toggleFilteredScouts = (checked) => {
      setSelectedScoutIds((current) => {
        const currentSet = new Set(current);
        filteredAssignmentScouts.forEach((scout) => checked ? currentSet.add(scout.id) : currentSet.delete(scout.id));
        return [...currentSet];
      });
    };

    if (!canManageEquipes) {
      return (
        <AccessDenied message="Only admins, head chiefs, and vice head chiefs can manage equipes for this group." />
      );
    }

    return (
      <div className="cms-panel-stack equipe-management-redesign">
        {isEquipeActionLoading && <UploadLoadingState message="Updating equipe management..." />}
{renderCoordinatorGroupSwitcher("Manage group")}

        <article className="admin-panel equipe-zone equipe-create-zone">
          <div className="panel-heading compact-heading">
            <div>
              <h2>Create New Equipe</h2>
              <p>Add a new equipe for {dashboardGroup?.name ?? "this group"}.</p>
            </div>
            <button type="button" className="primary-action" disabled={isEquipeActionLoading} onClick={() => setIsNewEquipeOpen((current) => !current)}>
              {isNewEquipeOpen ? "Close" : "+ New Equipe"}
            </button>
          </div>
          {isNewEquipeOpen && (
            <form className="inline-editor-grid" onSubmit={createDashboardEquipe}>
              <input required disabled={isEquipeActionLoading} placeholder="Equipe name" value={newEquipe.name} onChange={(event) => setNewEquipe((current) => ({ ...current, name: event.target.value }))} />
              <input disabled={isEquipeActionLoading} placeholder="Description" value={newEquipe.description} onChange={(event) => setNewEquipe((current) => ({ ...current, description: event.target.value }))} />
              <button type="submit" disabled={isEquipeActionLoading}>{isEquipeActionLoading ? "Creating..." : "Create equipe"}</button>
            </form>
          )}
        </article>

        <section className="equipe-zone">
          <div className="section-kicker">Equipe Cards</div>
          <div className="equipe-grid">
            {visibleGroupEquipes.map((equipe) => {
              const edit = equipeEdits[equipe.id] ?? equipe;
              const equipeScouts = groupScouts.filter((scout) => scout.equipeId === equipe.id);
              const maleCount = equipeScouts.filter((scout) => scout.gender === "male").length;
              const femaleCount = equipeScouts.filter((scout) => scout.gender === "female").length;
              const isDescriptionOpen = Boolean(expandedEquipeDescriptions[equipe.id]);
              const setEdit = (field, value) => setEquipeEdits((current) => ({ ...current, [equipe.id]: { ...edit, [field]: value } }));

              return (
                <article className="admin-panel equipe-card" key={equipe.id}>
                  <div className="panel-heading">
                    <div>
                      <input className="equipe-name-input" disabled={isEquipeActionLoading} value={edit.name ?? ""} onChange={(event) => setEdit("name", event.target.value)} aria-label="Equipe name" />
                      <p>{equipeScouts.length} scouts - {maleCount} male - {femaleCount} female</p>
                    </div>
                  </div>
                  <div className="inline-editor-grid compact">
                    <label>
                      Leader
                      <select value={edit.leaderId ?? ""} disabled={isEquipeActionLoading} onChange={(event) => setEdit("leaderId", event.target.value || null)}>
                        <option value="">No leader</option>
                        {groupChiefs.map((chief) => <option value={chief.id} key={chief.id}>{chief.name}</option>)}
                      </select>
                    </label>
                    <label>
                      Co-leader
                      <select value={edit.coLeaderId ?? ""} disabled={isEquipeActionLoading} onChange={(event) => setEdit("coLeaderId", event.target.value || null)}>
                        <option value="">No co-leader</option>
                        {groupChiefs.map((chief) => <option value={chief.id} key={chief.id}>{chief.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="equipe-description-editor">
                    <button type="button" className="inline-action" onClick={() => setExpandedEquipeDescriptions((current) => ({ ...current, [equipe.id]: !current[equipe.id] }))}>
                      {isDescriptionOpen ? "Hide Description" : "Edit Description"}
                    </button>
                    {isDescriptionOpen && (
                      <textarea rows="3" disabled={isEquipeActionLoading} value={edit.description ?? ""} placeholder="Description" onChange={(event) => setEdit("description", event.target.value)} />
                    )}
                  </div>
                  <div className="table-actions">
                    <button type="button" className="inline-action" disabled={isEquipeActionLoading} onClick={() => saveDashboardEquipe(equipe.id)}>{isEquipeActionLoading ? "Saving..." : "Save"}</button>
                    <button type="button" className="inline-action danger-action" disabled={isEquipeActionLoading} onClick={() => deleteDashboardEquipe(equipe.id)}>Delete Equipe</button>
                  </div>
                </article>
              );
            })}
            {!groupEquipes.length && <article className="admin-panel"><h2>No equipes yet</h2><p>Create the first equipe for {dashboardGroup?.name ?? "this group"}.</p></article>}
          </div>
        </section>

        <article className="table-panel equipe-assignment-zone">
          <div className="panel-heading">
            <div>
              <h2>Scout Assignment Table</h2>
              <p>Search, select, and move scouts between equipes.</p>
            </div>
            <div className="table-actions">
              <button type="button" className="inline-action" disabled={isEquipeActionLoading || !selectedScoutIds.length} onClick={() => assignSelectedScouts(null)}>Move Selected to Unassigned</button>
            </div>
          </div>
          <div className="cms-toolbar equipe-assignment-toolbar">
            <label>
              Search scouts
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" />
            </label>
            <label>
              Filter
              <select value={equipeScoutFilter} disabled={isEquipeActionLoading} onChange={(event) => setEquipeScoutFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
          <table>
            <thead><tr><th><input type="checkbox" disabled={isEquipeActionLoading} checked={allFilteredSelected} onChange={(event) => toggleFilteredScouts(event.target.checked)} aria-label="Select all visible scouts" /></th><th>Scout name</th><th>Current equipe</th></tr></thead>
            <tbody>
              {filteredAssignmentScouts.length ? filteredAssignmentScouts.map((scout) => (
                <tr key={scout.id}>
                  <td><input type="checkbox" disabled={isEquipeActionLoading} checked={selectedScoutIds.includes(scout.id)} onChange={() => toggleScoutSelection(scout.id)} /></td>
                  <td>{scout.name}</td>
                  <td>
                    <select value={scout.equipeId ?? ""} disabled={isEquipeActionLoading} onChange={(event) => updateScoutEquipeAssignment(scout.id, event.target.value || null)}>
                      <option value="">Unassigned</option>
                      {groupEquipes.map((equipe) => <option value={equipe.id} key={equipe.id}>{equipe.name}</option>)}
                    </select>
                  </td>
                </tr>
              )) : <tr><td colSpan="3">No scouts match this filter.</td></tr>}
            </tbody>
          </table>
        </article>

        <article className="admin-panel automatic-assignment-zone">
          <div className="panel-heading compact-heading">
            <div>
              <h2>Automatic Assignment Tool</h2>
              <p>Gender-balancing logic is preserved while assigning scouts across equipes.</p>
            </div>
          </div>
          <div className="cms-toolbar">
            <label>
              Split mode
              <select value={autoAssignMode} disabled={isEquipeActionLoading} onChange={(event) => setAutoAssignMode(event.target.value)}>
                <option value="equal">Equal Split</option>
                <option value="custom">Custom Size per Equipe</option>
              </select>
            </label>
            {isMixedGroup && (
              <label>
                Gender balance
                <select value={genderBalance} disabled={isEquipeActionLoading} onChange={(event) => setGenderBalance(event.target.value)}>
                  <option value="auto">Auto-balance based on available scouts</option>
                  <option value="50">50% male / 50% female</option>
                  <option value="60">60% male / 40% female</option>
                  <option value="40">40% male / 60% female</option>
                </select>
              </label>
            )}
            <button type="button" className="primary-action" disabled={isEquipeActionLoading} onClick={runAutomaticAssignment}>{isEquipeActionLoading ? "Running..." : "Run Automatic Assignment"}</button>
          </div>
          {autoAssignMode === "custom" && (
            <div className="inline-editor-grid compact">
              {groupEquipes.map((equipe) => (
                <label key={equipe.id}>
                  {equipe.name}
                  <input type="number" min="0" disabled={isEquipeActionLoading} value={customEquipeSizes[equipe.id] ?? ""} onChange={(event) => setCustomEquipeSizes((current) => ({ ...current, [equipe.id]: event.target.value }))} />
                </label>
              ))}
            </div>
          )}
          {assignmentPreview && (
            <div className="assignment-preview">
              {assignmentPreview.warning && <p className="helper-text">{assignmentPreview.warning}</p>}
              <div className="equipe-grid">
                {groupEquipes.map((equipe) => {
                  const scouts = assignmentPreview.assignments[equipe.id] ?? [];
                  return (
                    <article className="admin-panel" key={equipe.id}>
                      <h3>{equipe.name}</h3>
                      <p>{scouts.length} scouts - {scouts.filter((scout) => scout.gender === "male").length} male - {scouts.filter((scout) => scout.gender === "female").length} female</p>
                      <div className="mini-list">{scouts.map((scout) => <span key={scout.id}>{scout.name}</span>)}</div>
                    </article>
                  );
                })}
              </div>
              <p className="helper-text">{assignmentPreview.unassigned.length} scouts will stay Unassigned.</p>
              <div className="action-row">
                <button type="button" className="inline-action" disabled={isEquipeActionLoading} onClick={buildRandomAssignmentPreview}>Randomize Again</button>
                <button type="button" className="primary-action" disabled={isEquipeActionLoading} onClick={() => saveAssignmentPreview()}>{isEquipeActionLoading ? "Saving..." : "Save Assignments"}</button>
                <button type="button" className="inline-action" disabled={isEquipeActionLoading} onClick={() => setAssignmentPreview(null)}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      </div>
    );
  };
  const renderAssignedGroupMultiSelect = (selectedIds, onChange) => (
    <div className="group-checkbox-grid">
      {data.groups.map((group) => (
        <label className="checkbox-chip" key={group.id}>
          <input
            type="checkbox"
            checked={(selectedIds ?? []).includes(group.id)}
            onChange={(event) => onChange(toggleAssignedGroup(selectedIds, group.id, event.target.checked))}
          />
          <span>{group.name}</span>
        </label>
      ))}
    </div>
  );

  const renderUserEditPanel = (chief, edit) => (
    <div className="user-permission-edit-panel">
      <div className="inline-editor-grid compact">
        <label>
          Name
          <input value={edit.name} onChange={(event) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, name: event.target.value }) }))} />
        </label>
        <label>
          Email
          <input value={edit.email} onChange={(event) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, email: event.target.value }) }))} />
        </label>
        <label>
          Role
          <select value={edit.role} onChange={(event) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, role: event.target.value }) }))}>
            <option value="chief">Chief</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          Level
          <select value={edit.chiefLevel ?? "chief"} onChange={(event) => setChiefLevel(chief.id, event.target.value)}>
            <option value="chief">Chief</option>
            <option value="vice">Vice head chief</option>
            <option value="head">Head chief</option>
          </select>
        </label>
        <label>
          Status
          <select value={edit.accountStatus} onChange={(event) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, accountStatus: event.target.value }) }))}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="avatar-replace-control wide-field">
          <span>Profile picture</span>
          <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "chief", chief })} />
        </label>
      </div>
      <div className="form-section-heading compact-heading">
        <h3>Assigned groups</h3>
        <p className="helper-text">One selected group behaves like a normal chief. Multiple selected groups give this chief the same view with a group selector.</p>
        {renderAssignedGroupMultiSelect(edit.assignedGroupIds, (ids) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, assignedGroupIds: ids }) })))}
      </div>
      <div className="permission-toggle-grid">
        {[
          ["canPublish", "Post/photos"],
          ["canCreateGroupMeetings", "Meetings"],
          ["canEditScouts", "Edit scouts"],
          ["manageFormTemplates", "Form templates"],
          ["postForms", "Post forms"],
          ["viewAllForms", "All responses"]
        ].map(([field, label]) => (
          <label className="checkbox-chip" key={field}>
            <input type="checkbox" checked={Boolean(edit[field])} onChange={(event) => setChiefEdits((current) => ({ ...current, [chief.id]: normalizeUserRolePayload({ ...edit, [field]: event.target.checked }) }))} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="action-row compact-actions">
        <button type="button" className="primary-action" onClick={() => saveChief(chief.id)}>Save changes</button>
        <button type="button" className="inline-action" onClick={() => setEditingUserId(null)}>Cancel</button>
      </div>
    </div>
  );

  const renderPeopleProfileEditPanel = (profile, edit) => (
    <div className="user-permission-edit-panel people-profile-editor">
      <div className="people-profile-editor-avatar">
        <UserAvatar name={edit.name || profile.name} imageUrl={edit.profilePicturePreview || edit.profilePictureUrl || profile.profilePictureUrl} size={76} />
        <label className="avatar-replace-control">
          <span>Replace profile picture</span>
          <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "chief", chief: profile })} />
        </label>
      </div>
      <div className="inline-editor-grid compact">
        <label>
          Full name
          <input value={edit.name} onChange={(event) => setChiefEdits((current) => ({ ...current, [profile.id]: { ...edit, name: event.target.value } }))} />
        </label>
        <label>
          Email address
          <input type="email" value={edit.email} onChange={(event) => setChiefEdits((current) => ({ ...current, [profile.id]: { ...edit, email: event.target.value } }))} />
        </label>
        <label>
          Account status
          <select value={edit.accountStatus} onChange={(event) => setChiefEdits((current) => ({ ...current, [profile.id]: { ...edit, accountStatus: event.target.value } }))}>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>
      <p className="helper-text">Roles, scouting assignments, teams, and access scopes are managed from the corresponding tabs in this user's access record.</p>
      <div className="action-row compact-actions">
        <button type="button" className="primary-action" onClick={() => saveChief(profile.id)}>Save profile</button>
        <button type="button" className="inline-action" onClick={() => setEditingUserId(null)}>Cancel</button>
      </div>
    </div>
  );

  const renderPeopleAccess = () => {
    const editingProfile = editingUserId ? (data.users ?? []).find((profile) => profile.id === editingUserId) : null;
    const edit = editingProfile ? (chiefEdits[editingProfile.id] ?? toChiefForm(editingProfile)) : null;
    return <>
      <PeopleAccessWorkspace
        workspace={peopleAccessWorkspace}
        loading={peopleAccessLoading}
        error={peopleAccessError}
        warning={peopleAccessWarning}
        capabilities={peopleAccessCapabilities}
        onRefresh={loadPeopleAccessWorkspace}
        onInvite={invitePeopleAccessUser}
        onLoadUser={loadPeopleAccessUser}
        onUserAction={handlePeopleAccessUserAction}
        onAssignmentChange={changePeopleAccessAssignment}
        onCreateRole={createPeopleAccessRole}
        onCreateTeam={createPeopleAccessTeam}
        onReviewDecision={decidePeopleAccessReview}
      />
      {editingProfile && edit && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingUserId(null); }}>
          <section className="profile-modal people-access-profile-modal" role="dialog" aria-modal="true" aria-labelledby="people-access-profile-title">
            <button type="button" className="modal-close-button" aria-label="Close account editor" onClick={() => setEditingUserId(null)}><X size={18} aria-hidden="true" /></button>
            <h2 id="people-access-profile-title">Edit profile & account</h2>
            <p className="helper-text">Update identity and account details. Access assignments remain separate and auditable.</p>
            {renderPeopleProfileEditPanel(editingProfile, edit)}
          </section>
        </div>
      )}
    </>;
  };

  const renderChiefs = () => (
    <div className="cms-panel-stack users-permissions-layout">
      <form className="cms-form user-permissions-form" onSubmit={createChief}>
        <div className="form-section-heading">
          <h3>Add dashboard user</h3>
          <p className="helper-text">Create admins or chiefs. Selecting multiple assigned groups gives a chief the group selector without changing the dashboard experience.</p>
        </div>
        <div className="inline-editor-grid compact">
          <label>
            Full name
            <input required placeholder="Full name" value={newChief.name} onChange={(event) => setNewChief((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Email / username
            <input required type="email" placeholder="Email / username" value={newChief.email} onChange={(event) => setNewChief((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Role
            <select value={newChief.role} onChange={(event) => setNewChief((current) => normalizeUserRolePayload({ ...current, role: event.target.value }))}>
              <option value="chief">Chief</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Level
            <select value={newChief.chiefLevel ?? "chief"} onChange={(event) => setNewChiefLevel(event.target.value)}>
              <option value="chief">Chief</option>
              <option value="vice">Vice head chief</option>
              <option value="head">Head chief</option>
            </select>
          </label>
        </div>
        <label className="profile-picture-picker">
          <span>Profile picture</span>
          <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "newChief" })} />
          <div className="profile-picture-preview">
            <UserAvatar name={newChief.name || "New user"} imageUrl={newChiefPreview} size={48} />
            {newChief.profilePictureFile ? <small>{newChief.profilePictureFile.name}</small> : <small>Preview</small>}
          </div>
          {newChief.profilePictureFile && <button type="button" className="inline-action" onClick={() => setNewChief((current) => ({ ...current, profilePictureFile: null }))}>Remove image</button>}
        </label>
        <div className="form-section-heading compact-heading">
          <h3>Assigned groups</h3>
          {renderAssignedGroupMultiSelect(newChief.assignedGroupIds, (ids) => setNewChief((current) => normalizeUserRolePayload({ ...current, assignedGroupIds: ids })))}
        </div>
        <button type="submit" className="primary-action">Add user</button>
      </form>

      <div className="user-permissions-list">
        {visibleChiefs.map((chief) => {
          const edit = chiefEdits[chief.id] ?? toChiefForm(chief);
          const assignedNames = getProfileAssignedGroupIds(chief).map((groupId) => data.groups.find((group) => group.id === groupId)?.name ?? groupId);
          return (
            <article className="admin-panel user-permission-card" key={chief.id}>
              <div className="panel-heading user-permission-row-heading">
                <div className="user-profile-cell">
                  <UserAvatar name={edit.name || chief.name} imageUrl={edit.profilePicturePreview || edit.profilePictureUrl} size={48} />
                  <div>
                    <strong>{chief.name}</strong>
                    <p>{chief.email}</p>
                    <small>{chief.role === "admin" ? "Admin" : "Chief"}{chief.chiefLevel ? ` - ${chief.chiefLevel}` : ""}</small>
                    <small>{assignedNames.length ? assignedNames.join(", ") : "No group assigned"}</small>
                  </div>
                </div>
                <div className="action-row compact-actions user-row-actions">
                  <button type="button" className="inline-action" onClick={() => startUserEdit(chief)}>Edit user</button>
                  <button type="button" className="inline-action" onClick={() => { setPasswordResetUser(chief); setEditingUserId(null); }}>Reset password</button>
                  <button type="button" className="danger-action" onClick={() => deleteChiefUser(chief)}>Delete user</button>
                </div>
              </div>
              {editingUserId === chief.id && renderUserEditPanel(chief, edit)}
            </article>
          );
        })}
      </div>
    </div>
  );
  const renderPosts = () => (
    <div className="cms-panel-stack">
      <form className="cms-form wizard-form" onSubmit={createPost}>

        <WizardStepper step={postWizardStep} />
        {editingWizardPostId && <p className="helper-text">Editing a saved draft. Review it before submitting.</p>}
        {postWizardStep === 0 && (
          <div className="wizard-panel">
            <input required placeholder="Title" value={newPost.title} onChange={(event) => setNewPost((current) => ({ ...current, title: event.target.value }))} />
            <div className="inline-editor-grid compact">
              <label>
                Type
                <select value={newPost.postType} onChange={(event) => setNewPost((current) => ({ ...current, postType: event.target.value }))}>
                  {postTypeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label>
                Category
                <select value={newPost.category} onChange={(event) => setNewPost((current) => ({ ...current, category: event.target.value }))}>
                  {postCategoryOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <textarea rows="3" placeholder="Excerpt" value={newPost.excerpt} onChange={(event) => setNewPost((current) => ({ ...current, excerpt: event.target.value }))} />
            <RichTextEditor label="Full blog content" required value={newPost.body} onChange={(value) => setNewPost((current) => ({ ...current, body: value }))} minHeight={220} placeholder="Write the full blog post with links, headings, colors, and lists..." />
          </div>
        )}
        {postWizardStep === 1 && (
          <div className="wizard-panel">
            <label className="file-picker">
              Thumbnail image
              <input type="file" accept={acceptedImageTypes} onChange={(event) => setNewPost((current) => ({ ...current, thumbnailFile: event.target.files?.[0] ?? null }))} />
            </label>
            {newPost.thumbnailFile && <span className="helper-text">{newPost.thumbnailFile.name}</span>}
            <label>Linked album<select value={newPost.albumId} onChange={(event) => setNewPost((current) => ({ ...current, albumId: event.target.value }))}><option value="">No linked album</option>{allAlbums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select></label>
            {isAdmin && <label>Status<select value={newPost.approvalStatus} onChange={(event) => setNewPost((current) => ({ ...current, approvalStatus: event.target.value }))}>{contentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
          </div>
        )}
        {postWizardStep === 2 && (
          <div className="wizard-panel">
            <h3>Review post</h3>
            <div className="approval-preview-card wizard-preview-card">
              <BlogPostPreview post={{ ...newPost, contentType: "Blog post", author: newPost.author || user?.name || "Scout Leader", authorProfilePictureUrl: user?.profilePictureUrl }} compact />
              <ReviewGrid items={[
                ["Type", newPost.postType],
                ["Category", newPost.category],
                ["Thumbnail", newPost.thumbnailFile?.name ?? (newPost.thumbnailUrl ? "Existing thumbnail" : "Not set")],
                ["Linked album", allAlbums.find((album) => album.id === newPost.albumId)?.title]
              ]} />
            </div>
          </div>
        )}
        {postWizardStep < 2 ? (
          <WizardControls step={postWizardStep} setStep={setPostWizardStep} canProceed={postWizardStep === 0 ? Boolean(newPost.title.trim() && newPost.body.trim()) : true} />
        ) : (
          <div className="wizard-actions">
            <button type="button" className="secondary-action" onClick={() => setPostWizardStep(1)}>Back</button>
            <button type="submit" className="secondary-action" value="draft" disabled={Boolean(uploadStatus)}>Save draft</button>
            <button type="submit" className="primary-action" value={isAdmin ? newPost.approvalStatus : "pending"} disabled={Boolean(uploadStatus)}>{uploadStatus ? "Working..." : isAdmin ? "Submit post" : "Send for approval"}</button>
            <button type="button" className="danger-action" disabled={Boolean(uploadStatus)} onClick={discardPostWizard}>{editingWizardPostId ? "Delete draft" : "Discard"}</button>
          </div>
        )}
      </form>
      <BlogLinksTable items={visiblePosts} onDelete={deleteBlog} refresh={refresh} canDelete={isAdmin} onEditDraft={loadPostDraftIntoWizard} />
    </div>
  );

  const renderGallery = () => (
    <div className="cms-panel-stack">
      <form className="cms-form gallery-bundle-form wizard-form" onSubmit={createGalleryAlbum}>

        <WizardStepper step={galleryWizardStep} />
        {editingWizardAlbumId && <p className="helper-text">Editing a saved album draft. Review it before submitting.</p>}
        {galleryWizardStep === 0 && (
          <div className="wizard-panel">
            <div className="segmented-choice">
              <label>
                <input type="radio" name="galleryUploadMode" checked={galleryUploadMode === "existing"} onChange={() => setGalleryUploadMode("existing")} />
                <span>Add photos to an existing album</span>
              </label>
              <label>
                <input type="radio" name="galleryUploadMode" checked={galleryUploadMode === "new"} onChange={() => setGalleryUploadMode("new")} />
                <span>Create a new album and add photos</span>
              </label>
            </div>
            {galleryUploadMode === "existing" ? (
              <label>
                Existing album
                <select required value={photoAlbumId} onChange={(event) => setPhotoAlbumId(event.target.value)}>
                  <option value="">Choose an album</option>
                  {allAlbums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}
                </select>
              </label>
            ) : (
              <div className="inline-editor-grid">
                <input required placeholder="Album title" value={newAlbum.title} onChange={(event) => setNewAlbum((current) => ({ ...current, title: event.target.value }))} />
                <input required type="date" value={newAlbum.eventDate} onChange={(event) => setNewAlbum((current) => ({ ...current, eventDate: event.target.value }))} />
                <input required placeholder="Location" value={newAlbum.location} onChange={(event) => setNewAlbum((current) => ({ ...current, location: event.target.value }))} />
                <input required placeholder="Category" value={newAlbum.category} onChange={(event) => setNewAlbum((current) => ({ ...current, category: event.target.value }))} />
                <RichTextEditor label="Album description" value={newAlbum.description} onChange={(value) => setNewAlbum((current) => ({ ...current, description: value }))} minHeight={180} placeholder="Optional formatted album description with links, lists, and emojis..." />
              </div>
            )}
          </div>
        )}
        {galleryWizardStep === 1 && (
          <div className="wizard-panel">
            {galleryUploadMode === "new" && (
              <>
                <label className="file-picker">
                  Album thumbnail
                  <input required type="file" accept={acceptedImageTypes} onChange={(event) => setAlbumThumbnailFile(event.target.files?.[0] ?? null)} />
                </label>
                {albumThumbnailFile && <span className="helper-text">{albumThumbnailFile.name}</span>}
                {isAdmin && <label>Status<select value={newAlbum.approvalStatus} onChange={(event) => setNewAlbum((current) => ({ ...current, approvalStatus: event.target.value }))}>{contentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
              </>
            )}
            <label className="file-picker">
              Choose photos
              <input type="file" accept={acceptedImageTypes} multiple onChange={(event) => {
                appendPhotoFiles(event.target.files);
                event.target.value = "";
              }} />
            </label>
            <div className="upload-preview image-upload-list">
              {photoFiles.map((file) => (
                <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                  {file.name}
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeSelectedPhotoFile(file)}>Remove</button>
                </span>
              ))}
              {!photoFiles.length && <small>No photos selected yet.</small>}
            </div>
            {photoUploadProgress.total > 0 && (
              <div className="upload-progress" aria-label="Photo upload progress">
                <div><span style={{ width: `${photoUploadProgress.percent}%` }} /></div>
                <strong>{photoUploadProgress.percent}%</strong>
                <small>{photoUploadProgress.completed} of {photoUploadProgress.total} photos uploaded</small>
              </div>
            )}
          </div>
        )}
        {galleryWizardStep === 2 && (
          <div className="wizard-panel">
            <h3>Review album</h3>
            <div className="approval-preview-card wizard-preview-card photo-batch-preview">
              <div className="preview-event-meta">
                <span>{galleryUploadMode === "new" ? "New album" : "Existing album"}</span>
                <span>{galleryUploadMode === "new" ? newAlbum.title : allAlbums.find((album) => album.id === photoAlbumId)?.title}</span>
                <span>{photoFiles.length} photo{photoFiles.length === 1 ? "" : "s"} selected</span>
              </div>
              <FormattedText text={newAlbum.description} fallback="No description added yet." />
              <ReviewGrid items={[
                ["Date", newAlbum.eventDate],
                ["Location", newAlbum.location],
                ["Category", newAlbum.category],
                ["Thumbnail", albumThumbnailFile?.name ?? (editingWizardAlbumId ? "Existing thumbnail" : "Not set")]
              ]} />
              <div className="upload-preview image-upload-list">
                {photoFiles.slice(0, 8).map((file) => <span key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</span>)}
                {!photoFiles.length && <small>No new photos selected.</small>}
              </div>
            </div>
          </div>
        )}
        {galleryWizardStep < 2 ? (
          <WizardControls
            step={galleryWizardStep}
            setStep={setGalleryWizardStep}
            isSubmitting={Boolean(uploadStatus)}
            canProceed={galleryWizardStep === 0 ? (galleryUploadMode === "existing" ? Boolean(photoAlbumId) : Boolean(newAlbum.title.trim() && newAlbum.eventDate && newAlbum.location.trim() && newAlbum.category.trim())) : galleryWizardStep === 1 ? Boolean((photoFiles.length || editingWizardAlbumId) && (galleryUploadMode === "existing" || albumThumbnailFile || editingWizardAlbumId)) : true}
          />
        ) : (
          <div className="wizard-actions">
            <button type="button" className="secondary-action" onClick={() => setGalleryWizardStep(1)}>Back</button>
            <button type="submit" className="secondary-action" value="draft" disabled={Boolean(uploadStatus)}>Save draft</button>
            <button type="submit" className="primary-action" value={isAdmin ? newAlbum.approvalStatus : "pending"} disabled={Boolean(uploadStatus)}>{uploadStatus ? "Working..." : "Submit album/photos"}</button>
            <button type="button" className="danger-action" disabled={Boolean(uploadStatus)} onClick={discardGalleryWizard}>{editingWizardAlbumId ? "Delete draft" : "Discard"}</button>
          </div>
        )}
      </form>
      <AlbumLinksTable items={visibleAlbums} onDelete={deleteAlbum} refresh={refresh} canDelete={isAdmin} onEditDraft={loadAlbumDraftIntoWizard} />
    </div>
  );

  const renderPhotos = () => (
    <form className="cms-form" onSubmit={uploadPhotos}>
      <h2>Upload photos</h2>
      <select value={photoAlbumId} onChange={(event) => setPhotoAlbumId(event.target.value)}>{allAlbums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select>
      <label className="file-picker">Choose photos<input type="file" accept={acceptedImageTypes} multiple onChange={(event) => setPhotoFiles([...event.target.files])} /></label>
      <div className="upload-preview">{photoFiles.map((file) => <span key={file.name}>{file.name}</span>)}</div>
      {photoUploadProgress.total > 0 && (
        <div className="upload-progress" aria-label="Photo upload progress">
          <div><span style={{ width: `${photoUploadProgress.percent}%` }} /></div>
          <strong>{photoUploadProgress.percent}%</strong>
          <small>{photoUploadProgress.completed} of {photoUploadProgress.total} photos uploaded</small>
        </div>
      )}
      <button type="submit" disabled={!photoFiles.length || !photoAlbumId}>Upload selected photos</button>
    </form>
  );


  const renderDocuments = () => (
    <section className="settings-workspace documents-workspace">
      <div className="cms-panel-stack">
        <article className="admin-panel dashboard-upload-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Documents</p>
              <h2>Shared Dashboard Documents</h2>
              <p>Admins manage files and categories. Chiefs can view, preview, and download approved documents.</p>
            </div>
            {isAdmin && <label className="primary-action document-upload-button"><Upload size={17} />Upload files<input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={uploadDocuments} /></label>}
          </div>
          {uploadStatus && <UploadLoadingState message={uploadStatus} />}
          {isAdmin && (
            <div className="documents-admin-grid">
              <div className="cms-toolbar">
                <label>
                  Upload category
                  <select value={documentUploadCategoryId} onChange={(event) => setDocumentUploadCategoryId(event.target.value)}>
                    <option value="">Uncategorized</option>
                    {(data.documentCategories ?? []).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
              </div>
              <form className="cms-toolbar" onSubmit={(event) => { event.preventDefault(); createOrUpdateDocumentCategory(); }}>
                <label>
                  New category
                  <input value={documentCategoryName} onChange={(event) => setDocumentCategoryName(event.target.value)} placeholder="Meeting forms, camp files..." />
                </label>
                <button type="submit" className="inline-action"><Plus size={16} />Add</button>
              </form>
            </div>
          )}
          <div className="documents-category-row">
            <button type="button" className={selectedDocumentCategory === "all" ? "active" : ""} onClick={() => setSelectedDocumentCategory("all")}>All</button>
            <button type="button" className={selectedDocumentCategory === "uncategorized" ? "active" : ""} onClick={() => setSelectedDocumentCategory("uncategorized")}>Uncategorized</button>
            {(data.documentCategories ?? []).map((category) => (
              <span className="document-category-chip" key={category.id}>
                <button type="button" className={selectedDocumentCategory === category.id ? "active" : ""} onClick={() => setSelectedDocumentCategory(category.id)}>{category.name}</button>
                {isAdmin && <button type="button" className="icon-button" title="Rename category" onClick={() => createOrUpdateDocumentCategory(category)}>Edit</button>}
                {isAdmin && <button type="button" className="icon-button danger-action" title="Delete category" onClick={() => removeDocumentCategory(category)}><Trash2 size={15} /></button>}
              </span>
            ))}
          </div>
        </article>
        <div className="documents-grid">
          {visibleDocuments.length ? visibleDocuments.map((document) => {
            const edit = documentEdits[document.id] ?? document;
            const isPdf = document.fileType === "pdf" || document.mimeType === "application/pdf";
            const setEdit = (field, value) => setDocumentEdits((current) => ({ ...current, [document.id]: { ...edit, [field]: value } }));
            return (
              <article className="document-card" key={document.id}>
                <div className="document-card-icon"><FileText size={26} /></div>
                {isAdmin ? (
                  <>
                    <input value={edit.title ?? ""} onChange={(event) => setEdit("title", event.target.value)} />
                    <select value={edit.categoryId ?? ""} onChange={(event) => setEdit("categoryId", event.target.value)}>
                      <option value="">Uncategorized</option>
                      {(data.documentCategories ?? []).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                  </>
                ) : <h3>{document.title}</h3>}
                <p>{document.fileName}</p>
                <div className="document-meta-row"><span>{document.categoryName}</span><span>{document.fileType?.toUpperCase()}</span><span>{formatFileSize(document.fileSize)}</span></div>
                <small>Uploaded {formatDubaiDateTime(document.createdAt)}</small>
                <div className="action-row">
                  {isPdf && <button type="button" className="inline-action" onClick={() => setDocumentPreview(document)}><Eye size={16} />Preview</button>}
                  <a className="inline-action" href={document.fileUrl} target="_blank" rel="noreferrer"><Download size={16} />Download</a>
                  {isAdmin && <button type="button" className="inline-action" onClick={() => updateDocument(document)}>Save</button>}
                  {isAdmin && <button type="button" className="inline-action danger-action" onClick={() => deleteDocument(document)}><Trash2 size={16} />Delete</button>}
                </div>
              </article>
            );
          }) : <article className="admin-panel dashboard-upload-panel empty-state"><h3>No documents found</h3><p>Uploaded documents will appear here after they are approved and categorized.</p></article>}
        </div>
      </div>
      {documentPreview && (
        <div className="approval-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDocumentPreview(null); }}>
          <article className="approval-review-modal document-preview-modal" role="dialog" aria-modal="true">
            <div className="approval-modal-header"><div><p className="eyebrow">PDF preview</p><h2>{documentPreview.title}</h2></div><button type="button" className="modal-close-button" onClick={() => setDocumentPreview(null)}><X size={18} /></button></div>
            <iframe title={documentPreview.title} src={documentPreview.fileUrl} />
          </article>
        </div>
      )}
    </section>
  );

  const renderReports = () => {
    if (!isAdmin) return <AccessDenied message="Reports are admin-only because they include approval and system activity history." />;
    const rows = reportTab === "approvals"
      ? reportApprovalRows
      : reportTab === "activity"
        ? reportActivityRows
        : reportAuthorizationRows;
    const visibleRows = filterBySearch(
      rows,
      search,
      reportTab === "approvals"
        ? ["type", "title", "status", "submittedBy", "createdAt", "updatedAt"]
        : reportTab === "activity"
          ? ["action", "entityType", "entityId", "actor", "createdAt", "details"]
          : ["user", "module", "permissionKey", "legacyResult", "normalizedResult", "scope", "reason", "createdAt", "status"]
    );
    return (
      <section className="settings-workspace reports-workspace">
        <article className="admin-panel dashboard-upload-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Reports</p><h2>Approval and Activity History</h2><p>Read-only reporting for review decisions and important dashboard actions.</p></div>
            <button type="button" className="inline-action" onClick={() => downloadCsvFile(`${reportTab}-report.csv`, visibleRows)}>Export CSV</button>
          </div>
          <div className="approval-type-tabs" role="tablist" aria-label="Report tabs">
            <button type="button" className={reportTab === "approvals" ? "active" : ""} onClick={() => setReportTab("approvals")}>Approval History</button>
            <button type="button" className={reportTab === "activity" ? "active" : ""} onClick={() => setReportTab("activity")}>Activity Log</button>
            <button type="button" className={reportTab === "authorization" ? "active" : ""} onClick={() => setReportTab("authorization")}>Access Migration</button>
          </div>
          {reportsLoading && <UploadLoadingState message="Loading reports..." />}
          {reportsError && <p className="form-error">{reportsError}</p>}
          {reportTab === "authorization" && <div className="authorization-review-heading"><h3>Authorization migration review</h3><p>Read-only differences between legacy and normalized access. No access changes can be made here.</p></div>}
          <div className="table-panel reports-table-panel">
            <table>
              <thead>{reportTab === "approvals" ? <tr><th>Type</th><th>Title</th><th>Status</th><th>Submitted by</th><th>Created</th><th>Updated</th></tr> : reportTab === "activity" ? <tr><th>Action</th><th>Entity</th><th>Actor</th><th>Created</th><th>Details</th></tr> : <tr><th>User</th><th>Permission</th><th>Legacy</th><th>Normalized</th><th>Scope</th><th>Reason</th><th>Created</th><th>Status</th></tr>}</thead>
              <tbody>
                {visibleRows.length ? visibleRows.map((row, index) => reportTab === "approvals" ? (
                  <tr key={`${row.type}-${row.title}-${index}`}><td>{row.type}</td><td>{row.title}</td><td><StatusBadge status={row.status} /></td><td>{row.submittedBy}</td><td>{row.createdAt}</td><td>{row.updatedAt}</td></tr>
                ) : reportTab === "activity" ? (
                  <tr key={`${row.action}-${row.entityId}-${index}`}><td>{row.action}</td><td>{row.entityType}<small>{row.entityId}</small></td><td>{row.actor}</td><td>{row.createdAt}</td><td><code>{row.details}</code></td></tr>
                ) : (
                  <tr key={`${row.user}-${row.permissionKey}-${index}`}><td>{row.user}</td><td><strong>{row.permissionKey}</strong><small>{row.module}</small></td><td>{row.legacyResult}</td><td>{row.normalizedResult}</td><td>{row.scope}</td><td>{row.reason}</td><td>{row.createdAt}</td><td><StatusBadge status={row.status} /></td></tr>
                )) : <tr><td colSpan={reportTab === "authorization" ? 8 : 6}>No report rows match this view.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    );
  };

  const renderArchives = () => {
    const visibleArchives = filterBySearch(data.archivedYears ?? [], search, ["label", "archivedAt"]);
    const archiveEvents = filterBySearch(selectedArchive?.snapshot?.events ?? [], search, ["title", "date", "dateFrom", "dateTo"]);
    const archivePosts = filterBySearch(selectedArchive?.snapshot?.posts ?? [], search, ["title", "date", "author"]);
    const archiveAlbums = filterBySearch(selectedArchive?.snapshot?.albums ?? [], search, ["title", "location", "category"]);

    return <section className="settings-workspace archives-workspace">
      <div className="cms-panel-stack">
        <article className="admin-panel dashboard-upload-panel archive-banner">
          <div className="panel-heading">
            <div><p className="eyebrow">Archived Years</p><h2>Read-only scouting year snapshots</h2><p>Archives preserve the state of events, attendance, posts, and albums without changing live dashboard data.</p></div>
            {isAdmin && <button type="button" className="primary-action" disabled={Boolean(uploadStatus)} onClick={createArchiveSnapshot}>Create snapshot</button>}
          </div>
          {isAdmin && <label>Scouting year<select value={archiveYearId || data.activeScoutYearId || ""} onChange={(event) => setArchiveYearId(event.target.value)}>{(data.scoutYears ?? []).map((year) => <option value={year.id} key={year.id}>{year.label}{year.isActive ? " (active)" : ""}</option>)}</select></label>}
        </article>
        <div className="archive-layout">
          <aside className="archive-list">
            {visibleArchives.length ? visibleArchives.map((archive) => (
              <button type="button" key={archive.id} className={selectedArchive?.id === archive.id ? "active" : ""} onClick={() => setSelectedArchiveId(archive.id)}>
                <strong>{archive.label}</strong>
                <span>{formatDubaiDateTime(archive.archivedAt)}</span>
              </button>
            )) : <p className="empty-state">No archived years yet.</p>}
          </aside>
          {selectedArchive ? (
            <article className="admin-panel archive-detail-panel">
              <div className="read-only-banner">Read-only archive. Live data is untouched.</div>
              <div className="panel-heading"><div><h2>{selectedArchive.label}</h2><p>Archived {formatDubaiDateTime(selectedArchive.archivedAt)}</p></div>{isAdmin && <button type="button" className="inline-action danger-action" onClick={() => deleteArchiveSnapshot(selectedArchive)}>Delete archive</button>}</div>
              <div className="summary-card-grid archive-summary-grid">
                {summarizeArchiveSnapshot(selectedArchive.snapshot).map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}
              </div>
              <div className="archive-content-grid">
                <section><h3>Events</h3>{archiveEvents.slice(0, 8).map((event) => <p key={event.id}>{event.title} <small>{event.dateFrom ?? event.date}</small></p>)}</section>
                <section><h3>Posts</h3>{archivePosts.slice(0, 8).map((post) => <p key={post.id}>{post.title} <small>{post.date}</small></p>)}</section>
                <section><h3>Albums</h3>{archiveAlbums.slice(0, 8).map((album) => <p key={album.id}>{album.title} <small>{album.photoCount ?? 0} photos</small></p>)}</section>
              </div>
            </article>
          ) : <article className="admin-panel dashboard-upload-panel"><h3>Select an archive</h3><p>Archived snapshots will appear here after an admin creates one.</p></article>}
        </div>
      </div>
    </section>;
  };
  const renderSettings = () => (
    <section className="settings-detail">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>{settingSections.find(([id]) => id === activeSetting)?.[1]}</h2>
          <p>{settingSections.find(([id]) => id === activeSetting)?.[3]}</p>
        </div>
      </div>
      <div className="settings-card-grid">
        {settingSections.map(([id, label, Icon, description]) => (
          <button type="button" key={id} className={activeSetting === id ? "active" : ""} onClick={() => { setActiveSetting(id); setActiveSection(id); }}>
            <span><Icon size={20} aria-hidden="true" /></span>
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      {activeSetting === "usersPermissions" && renderPeopleAccess()}
      {activeSetting === "upload" && renderUpload()}
      {activeSetting === "rules" && renderRules()}
      {activeSetting === "websiteContent" && renderWebsiteContent()}
      {activeSetting === "faqs" && renderFaqs()}
      {activeSetting === "documents" && renderDocuments()}
      {activeSetting === "reports" && renderReports()}
      {activeSetting === "archives" && renderArchives()}
    </section>
  );

  const renderApprovalPreviewContent = () => {
    if (!selectedApproval) {
      return null;
    }

    return (
      <div className="approval-preview-card approval-modal-card">
        {selectedApproval.contentType === "Blog post" && (
          <BlogPostPreview post={{ ...selectedApproval, author: selectedApproval.author || getSubmitterName(selectedApproval), authorProfilePictureUrl: selectedApproval.authorProfilePictureUrl || getSubmitterPicture(selectedApproval) }} compact />
        )}
        {selectedApproval.currentVersion && (
          <div className="comparison-grid">
            <article>
              <span>Current Published Version</span>
              <strong>{selectedApproval.currentVersion.title}</strong>
              <FormattedText text={selectedApproval.currentVersion.excerpt ?? selectedApproval.currentVersion.location ?? ""} />
            </article>
            <article>
              <span>Proposed Changes</span>
              <strong>{selectedApproval.title}</strong>
              <FormattedText text={selectedApproval.excerpt ?? selectedApproval.location ?? selectedApproval.description ?? ""} />
            </article>
          </div>
        )}
        {selectedApproval.contentType === "Profile change" && (
          <div className="profile-change-preview">
            <div>
              <span>Current</span>
              <UserAvatar name={selectedApproval.name} imageUrl={selectedApproval.profilePictureUrl} size={58} />
              <strong>{selectedApproval.name}</strong>
            </div>
            <div>
              <span>Requested</span>
              <UserAvatar name={selectedApproval.pendingName ?? selectedApproval.name} imageUrl={selectedApproval.pendingProfilePictureUrl ?? selectedApproval.profilePictureUrl} size={58} />
              <strong>{selectedApproval.pendingName ?? selectedApproval.name}</strong>
            </div>
          </div>
        )}
        {selectedApproval.contentType === "Calendar event" && (
          <div className="preview-event-meta">
            <span>{selectedApproval.dateFrom ?? selectedApproval.date}</span>
            <span>{selectedApproval.startTime || "No start time"}</span>
            <span>{selectedApproval.visibility}</span>
          </div>
        )}
        {selectedApproval.contentType === "Posted form" && (
          <div className="forms-approval-preview">
            <FormPreview form={selectedApproval} disabled />
          </div>
        )}
        {selectedApproval.contentType === "Website Content" && (
          <div className="website-revision-preview">
            <p className="eyebrow">{selectedApproval.pageKey} page</p>
            {Object.values(selectedApproval.proposedData ?? {}).map(renderWebsiteChangeComparison)}
          </div>
        )}        {selectedApproval.contentType === "Album" && (
          <div className="photo-batch-preview">
            <div className="preview-event-meta">
              <span>{selectedApproval.eventDate || "No date"}</span>
              <span>{selectedApproval.location || "No location"}</span>
              <span>{selectedApproval.photoCount ?? selectedApproval.photos?.length ?? 0} photos</span>
            </div>
            <FormattedText text={selectedApproval.description} fallback="No description added yet." />
            <div className="approval-photo-grid">
              {(selectedApproval.photos ?? []).slice(0, 6).map((photo) => (
                <div key={photo.id}>
                  {photo.thumbnailUrl || photo.url ? <img src={photo.thumbnailUrl ?? photo.url} alt="" /> : <span>Photo</span>}
                </div>
              ))}
              {!(selectedApproval.photos ?? []).length && <div><span>No photos yet</span></div>}
            </div>
          </div>
        )}
        {selectedApproval.contentType === "Photo" && (
          <div className="approval-photo-preview">
            {selectedApproval.url ? <img src={selectedApproval.url} alt="" /> : <span>No image preview</span>}
          </div>
        )}
        {selectedApproval.contentType === "Photo batch" && (
          <div className="photo-batch-preview">
            <div className="preview-event-meta">
              <span>{selectedApproval.albumTitle}</span>
              <span>{selectedApproval.photoCount} photos</span>
              <span>{selectedApproval.approvalStatus}</span>
            </div>
            <div className="album-admin-actions compact">
              <span>{selectedApprovalPhotoIds.length} selected</span>
              <button type="button" className="inline-action" onClick={() => setSelectedApprovalPhotoIds((selectedApproval.photos ?? []).map((photo) => photo.id))}>Select all</button>
              <button type="button" className="inline-action" onClick={() => setSelectedApprovalPhotoIds([])}>Clear</button>
              <button type="button" className="inline-action danger-action" disabled={!selectedApprovalPhotoIds.length} onClick={removeSelectedApprovalPhotos}>Remove selected</button>
            </div>
            <div className="preview-activity-grid">
              {(selectedApproval.photos ?? []).slice(0, 12).map((photo) => (
                <div key={photo.id} className={selectedApprovalPhotoIds.includes(photo.id) ? "selected-preview-photo" : ""}>
                  <label className="photo-select-checkbox">
                    <input type="checkbox" checked={selectedApprovalPhotoIds.includes(photo.id)} onChange={() => toggleApprovalPhoto(photo.id)} />
                    <span>Select</span>
                  </label>
                  {photo.thumbnailUrl || photo.url ? <img src={photo.thumbnailUrl ?? photo.url} alt="" /> : <span>Photo</span>}
                </div>
              ))}
              {!(selectedApproval.photos ?? []).length && <div><span>No photos in this batch</span></div>}
            </div>
          </div>
        )}
        {selectedApproval.contentType !== "Blog post" && (
          <FormattedText text={selectedApproval.body ?? selectedApproval.excerpt ?? selectedApproval.description ?? selectedApproval.location} fallback="No preview text provided." />
        )}
        <dl className="approval-details">
          <div><dt>Submitted by</dt><dd><span className="approval-submitter"><UserAvatar name={getSubmitterName(selectedApproval)} imageUrl={getSubmitterPicture(selectedApproval)} size={30} />{getSubmitterName(selectedApproval)}</span></dd></div>
          <div><dt>Created</dt><dd>{formatDubaiDateTime(selectedApproval.createdAt)}</dd></div>
          <div><dt>Updated</dt><dd>{formatDubaiDateTime(selectedApproval.updatedAt)}</dd></div>
        </dl>
      </div>
    );
  };

  const renderApprovals = () => (
    <div className="approval-workspace approval-list-only">
      <div className="table-panel approval-table-panel">
        <div className="panel-heading">
          <div>
            <h2>Content Review Queue</h2>
            <p>Search and filter submitted posts, albums, and calendar events across every approval status.</p>
          </div>
          <span>{pendingItems.length} waiting</span>
        </div>
        <div className="approval-type-tabs" role="tablist" aria-label="Approval types">
          {["all", "Blog post", "Album", "Calendar event", "Posted form", "Website Content", "Photo batch", "Photo", "Profile change"].map((type) => {
            const count = [...reviewItems, ...profileReviewItems].filter((item) => (type === "all" || item.contentType === type) && ["pending", "pending_update", "needs_changes"].includes(item.approvalStatus)).length;
            return (
              <button type="button" key={type} className={approvalTypeFilter === type ? "active" : ""} onClick={() => setApprovalTypeFilter(type)}>
                <span>{type === "all" ? "All" : type.replace("Calendar event", "Events").replace("Blog post", "Blogs").replace("Posted form", "Forms").replace("Profile change", "Profiles")}</span>
                {count > 0 && <small>{count}</small>}
              </button>
            );
          })}
        </div>
        <table>
          <thead><tr><th>Type</th><th>Title</th><th>Status</th><th>Submitted by</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleApprovalItems.length ? visibleApprovalItems.map((item) => (
              <tr key={`${item.contentType}-${item.id}`}>
                <td>{item.contentType}</td>
                <td>{item.title}</td>
                <td><StatusBadge status={item.approvalStatus} /></td>
                <td><span className="approval-submitter"><UserAvatar name={getSubmitterName(item)} imageUrl={getSubmitterPicture(item)} size={28} />{getSubmitterName(item)}</span></td>
                <td>{formatDubaiDateTime(getReviewTimestamp(item))}</td>
                <td className="table-actions">
                  <button type="button" className="inline-action" onClick={() => {
                    setSelectedApproval(item);
                    setSelectedApprovalPhotoIds([]);
                    setApprovalComment(item.reviewerComment ?? "");
                  }}>
                    Preview
                  </button>
                </td>
              </tr>
            )) : <tr><td colSpan="6">No approval requests match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {selectedApproval && (
        <div className="approval-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedApproval(null); }}>
          <article className="approval-review-modal" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title">
            <div className="approval-modal-header">
              <div>
                <p className="eyebrow">{selectedApproval.contentType}</p>
                <h2 id="approval-modal-title">{selectedApproval.title}</h2>
              </div>
              <div className="approval-modal-header-actions">
                <StatusBadge status={selectedApproval.approvalStatus} />
                <button type="button" className="modal-close-button" aria-label="Close preview" onClick={() => setSelectedApproval(null)}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="approval-modal-body">
              {renderApprovalPreviewContent()}
              {selectedApproval.contentType === "Posted form" ? (
                <div className="approval-comment-box">
                  <RichTextEditor label="Review comments" value={approvalComment} onChange={setApprovalComment} minHeight={120} placeholder="Explain what changed, why it was rejected, or what the chief should edit." />
                </div>
              ) : (
                <label className="approval-comment-box">
                  Review comments
                  <textarea
                    rows="4"
                    placeholder="Explain what changed, why it was rejected, or what the chief should edit."
                    value={approvalComment}
                    onChange={(event) => setApprovalComment(event.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="approval-modal-footer">
              <button type="button" className="inline-action" onClick={() => saveApprovalDecision(selectedApproval, "approved")}>Approve</button>
              <button type="button" className="inline-action" onClick={() => saveApprovalDecision(selectedApproval, "needs_changes")}>Send Back</button>
              <button type="button" className="inline-action danger-action" onClick={() => saveApprovalDecision(selectedApproval, "rejected")}>Reject</button>
              <button type="button" className="inline-action danger-action" onClick={() => saveApprovalDecision(selectedApproval, "archived")}>Archive</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );

  const renderAiAssistant = () => (
    <section className="ai-assistant-placeholder" aria-labelledby="ai-assistant-title">
      <article className="ai-assistant-card">
        <div className="ai-assistant-icon" aria-hidden="true">
          <Sparkles size={34} />
        </div>
        <span className="coming-soon-badge">Coming Soon</span>
        <h2 id="ai-assistant-title">AI Assistant</h2>
        <p>Future support for quick dashboard answers, summaries, and guidance for Chiefs, Coordinators, and Admins will live here.</p>
        <div className="ai-assistant-disabled-input" aria-hidden="true">Coming soon...</div>
      </article>
    </section>
  );
  const renderSection = () => {
    if (activeSection === "usersPermissions" ? !canViewPeopleAccess : !canOpenSection(activeSection, user)) {
      return <AccessDenied />;
    }
    if (activeSection === "overview") return renderOverview();
    if (activeSection === "aiAssistant") return renderAiAssistant();
    if (activeSection === "myGroup") return renderMyGroup();
    if (activeSection === "websiteContent") return renderWebsiteContent();
    if (activeSection === "upload") return renderUpload();
    if (activeSection === "rules") return renderRules();
    if (activeSection === "scouts") return renderScouts();
    if (activeSection === "equipes") return renderEquipes();
    if (activeSection === "usersPermissions") return renderPeopleAccess();
    if (activeSection === "posts") return renderPosts();
    if (activeSection === "gallery") return renderGallery();
    if (activeSection === "faqs") return renderFaqs();
    if (activeSection === "contactMessages") return renderContactMessages();
    if (activeSection === "notifications") return renderNotifications();
    if (activeSection === "approvals") return renderApprovals();
    if (activeSection === "scoutAttendance") return <><div className="cms-panel-stack">{renderCoordinatorGroupSwitcher("Take attendance for group")}</div><ScoutAttendanceManager dataOverride={data} userOverride={scopedUser} searchQuery={search} /></>;
    if (activeSection === "attendanceSheets") return <><div className="cms-panel-stack">{renderCoordinatorGroupSwitcher("View attendance for group")}</div><AttendanceSheetsManager dataOverride={data} userOverride={scopedUser} searchQuery={search} /></>;
    if (activeSection === "chiefAttendance") return <><div className="cms-panel-stack">{renderCoordinatorGroupSwitcher("Take chief attendance for group")}</div><ChiefAttendanceManager dataOverride={data} userOverride={scopedUser} searchQuery={search} /></>;
    if (["manageForms", "formsCreate", "formTemplates", "postedForms", "formResponses", "myForms", "myFormDrafts", "mySubmittedForms"].includes(activeSection)) {
      return <FormsDashboard data={data} user={scopedUser} isAdmin={isAdmin} mode={activeSection} initialFormId={requestedFormId} onRefresh={refresh} setSaveMessage={setSaveMessage} searchQuery={search} />;
    }
    if (activeSection === "calendar") return <CalendarManagement dataOverride={data} userOverride={scopedUser} searchQuery={search} />;
    if (activeSection === "reports") return renderReports();
    if (activeSection === "documents") return renderDocuments();
    if (activeSection === "archives") return renderArchives();
    return <EmptyAdminSection title={selectedSection?.[1] ?? "Section"} />;
  };

  const activeTitle = selectedSection?.[1] ?? "Admin";
  const mobilePrimaryIds = ["overview", "scoutAttendance", "aiAssistant", "myForms"];
  const mobilePrimaryItems = mobilePrimaryIds.map((id) => flatSidebarItems.find(([itemId]) => itemId === id)).filter(Boolean).slice(0, 4);
  const mobilePrimaryIdSet = new Set(mobilePrimaryItems.map(([id]) => id));
  const mobileMoreItems = flatSidebarItems.filter(([id]) => !mobilePrimaryIdSet.has(id));
  const hasMobileMoreItems = mobileMoreItems.length > 0;
  const isMobilePrimaryActive = (id) => activeSection === id;
  const mobileTabCount = mobilePrimaryItems.length + (hasMobileMoreItems ? 1 : 0);
  const activeMobileTabIndex = (() => {
    const primaryIndex = mobilePrimaryItems.findIndex(([id]) => isMobilePrimaryActive(id));
    if (primaryIndex >= 0) return primaryIndex;
    if (isMobileMoreOpen || mobileMoreItems.some(([id]) => id === activeSection)) return mobilePrimaryItems.length;
    return 0;
  })();
  const triggerMobileNavPress = () => {
    if (window.matchMedia("(max-width: 768px)").matches) navigator.vibrate?.(8);
  };
  const visibleNotificationItems = activeNotificationItems.slice(0, 8);

  const dashboardTopbar = (
    <div className="dashboard-topbar">
      <div className="dashboard-topbar-brand-group">
        <button type="button" className="dashboard-shell-toggle" onClick={toggleSidebarMode} title={sidebarMode === "expanded" ? "Collapse sidebar" : "Expand sidebar"} aria-label={sidebarMode === "expanded" ? "Collapse sidebar" : "Expand sidebar"}>
          {sidebarMode === "expanded" ? <PanelLeftClose size={19} aria-hidden="true" /> : <PanelLeftOpen size={19} aria-hidden="true" />}
        </button>
        <Link className="dashboard-wordmark" to="/" title="Back to website" aria-label="Back to website">
          <img src={scoutLogo} alt="" />
          <span>St. Mary's Scouts</span>
        </Link>
      </div>
      <div className="dashboard-topbar-title-group">
        <strong className="dashboard-topbar-title">{activeTitle}</strong>
      </div>
      <button type="button" className="dashboard-mobile-search-toggle" aria-label="Search current section" aria-expanded={isMobileSearchOpen} onClick={() => setIsMobileSearchOpen((current) => !current)}><Search size={18} aria-hidden="true" /></button>
      <div className={`dashboard-topbar-search ${isMobileSearchOpen ? "open" : ""}`}>
        <input placeholder="Search current section" value={search} onChange={(event) => setSearch(event.target.value)} />
        {[
          "posts",
          "gallery",
          "approvals",
          "contactMessages"
        ].includes(activeSection) && (
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {(activeSection === "contactMessages"
              ? ["new", "read", "replied", "archived"]
              : contentStatuses
            ).map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        )}
      </div>
      <div className="dashboard-topbar-actions">
        <button type="button" className="dashboard-theme-toggle" onClick={() => setDashboardTheme((current) => current === "dark" ? "light" : "dark")} title={dashboardTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={dashboardTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dashboardTheme === "dark"}>
          {dashboardTheme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
        <div className="dashboard-notification-menu">
          <button type="button" className="dashboard-notification-button" onClick={() => { setIsNotificationsOpen((current) => !current); setIsProfileMenuOpen(false); }} title={canOpenSection("approvals", user) ? "Pending approvals" : "My pending work"} aria-expanded={isNotificationsOpen} aria-haspopup="menu">
            <Bell size={18} aria-hidden="true" />
            {dashboardNotificationCount > 0 && <small>{dashboardNotificationCount}</small>}
          </button>
          {isNotificationsOpen && (
            <div className="dashboard-notification-dropdown" role="menu">
              <div className="notification-dropdown-header">
                <div><strong>Notifications</strong><span>{dashboardNotificationCount}</span></div>
                <div className="notification-dropdown-actions"><button type="button" className="inline-action" onClick={async () => { await readAllDashboardNotifications(); await refresh(); }}>Mark all read</button><button type="button" className="icon-button notification-mobile-close" aria-label="Close notifications" onClick={() => setIsNotificationsOpen(false)}><X size={18} /></button></div>
              </div>
              {visibleNotificationItems.length ? visibleNotificationItems.map((item) => (
                <button type="button" className={`notification-row ${item.isRead ? "" : "unread"}`} key={item.id ?? `${item.contentType}-${item.entityId ?? item.title}`} onClick={() => openNotification(item)}>
                  <span className="notification-type-icon">{notificationIcon(item, 17)}</span>
                  <span><strong>{item.title || item.name || "Notification"}</strong><small>{item.message || item.contentType} - {formatRelativeTime(item.createdAt)}</small></span>
                  {!item.isRead && <i aria-label="Unread" />}
                  {item.id && !String(item.id).startsWith("open-form-") && <span role="button" tabIndex={0} className="notification-delete-inline" aria-label="Delete notification" onClick={(event) => deleteNotificationItem(event, item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") deleteNotificationItem(event, item); }}><Trash2 size={14} /></span>}
                </button>
              )) : <p>No notifications right now.</p>}
              <button type="button" className="notification-view-all" onClick={() => { setIsNotificationsOpen(false); openDashboardSection("notifications"); }}>See All</button>
            </div>
          )}
        </div>
        <div className="dashboard-profile-menu">
          <button type="button" className="dashboard-profile-button" onClick={() => { setIsProfileMenuOpen((current) => !current); setIsNotificationsOpen(false); }} aria-expanded={isProfileMenuOpen}>
            <UserAvatar user={user} size={36} />
            <span>{user.name}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {isProfileMenuOpen && (
            <div className="dashboard-profile-dropdown">
              <button type="button" onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }}>My Profile</button>
              <button type="button" className="danger-action" onClick={() => { setIsProfileMenuOpen(false); logout(); }}>Log Out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section className={`admin-cms-shell dashboard-theme-${dashboardTheme} sidebar-${sidebarMode} ${isSidebarTemporarilyExpanded ? "sidebar-temporary-expanded" : ""} ${isMobileSidebarOpen ? "mobile-sidebar-open" : ""} ${showMobileMenuBar ? "mobile-menu-bar-visible" : ""}`} onMouseDownCapture={guardDashboardBackdropClose}>
      {dashboardTopbar}
      <div className="dashboard-mobile-reveal-bar" aria-hidden={!showMobileMenuBar}>
        <button type="button" className="dashboard-menu-button" aria-expanded={isMobileSidebarOpen} aria-controls="dashboard-sidebar" onClick={() => setIsMobileSidebarOpen(true)}>
          <Menu size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
        <span>{activeTitle}</span>
      </div>
      <button type="button" className="dashboard-sidebar-overlay" aria-label="Close dashboard menu" onClick={() => setIsMobileSidebarOpen(false)} />
      <aside className="admin-sidebar" id="dashboard-sidebar">
        {isMobileSidebarOpen && (
          <button type="button" className="dashboard-drawer-close" aria-label="Close dashboard menu" onClick={() => setIsMobileSidebarOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <nav className="sidebar-navigation">
          {sidebarGroups.map((group) => {
            if (group.type === "item") {
              const [id, label, Icon] = group.item;
              return (
                <button type="button" className={activeSection === id ? "active" : ""} onClick={() => selectSidebarItem(id)} key={id} aria-label={label} {...sidebarTooltipHandlers(label)}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  {id === "approvals" && pendingItems.length > 0 && <small className="sidebar-badge">{pendingItems.length}</small>}
                </button>
              );
            }

            const isOpen = Boolean(openSidebarGroups[group.id]);
            const isActiveGroup = group.children.some(([id]) => id === activeSection);
            const GroupIcon = group.Icon;
            return (
              <div className={`sidebar-group ${isOpen ? "open" : ""} ${isActiveGroup ? "active-group" : ""}`} key={group.id}>
                <button type="button" className="sidebar-group-trigger" onClick={(event) => sidebarMode === "collapsed" ? openCollapsedSidebarGroup(group.id, event) : toggleSidebarGroup(group.id)} aria-label={group.label} aria-expanded={isOpen} {...sidebarTooltipHandlers(group.label)}>
                  <GroupIcon size={17} aria-hidden="true" />
                  <span>{group.label}</span>
                  <ChevronDown className="sidebar-chevron" size={16} aria-hidden="true" />
                </button>
                <div className="sidebar-subitems" style={sidebarMode === "collapsed" && isOpen && collapsedFlyoutTop !== null ? { "--sidebar-flyout-top": `${collapsedFlyoutTop}px` } : undefined}>
                  {group.children.map(([id, label, Icon]) => (
                    <button type="button" className={activeSection === id ? "active" : ""} onClick={() => selectSidebarItem(id)} key={id} aria-label={label} {...sidebarTooltipHandlers(label)}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
      <nav className="dashboard-bottom-tabs" aria-label="Dashboard mobile navigation" style={{ "--mobile-tab-count": mobileTabCount, "--mobile-active-index": activeMobileTabIndex }}>
        <span className="dashboard-bottom-indicator" aria-hidden="true" />
        {mobilePrimaryItems.map(([id, label, Icon]) => (
          <button type="button" key={id} className={isMobilePrimaryActive(id) ? "active" : ""} onPointerDown={triggerMobileNavPress} onClick={() => selectSidebarItem(id)}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            {id === "approvals" && pendingItems.length > 0 && <small>{pendingItems.length}</small>}
          </button>
        ))}
        {hasMobileMoreItems && (
          <button type="button" className={isMobileMoreOpen ? "active" : ""} onPointerDown={triggerMobileNavPress} onClick={() => { setOpenMobileMoreGroups({}); setIsMobileMoreOpen((current) => !current); }}>
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>More</span>
          </button>
        )}
      </nav>
      {hasMobileMoreItems && isMobileMoreOpen && (
        <div className="dashboard-more-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setIsMobileMoreOpen(false); setOpenMobileMoreGroups({}); } }}>
          <div className="dashboard-more-sheet" role="dialog" aria-modal="true" aria-label="More dashboard sections">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">More</p>
                <h2>Dashboard Sections</h2>
              </div>
              <button type="button" className="modal-close-button" aria-label="Close more menu" onClick={() => { setIsMobileMoreOpen(false); setOpenMobileMoreGroups({}); }}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="dashboard-more-grid">
              {sidebarGroups.map((group) => {
                if (group.type === "item") {
                  const [id, label, Icon] = group.item;
                  if (mobilePrimaryIdSet.has(id)) return null;
                  return (
                    <button type="button" key={id} className={isMobilePrimaryActive(id) ? "active" : ""} onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectSidebarItem(id); }}>
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                      {id === "approvals" && pendingItems.length > 0 && <small>{pendingItems.length}</small>}
                    </button>
                  );
                }

                const visibleChildren = group.children.filter(([id]) => !mobilePrimaryIdSet.has(id));
                if (!visibleChildren.length) return null;
                const isOpen = Boolean(openMobileMoreGroups[group.id]);
                const isActiveGroup = visibleChildren.some(([id]) => id === activeSection);
                const GroupIcon = group.Icon;
                return (
                  <div className={`dashboard-more-group ${isOpen ? "open" : ""} ${isActiveGroup ? "active-group" : ""}`} key={group.id}>
                    <button type="button" className="dashboard-more-group-trigger" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleMobileMoreGroup(group.id); }} aria-expanded={isOpen}>
                      <GroupIcon size={18} aria-hidden="true" />
                      <span>{group.label}</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div className="dashboard-more-subitems">
                        {visibleChildren.map(([id, label, Icon]) => (
                          <button type="button" key={id} className={activeSection === id ? "active" : ""} onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectSidebarItem(id); }}>
                            <Icon size={18} aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <main className="admin-main">
        {saveMessage && <p className="helper-text dashboard-save-message">{saveMessage}</p>}
        {isDashboardLoading && <UploadLoadingState message="Loading dashboard data..." />}
        {dashboardError && (
          <div className="dashboard-error-banner" role="alert">
            <strong>Some dashboard data could not be loaded.</strong>
            <span>{dashboardError.message}</span>
            <button type="button" className="inline-action" onClick={refresh}>Try again</button>
          </div>
        )}
        {uploadStatus && <UploadLoadingState message={uploadStatus} progress={photoUploadProgress.total ? photoUploadProgress : null} />}
        {renderSection()}
      </main>
      {isProfileModalOpen && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsProfileModalOpen(false); }}>
          <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Profile settings">
            <button type="button" className="modal-close-button" aria-label="Close profile settings" onClick={() => setIsProfileModalOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
            <h2>Profile settings</h2>
            <div className="profile-modal-current">
              <UserAvatar name={profileEdit.name || user.name} imageUrl={profileEdit.profilePicturePreview || user.profilePictureUrl} size={74} />
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                {user.profileChangeStatus === "pending" && <small>Profile change pending approval</small>}
              </div>
            </div>
            {profileMessage && <p className="helper-text">{profileMessage}</p>}
            <form className="profile-settings-form" onSubmit={submitOwnProfileChange}>
              <label>
                Display name
                <input value={profileEdit.name} onChange={(event) => setProfileEdit((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label className="profile-picture-picker">
                <span>Profile picture</span>
                <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "ownProfile" })} />
                <div className="profile-picture-preview">
                  <UserAvatar name={profileEdit.name || user.name} imageUrl={profileEdit.profilePicturePreview || user.profilePictureUrl} size={52} />
                  <small>{profileEdit.profilePictureFile ? profileEdit.profilePictureFile.name : "Choose and crop a new picture"}</small>
                </div>
              </label>
              <button type="submit" className="primary-action">Submit profile update</button>
            </form>
            <MfaSecurityPanel onSessionUpgraded={() => setProfileMessage("MFA verified. Retry the protected People & Access action.")} />
            <form className="profile-settings-form" onSubmit={changePassword}>
              <h3>Change password</h3>
              <input type="password" placeholder="Current password" value={profileEdit.currentPassword} onChange={(event) => setProfileEdit((current) => ({ ...current, currentPassword: event.target.value }))} />
              <input type="password" placeholder="New password" value={profileEdit.newPassword} onChange={(event) => setProfileEdit((current) => ({ ...current, newPassword: event.target.value }))} />
              <input type="password" placeholder="Confirm new password" value={profileEdit.confirmPassword} onChange={(event) => setProfileEdit((current) => ({ ...current, confirmPassword: event.target.value }))} />
              <button type="submit" className="inline-action">Update password</button>
            </form>
          </div>
        </div>
      )}
      {avatarCropRequest && (
        <AvatarCropModal
          file={avatarCropRequest.file}
          title={avatarCropRequest.target?.type === "siteContent" ? "Crop website image" : "Crop profile picture"}
          aspectRatio={avatarCropRequest.target?.type === "siteContent" ? avatarCropRequest.target.cropConfig?.aspect ?? 4 / 3 : 1}
          shape={avatarCropRequest.target?.type === "siteContent" ? avatarCropRequest.target.cropConfig?.shape ?? "square" : "circle"}
          confirmLabel={avatarCropRequest.target?.type === "siteContent" ? "Replace image" : "Use picture"}
          onCancel={() => setAvatarCropRequest(null)}
          onConfirm={applyCroppedAvatar}
        />
      )}
      {passwordResetUser && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPasswordResetUser(null); }}>
          <form className="profile-modal password-reset-modal" onSubmit={submitPasswordReset}>
            <button type="button" className="modal-close-button" aria-label="Close password reset" onClick={() => setPasswordResetUser(null)}>
              <X size={18} aria-hidden="true" />
            </button>
            <h2>Send password recovery</h2>
            <p className="helper-text">Supabase will email {passwordResetUser.name} a secure link so they can choose their own password. You will never see or set it.</p>
            <div className="action-row">
              <button type="button" className="inline-action" onClick={() => setPasswordResetUser(null)}>Cancel</button>
              <button type="submit" className="primary-action">Send recovery email</button>
            </div>
          </form>
        </div>
      )}
      {discardCloseRequest && (
        <div className="discard-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscardCloseRequest(null); }}>
          <div className="discard-confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Unsaved changes">
            <h2>You have unsaved changes</h2>
            <p>Are you sure you want to close without saving?</p>
            <div className="action-row">
              <button type="button" className="inline-action" onClick={() => setDiscardCloseRequest(null)}>Keep Editing</button>
              <button type="button" className="danger-action" onClick={() => { closeBackdropByKind(discardCloseRequest.kind); setDiscardCloseRequest(null); }}>Discard Changes</button>
            </div>
          </div>
        </div>
      )}
      {sidebarTooltip && createPortal(
        <div className="dashboard-sidebar-tooltip-portal" style={{ left: `${sidebarTooltip.left}px`, top: `${sidebarTooltip.top}px` }} role="tooltip">
          {sidebarTooltip.label}
        </div>,
        document.body
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status ?? "pending"}`}>{String(status ?? "pending").replace("_", " ")}</span>;
}

function BlogLinksTable({ items, onDelete, refresh, canDelete = false, onEditDraft = null }) {
  return (
    <div className="table-panel">
      <table className="editable-table blog-list-table">
        <thead>
          <tr><th>Blog</th><th>Status</th><th>Author</th><th>Published</th><th>Updated</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {items.length ? items.map((item) => (
            <tr key={item.revisionId ?? item.id}>
              <td>
                <Link className="blog-title-link" to={`/blogs/${item.slug}`}>
                  {item.title}
                </Link>
                <small>{item.excerpt || "No excerpt yet."}</small>
                {item.reviewerComment && <small className="review-note">Review note: {item.reviewerComment}</small>}
              </td>
              <td><StatusBadge status={item.approvalStatus} /></td>
              <td>{item.author ?? "Scouts Group"}</td>
              <td>{item.date || "Not published"}</td>
              <td>{item.updatedAt?.slice?.(0, 10) ?? item.createdAt?.slice?.(0, 10) ?? ""}</td>
              <td className="table-actions">
                <Link className="inline-action" to={`/blogs/${item.slug}`}>Open</Link>
                {item.approvalStatus === "draft" && onEditDraft && <button type="button" className="inline-action" onClick={() => onEditDraft(item)}>Edit draft</button>}
                {canDelete && !item.isRevision && (
                  <button type="button" className="inline-action danger-action" onClick={async () => {
                    await onDelete(item.id);
                    await refresh();
                  }}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          )) : <tr><td colSpan="6">No blog posts found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AlbumLinksTable({ items, onDelete, refresh, canDelete = false, onEditDraft = null }) {
  return (
    <div className="table-panel">
      <table className="editable-table blog-list-table">
        <thead>
          <tr><th>Album</th><th>Status</th><th>Date</th><th>Location</th><th>Photos</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {items.length ? items.map((item) => (
            <tr key={item.revisionId ?? item.id}>
              <td>
                <Link className="blog-title-link" to={`/gallery/${item.originalId ?? item.id}`}>
                  {item.title}
                </Link>
                <small>{item.category || item.coverLabel || "Album"}</small>
                {item.reviewerComment && <small className="review-note">Review note: {item.reviewerComment}</small>}
              </td>
              <td><StatusBadge status={item.approvalStatus} /></td>
              <td>{item.eventDate || "No date"}</td>
              <td>{item.location || "No location"}</td>
              <td>{item.photoCount ?? item.photos?.length ?? 0}</td>
              <td className="table-actions">
                <Link className="inline-action" to={`/gallery/${item.originalId ?? item.id}`}>Open</Link>
                {item.approvalStatus === "draft" && onEditDraft && <button type="button" className="inline-action" onClick={() => onEditDraft(item)}>Edit draft</button>}
                {canDelete && !item.isRevision && (
                  <button type="button" className="inline-action danger-action" onClick={async () => {
                    await onDelete(item.id);
                    await refresh();
                  }}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          )) : <tr><td colSpan="6">No albums found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function UploadLoadingState({ message, progress = null }) {
  return (
    <div className="upload-loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{message}</strong>
        <small>Keep this page open while the upload finishes.</small>
      </div>
      {progress && (
        <div className="upload-progress compact" aria-label="Current upload progress">
          <div><span style={{ width: `${progress.percent}%` }} /></div>
          <strong>{progress.percent}%</strong>
          <small>{progress.completed} of {progress.total} uploaded</small>
        </div>
      )}
    </div>
  );
}

function ContentTable({ items, edits, setEdits, onSave, onDelete, refresh, type, albums = [], canManageStatus = false }) {
  return (
    <div className="table-panel">
      <table className="editable-table">
        <thead><tr><th>Title</th><th>Status</th><th>{type === "post" ? "Author" : "Location"}</th><th>{type === "post" ? "Linked album" : "Category"}</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>
          {items.length ? items.map((item) => {
            const edit = edits[item.id] ?? item;
            const setEdit = (field, value) => setEdits((current) => ({ ...current, [item.id]: { ...edit, [field]: value } }));
            return (
              <tr key={item.id}>
                <td>
                  <input value={edit.title ?? ""} placeholder="Title" onChange={(event) => setEdit("title", event.target.value)} />
                  {type === "post" && (
                    <div className="blog-inline-editor">
                      <textarea rows="3" placeholder="Excerpt" value={edit.excerpt ?? ""} onChange={(event) => setEdit("excerpt", event.target.value)} />
                      <div className="inline-editor-grid compact">
                        <label>
                          Type
                          <select value={edit.postType ?? "blog"} onChange={(event) => setEdit("postType", event.target.value)}>
                            {postTypeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </label>
                        <label>
                          Category
                          <select value={edit.category ?? "general"} onChange={(event) => setEdit("category", event.target.value)}>
                            {postCategoryOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                          </select>
                        </label>
                      </div>
                      <RichTextEditor label="Full blog content" value={edit.body ?? ""} onChange={(value) => setEdit("body", value)} minHeight={170} placeholder="Edit the formatted blog content..." />
                    </div>
                  )}
                  {type === "album" && (
                    <div className="blog-inline-editor">
                      <RichTextEditor label="Album description" value={edit.description ?? ""} onChange={(value) => setEdit("description", value)} minHeight={150} placeholder="Edit the formatted album description..." />
                    </div>
                  )}
                  {item.reviewerComment && <small className="review-note">Review note: {item.reviewerComment}</small>}
                </td>
                <td>
                  {canManageStatus ? (
                    <select value={edit.approvalStatus ?? "pending"} onChange={(event) => setEdit("approvalStatus", event.target.value)}>
                      {contentStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  ) : (
                    <StatusBadge status={item.approvalStatus} />
                  )}
                </td>
                <td>
                  <input value={(type === "post" ? edit.author : edit.location) ?? ""} onChange={(event) => setEdit(type === "post" ? "author" : "location", event.target.value)} />
                </td>
                <td>{type === "post" ? <select value={edit.albumId ?? ""} onChange={(event) => setEdit("albumId", event.target.value)}><option value="">No linked album</option>{albums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select> : <input value={edit.category ?? ""} onChange={(event) => setEdit("category", event.target.value)} />}</td>
                <td>{item.updatedAt ?? item.createdAt ?? item.date ?? item.eventDate}</td>
                <td className="table-actions">
                  {canManageStatus ? (
                    <>
                      <button type="button" className="inline-action" onClick={() => onSave(item.id, edit)}>Save</button>
                      <button type="button" className="inline-action danger-action" onClick={async () => { await onDelete(item.id); await refresh(); }}>Delete</button>
                    </>
                  ) : type === "post" ? (
                    <>
                      <button type="button" className="inline-action" onClick={() => onSave(item.id, edit, { status: "draft" })}>Save draft</button>
                      <button type="button" className="inline-action" onClick={() => onSave(item.id, edit, { status: "pending" })}>Send for approval</button>
                    </>
                  ) : (
                    <button type="button" className="inline-action" onClick={() => onSave(item.id, edit)}>Save & resubmit</button>
                  )}
                </td>
              </tr>
            );
          }) : <tr><td colSpan="6">No content found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminLinkPanel({ to, title }) {
  return (
    <article className="admin-panel dashboard-upload-panel">
      <h2>{title}</h2>
      <p>This workflow already exists and is preserved.</p>
      <Link className="inline-action" to={to}>Open {title}</Link>
    </article>
  );
}

function EmptyAdminSection({ title }) {
  return (
    <article className="admin-panel dashboard-upload-panel">
      <h2>{title}</h2>
      <p>This module is reserved for the built-in CMS workflow and future Supabase storage integration.</p>
    </article>
  );
}

function AccessDenied({ message = "Your role, chief level, assigned group, and permissions control which dashboard tools are available." }) {
  return (
    <article className="admin-panel dashboard-upload-panel">
      <p className="eyebrow">Access denied</p>
      <h2>You do not have permission to open this dashboard section.</h2>
      <p>{message}</p>
    </article>
  );
}
