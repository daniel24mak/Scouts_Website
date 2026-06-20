import {
  Archive,
  CalendarDays,
  CheckCircle2,
  FileText,
  Folder,
  GalleryHorizontal,
  MonitorSmartphone,
  Image,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  Menu,
  X,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addAlbumPhotos,
  addChief,
  addEquipe,
  addFaq,
  addLeader,
  addRegisteredScout,
  changeOwnPassword,
  resetUserPassword,
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
  uploadRegistrationSheet
} from "../api/client.js";
import { useBootstrap } from "../api/useBootstrap.js";
import ScoutAttendanceManager from "../features/attendance/ScoutAttendanceManager.jsx";
import AttendanceSheetsManager from "../features/attendance/AttendanceSheetsManager.jsx";
import ChiefAttendanceManager from "../features/attendance/ChiefAttendanceManager.jsx";
import CalendarManagement from "../features/calendar/CalendarManagement.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import AvatarCropModal from "../components/AvatarCropModal.jsx";
import BlogPostPreview from "../components/BlogPostPreview.jsx";
import RichTextEditor from "../components/RichTextEditor.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import { logAuditEvent } from "../services/auditService.js";
import {
  canCreateGroupMeetings,
  canEditScouts,
  canManageSystem,
  canPublishContent,
  canTakeAttendance
} from "../services/permissions.js";
import { subscribeDashboardRealtime } from "../services/realtimeService.js";
import { isSupabaseConfigured } from "../services/supabaseClient.js";

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
  email: "",
  role: "chief",
  groupId: "",
  chiefLevel: "chief",
  accountStatus: "active",
  temporaryPassword: "",
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
  ["home", "home_hero_title", "Home hero title", "text"],
  ["home", "home_hero_subtitle", "Home hero subtitle", "textarea"],
  ["home", "home_hero_image", "Home hero image", "image"],
  ["home", "home_about_image", "Home about preview image", "image"],
  ["home", "home_activity_image_1", "Life in Scouts image 1", "image"],
  ["home", "home_activity_image_2", "Life in Scouts image 2", "image"],
  ["home", "home_activity_image_3", "Life in Scouts image 3", "image"],
  ["home", "home_activity_image_4", "Life in Scouts image 4", "image"],
  ["home", "home_activity_image_5", "Life in Scouts image 5", "image"],
  ["home", "home_activity_image_6", "Life in Scouts image 6", "image"],
  ["home", "home_about_text", "Home about preview text", "textarea"],
  ["home", "home_location_text", "Home location text", "text"],
  ["about", "about_hero_image", "About header image", "image"],
  ["about", "about_intro_image", "About story image", "image"],
  ["about", "about_intro_text", "About intro text", "textarea"],
  ["about", "about_history_text", "About history text", "textarea"],
  ["about", "about_history_milestones", "About timeline milestones (Year | Title | Description)", "textarea"],
  ["about", "about_mission_text", "About mission text", "textarea"]
];

const sections = [
  ["overview", "Overview", LayoutDashboard, "all"],
  ["myGroup", "My Group", Users, "chief"],
  ["scoutAttendance", "Scout Attendance", CheckCircle2, "attendance"],
  ["attendanceSheets", "Attendance Sheets", FileText, "attendance"],
  ["chiefAttendance", "Chief Attendance", ShieldCheck, "admin"],
  ["scouts", "Scouts", Users, "scouts"],
  ["equipes", "Equipe Management", ShieldCheck, "chief"],
  ["calendar", "Calendar Events", CalendarDays, "all"],
  ["posts", "Posts / Blogs", FileText, "publish"],
  ["gallery", "Gallery / Albums", GalleryHorizontal, "publish"],
  ["approvals", "Approval Requests", CheckCircle2, "admin"],
  ["contactMessages", "Contact Messages", MessageSquare, "admin"],
  ["settings", "Settings", Settings, "admin"],
  ["usersPermissions", "Users & Permissions", LockKeyhole, "settings"],
  ["websiteContent", "Website Content", Image, "settings"],
  ["upload", "Registered Scout Upload", Upload, "settings"],
  ["rules", "Groups & Sorting Rules", Settings, "settings"],
  ["faqs", "FAQ Management", FileText, "settings"],
  ["documents", "Documents", Folder, "settings"],
  ["reports", "Reports", Archive, "settings"],
  ["archives", "Archived Years", Archive, "settings"]
];

const settingSections = [
  ["usersPermissions", "Users & Permissions", LockKeyhole, "Manage users, chiefs, roles, chief levels, groups, and permissions."],
  ["upload", "Registered Scout Upload", Upload, "Upload the active scout registration sheet and preserve historical lists."],
  ["rules", "Groups & Sorting Rules", Settings, "Control automatic grouping by school grade, age, and gender rules."],
  ["websiteContent", "Website Content", Image, "Edit public website text, images, leader headshots, and content blocks."],
  ["faqs", "FAQ Management", FileText, "Create and edit the public home page FAQ accordion."],
  ["documents", "Documents", Folder, "Store and prepare document publishing workflows."],
  ["reports", "Reports", Archive, "Review attendance and yearly reporting modules."],
  ["archives", "Archived Years", Archive, "Review current active year and prepare future archive workflows."]
];

const contentStatuses = ["draft", "pending", "pending_update", "needs_changes", "approved", "rejected", "archived"];
const reviewStatuses = ["pending", "pending_update", "needs_changes", "rejected", "archived"];
const sidebarModeKey = "scouts-dashboard-sidebar-mode";
const acceptedImageTypes = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

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

function chiefDefaults(level) {
    if (level === "head") {
    return { canPublish: true, canCreateGroupMeetings: true, canEditScouts: true };
  }
    if (level === "vice") {
    return { canPublish: true, canCreateGroupMeetings: true, canEditScouts: false };
  }

  return { canPublish: false, canCreateGroupMeetings: false, canEditScouts: false };
}

function toChiefForm(user) {
  return {
    name: user.name,
    email: user.email ?? "",
    role: user.role ?? "chief",
    groupId: user.groupId ?? "",
    chiefLevel: user.chiefLevel ?? "chief",
    accountStatus: user.accountStatus ?? "active",
    canPublish: Boolean(user.permissions.canPublish),
    canCreateGroupMeetings: Boolean(user.permissions.canCreateGroupMeetings),
    canEditScouts: Boolean(user.permissions.canEditScouts),
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

function getEquipeName(scout, equipes) {
  return equipes.find((equipe) => equipe.id === scout?.equipeId)?.name ?? "Unassigned";
}

function hasChiefAccess(user) {
  return user?.role === "chief" || Boolean(user?.groupId && user?.chiefLevel);
}

function canManageEquipesForGroup(user, groupId) {
  return canManageSystem(user) || (
    user?.groupId === groupId &&
    ["head", "vice"].includes(user?.chiefLevel) &&
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
    if (id === "equipes") {
    return ["head", "vice"].includes(user?.chiefLevel);
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

  return false;
}

function canOpenSection(sectionId, user) {
  const section = sections.find(([id]) => id === sectionId);
    if (!section) {
    return false;
  }
    if (section[3] === "settings") {
    return canManageSystem(user);
  }

  return isSectionAllowed(section, user);
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
  const [selectedEquipeId, setSelectedEquipeId] = useState("all");
  const [selectedScoutIds, setSelectedScoutIds] = useState([]);
  const [autoAssignMode, setAutoAssignMode] = useState("equal");
  const [customEquipeSizes, setCustomEquipeSizes] = useState({});
  const [genderBalance, setGenderBalance] = useState("auto");
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [chiefEdits, setChiefEdits] = useState({});
  const [newChief, setNewChief] = useState({ ...emptyChief, groupId: data.groups[0]?.id ?? "" });
  const [newChiefPreview, setNewChiefPreview] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ name: user?.name ?? "", profilePictureFile: null, profilePicturePreview: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [passwordResetValue, setPasswordResetValue] = useState("");
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
  const [activeSetting, setActiveSetting] = useState("usersPermissions");
  const [settingsMode, setSettingsMode] = useState(false);
  const [lastDashboardSection, setLastDashboardSection] = useState("overview");
  const [sidebarMode, setSidebarMode] = useState(() => window.localStorage.getItem(sidebarModeKey) ?? "expanded");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showMobileMenuBar, setShowMobileMenuBar] = useState(false);
  const [contentPreviewMode, setContentPreviewMode] = useState("web");
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [selectedApprovalPhotoIds, setSelectedApprovalPhotoIds] = useState([]);
  const [approvalComment, setApprovalComment] = useState("");
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(user?.groupId ?? data.groups[0]?.id ?? "");
  const [saveMessage, setSaveMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [registrationTargetMode, setRegistrationTargetMode] = useState("existing");
  const [registrationYearId, setRegistrationYearId] = useState(data.activeScoutYearId ?? data.scoutYears?.[0]?.id ?? "");
  const [newScoutYearName, setNewScoutYearName] = useState("");

  useEffect(() => {
    if (saveMessage) {
      showToast(saveMessage);
    }
  }, [saveMessage, showToast]);

  const visibleSections = sections.filter((section) => isSectionAllowed(section, user));
  const isAdmin = canManageSystem(user);
  const dashboardGroupId = isAdmin ? selectedGroupId : user?.groupId;
  const dashboardGroup = data.groups.find((group) => group.id === dashboardGroupId);
  const usersById = useMemo(() => new Map((data.users ?? []).map((profile) => [profile.id, profile])), [data.users]);
  const getSubmitterProfile = (submittedBy) => usersById.get(submittedBy) ?? null;
  const getSubmitterName = (item) => item.submitterName || getSubmitterProfile(item.submittedBy)?.name || (item.submittedBy && !String(item.submittedBy).includes("-") ? item.submittedBy : "Unknown");
  const getSubmitterPicture = (item) => item.submitterProfilePictureUrl || getSubmitterProfile(item.submittedBy)?.profilePictureUrl || null;
  const chiefs = data.users.filter((user) => user.role === "chief" || user.groupId || user.chiefLevel);
  const groupEquipes = (data.equipes ?? []).filter((equipe) => equipe.groupId === dashboardGroupId && equipe.isActive);
  const groupChiefs = chiefs.filter((chief) => chief.groupId === dashboardGroupId);
  const allPosts = data.allBlogPosts ?? data.blogPosts;
  const allAlbums = data.allGalleryAlbums ?? data.galleryAlbums;
  const allPhotos = data.allGalleryPhotos ?? allAlbums.flatMap((album) => album.photos ?? []);
  const allPhotoBatches = data.photoUploadBatches ?? [];
  const reviewItems = [
    ...allPosts.map((post) => ({ ...post, contentType: "Blog post" })),
    ...allAlbums.map((album) => ({ ...album, contentType: "Album" })),
    ...allPhotoBatches.map((batch) => ({ ...batch, contentType: "Photo batch" })),
    ...data.plannedEvents.map((event) => ({ ...event, contentType: "Calendar event" }))
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
  const selectedSection = sections.find(([id]) => id === activeSection);

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
    if (!canOpenSection(activeSection, user)) {
      setActiveSection("overview");
    }
  }, [activeSection, user]);
  useEffect(() => {
    if (!selectedGroupId && data.groups[0]?.id) {
      setSelectedGroupId(data.groups[0].id);
    }
  }, [data.groups, selectedGroupId]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeSection, activeSetting, settingsMode]);
  useEffect(() => {
    const handleKeyDown = (event) => {
    if (event.key === "Escape") {
        setIsMobileSidebarOpen(false);
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

    const handleDashboardScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const isScrollingUp = currentScrollY < lastScrollY - 8;
      const isScrollingDown = currentScrollY > lastScrollY + 8;
    if (!isMobile || currentScrollY < 180 || isMobileSidebarOpen) {
        setShowMobileMenuBar(false);
      } else if (isScrollingUp) {
        setShowMobileMenuBar(true);
      } else if (isScrollingDown) {
        setShowMobileMenuBar(false);
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
        : data.registeredScouts.filter((scout) => scout.groupId === user?.groupId);
      const byEquipe =
        selectedEquipeId === "all"
          ? permittedScouts
          : selectedEquipeId === "unassigned"
            ? permittedScouts.filter((scout) => !scout.equipeId)
            : permittedScouts.filter((scout) => scout.equipeId === selectedEquipeId);

      return filterBySearch(byEquipe, search, ["name", "schoolGrade", "school", "groupId"]);
    },
    [data.registeredScouts, isAdmin, search, selectedEquipeId, user?.groupId]
  );
  const visiblePosts = useMemo(() => {
    const availablePosts = isAdmin ? allPosts : allPosts.filter((post) => post.submittedBy === user?.id);
    const byStatus =
      statusFilter === "all"
        ? availablePosts
        : availablePosts.filter((post) => post.approvalStatus === statusFilter);
    return filterBySearch(byStatus, search, ["title", "author", "excerpt", "postType", "category", "approvalStatus"]);
  }, [allPosts, isAdmin, search, statusFilter, user?.id]);
  const visibleAlbums = useMemo(() => {
    const availableAlbums = isAdmin ? allAlbums : allAlbums.filter((album) => album.submittedBy === user?.id);
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
  const visibleApprovalItems = useMemo(() => {
    const allReviewItems = [...reviewItems, ...profileReviewItems];
    const byStatus =
      statusFilter === "all"
        ? allReviewItems
        : allReviewItems.filter((item) => item.approvalStatus === statusFilter);
    return filterBySearch(byStatus, search, ["title", "contentType", "approvalStatus", "submittedBy", "name", "pendingName"]);
  }, [reviewItems, profileReviewItems, search, statusFilter]);

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
  const openDashboardSection = (sectionId) => {
    if (sectionId === "settings") {
      setLastDashboardSection(activeSection === "settings" ? lastDashboardSection : activeSection);
      setSettingsMode(true);
      setActiveSection(activeSetting);
      return;
    }

    setSettingsMode(false);
    setActiveSection(sectionId);
    setLastDashboardSection(sectionId);
  };
  const backToDashboard = () => {
    setSettingsMode(false);
    setActiveSection(canOpenSection(lastDashboardSection, user) ? lastDashboardSection : "overview");
  };
  const toggleSidebarMode = async () => {
    const nextMode = sidebarMode === "expanded" ? "collapsed" : "expanded";
    setSidebarMode(nextMode);
    await logAuditEvent("sidebar_preference_changed", "Dashboard", user?.id ?? "anonymous", { sidebarMode: nextMode });
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

    await addEquipe({ ...newEquipe, groupId: dashboardGroupId });
    setNewEquipe({ name: "", description: "" });
    setSaveMessage("Equipe created.");
    await refresh();
  };
  const saveDashboardEquipe = async (equipeId) => {
    const payload = equipeEdits[equipeId] ?? groupEquipes.find((equipe) => equipe.id === equipeId);
    await saveEquipe(equipeId, payload);
    setSaveMessage("Equipe saved.");
    await refresh();
  };
  const archiveDashboardEquipe = async (equipeId) => {
    await removeEquipe(equipeId);
    setSaveMessage("Equipe archived and scouts moved to Unassigned.");
    await refresh();
  };
  const assignSelectedScouts = async (equipeId) => {
    if (!selectedScoutIds.length) {
      setSaveMessage("Select at least one scout first.");
      return;
    }

    await assignEquipeScouts({ scoutIds: selectedScoutIds, equipeId: equipeId || null, groupId: dashboardGroupId });
    setSelectedScoutIds([]);
    setSaveMessage(equipeId ? "Selected scouts assigned to equipe." : "Selected scouts moved to Unassigned.");
    await refresh();
  };
  const toggleScoutSelection = (scoutId) => {
    setSelectedScoutIds((current) =>
      current.includes(scoutId) ? current.filter((id) => id !== scoutId) : [...current, scoutId]
    );
  };
  const buildRandomAssignmentPreview = () => {
    const availableScouts = data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId);
    const activeEquipes = groupEquipes;
    if (!activeEquipes.length || !availableScouts.length) {
      setSaveMessage("Create equipes and make sure this group has scouts before randomizing.");
      return;
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
      return;
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

    setAssignmentPreview({
      assignments,
      unassigned,
      warning: genderWarning
        ? "Exact gender percentage could not be matched because of the available number of scouts. The closest balanced distribution was applied."
        : ""
    });
  };
  const saveAssignmentPreview = async () => {
    if (!assignmentPreview) {
      return;
    }

    for (const [equipeId, scouts] of Object.entries(assignmentPreview.assignments)) {
      await assignEquipeScouts({ scoutIds: scouts.map((scout) => scout.id), equipeId, groupId: dashboardGroupId });
    }

    await logAuditEvent("automatic_equipe_assignment_saved", "Group", dashboardGroupId, {
      equipeIds: Object.keys(assignmentPreview.assignments)
    });
    setAssignmentPreview(null);
    setSaveMessage("Automatic equipe assignments saved.");
    await refresh();
  };
  const setChiefLevel = (chiefId, level) => {
    setChiefEdits((current) => ({
      ...current,
      [chiefId]: { ...current[chiefId], chiefLevel: level, ...chiefDefaults(level) }
    }));
  };
  const openAvatarCrop = (file, target) => {
    if (!file) return;
    setAvatarCropRequest({ file, target });
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
    await updateChief(chiefId, chiefEdits[chiefId]);
    setSaveMessage("User and permissions saved.");
    await refresh();
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
      if (!newChief.temporaryPassword) {
        throw new Error("Enter a temporary password for the new user.");
      }
      if (newChief.role !== "admin" && !newChief.groupId) {
        throw new Error("Select a group for this user.");
      }

      await addChief(newChief);
      setNewChief({ ...emptyChief, groupId: data.groups[0]?.id ?? "" });
      setSaveMessage("User created in Supabase Auth and added to Users & Permissions.");
      await refresh();
    } catch (error) {
      setSaveMessage(`User was not fully created: ${error.message}`);
    }
  };
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
    if (passwordResetValue.length < 6) {
      setSaveMessage("Temporary password must be at least 6 characters.");
      return;
    }

    try {
      await resetUserPassword(passwordResetUser.id, passwordResetValue);
      setPasswordResetUser(null);
      setPasswordResetValue("");
      setSaveMessage(`Temporary password reset for ${passwordResetUser.name}.`);
      await refresh();
    } catch (error) {
      setSaveMessage(`Password reset failed: ${error.message}`);
    }
  };
  const createPost = async (event) => {
    event.preventDefault();
    const requestedStatus = event.nativeEvent.submitter?.value;
    try {
      setUploadStatus(newPost.thumbnailFile ? "Optimizing and uploading blog thumbnail..." : "Saving blog post...");
      await createBlog({
        ...newPost,
        approvalStatus: isAdmin ? newPost.approvalStatus : requestedStatus || "pending"
      });
      setNewPost(emptyPost);
      setSaveMessage((requestedStatus || newPost.approvalStatus) === "draft" ? "Post draft saved." : "Post sent for approval.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Post save failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const savePost = async (postId, payload, options = {}) => {
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
  const createGalleryAlbum = async (event) => {
    event.preventDefault();

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
    if (!albumThumbnailFile) {
          setSaveMessage("Please upload an album thumbnail.");
          return;
        }
    if (!newAlbum.category.trim()) {
          setSaveMessage("Please select an album category.");
          return;
        }
      }
    if (!photoFiles.length) {
        setSaveMessage("Please upload at least one photo.");
        return;
      }

      setUploadStatus(galleryUploadMode === "new" ? "Creating album and optimizing photos..." : "Optimizing and uploading photo bundle...");
      setPhotoUploadProgress({ completed: 0, total: photoFiles.length, percent: 0 });
      let targetAlbumId = photoAlbumId;
      const approvalStatus = isAdmin ? newAlbum.approvalStatus : "pending";
    if (galleryUploadMode === "new") {
        const created = await createAlbum({
          ...newAlbum,
          thumbnailFile: albumThumbnailFile,
          approvalStatus
        });
        targetAlbumId = Array.isArray(created) ? created[0]?.id : created?.id;
      }

      await addAlbumPhotos(targetAlbumId, {
        photos: photoFiles,
        approvalStatus,
        submittedBy: user.name,
        onProgress: (progress) => {
          setPhotoUploadProgress(progress);
          setUploadStatus(`Uploading optimized photos: ${progress.completed} of ${progress.total}`);
        }
      });

      setNewAlbum(emptyAlbum);
      setAlbumThumbnailFile(null);
      setPhotoFiles([]);
      setSaveMessage(galleryUploadMode === "new" ? "Album and photo bundle submitted." : "Photo bundle submitted.");
      setPhotoUploadProgress({ completed: 0, total: 0, percent: 0 });
      await refresh();
    } catch (error) {
      setSaveMessage(`Gallery upload failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const saveAlbum = async (albumId, payload) => {
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
    await logAuditEvent(`content_${approvalStatus}`, item.contentType, item.id, {
      title: item.title,
      reviewerComment: payload.reviewerComment
    });
    setSaveMessage(`${item.contentType} marked ${approvalStatus.replace("_", " ")}.`);
    setSelectedApproval((current) =>
      current?.id === item.id && current?.contentType === item.contentType
        ? { ...current, ...payload }
        : current
    );
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
  const saveContentField = async (sectionName, contentKey, fieldType) => {
    const current = data.siteContent?.[contentKey] ?? { sectionName, contentKey, textValue: "" };
    const edit = siteContentEdits[contentKey] ?? current;
    const file = siteImageFiles[contentKey] ?? null;

    try {
      setUploadStatus(file ? `Optimizing and uploading ${contentKey.replaceAll("_", " ")}...` : "Saving website content...");
      await saveWebsiteContent({
        sectionName,
        contentKey,
        textValue: fieldType === "image" ? current.textValue ?? "" : edit.textValue ?? "",
        imageUrl: current.imageUrl ?? null,
        storagePath: current.storagePath ?? null,
        file
      });
      setSiteImageFiles((currentFiles) => ({ ...currentFiles, [contentKey]: null }));
      setSaveMessage("Website content saved.");
      await refresh();
    } catch (error) {
      setSaveMessage(`Website content save failed: ${error.message}`);
    } finally {
      setUploadStatus(null);
    }
  };
  const publishWebsiteContent = async () => {
    for (const [sectionName, contentKey, , fieldType] of websiteContentFields) {
    if (siteContentEdits[contentKey] || siteImageFiles[contentKey]) {
        await saveContentField(sectionName, contentKey, fieldType);
      }
    }

    setSaveMessage("Website content changes published.");
  };
  const getContentText = (contentKey, fallback = "") =>
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
    setSaveMessage("Contact message updated.");
    await refresh();
  };
  const deleteContact = async (messageId) => {
    await removeContactMessage(messageId);
    setSaveMessage("Contact message deleted.");
    await refresh();
  };
  const renderWebsiteContent = () => (
    <div className="cms-panel-stack">
      <div className="content-editor-shell">
        <div className="content-editor-fields">
          <div className="content-editor-toolbar">
            <div>
              <h2>Website Content</h2>
              <p>Draft locally, preview the page, then publish changes into the public website content table.</p>
            </div>
            <div className="segmented-control">
              <button type="button" className={contentPreviewMode === "web" ? "active" : ""} onClick={() => setContentPreviewMode("web")}>
                Web Preview
              </button>
              <button type="button" className={contentPreviewMode === "mobile" ? "active" : ""} onClick={() => setContentPreviewMode("mobile")}>
                <MonitorSmartphone size={16} aria-hidden="true" />
                App Mobile Preview
              </button>
            </div>
          </div>
          <div className="website-content-grid">
            {websiteContentFields.map(([sectionName, contentKey, label, fieldType]) => {
              const current = data.siteContent?.[contentKey] ?? { sectionName, contentKey, textValue: "" };
              const edit = siteContentEdits[contentKey] ?? current;
              const previewImage = getContentImage(contentKey);
              const setEdit = (value) =>
                setSiteContentEdits((currentEdits) => ({
                  ...currentEdits,
                  [contentKey]: { ...edit, sectionName, contentKey, textValue: value }
                }));

              return (
                <article className="cms-form" key={contentKey}>
                  <h3>{label}</h3>
                  {fieldType === "image" ? (
                    <>
                      {previewImage ? (
                        <img className="website-image-preview" src={previewImage} alt="" loading="lazy" decoding="async" width={360} height={220} />
                      ) : (
                        <div className="website-image-empty">No image saved yet</div>
                      )}
                      <label className="file-picker">
                        Choose image
                        <input
                          type="file"
                          accept={acceptedImageTypes}
                          onChange={(event) =>
                            setSiteImageFiles((currentFiles) => ({
                              ...currentFiles,
                              [contentKey]: event.target.files?.[0] ?? null
                            }))
                          }
                        />
                      </label>
                      {siteImageFiles[contentKey] && <span className="helper-text">{siteImageFiles[contentKey].name}</span>}
                    </>
                  ) : fieldType === "textarea" ? (
                    <textarea rows="4" value={edit.textValue ?? ""} onChange={(event) => setEdit(event.target.value)} />
                  ) : (
                    <input value={edit.textValue ?? ""} onChange={(event) => setEdit(event.target.value)} />
                  )}
                  <button type="button" disabled={Boolean(uploadStatus)} onClick={() => saveContentField(sectionName, contentKey, fieldType)}>
                    {uploadStatus ? "Working..." : `Publish ${label}`}
                  </button>
                </article>
              );
            })}
          </div>
          <div className="content-publish-bar">
            <button type="button" className="inline-action" onClick={() => setSaveMessage("Draft kept in this editor until you publish.")}>
              Save Draft
            </button>
            <button type="button" className="inline-action" onClick={() => setSaveMessage("Preview updated from current editor values.")}>
              Preview
            </button>
            <button type="button" className="inline-action" onClick={publishWebsiteContent}>
              <Send size={16} aria-hidden="true" />
              Publish Changes
            </button>
            <button type="button" className="inline-action danger-action" onClick={() => {
              setSiteContentEdits({});
              setSiteImageFiles({});
              setSaveMessage("Unpublished website content edits discarded.");
            }}>
              Discard
            </button>
          </div>
        </div>
        <aside className={`website-live-preview ${contentPreviewMode}`}>
          <div className="preview-browser-bar">
            <span />
            <span />
            <span />
            <strong>{contentPreviewMode === "web" ? "Website" : "Mobile"}</strong>
          </div>
          <div
            className="preview-hero"
            style={{
              backgroundImage: getContentImage("home_hero_image")
                ? `linear-gradient(90deg, rgb(11 31 58 / 0.84), rgb(11 31 58 / 0.28)), url("${getContentImage("home_hero_image")}")`
                : undefined
            }}
          >
            <p className="eyebrow">Scout of Saint Mary</p>
            <h2>{getContentText("home_hero_title", "Scout of Saint Mary")}</h2>
            <p>{getContentText("home_hero_subtitle", "A living preview of the public home page.")}</p>
          </div>
          <div className="preview-content-block">
            {getContentImage("home_about_image") && <img src={getContentImage("home_about_image")} alt="" loading="lazy" decoding="async" width={360} height={240} />}
            <h3>About Preview</h3>
            <p>{getContentText("home_about_text", "Update the about preview text to see it here before publishing.")}</p>
          </div>
          <div className="preview-activity-grid">
            {["home_activity_image_1", "home_activity_image_2", "home_activity_image_3"].map((key) => (
              <div key={key}>
                {getContentImage(key) ? <img src={getContentImage(key)} alt="" loading="lazy" decoding="async" width={180} height={140} /> : <span>Life in Scouts</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <form className="inline-editor-grid leader-add-form" onSubmit={createManagedLeader}>
        <input required placeholder="Leader name" value={newLeader.name} onChange={(event) => setNewLeader((current) => ({ ...current, name: event.target.value }))} />
        <input required placeholder="Title" value={newLeader.title} onChange={(event) => setNewLeader((current) => ({ ...current, title: event.target.value }))} />
        <input type="number" placeholder="Order" value={newLeader.displayOrder} onChange={(event) => setNewLeader((current) => ({ ...current, displayOrder: event.target.value }))} />
        <label className="file-picker">Headshot<input type="file" accept={acceptedImageTypes} onChange={(event) => setNewLeader((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} /></label>
        <button type="submit" disabled={Boolean(uploadStatus)}>{uploadStatus ? "Saving..." : "Add leader"}</button>
      </form>
      <div className="table-panel">
        <table className="editable-table">
          <thead><tr><th>Photo</th><th>Name</th><th>Title</th><th>Order</th><th>Visible</th><th>Replace photo</th><th>Actions</th></tr></thead>
          <tbody>
            {(data.leaders ?? []).length ? data.leaders.map((leader) => {
              const edit = leaderEdits[leader.id] ?? leader;
              const setEdit = (field, value) => setLeaderEdits((current) => ({ ...current, [leader.id]: { ...edit, [field]: value } }));
              return (
                <tr key={leader.id}>
                  <td>{leader.photoUrl ? <img className="leader-table-photo" src={leader.photoUrl} alt="" /> : "No photo"}</td>
                  <td><input value={edit.name ?? ""} onChange={(event) => setEdit("name", event.target.value)} /></td>
                  <td><input value={edit.title ?? ""} onChange={(event) => setEdit("title", event.target.value)} /></td>
                  <td><input type="number" value={edit.displayOrder ?? 0} onChange={(event) => setEdit("displayOrder", event.target.value)} /></td>
                  <td><label className="checkbox-cell"><input type="checkbox" checked={edit.isActive !== false} onChange={(event) => setEdit("isActive", event.target.checked)} /></label></td>
                  <td><input type="file" accept={acceptedImageTypes} onChange={(event) => setEdit("file", event.target.files?.[0] ?? null)} /></td>
                  <td className="table-actions">
                    <button type="button" className="inline-action" disabled={Boolean(uploadStatus)} onClick={() => saveManagedLeader(leader.id)}>Save</button>
                    <button type="button" className="inline-action danger-action" onClick={() => hideManagedLeader(leader.id)}>Hide</button>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="7">No managed leaders yet. Add leaders above to replace the automatic chief list.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFaqs = () => (
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

  const renderContactMessages = () => (
    <div className="table-panel">
      <table className="editable-table">
        <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Message</th><th>Status</th><th>Notes</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {visibleContactMessages.length ? visibleContactMessages.map((message) => {
            const edit = contactEdits[message.id] ?? message;
            const setEdit = (field, value) => setContactEdits((current) => ({ ...current, [message.id]: { ...edit, [field]: value } }));

            return (
              <tr key={message.id}>
                <td>{message.name}</td>
                <td><a href={`mailto:${message.email}`}>{message.email}</a></td>
                <td>{message.subject}</td>
                <td>{message.message}</td>
                <td>
                  <select value={edit.status} onChange={(event) => setEdit("status", event.target.value)}>
                    {["new", "read", "responded", "archived"].map((status) => <option value={status} key={status}>{status}</option>)}
                  </select>
                </td>
                <td><textarea rows="3" value={edit.notes ?? ""} onChange={(event) => setEdit("notes", event.target.value)} /></td>
                <td>{message.createdAt?.slice(0, 10) ?? ""}</td>
                <td className="table-actions">
                  <button type="button" className="inline-action" onClick={() => saveContact(message.id, edit)}>Save</button>
                  <button type="button" className="inline-action" onClick={() => saveContact(message.id, { ...edit, status: "read" })}>Read</button>
                  <button type="button" className="inline-action" onClick={() => saveContact(message.id, { ...edit, status: "responded" })}>Responded</button>
                  <button type="button" className="inline-action danger-action" onClick={() => saveContact(message.id, { ...edit, status: "archived" })}>Archive</button>
                  <button type="button" className="inline-action danger-action" onClick={() => deleteContact(message.id)}>Delete</button>
                </td>
              </tr>
            );
          }) : <tr><td colSpan="8">No contact messages found.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const renderMyGroup = () => {
    const groupScouts = sortScouts(
      data.registeredScouts.filter((scout) => scout.groupId === dashboardGroupId),
      data.registrationImportSettings.sortBy
    );
    const groupEvents = data.plannedEvents.filter(
      (event) =>
        event.visibility === "logged-in" ||
        event.groupId === dashboardGroupId ||
        event.visibleGroupIds?.includes(dashboardGroupId)
    );

    return (
      <div className="cms-panel-stack">
        {isAdmin && (
          <div className="cms-toolbar">
            <label>
              View group
              <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                {data.groups.map((group) => (
                  <option value={group.id} key={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="dashboard-stat-grid">
          <article className="stat-card">
            <span>Assigned group</span>
            <strong>{dashboardGroup?.name ?? "Unassigned"}</strong>
          </article>
          <article className="stat-card">
            <span>Scouts</span>
            <strong>{groupScouts.length}</strong>
          </article>
          <article className="stat-card">
            <span>Attendance days</span>
            <strong>{data.attendanceMeetings.filter((meeting) => meeting.groupId === dashboardGroupId).length}</strong>
          </article>
          <article className="stat-card">
            <span>Upcoming internal events</span>
            <strong>{groupEvents.length}</strong>
          </article>
        </div>
        <div className="action-row">
          {canTakeAttendance(user) && <button type="button" className="inline-action" onClick={() => setActiveSection("scoutAttendance")}>Take scout attendance</button>}
          {canTakeAttendance(user) && <button type="button" className="inline-action" onClick={() => setActiveSection("attendanceSheets")}>View attendance sheet</button>}
          {canPublishContent(user) && <Link className="inline-action" to="/chiefs/content">Submit post or photos</Link>}
        </div>
        <article className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>{dashboardGroup?.name ?? "My Group"}</h2>
              <p>
                Scouts sorted by {sortLabels[data.registrationImportSettings.sortBy]} from{" "}
                {data.registrationImportSettings.excelFileName}.
              </p>
            </div>
            <span>{groupScouts.length} scouts</span>
          </div>
          <table>
            <thead><tr><th>Name</th><th>School Grade</th><th>Age</th><th>Equipe</th><th>Status</th></tr></thead>
            <tbody>
              {groupScouts.length ? groupScouts.map((scout) => (
                <tr key={scout.id}>
                  <td>{scout.name}</td>
                  <td>{getSchoolGrade(scout)}</td>
                  <td>{scout.age}</td>
                  <td>{getEquipeName(scout, groupEquipes)}</td>
                  <td>{scout.status}</td>
                </tr>
              )) : <tr><td colSpan="5">No scouts found for this group.</td></tr>}
            </tbody>
          </table>
        </article>
        <article className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>Group and internal events</h2>
              <p>Events shown here are limited to what this dashboard user can access.</p>
            </div>
            <span>{groupEvents.length} events</span>
          </div>
          <table>
            <thead><tr><th>Event</th><th>Date from</th><th>Date to</th><th>Visibility</th><th>Status</th></tr></thead>
            <tbody>
              {groupEvents.length ? groupEvents.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{event.dateFrom ?? event.date}</td>
                  <td>{event.dateTo ?? event.date}</td>
                  <td>{event.visibility}</td>
                  <td>{event.approvalStatus}</td>
                </tr>
              )) : <tr><td colSpan="5">No internal events found.</td></tr>}
            </tbody>
          </table>
        </article>
      </div>
    );
  };

  const renderOverview = () => {
    if (!isAdmin) {
      const groupScouts = data.registeredScouts.filter((scout) => scout.groupId === user.groupId);
      const groupAttendance = data.attendanceMeetings.filter((meeting) => meeting.groupId === user.groupId);
      const groupEvents = data.plannedEvents.filter(
        (event) =>
          event.visibility === "logged-in" ||
          event.groupId === user.groupId ||
          event.visibleGroupIds?.includes(user.groupId)
      );
      const ownSubmissions = [
        ...allPosts,
        ...allAlbums,
        ...data.plannedEvents
      ].filter((item) => item.submittedBy === user.id);

      return (
        <>
          <div className="dashboard-stat-grid">
            {[
              ["Assigned group", dashboardGroup?.name ?? "Unassigned"],
              ["Scouts", groupScouts.length],
              ["Attendance days", groupAttendance.length],
              ["My submissions", ownSubmissions.length]
            ].map(([label, value]) => (
              <article className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="admin-dashboard-grid">
            <article className="admin-panel dashboard-upload-panel">
              <h2>My Group</h2>
              <p>View scouts, attendance summaries, and internal group events for {dashboardGroup?.name ?? "your group"}.</p>
              <button type="button" className="inline-action" onClick={() => setActiveSection("myGroup")}>
                Open My Group
              </button>
            </article>
            <article className="admin-panel dashboard-upload-panel">
              <h2>Quick actions</h2>
              <div className="shortcut-list">
                {canTakeAttendance(user) && <button type="button" onClick={() => setActiveSection("scoutAttendance")}>Take scout attendance</button>}
                {canTakeAttendance(user) && <button type="button" onClick={() => setActiveSection("attendanceSheets")}>View attendance sheet</button>}
                {canPublishContent(user) && <Link to="/chiefs/content">Submit post or photos</Link>}
                {canCreateGroupMeetings(user) && <button type="button" onClick={() => setActiveSection("calendar")}>Create group event</button>}
              </div>
            </article>
            <article className="admin-panel dashboard-upload-panel">
              <h2>Upcoming internal events</h2>
              <div className="mini-list">
                {groupEvents.slice(0, 3).map((event) => <span key={event.id}>{event.title} - {event.dateFrom ?? event.date}</span>)}
                {!groupEvents.length && <span>No internal events yet</span>}
              </div>
            </article>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="dashboard-stat-grid">
          {[
            ["Active scouts", data.registeredScouts.length],
            ["Chiefs", chiefs.length],
            ["Attendance days", data.attendanceMeetings.length],
            ["Pending approvals", pendingItems.length]
          ].map(([label, value]) => (
            <article className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="admin-dashboard-grid">
          <article className="admin-panel dashboard-upload-panel">
            <h2>Active year</h2>
            <p>
              {data.registrationImportSettings.scoutYear} is active. Current import:{" "}
              {data.registrationImportSettings.excelFileName}.
            </p>
            <button type="button" className="inline-action" onClick={() => setActiveSection("upload")}>
              Upload scout list
            </button>
          </article>
          <article className="admin-panel dashboard-upload-panel">
            <h2>Approvals</h2>
            <p>{pendingItems.length} items are waiting for review.</p>
            <button type="button" className="inline-action" onClick={() => setActiveSection("approvals")}>
              Review requests
            </button>
          </article>
          <article className="admin-panel dashboard-upload-panel">
            <h2>Recent activity</h2>
            <div className="mini-list">
              <span>{data.attendanceMeetings.at(-1)?.date ?? "No scout attendance yet"}</span>
              <span>{data.chiefAttendanceMeetings.at(-1)?.date ?? "No chief attendance yet"}</span>
              <span>{allPosts[0]?.title ?? "No posts yet"}</span>
              <span>{(data.contactMessages ?? []).filter((message) => message.status === "new").length} new contact messages</span>
            </div>
          </article>
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
              .filter((equipe) => isAdmin || equipe.groupId === user?.groupId)
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
    const isMixedGroup =
      dashboardGroup?.genderFilter === "mixed" ||
      (groupScouts.some((scout) => scout.gender === "male") && groupScouts.some((scout) => scout.gender === "female"));
    if (!canManageEquipes) {
      return (
        <AccessDenied message="Only admins, head chiefs, and vice head chiefs can manage equipes for this group." />
      );
    }

    return (
      <div className="cms-panel-stack">
        {isAdmin && (
          <div className="cms-toolbar">
            <label>
              Manage group
              <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                {data.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}
              </select>
            </label>
          </div>
        )}

        <form className="inline-editor-grid" onSubmit={createDashboardEquipe}>
          <input required placeholder="Equipe name" value={newEquipe.name} onChange={(event) => setNewEquipe((current) => ({ ...current, name: event.target.value }))} />
          <input placeholder="Description" value={newEquipe.description} onChange={(event) => setNewEquipe((current) => ({ ...current, description: event.target.value }))} />
          <button type="submit">Create equipe</button>
        </form>

        <div className="equipe-grid">
          {groupEquipes.map((equipe) => {
            const edit = equipeEdits[equipe.id] ?? equipe;
            const equipeScouts = groupScouts.filter((scout) => scout.equipeId === equipe.id);
            const maleCount = equipeScouts.filter((scout) => scout.gender === "male").length;
            const femaleCount = equipeScouts.filter((scout) => scout.gender === "female").length;
            const setEdit = (field, value) => setEquipeEdits((current) => ({ ...current, [equipe.id]: { ...edit, [field]: value } }));

            return (
              <article className="admin-panel equipe-card" key={equipe.id}>
                <div className="panel-heading">
                  <div>
                    <h2>{equipe.name}</h2>
                    <p>{equipeScouts.length} scouts  -  {maleCount} male  -  {femaleCount} female</p>
                  </div>
                  <label className="checkbox-cell">
                    <input type="checkbox" checked={selectedScoutIds.length > 0 && equipeScouts.every((scout) => selectedScoutIds.includes(scout.id))} onChange={(event) => {
                      setSelectedScoutIds((current) => {
                        const currentSet = new Set(current);
                        equipeScouts.forEach((scout) => event.target.checked ? currentSet.add(scout.id) : currentSet.delete(scout.id));
                        return [...currentSet];
                      });
                    }} />
                  </label>
                </div>
                <input value={edit.name ?? ""} onChange={(event) => setEdit("name", event.target.value)} />
                <input value={edit.description ?? ""} placeholder="Description" onChange={(event) => setEdit("description", event.target.value)} />
                <div className="inline-editor-grid compact">
                  <label>
                    Leader
                    <select value={edit.leaderId ?? ""} onChange={(event) => setEdit("leaderId", event.target.value || null)}>
                      <option value="">No leader</option>
                      {groupChiefs.map((chief) => <option value={chief.id} key={chief.id}>{chief.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Co-leader
                    <select value={edit.coLeaderId ?? ""} onChange={(event) => setEdit("coLeaderId", event.target.value || null)}>
                      <option value="">No co-leader</option>
                      {groupChiefs.map((chief) => <option value={chief.id} key={chief.id}>{chief.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mini-list equipe-scout-list">
                  {equipeScouts.map((scout) => (
                    <label key={scout.id}>
                      <input type="checkbox" checked={selectedScoutIds.includes(scout.id)} onChange={() => toggleScoutSelection(scout.id)} />
                      <span>{scout.name}</span>
                    </label>
                  ))}
                  {!equipeScouts.length && <span>No scouts assigned yet.</span>}
                </div>
                <div className="table-actions">
                  <button type="button" className="inline-action" onClick={() => saveDashboardEquipe(equipe.id)}>Save</button>
                  <button type="button" className="inline-action" onClick={() => assignSelectedScouts(equipe.id)}>Assign selected</button>
                  <button type="button" className="inline-action danger-action" onClick={() => archiveDashboardEquipe(equipe.id)}>Archive</button>
                </div>
              </article>
            );
          })}
          {!groupEquipes.length && <article className="admin-panel"><h2>No equipes yet</h2><p>Create the first equipe for {dashboardGroup?.name ?? "this group"}.</p></article>}
        </div>

        <article className="table-panel">
          <div className="panel-heading">
            <div>
              <h2>Unassigned scouts</h2>
              <p>Select scouts here, then assign them to an equipe above.</p>
            </div>
            <div className="table-actions">
              <button type="button" className="inline-action" onClick={() => assignSelectedScouts(null)}>Move selected to Unassigned</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Select</th><th>Name</th><th>School Grade</th><th>Age</th><th>Gender</th><th>Equipe</th></tr></thead>
            <tbody>
              {groupScouts.map((scout) => (
                <tr key={scout.id}>
                  <td><input type="checkbox" checked={selectedScoutIds.includes(scout.id)} onChange={() => toggleScoutSelection(scout.id)} /></td>
                  <td>{scout.name}</td>
                  <td>{getSchoolGrade(scout)}</td>
                  <td>{scout.age}</td>
                  <td>{scout.gender || "Unknown"}</td>
                  <td>{getEquipeName(scout, groupEquipes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="admin-panel">
          <h2>Automatic assignment</h2>
          <div className="cms-toolbar">
            <label>
              Split mode
              <select value={autoAssignMode} onChange={(event) => setAutoAssignMode(event.target.value)}>
                <option value="equal">Equal split</option>
                <option value="custom">Custom size per equipe</option>
              </select>
            </label>
            {isMixedGroup && (
              <label>
                Gender balance
                <select value={genderBalance} onChange={(event) => setGenderBalance(event.target.value)}>
                  <option value="auto">Auto-balance based on available scouts</option>
                  <option value="50">50% male / 50% female</option>
                  <option value="60">60% male / 40% female</option>
                  <option value="40">40% male / 60% female</option>
                </select>
              </label>
            )}
            <button type="button" className="primary-action" onClick={buildRandomAssignmentPreview}>Preview random split</button>
          </div>
          {autoAssignMode === "custom" && (
            <div className="inline-editor-grid compact">
              {groupEquipes.map((equipe) => (
                <label key={equipe.id}>
                  {equipe.name}
                  <input type="number" min="0" value={customEquipeSizes[equipe.id] ?? ""} onChange={(event) => setCustomEquipeSizes((current) => ({ ...current, [equipe.id]: event.target.value }))} />
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
                      <p>{scouts.length} scouts  -  {scouts.filter((scout) => scout.gender === "male").length} male  -  {scouts.filter((scout) => scout.gender === "female").length} female</p>
                      <div className="mini-list">{scouts.map((scout) => <span key={scout.id}>{scout.name}</span>)}</div>
                    </article>
                  );
                })}
              </div>
              <p className="helper-text">{assignmentPreview.unassigned.length} scouts will stay Unassigned.</p>
              <div className="action-row">
                <button type="button" className="inline-action" onClick={buildRandomAssignmentPreview}>Randomize Again</button>
                <button type="button" className="primary-action" onClick={saveAssignmentPreview}>Save Assignments</button>
                <button type="button" className="inline-action" onClick={() => setAssignmentPreview(null)}>Cancel</button>
              </div>
            </div>
          )}
        </article>
      </div>
    );
  };

  const renderChiefs = () => (
    <div className="cms-panel-stack">
      <form className="inline-editor-grid chief-add-form" onSubmit={createChief}>
        <input required placeholder="Full name" value={newChief.name} onChange={(event) => setNewChief((current) => ({ ...current, name: event.target.value }))} />
        <input required type="email" placeholder="Email / username" value={newChief.email} onChange={(event) => setNewChief((current) => ({ ...current, email: event.target.value }))} />
        <input required type="password" placeholder="Temporary password" value={newChief.temporaryPassword} onChange={(event) => setNewChief((current) => ({ ...current, temporaryPassword: event.target.value }))} />
        <label className="profile-picture-picker">
          <span>Profile picture</span>
          <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "newChief" })} />
          <div className="profile-picture-preview">
            <UserAvatar name={newChief.name || "New user"} imageUrl={newChiefPreview} size={48} />
            {newChief.profilePictureFile ? <small>{newChief.profilePictureFile.name}</small> : <small>Optional image</small>}
          </div>
          {newChief.profilePictureFile && <button type="button" className="inline-action" onClick={() => setNewChief((current) => ({ ...current, profilePictureFile: null }))}>Remove image</button>}
        </label>
        <select value={newChief.role} onChange={(event) => setNewChief((current) => ({ ...current, role: event.target.value }))}><option value="chief">Chief</option><option value="admin">Admin + chief</option></select>
        <select value={newChief.groupId} onChange={(event) => setNewChief((current) => ({ ...current, groupId: event.target.value }))}>{data.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select>
        <select value={newChief.chiefLevel} onChange={(event) => setNewChiefLevel(event.target.value)}><option value="chief">Chief</option><option value="vice">Vice head chief</option><option value="head">Head chief</option></select>
        <button type="submit">Add user</button>
      </form>
      <div className="table-panel">
        <table className="editable-table users-permissions-table">
          <thead><tr><th>Profile</th><th>Name</th><th>Email</th><th>Role</th><th>Group</th><th>Level</th><th>Status</th><th>Post/photos</th><th>Meetings</th><th>Edit scouts</th><th>Password</th><th>Save</th></tr></thead>
          <tbody>
            {chiefs.map((chief) => {
              const edit = chiefEdits[chief.id] ?? toChiefForm(chief);
              const setEdit = (field, value) => setChiefEdits((current) => ({ ...current, [chief.id]: { ...edit, [field]: value } }));
              const setProfileImage = (file) => {
                if (edit.profilePicturePreview) {
                  URL.revokeObjectURL(edit.profilePicturePreview);
                }
                setChiefEdits((current) => ({
                  ...current,
                  [chief.id]: {
                    ...edit,
                    profilePictureFile: file ?? null,
                    profilePicturePreview: file ? URL.createObjectURL(file) : ""
                  }
                }));
              };
              return (
                <tr key={chief.id}>
                  <td>
                    <div className="user-profile-cell">
                      <UserAvatar name={edit.name || chief.name} imageUrl={edit.profilePicturePreview || edit.profilePictureUrl} size={42} />
                      <label className="avatar-replace-control">
                        <span>Change</span>
                        <input type="file" accept={acceptedImageTypes} onChange={(event) => openAvatarCrop(event.target.files?.[0] ?? null, { type: "chief", chief })} />
                      </label>
                    </div>
                  </td>
                  <td><input value={edit.name} onChange={(event) => setEdit("name", event.target.value)} /></td>
                  <td><input value={edit.email} onChange={(event) => setEdit("email", event.target.value)} /></td>
                  <td><select value={edit.role} onChange={(event) => setEdit("role", event.target.value)}><option value="chief">Chief</option><option value="admin">Admin + chief</option></select></td>
                  <td><select value={edit.groupId} onChange={(event) => setEdit("groupId", event.target.value)}>{data.groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></td>
                  <td><select value={edit.chiefLevel} onChange={(event) => setChiefLevel(chief.id, event.target.value)}><option value="chief">Chief</option><option value="vice">Vice head chief</option><option value="head">Head chief</option></select></td>
                  <td><select value={edit.accountStatus} onChange={(event) => setEdit("accountStatus", event.target.value)}><option value="active">Active</option><option value="disabled">Disabled</option></select></td>
                  {["canPublish", "canCreateGroupMeetings", "canEditScouts"].map((field) => (
                    <td key={field}><label className="checkbox-cell"><input type="checkbox" checked={Boolean(edit[field])} onChange={(event) => setEdit(field, event.target.checked)} /></label></td>
                  ))}
                  <td><button type="button" className="inline-action" onClick={() => { setPasswordResetUser(chief); setPasswordResetValue(""); }}>Reset</button></td>
                  <td><button type="button" className="inline-action" onClick={() => saveChief(chief.id)}>Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  const renderPosts = () => (
    <div className="cms-panel-stack">
      <form className="cms-form" onSubmit={createPost}>
        <h2>Create post</h2>
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
        <label className="file-picker">
          Thumbnail image
          <input type="file" accept={acceptedImageTypes} onChange={(event) => setNewPost((current) => ({ ...current, thumbnailFile: event.target.files?.[0] ?? null }))} />
        </label>
        {newPost.thumbnailFile && <span className="helper-text">{newPost.thumbnailFile.name}</span>}
        <select value={newPost.albumId} onChange={(event) => setNewPost((current) => ({ ...current, albumId: event.target.value }))}><option value="">No linked album</option>{allAlbums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}</select>
        {isAdmin && <select value={newPost.approvalStatus} onChange={(event) => setNewPost((current) => ({ ...current, approvalStatus: event.target.value }))}>{contentStatuses.map((status) => <option key={status}>{status}</option>)}</select>}
        {isAdmin ? (
          <button type="submit" disabled={Boolean(uploadStatus)}>{uploadStatus ? "Saving..." : "Create post"}</button>
        ) : (
          <div className="blog-submit-actions">
            <button type="submit" value="draft" disabled={Boolean(uploadStatus)}>Save draft</button>
            <button type="submit" value="pending" disabled={Boolean(uploadStatus)}>Send for approval</button>
          </div>
        )}
      </form>
      <BlogLinksTable items={visiblePosts} onDelete={deleteBlog} refresh={refresh} canDelete={isAdmin} />
    </div>
  );

  const renderGallery = () => (
    <div className="cms-panel-stack">
      <form className="cms-form gallery-bundle-form" onSubmit={createGalleryAlbum}>
        <h2>Gallery upload</h2>
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
            <label className="file-picker">
              Album thumbnail
              <input required type="file" accept={acceptedImageTypes} onChange={(event) => setAlbumThumbnailFile(event.target.files?.[0] ?? null)} />
            </label>
            {albumThumbnailFile && <span className="helper-text">{albumThumbnailFile.name}</span>}
            {isAdmin && <select value={newAlbum.approvalStatus} onChange={(event) => setNewAlbum((current) => ({ ...current, approvalStatus: event.target.value }))}>{contentStatuses.map((status) => <option key={status}>{status}</option>)}</select>}
          </div>
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
        <button type="submit" disabled={Boolean(uploadStatus) || !photoFiles.length || (galleryUploadMode === "existing" && !photoAlbumId)}>
          {uploadStatus ? "Uploading..." : "Submit photo bundle"}
        </button>
      </form>
      <AlbumLinksTable items={visibleAlbums} onDelete={deleteAlbum} refresh={refresh} canDelete={isAdmin} />
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

  const renderSettings = () => (
    <section className="settings-detail">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>{settingSections.find(([id]) => id === activeSetting)?.[1]}</h2>
          <p>{settingSections.find(([id]) => id === activeSetting)?.[3]}</p>
        </div>
      </div>
      {activeSetting === "usersPermissions" && renderChiefs()}
      {activeSetting === "upload" && renderUpload()}
      {activeSetting === "rules" && renderRules()}
      {activeSetting === "websiteContent" && renderWebsiteContent()}
      {activeSetting === "faqs" && renderFaqs()}
      {activeSetting === "documents" && <EmptyAdminSection title="Documents" />}
      {activeSetting === "reports" && <EmptyAdminSection title="Reports" />}
      {activeSetting === "archives" && <EmptyAdminSection title="Archived Years" />}
    </section>
  );

  const renderApprovals = () => (
    <div className="approval-workspace">
      <div className="table-panel">
        <div className="panel-heading">
          <div>
            <h2>Content Review Queue</h2>
            <p>Search and filter submitted posts, albums, and calendar events across every approval status.</p>
          </div>
          <span>{pendingItems.length} waiting</span>
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
                <td>{item.updatedAt ?? item.createdAt}</td>
                <td className="table-actions">
                  <button type="button" className="inline-action" onClick={() => {
                    setSelectedApproval(item);
                    setSelectedApprovalPhotoIds([]);
                    setApprovalComment(item.reviewerComment ?? "");
                  }}>
                    Preview
                  </button>
                  <button type="button" className="inline-action" onClick={() => saveApprovalDecision(item, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="inline-action danger-action" onClick={() => saveApprovalDecision(item, "rejected")}>
                    Reject
                  </button>
                </td>
              </tr>
            )) : <tr><td colSpan="6">No approval requests match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <aside className="approval-preview-panel">
        {selectedApproval ? (
          <>
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">{selectedApproval.contentType}</p>
                <h2>{selectedApproval.title}</h2>
              </div>
              <StatusBadge status={selectedApproval.approvalStatus} />
            </div>
            <div className="approval-preview-card">
              {selectedApproval.contentType === "Blog post" && (
                <BlogPostPreview post={{ ...selectedApproval, author: selectedApproval.author || getSubmitterName(selectedApproval), authorProfilePictureUrl: selectedApproval.authorProfilePictureUrl || getSubmitterPicture(selectedApproval) }} compact />
              )}
              {selectedApproval.currentVersion && (
                <div className="comparison-grid">
                  <article>
                    <span>Current Published Version</span>
                    <strong>{selectedApproval.currentVersion.title}</strong>
                    <p>{selectedApproval.currentVersion.excerpt ?? selectedApproval.currentVersion.location ?? ""}</p>
                  </article>
                  <article>
                    <span>Proposed Changes</span>
                    <strong>{selectedApproval.title}</strong>
                    <p>{selectedApproval.excerpt ?? selectedApproval.location ?? selectedApproval.description ?? ""}</p>
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
              {selectedApproval.contentType === "Album" && (
                <div className="photo-batch-preview">
                  <div className="preview-event-meta">
                    <span>{selectedApproval.eventDate || "No date"}</span>
                    <span>{selectedApproval.location || "No location"}</span>
                    <span>{selectedApproval.photoCount ?? selectedApproval.photos?.length ?? 0} photos</span>
                  </div>
                  <p>{selectedApproval.description || "No description added yet."}</p>
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
                    <button type="button" className="inline-action" onClick={() => setSelectedApprovalPhotoIds((selectedApproval.photos ?? []).map((photo) => photo.id))}>
                      Select all
                    </button>
                    <button type="button" className="inline-action" onClick={() => setSelectedApprovalPhotoIds([])}>
                      Clear
                    </button>
                    <button type="button" className="inline-action danger-action" disabled={!selectedApprovalPhotoIds.length} onClick={removeSelectedApprovalPhotos}>
                      Remove selected
                    </button>
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
              <p>{selectedApproval.excerpt ?? selectedApproval.description ?? selectedApproval.location ?? "No preview text provided."}</p>
              {selectedApproval.body && <p>{selectedApproval.body}</p>}
              <dl className="approval-details">
                <div><dt>Submitted by</dt><dd><span className="approval-submitter"><UserAvatar name={getSubmitterName(selectedApproval)} imageUrl={getSubmitterPicture(selectedApproval)} size={30} />{getSubmitterName(selectedApproval)}</span></dd></div>
                <div><dt>Created</dt><dd>{selectedApproval.createdAt ?? "Unknown"}</dd></div>
                <div><dt>Updated</dt><dd>{selectedApproval.updatedAt ?? "Not updated"}</dd></div>
              </dl>
            </div>
            <label className="approval-comment-box">
              Review comments
              <textarea
                rows="4"
                placeholder="Explain what changed, why it was rejected, or what the chief should edit."
                value={approvalComment}
                onChange={(event) => setApprovalComment(event.target.value)}
              />
            </label>
            <div className="approval-action-grid">
              <button type="button" className="inline-action" onClick={() => saveApprovalDecision(selectedApproval, "approved")}>
                Approve
              </button>
              <button type="button" className="inline-action" onClick={() => saveApprovalDecision(selectedApproval, "needs_changes")}>
                Send Back
              </button>
              <button type="button" className="inline-action danger-action" onClick={() => saveApprovalDecision(selectedApproval, "rejected")}>
                Reject
              </button>
              <button type="button" className="inline-action danger-action" onClick={() => saveApprovalDecision(selectedApproval, "archived")}>
                Archive
              </button>
            </div>
          </>
        ) : (
          <div className="empty-approval-preview">
            <CheckCircle2 size={34} aria-hidden="true" />
            <h2>Select a request</h2>
            <p>Preview submitted content, add review comments, then approve, reject, archive, or send it back for editing.</p>
          </div>
        )}
      </aside>
    </div>
  );

  const renderSection = () => {
    if (!canOpenSection(activeSection, user)) {
      return <AccessDenied />;
    }
    if (activeSection === "overview") return renderOverview();
    if (activeSection === "myGroup") return renderMyGroup();
    if (activeSection === "websiteContent") return renderWebsiteContent();
    if (activeSection === "upload") return renderUpload();
    if (activeSection === "rules") return renderRules();
    if (activeSection === "scouts") return renderScouts();
    if (activeSection === "equipes") return renderEquipes();
    if (activeSection === "usersPermissions") return renderChiefs();
    if (activeSection === "posts") return renderPosts();
    if (activeSection === "gallery") return renderGallery();
    if (activeSection === "faqs") return renderFaqs();
    if (activeSection === "contactMessages") return renderContactMessages();
    if (activeSection === "approvals") return renderApprovals();
    if (activeSection === "scoutAttendance") return <ScoutAttendanceManager />;
    if (activeSection === "attendanceSheets") return <AttendanceSheetsManager />;
    if (activeSection === "chiefAttendance") return <ChiefAttendanceManager />;
    if (activeSection === "calendar") return <CalendarManagement />;
    if (activeSection === "settings") return renderSettings();
    if (activeSection === "reports") return <EmptyAdminSection title="Reports" />;
    return <EmptyAdminSection title={selectedSection?.[1] ?? "Section"} />;
  };

  const activeTitle = settingsMode
    ? settingSections.find(([id]) => id === activeSetting)?.[1] ?? "Settings"
    : selectedSection?.[1] ?? "Admin";
  const sidebarItems = settingsMode ? settingSections : visibleSections;

  return (
    <section className={`admin-cms-shell sidebar-${sidebarMode} ${settingsMode ? "settings-mode" : ""} ${isMobileSidebarOpen ? "mobile-sidebar-open" : ""} ${showMobileMenuBar ? "mobile-menu-bar-visible" : ""}`}>
      <div className="dashboard-mobile-reveal-bar" aria-hidden={!showMobileMenuBar}>
        <button type="button" className="dashboard-menu-button" aria-expanded={isMobileSidebarOpen} aria-controls="dashboard-sidebar" onClick={() => setIsMobileSidebarOpen(true)}>
          <Menu size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
        <span>{activeTitle}</span>
      </div>
      <button type="button" className="dashboard-sidebar-overlay" aria-label="Close dashboard menu" onClick={() => setIsMobileSidebarOpen(false)} />
      <aside className="admin-sidebar" id="dashboard-sidebar">
        <div className="admin-sidebar-title">
          <div className="sidebar-brand sidebar-brand-expanded">
            <strong>{settingsMode ? "Settings" : "Scouts Dashboard"}</strong>
            <span>{data.registrationImportSettings.scoutYear}</span>
          </div>
          <button type="button" className="sidebar-desktop-toggle" onClick={toggleSidebarMode} title={sidebarMode === "expanded" ? "Collapse sidebar" : "Expand sidebar"} aria-label={sidebarMode === "expanded" ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarMode === "expanded" ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="dashboard-drawer-close" aria-label="Close dashboard menu" onClick={() => setIsMobileSidebarOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-control-stack">
          {settingsMode && (
            <button type="button" className="sidebar-control-button" onClick={backToDashboard} title="Back to Dashboard" aria-label="Back to Dashboard">
              <ArrowLeft size={17} aria-hidden="true" />
              <span>Back to Dashboard</span>
            </button>
          )}
          <Link className="sidebar-control-button sidebar-website-button" to="/" onClick={() => setIsMobileSidebarOpen(false)} title="Back to Website" aria-label="Back to Website">
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Back to Website</span>
          </Link>
        </div>
        <nav className="sidebar-navigation">
          {sidebarItems.map(([id, label, Icon]) => (
            <button
              type="button"
              className={(settingsMode ? activeSetting === id : activeSection === id) ? "active" : ""}
              onClick={() => {
    if (settingsMode) {
                  setActiveSetting(id);
                  setActiveSection(id);
                } else {
                  openDashboardSection(id);
                }
                setIsMobileSidebarOpen(false);
              }}
              key={id}
              title={label}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              {id === "approvals" && pendingItems.length > 0 && <small className="sidebar-badge">{pendingItems.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <button type="button" className="sidebar-account-summary" onClick={() => setIsProfileModalOpen(true)} title="Profile settings">
            <UserAvatar user={user} size={38} />
            <span>
              <strong>{user.name}</strong>
              <small>{user.role === "admin" ? "Admin" : "Chief"}{user.chiefLevel ? ` - ${user.chiefLevel}` : ""}{dashboardGroup?.name ? ` - ${dashboardGroup.name}` : ""}</small>
            </span>
          </button>
          <button type="button" className="sidebar-logout-button" onClick={() => { setIsMobileSidebarOpen(false); logout(); }} title="Logout">
            <LockKeyhole size={17} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="dashboard-topbar">
          <button type="button" className="dashboard-menu-button" aria-expanded={isMobileSidebarOpen} aria-controls="dashboard-sidebar" onClick={() => setIsMobileSidebarOpen(true)}>
            <Menu size={18} aria-hidden="true" />
            <span>Menu</span>
          </button>
          <span className="dashboard-topbar-label">{activeTitle}</span>
        </div>
        <div className="admin-main-header">
          <div>
            <p className="eyebrow">Built-in CMS</p>
            <h1>{activeTitle}</h1>
          </div>
          <div className="admin-header-actions">
            <button type="button" className="inline-action live-refresh-button" onClick={async () => {
              await refresh();
              setLastLiveUpdate(new Date());
            }}>
              <RefreshCw size={16} aria-hidden="true" />
              {lastLiveUpdate ? "Updated just now" : "Refresh"}
            </button>
            <input placeholder="Search current section" value={search} onChange={(event) => setSearch(event.target.value)} />
            {["posts", "gallery", "approvals", "contactMessages"].includes(activeSection) && (
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {(activeSection === "contactMessages"
                  ? ["new", "read", "responded", "archived"]
                  : contentStatuses
                ).map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
            )}
          </div>
        </div>
        {saveMessage && <p className="helper-text">{saveMessage}</p>}
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
          title="Crop profile picture"
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
            <h2>Reset temporary password</h2>
            <p className="helper-text">Set a new temporary password for {passwordResetUser.name}. It is sent only to Supabase Auth and is not saved in the users table.</p>
            <input type="password" autoFocus required minLength="6" placeholder="New temporary password" value={passwordResetValue} onChange={(event) => setPasswordResetValue(event.target.value)} />
            <div className="action-row">
              <button type="button" className="inline-action" onClick={() => setPasswordResetUser(null)}>Cancel</button>
              <button type="submit" className="primary-action">Reset password</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status ?? "pending"}`}>{String(status ?? "pending").replace("_", " ")}</span>;
}

function BlogLinksTable({ items, onDelete, refresh, canDelete = false }) {
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

function AlbumLinksTable({ items, onDelete, refresh, canDelete = false }) {
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






































