import {
  deleteSupabaseFile,
  deleteSupabaseRows,
  getCurrentSupabaseUserId,
  getSupabasePublicFileUrl,
  getSupabaseRows,
  insertSupabaseRow,
  patchSupabaseRows,
  uploadSupabaseFile
} from "./supabaseClient.js";

const documentBucket = "dashboard-documents";
const maxDocumentSize = 25 * 1024 * 1024;
const allowedDocumentExtensions = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"]);

function extensionFromFileName(name = "") {
  return String(name).split(".").pop()?.toLowerCase() ?? "";
}

function normalizeDocumentCategory(row) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function normalizeDashboardDocument(row) {
  const category = row.document_categories ?? row.category ?? null;
  return {
    id: row.id,
    scoutYearId: row.scout_year_id ?? null,
    title: row.title,
    storagePath: row.storage_path,
    fileUrl: row.file_url ?? getSupabasePublicFileUrl(row.storage_path, documentBucket),
    fileName: row.file_name ?? row.title,
    fileType: row.file_type ?? extensionFromFileName(row.file_name ?? row.title),
    mimeType: row.mime_type ?? "",
    fileSize: Number(row.file_size ?? 0),
    categoryId: row.category_id ?? null,
    categoryName: category?.name ?? "Uncategorized",
    visibility: row.visibility ?? "authenticated",
    status: row.status ?? "approved",
    submittedBy: row.submitted_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function normalizeAuditLog(row) {
  return {
    id: row.id,
    actorId: row.actor_id ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at ?? null
  };
}

function normalizeArchivedYear(row) {
  return {
    id: row.id,
    scoutYearId: row.scout_year_id ?? null,
    label: row.year_label ?? "Archived year",
    snapshot: row.snapshot ?? {},
    archivedBy: row.archived_by ?? null,
    archivedAt: row.archived_at ?? null,
    deletedAt: row.deleted_at ?? null
  };
}

function validateDocumentFile(file) {
  const extension = extensionFromFileName(file?.name);
  if (!allowedDocumentExtensions.has(extension)) {
    throw new Error("Only PDF, Word, PowerPoint, and Excel files can be uploaded.");
  }

  if (file.size > maxDocumentSize) {
    throw new Error("Each document must be 25MB or smaller.");
  }

  return extension;
}

export async function getDocumentsWorkspaceData() {
  const [categoryRows, documentRows, archiveRows] = await Promise.all([
    getSupabaseRows("document_categories", "select=*&order=name.asc").catch(() => []),
    getSupabaseRows("documents", "select=*,document_categories(name)&status=eq.approved&order=created_at.desc").catch(() =>
      getSupabaseRows("documents", "select=*&status=eq.approved&order=created_at.desc").catch(() => [])
    ),
    getSupabaseRows("archived_years", "select=*&deleted_at=is.null&order=archived_at.desc").catch(() => [])
  ]);

  return {
    documentCategories: categoryRows.map(normalizeDocumentCategory),
    documents: documentRows.map(normalizeDashboardDocument),
    archivedYears: archiveRows.map(normalizeArchivedYear)
  };
}

export async function getReportsWorkspaceData() {
  const auditRows = await getSupabaseRows("audit_logs", "select=*&order=created_at.desc&limit=500");
  return {
    auditLogs: auditRows.map(normalizeAuditLog)
  };
}

export async function saveDocumentCategory(category) {
  const name = String(category.name ?? "").trim();
  if (!name) {
    throw new Error("Enter a category name.");
  }

  const row = {
    name,
    updated_at: new Date().toISOString()
  };

  if (category.id) {
    const [saved] = await patchSupabaseRows("document_categories", `id=eq.${encodeURIComponent(category.id)}`, row);
    return normalizeDocumentCategory(saved);
  }

  const [created] = await insertSupabaseRow("document_categories", {
    ...row,
    created_by: getCurrentSupabaseUserId()
  });
  return normalizeDocumentCategory(created);
}

export async function deleteDocumentCategory(categoryId) {
  await patchSupabaseRows("documents", `category_id=eq.${encodeURIComponent(categoryId)}`, {
    category_id: null,
    updated_at: new Date().toISOString()
  }).catch(() => []);
  return deleteSupabaseRows("document_categories", `id=eq.${encodeURIComponent(categoryId)}`);
}

export async function uploadDashboardDocuments(files, categoryId = null, scoutYearId = null) {
  const currentUserId = getCurrentSupabaseUserId();
  const uploadedRows = [];

  for (const file of files) {
    const extension = validateDocumentFile(file);
    const safeName = file.name.replace(/[^a-z0-9_.-]+/gi, "-");
    const storagePath = `${currentUserId ?? "admin"}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileUrl = await uploadSupabaseFile(storagePath, file, documentBucket, { cacheControl: "3600" });
    const [created] = await insertSupabaseRow("documents", {
      scout_year_id: scoutYearId || null,
      title: file.name.replace(/\.[^.]+$/, ""),
      storage_path: storagePath,
      file_url: fileUrl,
      file_name: file.name,
      file_type: extension,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
      category_id: categoryId || null,
      visibility: "authenticated",
      status: "approved",
      submitted_by: currentUserId
    });
    uploadedRows.push(normalizeDashboardDocument(created));
  }

  return uploadedRows;
}

export async function updateDashboardDocument(documentId, payload) {
  const [saved] = await patchSupabaseRows("documents", `id=eq.${encodeURIComponent(documentId)}`, {
    title: payload.title,
    category_id: payload.categoryId || null,
    updated_at: new Date().toISOString()
  });
  return normalizeDashboardDocument(saved);
}

export async function deleteDashboardDocument(document) {
  await deleteSupabaseRows("documents", `id=eq.${encodeURIComponent(document.id)}`);
  if (document.storagePath) {
    await deleteSupabaseFile(document.storagePath, documentBucket).catch(() => null);
  }
  return document.id;
}

export async function createArchivedYearSnapshot(payload) {
  const [created] = await insertSupabaseRow("archived_years", {
    scout_year_id: payload.scoutYearId,
    year_label: payload.label,
    snapshot: payload.snapshot,
    archived_by: getCurrentSupabaseUserId()
  });
  return normalizeArchivedYear(created);
}

export async function deleteArchivedYearSnapshot(archiveId) {
  const [updated] = await patchSupabaseRows("archived_years", `id=eq.${encodeURIComponent(archiveId)}`, {
    deleted_at: new Date().toISOString(),
    deleted_by: getCurrentSupabaseUserId()
  });
  return normalizeArchivedYear(updated);
}
