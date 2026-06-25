import { deleteSupabaseFile, deleteSupabaseRows, getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow, patchSupabaseRows, uploadSupabaseFile, upsertSupabaseRows } from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

function normalizeRevision(row) {
  let proposedData = row.proposed_data ?? {};
  if (typeof proposedData === "string") {
    try { proposedData = JSON.parse(proposedData); } catch { proposedData = {}; }
  }
  return { id: row.id, title: row.title ?? "Website content changes", pageKey: row.page_key ?? "home", proposedData, approvalStatus: row.status ?? "pending", submittedBy: row.submitted_by ?? null, reviewedBy: row.reviewed_by ?? null, reviewerComment: row.reviewer_comment ?? "", reviewedAt: row.reviewed_at ?? null, createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null, contentType: "Website Content" };
}

export async function getWebsiteContentRevisions() {
  const rows = await getSupabaseRows("site_content_revisions", "select=*&order=updated_at.desc");
  return rows.map(normalizeRevision);
}

async function prepareLeaderChanges(change) {
  const operations = [];
  for (const operation of change.operations ?? []) {
    if (operation.action !== "upsert" || !operation.file) {
      operations.push({ ...operation, file: undefined });
      continue;
    }
    const optimized = await optimizeImageForUpload(operation.file, "leader_headshot");
    const storagePath = optimizedImagePath(`pending/website-leaders/${operation.id}`, operation.file);
    const photoUrl = await uploadSupabaseFile(storagePath, optimized.file, "leader-headshots", { cacheControl: IMAGE_CACHE_CONTROL });
    operations.push({ ...operation, file: undefined, photoUrl, storagePath, previousStoragePath: operation.storagePath ?? null });
  }
  return { ...change, operations };
}

export async function submitWebsiteContentRevision({ pageKey, title, changes }) {
  const userId = getCurrentSupabaseUserId();
  if (!userId) throw new Error("Your session is no longer valid. Sign in again before submitting website changes.");
  if (!Array.isArray(changes) || !changes.length) throw new Error("There are no website changes to submit.");
  const proposedData = {};
  for (const change of changes) {
    if (change.entityType === "faqChanges") {
      proposedData.faq_changes = { ...change, operations: change.operations ?? [] };
      continue;
    }
    if (change.entityType === "leaderChanges") {
      proposedData.leader_changes = await prepareLeaderChanges(change);
      continue;
    }
    let imageUrl = change.imageUrl ?? null;
    let storagePath = change.storagePath ?? null;
    if (change.file) {
      const optimized = await optimizeImageForUpload(change.file, change.contentKey.includes("hero") ? "hero" : "website_content");
      storagePath = optimizedImagePath(`pending/website-content/${change.contentKey}`, change.file);
      imageUrl = await uploadSupabaseFile(storagePath, optimized.file, "site-images", { cacheControl: IMAGE_CACHE_CONTROL });
    }
    proposedData[change.contentKey] = { sectionName: change.sectionName, contentKey: change.contentKey, label: change.label, fieldType: change.fieldType, textValue: change.textValue ?? "", imageUrl, storagePath, previousStoragePath: change.previousStoragePath ?? null };
  }
  const rows = await insertSupabaseRow("site_content_revisions", { title, page_key: pageKey, proposed_data: proposedData, status: "pending", submitted_by: userId });
  if (!rows?.[0]) throw new Error("Supabase did not return the pending website change. Check the site_content_revisions table and its RLS policies.");
  return normalizeRevision(rows[0]);
}

async function applyFaqChanges(change, now) {
  for (const operation of change.operations ?? []) {
    if (operation.action === "delete") {
      await deleteSupabaseRows("faqs", `id=eq.${encodeURIComponent(operation.id)}`);
      continue;
    }
    const row = { question: operation.question, answer: operation.answer, display_order: Number(operation.displayOrder ?? 0), is_active: operation.isActive !== false, updated_by: getCurrentSupabaseUserId(), updated_at: now };
    if (operation.isNew || String(operation.id).startsWith("faq-")) await insertSupabaseRow("faqs", row);
    else await patchSupabaseRows("faqs", `id=eq.${encodeURIComponent(operation.id)}`, row);
  }
}

async function applyLeaderChanges(change, now) {
  for (const operation of change.operations ?? []) {
    if (operation.action === "delete") {
      const rows = await getSupabaseRows("leaders", `select=storage_path&id=eq.${encodeURIComponent(operation.id)}`).catch(() => []);
      await deleteSupabaseRows("leaders", `id=eq.${encodeURIComponent(operation.id)}`);
      await Promise.all(rows.map((row) => row.storage_path).filter(Boolean).map((path) => deleteSupabaseFile(path, "leader-headshots").catch(() => {})));
      continue;
    }
    const row = { full_name: operation.name, title: operation.title, photo_url: operation.photoUrl ?? null, storage_path: operation.storagePath ?? null, display_order: Number(operation.displayOrder ?? 0), is_active: operation.isActive !== false, updated_at: now };
    if (operation.isNew || String(operation.id).startsWith("leader-")) await insertSupabaseRow("leaders", row);
    else {
      await patchSupabaseRows("leaders", `id=eq.${encodeURIComponent(operation.id)}`, row);
      if (operation.previousStoragePath && operation.previousStoragePath !== operation.storagePath) await deleteSupabaseFile(operation.previousStoragePath, "leader-headshots").catch(() => {});
    }
  }
}

export async function reviewWebsiteContentRevision(revision, status, reviewerComment = "") {
  const now = new Date().toISOString();
  if (status === "approved") {
    const changes = Object.values(revision.proposedData ?? {});
    const contentChanges = changes.filter((change) => !change.entityType);
    if (contentChanges.length) {
      await upsertSupabaseRows("site_content", contentChanges.map((change) => ({ section_name: change.sectionName, content_key: change.contentKey, text_value: change.textValue ?? "", image_url: change.imageUrl ?? null, storage_path: change.storagePath ?? null, updated_by: getCurrentSupabaseUserId(), updated_at: now })), "section_name,content_key");
      await Promise.all(contentChanges.filter((change) => change.previousStoragePath && change.previousStoragePath !== change.storagePath).map((change) => deleteSupabaseFile(change.previousStoragePath, "site-images").catch(() => {})));
    }
    const faqChanges = changes.find((change) => change.entityType === "faqChanges");
    if (faqChanges) await applyFaqChanges(faqChanges, now);
    const leaderChanges = changes.find((change) => change.entityType === "leaderChanges");
    if (leaderChanges) await applyLeaderChanges(leaderChanges, now);
  }
  const rows = await patchSupabaseRows("site_content_revisions", `id=eq.${encodeURIComponent(revision.id)}`, { status, reviewer_comment: reviewerComment, reviewed_by: getCurrentSupabaseUserId(), reviewed_at: now, updated_at: now });
  if (!rows?.[0]) throw new Error("The website approval result could not be saved.");
  return normalizeRevision(rows[0]);
}