const collectionKeys = [
  "users",
  "groups",
  "registeredScouts",
  "scoutYears",
  "attendanceMeetings",
  "attendanceSheets",
  "chiefAttendanceMeetings",
  "chiefAttendanceSheet",
  "plannedEvents",
  "allBlogPosts",
  "blogPosts",
  "allGalleryAlbums",
  "allGalleryPhotos",
  "galleryAlbums",
  "photoUploadBatches",
  "leaders",
  "faqs",
  "contactMessages",
  "equipes",
  "formTemplates",
  "formTemplateVersions",
  "postedForms",
  "formSubmissions",
  "formAiSummaries",
  "documentCategories",
  "documents",
  "archivedYears",
  "auditLogs",
  "notifications",
  "siteContentRevisions",
  "contentSubmissions",
  "authorizationMigrationDifferences"
];

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeBootstrapData(value, defaults = {}) {
  const safeDefaults = objectOrEmpty(defaults);
  const source = objectOrEmpty(value);
  const normalized = { ...safeDefaults, ...source };

  collectionKeys.forEach((key) => {
    if (!Array.isArray(normalized[key])) {
      normalized[key] = Array.isArray(safeDefaults[key]) ? safeDefaults[key] : [];
    }
  });

  normalized.registrationImportSettings = {
    ...objectOrEmpty(safeDefaults.registrationImportSettings),
    ...objectOrEmpty(source.registrationImportSettings)
  };
  normalized.groupingRulesStore = {
    ...objectOrEmpty(safeDefaults.groupingRulesStore),
    ...objectOrEmpty(source.groupingRulesStore),
    rules: Array.isArray(source.groupingRulesStore?.rules)
      ? source.groupingRulesStore.rules
      : Array.isArray(safeDefaults.groupingRulesStore?.rules)
        ? safeDefaults.groupingRulesStore.rules
        : []
  };
  normalized.siteContent = source.siteContent && typeof source.siteContent === "object" && !Array.isArray(source.siteContent)
    ? source.siteContent
    : objectOrEmpty(safeDefaults.siteContent);

  return normalized;
}
