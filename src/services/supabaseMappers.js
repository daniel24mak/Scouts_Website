import { getSupabasePublicFileUrl } from "./supabaseClient.js";

export function normalizeProfile(profile) {
  const role = profile.role ?? profile.role_id ?? "chief";
  const chiefLevel = profile.chief_level ?? profile.chiefLevel ?? null;

  return {
    id: profile.id,
    name: profile.full_name ?? profile.display_name ?? profile.name ?? profile.email ?? "Internal user",
    email: profile.email ?? profile.username ?? "",
    role,
    groupId: profile.group_id ?? profile.groupId ?? null,
    chiefLevel,
    accountStatus: profile.account_status ?? profile.accountStatus ?? "active",
    profilePictureUrl: profile.profile_picture_url ?? profile.profilePictureUrl ?? null,
    pendingName: profile.pending_name ?? profile.pendingName ?? null,
    pendingProfilePictureUrl: profile.pending_profile_picture_url ?? profile.pendingProfilePictureUrl ?? null,
    profileChangeStatus: profile.profile_change_status ?? profile.profileChangeStatus ?? null,
    profileChangeComment: profile.profile_change_comment ?? profile.profileChangeComment ?? "",
    profileChangeSubmittedAt: profile.profile_change_submitted_at ?? profile.profileChangeSubmittedAt ?? null,
    mustChangePassword: Boolean(profile.must_change_password ?? profile.mustChangePassword),
    createdAt: profile.created_at ?? profile.createdAt ?? null,
    updatedAt: profile.updated_at ?? profile.updatedAt ?? null,
    lastLogin: profile.last_login ?? profile.lastLogin ?? null,
    permissions: {
      canPublish: Boolean(profile.can_publish ?? profile.permissions?.canPublish),
      canCreateGroupMeetings: Boolean(
        profile.can_create_group_meetings ?? profile.permissions?.canCreateGroupMeetings
      ),
      canEditScouts: Boolean(profile.can_edit_scouts ?? profile.permissions?.canEditScouts),
      manageFormTemplates: Boolean(profile.manage_form_templates ?? profile.permissions?.manageFormTemplates),
      viewAllForms: Boolean(profile.view_all_forms ?? profile.permissions?.viewAllForms),
      postForms: Boolean(profile.post_forms ?? profile.permissions?.postForms)
    }
  };
}

export function normalizeGroup(group) {
  return {
    id: group.id,
    name: group.name,
    assignmentBasis: group.assignment_basis ?? group.assignmentBasis ?? "schoolGrade",
    gradeRange:
      group.grade_range ??
      (group.grade_start && group.grade_end ? `Grades ${group.grade_start}-${group.grade_end}` : ""),
    ageRange:
      group.age_range ?? (group.age_start && group.age_end ? `Ages ${group.age_start}-${group.age_end}` : ""),
    genderFilter: group.gender_filter ?? group.genderFilter ?? "mixed",
    scouts: []
  };
}

export function normalizeScout(scout) {
  return {
    id: scout.id,
    name: scout.name,
    schoolGrade: scout.school_grade ?? scout.schoolGrade ?? "",
    age: scout.age,
    gender: scout.gender ?? "",
    school: scout.school ?? "",
    groupId: scout.group_id ?? scout.groupId,
    equipeId: scout.equipe_id ?? scout.equipeId ?? null,
    parentName: scout.parent_name ?? scout.parentName ?? "",
    parentPhone: scout.parent_phone ?? scout.parentPhone ?? "",
    status: scout.status ?? "Registered",
    scoutYearId: scout.scout_year_id ?? scout.scoutYearId ?? null,
    source: scout.source ?? "supabase"
  };
}

export function normalizeEquipe(equipe, leaders = []) {
  return {
    id: equipe.id,
    groupId: equipe.group_id ?? equipe.groupId,
    name: equipe.name,
    description: equipe.description ?? "",
    createdBy: equipe.created_by ?? equipe.createdBy ?? null,
    createdAt: equipe.created_at ?? equipe.createdAt ?? null,
    updatedAt: equipe.updated_at ?? equipe.updatedAt ?? null,
    archivedAt: equipe.archived_at ?? equipe.archivedAt ?? null,
    isActive: Boolean(equipe.is_active ?? equipe.isActive ?? true),
    leaderId: leaders.find((leader) => leader.equipe_id === equipe.id && leader.role === "leader")?.chief_id ?? null,
    coLeaderId: leaders.find((leader) => leader.equipe_id === equipe.id && leader.role === "co_leader")?.chief_id ?? null
  };
}

export function normalizeRule(rule) {
  return {
    groupId: rule.group_id ?? rule.groupId,
    assignmentBasis: rule.assignment_basis ?? rule.assignmentBasis ?? "schoolGrade",
    gradeStart: Number(rule.grade_start ?? rule.gradeStart ?? 0),
    gradeEnd: Number(rule.grade_end ?? rule.gradeEnd ?? 0),
    ageStart: Number(rule.age_start ?? rule.ageStart ?? 0),
    ageEnd: Number(rule.age_end ?? rule.ageEnd ?? 0),
    genderFilter: rule.gender_filter ?? rule.genderFilter ?? "mixed"
  };
}

function normalizeAuthorName(value) {
  const author = String(value ?? "").trim();
  if (["group admin", "admin", "chief", "admin + chief", "scouts group"].includes(author.toLowerCase())) {
    return "Unknown author";
  }
  return author || "Unknown author";
}
export function normalizePost(post) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    postType: post.content_type ?? post.postType ?? post.type ?? "blog",
    contentType: post.content_type ?? post.postType ?? post.type ?? "blog",
    category: post.category ?? "general",
    date: post.published_at?.slice(0, 10) ?? post.date ?? post.created_at?.slice(0, 10) ?? "",
    author: normalizeAuthorName(post.author_name ?? post.author),
    authorProfilePictureUrl: post.author_profile_picture_url ?? post.authorProfilePictureUrl ?? null,
    thumbnailColor: post.thumbnail_color ?? post.thumbnailColor ?? "#2f7d6d",
    thumbnailUrl: post.thumbnail_url ?? post.thumbnailUrl ?? null,
    thumbnailPath: post.thumbnail_path ?? post.thumbnailPath ?? null,
    albumId: post.linked_album_id ?? post.album_id ?? post.albumId ?? null,
    excerpt: post.excerpt ?? "",
    body: post.body ?? post.excerpt ?? "",
    approvalStatus: post.status ?? post.approval_status ?? post.approvalStatus ?? "pending",
    reviewerComment: post.reviewer_comment ?? post.reviewerComment ?? "",
    submittedBy: post.submitted_by ?? post.submittedBy ?? null,
    createdAt: post.created_at ?? post.createdAt ?? null,
    updatedAt: post.updated_at ?? post.updatedAt ?? null
  };
}

export function normalizePostRevision(revision, originalPost = null) {
  const proposedData = revision.proposed_data ?? revision.proposedData ?? {};

  return {
    ...normalizePost({ ...(originalPost ?? {}), ...proposedData }),
    id: revision.id,
    revisionId: revision.id,
    originalId: revision.original_content_id ?? revision.originalContentId,
    isRevision: true,
    revisionType: originalPost ? "Blog update" : "New blog",
    approvalStatus: revision.status ?? "pending_update",
    reviewerComment: revision.reviewer_comment ?? revision.reviewerComment ?? "",
    submittedBy: revision.submitted_by ?? revision.submittedBy ?? null,
    createdAt: revision.created_at ?? revision.createdAt ?? null,
    updatedAt: revision.updated_at ?? revision.updatedAt ?? null,
    currentVersion: originalPost ? normalizePost(originalPost) : null
  };
}

export function normalizeAlbum(album, photos = []) {
  const firstApprovedPhoto = photos.find((photo) => photo.approvalStatus === "approved" && (photo.thumbnailUrl || photo.url));
  const thumbnailUrl = album.thumbnail_url ?? album.thumbnailUrl ?? firstApprovedPhoto?.thumbnailUrl ?? firstApprovedPhoto?.url ?? null;

  return {
    id: album.id,
    title: album.title,
    eventDate: album.event_date ?? album.eventDate ?? "",
    location: album.location ?? "",
    category: album.category ?? "Event",
    description: album.description ?? "",
    color: album.color ?? "#2f7d6d",
    thumbnailUrl,
    thumbnailPath: album.thumbnail_storage_path ?? album.thumbnail_path ?? album.thumbnailPath ?? null,
    thumbnailSource: album.thumbnail_source ?? (album.thumbnail_url ? "custom" : firstApprovedPhoto ? "first_image" : "placeholder"),
    photoCount: Number(album.photo_count ?? album.photoCount ?? photos.length),
    coverLabel: album.cover_label ?? album.coverLabel ?? album.category ?? "Album",
    approvalStatus: album.status ?? album.approval_status ?? album.approvalStatus ?? "pending",
    reviewerComment: album.reviewer_comment ?? album.reviewerComment ?? "",
    submittedBy: album.submitted_by ?? album.submittedBy ?? null,
    createdAt: album.created_at ?? album.createdAt ?? null,
    updatedAt: album.updated_at ?? album.updatedAt ?? null,
    photos
  };
}

export function normalizeAlbumRevision(revision, originalAlbum = null, photos = []) {
  const proposedData = revision.proposed_data ?? revision.proposedData ?? {};

  return {
    ...normalizeAlbum({ ...(originalAlbum ?? {}), ...proposedData }, proposedData.photos ?? photos),
    id: revision.id,
    revisionId: revision.id,
    originalId: revision.original_content_id ?? revision.originalContentId,
    isRevision: true,
    revisionType: originalAlbum ? "Album update" : "New album",
    approvalStatus: revision.status ?? "pending_update",
    reviewerComment: revision.reviewer_comment ?? revision.reviewerComment ?? "",
    submittedBy: revision.submitted_by ?? revision.submittedBy ?? null,
    createdAt: revision.created_at ?? revision.createdAt ?? null,
    updatedAt: revision.updated_at ?? revision.updatedAt ?? null,
    currentVersion: originalAlbum ? normalizeAlbum(originalAlbum, photos) : null
  };
}

export function normalizePhoto(photo) {
  const storagePath = photo.storage_path ?? photo.storagePath ?? null;
  const explicitUrl = photo.public_url ?? photo.url ?? null;
  const thumbnailPath = photo.thumbnail_storage_path ?? photo.thumbnail_path ?? photo.thumbnailPath ?? null;
  const thumbnailExplicitUrl = photo.thumbnail_url ?? photo.thumbnailUrl ?? null;

  return {
    id: photo.id,
    title: photo.title,
    albumId: photo.album_id ?? photo.albumId,
    uploadBatchId: photo.upload_batch_id ?? photo.uploadBatchId ?? null,
    storagePath,
    url: explicitUrl ?? getSupabasePublicFileUrl(storagePath),
    thumbnailUrl: thumbnailExplicitUrl ?? getSupabasePublicFileUrl(thumbnailPath, "gallery"),
    thumbnailPath,
    originalFileName: photo.original_file_name ?? photo.originalFileName ?? null,
    originalFormat: photo.original_format ?? photo.originalFormat ?? null,
    originalFileSize: photo.original_file_size ?? photo.originalFileSize ?? null,
    optimizedFileSize: photo.optimized_file_size ?? photo.optimizedFileSize ?? null,
    thumbnailFileSize: photo.thumbnail_file_size ?? photo.thumbnailFileSize ?? null,
    width: photo.optimized_width ?? photo.width ?? null,
    height: photo.optimized_height ?? photo.height ?? null,
    quality: photo.quality_used ?? photo.quality ?? null,
    approvalStatus: photo.status ?? photo.approval_status ?? photo.approvalStatus ?? "pending",
    reviewerComment: photo.reviewer_comment ?? photo.reviewerComment ?? "",
    submittedBy: photo.submitted_by ?? photo.submittedBy ?? null,
    createdAt: photo.created_at ?? photo.createdAt ?? null,
    sortOrder: Number(photo.sort_order ?? photo.sortOrder ?? 0)
  };
}

export function normalizePhotoUploadBatch(batch, album = null, photos = []) {
  return {
    id: batch.id,
    albumId: batch.album_id ?? batch.albumId,
    albumTitle: album?.title ?? "Gallery album",
    title: `${album?.title ?? "Album"} photo upload`,
    contentType: "Photo batch",
    approvalStatus: batch.status ?? batch.approval_status ?? batch.approvalStatus ?? "pending",
    reviewerComment: batch.reviewer_comment ?? batch.reviewerComment ?? "",
    submittedBy: batch.submitted_by ?? batch.submittedBy ?? null,
    reviewedBy: batch.reviewed_by ?? batch.reviewedBy ?? null,
    reviewedAt: batch.reviewed_at ?? batch.reviewedAt ?? null,
    createdAt: batch.created_at ?? batch.createdAt ?? null,
    updatedAt: batch.updated_at ?? batch.updatedAt ?? null,
    photoCount: Number(batch.photo_count ?? batch.photoCount ?? photos.length),
    photos
  };
}

export function normalizeEvent(event) {
  const dateFrom = event.date_from ?? event.dateFrom ?? event.event_date ?? event.date;
  const dateTo = event.date_to ?? event.dateTo ?? dateFrom;

  return {
    id: event.id,
    title: event.title,
    date: event.event_date ?? dateFrom,
    dateFrom,
    dateTo,
    startTime: event.start_time ?? event.startTime ?? "",
    endTime: event.end_time ?? event.endTime ?? "",
    type: event.event_type ?? event.type ?? "event",
    status: event.event_status ?? event.status ?? "planned",
    approvalStatus: event.status ?? event.approval_status ?? event.approvalStatus ?? "approved",
    reviewerComment: event.reviewer_comment ?? event.reviewerComment ?? "",
    visibility: event.visibility ?? "public",
    groupId: event.group_id ?? event.groupId ?? null,
    visibleGroupIds: event.visible_group_ids ?? event.visibleGroupIds ?? [],
    location: event.location ?? "",
    locationUrl: event.location_url ?? event.locationUrl ?? event.location_link ?? event.locationLink ?? event.map_url ?? event.mapUrl ?? "",
    mapEmbedUrl: event.map_embed_url ?? event.mapEmbedUrl ?? event.location_embed_url ?? event.locationEmbedUrl ?? "",
    color: event.color ?? event.event_color ?? event.eventColor ?? event.accent_color ?? event.accentColor ?? null,
    description: event.description ?? "",
    imageUrl: event.image_url ?? event.imageUrl ?? null,
    storagePath: event.storage_path ?? event.storagePath ?? null,
    linkedBlogId: event.linked_blog_id ?? event.linkedBlogId ?? null,
    linkedAlbumId: event.linked_album_id ?? event.linkedAlbumId ?? null,
    submittedBy: event.submitted_by ?? event.created_by ?? event.submittedBy ?? event.createdBy ?? null,
    createdAt: event.created_at ?? event.createdAt ?? null,
    updatedAt: event.updated_at ?? event.updatedAt ?? null
  };
}








