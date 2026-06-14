import { normalizePost, normalizePostRevision } from "./supabaseMappers.js";
import {
  deleteSupabaseFile,
  deleteSupabaseRows,
  getSupabaseRows,
  getCurrentSupabaseUserId,
  insertSupabaseRow,
  patchSupabaseRows,
  uploadSupabaseFile
} from "./supabaseClient.js";
import { IMAGE_CACHE_CONTROL, optimizedImagePath, optimizeImageForUpload } from "./imageOptimizationService.js";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "post";
}


const publicPostSelect = "select=id,slug,title,author_name,thumbnail_color,thumbnail_url,thumbnail_path,linked_album_id,excerpt,body,status,published_at,created_at,updated_at";

export async function getPublicPosts({ limit = 12, offset = 0 } = {}) {
  const rows = await getSupabaseRows(
    "posts",
    `${publicPostSelect}&status=eq.approved&order=published_at.desc,created_at.desc&limit=${Number(limit)}&offset=${Number(offset)}`
  );

  return rows.map(normalizePost);
}

export async function getPublicPostBySlug(slug) {
  const rows = await getSupabaseRows(
    "posts",
    `${publicPostSelect}&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`
  );

  return rows[0] ? normalizePost(rows[0]) : null;
}

async function createUniqueSlug(baseSlug, currentPostId = null) {
  const rootSlug = slugify(baseSlug);
  const rows = await getSupabaseRows("posts", `select=id,slug&slug=like.${encodeURIComponent(`${rootSlug}%`)}`).catch(
    () => []
  );
  const existingSlugs = new Set(
    rows
      .filter((row) => !currentPostId || row.id !== currentPostId)
      .map((row) => row.slug)
  );

  if (!existingSlugs.has(rootSlug)) {
    return rootSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${rootSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${rootSlug}-${suffix}`;
}

async function preparePostData(post, options = {}) {
  let thumbnailUrl = post.thumbnailUrl ?? null;
  let thumbnailPath = post.thumbnailPath ?? null;

  if (post.thumbnailFile instanceof File) {
    const optimized = await optimizeImageForUpload(post.thumbnailFile, "blog_thumbnail");
    thumbnailPath = optimizedImagePath("blog-thumbnails/optimized", post.thumbnailFile);
    thumbnailUrl = await uploadSupabaseFile(thumbnailPath, optimized.file, "blog-thumbnails", { cacheControl: IMAGE_CACHE_CONTROL });
  }

  return {
    slug: options.ensureUniqueSlug
      ? await createUniqueSlug(post.slug || post.title, options.currentPostId)
      : post.slug || slugify(post.title),
    title: post.title,
    author_name: post.author,
    thumbnail_color: post.thumbnailColor ?? "#2f7d6d",
    thumbnail_url: thumbnailUrl,
    thumbnail_path: thumbnailPath,
    linked_album_id: post.albumId || null,
    excerpt: post.excerpt ?? "",
    body: post.body ?? post.excerpt ?? ""
  };
}

export async function getPosts() {
  const [rows, revisionRows] = await Promise.all([
    getSupabaseRows("posts", "select=*&order=created_at.desc"),
    getSupabaseRows("post_revisions", "select=*&order=updated_at.desc").catch(() => [])
  ]);
  const posts = rows.map(normalizePost);
  const revisions = revisionRows.map((revision) =>
    normalizePostRevision(
      revision,
      rows.find((post) => post.id === (revision.original_content_id ?? revision.originalContentId)) ?? null
    )
  );

  return {
    allBlogPosts: [...revisions, ...posts],
    blogPosts: posts.filter((post) => post.approvalStatus === "approved")
  };
}

export async function createPost(post) {
  const currentUserId = getCurrentSupabaseUserId();
  const postData = await preparePostData(post, { ensureUniqueSlug: true });

  return insertSupabaseRow("posts", {
    ...postData,
    status: post.approvalStatus ?? "pending",
    submitted_by: currentUserId,
    published_at: (post.approvalStatus ?? "pending") === "approved" ? new Date().toISOString() : null
  });
}

export async function updatePost(postId, post) {
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(post.approvalStatus);
  const previousThumbnailPath = post.thumbnailPath ?? post.currentVersion?.thumbnailPath ?? null;
  const postData = await preparePostData(post, { currentPostId: post.originalId ?? postId });
  const proposedData = {
    ...post,
    thumbnailUrl: postData.thumbnail_url,
    thumbnailPath: postData.thumbnail_path,
    thumbnailFile: undefined
  };

  if (post.isRevision || post.revisionId) {
    const revisionId = post.revisionId ?? postId;

    if (post.approvalStatus === "approved") {
      return patchSupabaseRows("posts", `id=eq.${encodeURIComponent(post.originalId)}`, {
        ...postData,
        status: "approved",
        reviewer_comment: post.reviewerComment ?? "",
        reviewed_by: getCurrentSupabaseUserId(),
        reviewed_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).then(() =>
        patchSupabaseRows("post_revisions", `id=eq.${encodeURIComponent(revisionId)}`, {
          status: "approved",
          reviewer_comment: post.reviewerComment ?? "",
          approved_by: getCurrentSupabaseUserId(),
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      ).then((result) => {
        if (postData.thumbnail_path && previousThumbnailPath && previousThumbnailPath !== postData.thumbnail_path) {
          deleteSupabaseFile(previousThumbnailPath, "blog-thumbnails").catch(() => {});
        }
        return result;
      });
    }

    return patchSupabaseRows("post_revisions", `id=eq.${encodeURIComponent(revisionId)}`, {
      status: post.approvalStatus ?? "pending_update",
      proposed_data: proposedData,
      reviewer_comment: post.reviewerComment ?? "",
      reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    });
  }

  if (post.revisionOfId || post.approvalStatus === "pending_update") {
    return insertSupabaseRow("post_revisions", {
      original_content_id: post.revisionOfId ?? postId,
      submitted_by: getCurrentSupabaseUserId(),
      status: post.approvalStatus ?? "pending_update",
      proposed_data: proposedData,
      reviewer_comment: post.reviewerComment ?? ""
    });
  }

  const saved = await patchSupabaseRows("posts", `id=eq.${encodeURIComponent(postId)}`, {
    ...postData,
    status: post.approvalStatus ?? "pending",
    reviewer_comment: post.reviewerComment ?? "",
    reviewed_by: reviewed ? getCurrentSupabaseUserId() : null,
    reviewed_at: reviewed ? new Date().toISOString() : null,
    published_at: post.approvalStatus === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  });

  if (postData.thumbnail_path && previousThumbnailPath && previousThumbnailPath !== postData.thumbnail_path) {
    deleteSupabaseFile(previousThumbnailPath, "blog-thumbnails").catch(() => {});
  }

  return saved;
}

export async function deletePost(postId) {
  const rows = await getSupabaseRows("posts", `select=thumbnail_path&id=eq.${encodeURIComponent(postId)}`).catch(() => []);
  const deleted = await deleteSupabaseRows("posts", `id=eq.${encodeURIComponent(postId)}`);
  const thumbnailPaths = rows.map((row) => row.thumbnail_path).filter(Boolean);

  await Promise.all(thumbnailPaths.map((path) => deleteSupabaseFile(path, "blog-thumbnails").catch(() => {})));

  return deleted;
}

