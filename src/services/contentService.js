import { normalizePost, normalizePostRevision } from "./supabaseMappers.js";
import { getProfileById, getProfiles } from "./userService.js";
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


const publicPostSelect = "select=id,slug,title,content_type,category,author_name,author_profile_picture_url,thumbnail_color,thumbnail_url,thumbnail_path,linked_album_id,excerpt,body,status,submitted_by,published_at,created_at,updated_at";
const legacyPublicPostSelect = "select=id,slug,title,author_name,thumbnail_color,thumbnail_url,thumbnail_path,linked_album_id,excerpt,body,status,submitted_by,published_at,created_at,updated_at";

function isMissingPostMetadataColumns(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("content_type") || message.includes("category") || message.includes("author_profile_picture_url") || message.includes("pgrst204") || message.includes("42703");
}

function isRoleLikeAuthor(value) {
  return ["group admin", "admin", "chief", "admin + chief", "scouts group"].includes(String(value ?? "").trim().toLowerCase());
}

function applyAuthorProfile(post, profile) {
  if (!profile) return post;
  return {
    ...post,
    author: isRoleLikeAuthor(post.author) ? profile.name : post.author || profile.name,
    authorProfilePictureUrl: post.authorProfilePictureUrl || profile.profilePictureUrl || null,
    submitterName: profile.name,
    submitterProfilePictureUrl: profile.profilePictureUrl || null
  };
}

async function enrichPostsWithAuthors(posts) {
  const profiles = await getProfiles().catch(() => []);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return posts.map((post) => applyAuthorProfile(post, profilesById.get(post.submittedBy)));
}
function stripPostMetadataColumns(row) {
  const { content_type, category, author_profile_picture_url, ...rest } = row;
  return rest;
}

async function insertPostRow(row) {
  try {
    return await insertSupabaseRow("posts", row);
  } catch (error) {
    if (!isMissingPostMetadataColumns(error)) throw error;
    return insertSupabaseRow("posts", stripPostMetadataColumns(row));
  }
}

async function patchPostRows(filter, row) {
  try {
    return await patchSupabaseRows("posts", filter, row);
  } catch (error) {
    if (!isMissingPostMetadataColumns(error)) throw error;
    return patchSupabaseRows("posts", filter, stripPostMetadataColumns(row));
  }
}

export async function getPublicPosts({ limit = 12, offset = 0 } = {}) {
  let rows;
  try {
    rows = await getSupabaseRows(
      "posts",
      `${publicPostSelect}&status=eq.approved&order=published_at.desc,created_at.desc&limit=${Number(limit)}&offset=${Number(offset)}`
    );
  } catch (error) {
    if (!isMissingPostMetadataColumns(error)) throw error;
    rows = await getSupabaseRows(
      "posts",
      `${legacyPublicPostSelect}&status=eq.approved&order=published_at.desc,created_at.desc&limit=${Number(limit)}&offset=${Number(offset)}`
    );
  }

  return rows.map(normalizePost);
}

export async function getPublicPostBySlug(slug) {
  let rows;
  try {
    rows = await getSupabaseRows(
      "posts",
      `${publicPostSelect}&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`
    );
  } catch (error) {
    if (!isMissingPostMetadataColumns(error)) throw error;
    rows = await getSupabaseRows(
      "posts",
      `${legacyPublicPostSelect}&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`
    );
  }

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
    content_type: post.postType ?? post.contentType ?? "blog",
    category: post.category ?? "general",
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
  const posts = await enrichPostsWithAuthors(rows.map(normalizePost));
  const revisions = await enrichPostsWithAuthors(revisionRows.map((revision) =>
    normalizePostRevision(
      revision,
      rows.find((post) => post.id === (revision.original_content_id ?? revision.originalContentId)) ?? null
    )
  ));

  return {
    allBlogPosts: [...revisions, ...posts],
    blogPosts: posts.filter((post) => post.approvalStatus === "approved")
  };
}
export async function createPost(post) {
  const currentUserId = getCurrentSupabaseUserId();
  const postData = await preparePostData(post, { ensureUniqueSlug: true });
  const authorProfile = currentUserId ? await getProfileById(currentUserId).catch(() => null) : null;
  const authorName = authorProfile?.name || postData.author_name || "Unknown author";

  return insertPostRow({
    ...postData,
    author_name: authorName,
    author_profile_picture_url: authorProfile?.profilePictureUrl ?? null,
    status: post.approvalStatus ?? "pending",
    submitted_by: currentUserId,
    published_at: (post.approvalStatus ?? "pending") === "approved" ? new Date().toISOString() : null
  });
}

export async function updatePost(postId, post) {
  const reviewed = ["approved", "rejected", "needs_changes", "archived"].includes(post.approvalStatus);
  const previousThumbnailPath = post.thumbnailPath ?? post.currentVersion?.thumbnailPath ?? null;
  const postData = await preparePostData(post, { currentPostId: post.originalId ?? postId });
  const submitterProfile = post.submittedBy ? await getProfileById(post.submittedBy).catch(() => null) : null;
  if (submitterProfile && (!postData.author_name || isRoleLikeAuthor(postData.author_name))) {
    postData.author_name = submitterProfile.name;
  }
  if (submitterProfile && !postData.author_profile_picture_url) {
    postData.author_profile_picture_url = submitterProfile.profilePictureUrl ?? null;
  }
  const proposedData = {
    ...post,
    thumbnailUrl: postData.thumbnail_url,
    thumbnailPath: postData.thumbnail_path,
    thumbnailFile: undefined
  };

  if (post.isRevision || post.revisionId) {
    const revisionId = post.revisionId ?? postId;

    if (post.approvalStatus === "approved") {
      return patchPostRows(`id=eq.${encodeURIComponent(post.originalId)}`, {
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

  const saved = await patchPostRows(`id=eq.${encodeURIComponent(postId)}`, {
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













