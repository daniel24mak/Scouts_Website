// Runtime-independent archive helpers. The snapshot hash is supplied by the
// trusted PostgreSQL RPC: JSON.stringify is not PostgreSQL's jsonb serialization.
type Row = Record<string, unknown>;
export type BackupSnapshot = {
  version: 1;
  yearId: string;
  snapshotHash: string;
  counts: Record<string, number>;
  data: Record<string, Row[]>;
};
export type CsvExport = { archivePath: string; dataset: string; bytes: Uint8Array };
export type StorageReference = {
  bucket: string;
  path: string;
  archivePath: string;
  deleteWithYear: boolean;
};
export type DownloadedFile = StorageReference & { bytes: Uint8Array };
export type DeterministicZipEntry = [Uint8Array, { mtime: Date }];

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const referenceKey = (ref: { bucket: string; path: string }) => JSON.stringify([ref.bucket, ref.path]);

export function validateBackupSnapshot(value: unknown, yearId: string): BackupSnapshot {
  if (!isRecord(value) || value.version !== 1 || value.yearId !== yearId
    || typeof value.snapshotHash !== "string" || !/^[a-f0-9]{64}$/.test(value.snapshotHash)
    || !isRecord(value.data) || !isRecord(value.counts)) throw new Error("Invalid backup snapshot");
  const { data, counts } = value;
  if (Object.keys(data).length !== Object.keys(counts).length) throw new Error("Invalid backup snapshot counts");
  for (const [name, rows] of Object.entries(data)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name) || !Array.isArray(rows) || !rows.every(isRecord)
      || counts[name] !== rows.length) throw new Error("Invalid backup snapshot dataset");
  }
  const years = data.scout_years;
  if (!Array.isArray(years) || years.length !== 1 || years[0].id !== yearId || years[0].is_active !== false) {
    throw new Error("Backup requires an existing inactive scouting year");
  }
  return value as BackupSnapshot;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort(compare).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function rowsToCsv(rows: Row[]): string {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort(compare);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : typeof value === "object" ? canonicalJson(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const sorted = [...rows].sort((a, b) => compare(String(a.id ?? ""), String(b.id ?? "")) || compare(canonicalJson(a), canonicalJson(b)));
  return [columns.map(escape).join(","), ...sorted.map((row) => columns.map((key) => escape(row[key])).join(","))].join("\r\n") + "\r\n";
}

export function createCsvExports(snapshot: BackupSnapshot): CsvExport[] {
  const encoder = new TextEncoder();
  return [
    { archivePath: "year.csv", dataset: "scout_years", bytes: encoder.encode(rowsToCsv(snapshot.data.scout_years)) },
    ...Object.keys(snapshot.data).sort(compare).filter((name) => snapshot.data[name].length).map((name) => ({
      archivePath: `${name}.csv`, dataset: name, bytes: encoder.encode(rowsToCsv(snapshot.data[name]))
    }))
  ];
}

function safeStorageReference(bucket: unknown, path: unknown): { bucket: string; path: string } {
  if (typeof bucket !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(bucket)
    || typeof path !== "string" || !path.trim() || path.length > 4096
    || /[\\\u0000-\u001f\u007f]/.test(path) || path.startsWith("/") || path.includes(":")
    || path.split("/").some((part) => !part || part === "." || part === ".." || /%(?:2e|2f|5c|00)/i.test(part))) {
    throw new Error("Invalid or unmapped storage reference");
  }
  return { bucket, path };
}

function normalizedPathKey(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function collectStorageReferences(snapshot: BackupSnapshot, uploadBucket = "scouts-files"): StorageReference[] {
  const refs = new Map<string, Omit<StorageReference, "archivePath">>();
  const consumedPathFields = new WeakMap<object, Set<string>>();
  const campaigns = new Set((snapshot.data.registration_campaigns ?? []).filter((row) => row.scout_year_id === snapshot.yearId).map((row) => row.id));
  const submissions = new Set((snapshot.data.scout_registration_submissions ?? []).filter((row) => campaigns.has(row.campaign_id)).map((row) => row.id));
  const drafts = new Set((snapshot.data.scout_registration_drafts ?? []).filter((row) => campaigns.has(row.campaign_id)).map((row) => row.id));
  const registrationDocumentBuckets = new Set(["scout-headshots", "identity-documents", "form-attachments"]);
  const addPath = (record: Row, keys: string[], bucket: string, deleteWithYear: boolean) => {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === null || record[key] === "") continue;
      const consumed = consumedPathFields.get(record) ?? new Set<string>();
      consumed.add(key);
      consumedPathFields.set(record, consumed);
      const ref = safeStorageReference(bucket, record[key]);
      const identity = referenceKey(ref);
      const existing = refs.get(identity);
      // A reference from any preserved content always prevents later cleanup.
      refs.set(identity, { ...ref, deleteWithYear: deleteWithYear && (existing?.deleteWithYear ?? true) });
    }
  };
  const addPhotoPaths = (value: unknown) => {
    if (!isRecord(value)) return;
    addPath(value, ["storage_path", "storagePath"], "gallery", false);
    addPath(value, ["thumbnail_storage_path", "thumbnail_path", "thumbnailPath"], "gallery", false);
  };
  const addAlbumShape = (value: unknown) => {
    if (!isRecord(value)) return;
    addPath(value, ["thumbnail_storage_path", "thumbnail_path", "thumbnailPath"], "album-thumbnails", false);
    if (Array.isArray(value.photos)) for (const photo of value.photos) addPhotoPaths(photo);
  };
  for (const [dataset, rows] of Object.entries(snapshot.data)) {
    for (const row of rows) {
      if (dataset === "registration_uploads") addPath(row, ["storage_path"], uploadBucket, row.scout_year_id === snapshot.yearId);
      else if (dataset === "posts") addPath(row, ["thumbnail_path"], "blog-thumbnails", false);
      else if (dataset === "post_revisions" && isRecord(row.proposed_data)) {
        addPath(row.proposed_data, ["thumbnail_path", "thumbnailPath"], "blog-thumbnails", false);
        if (isRecord(row.proposed_data.currentVersion)) addPath(row.proposed_data.currentVersion, ["thumbnail_path", "thumbnailPath"], "blog-thumbnails", false);
      } else if (dataset === "gallery_albums") addPath(row, ["thumbnail_storage_path", "thumbnail_path"], "album-thumbnails", false);
      else if (dataset === "album_revisions" && isRecord(row.proposed_data)) {
        addAlbumShape(row.proposed_data);
        addAlbumShape(row.proposed_data.currentVersion);
      } else if (dataset === "gallery_images") addPhotoPaths(row);
      else if (dataset === "calendar_events") addPath(row, ["storage_path"], "event-images", false);
      else if (dataset === "documents") addPath(row, ["storage_path"], "dashboard-documents", false);
      else if (dataset === "reports") addPath(row, ["storage_path"], uploadBucket, false);
      else if (dataset === "scout_registration_documents") {
        if (typeof row.bucket_id !== "string" || !registrationDocumentBuckets.has(row.bucket_id)) {
          throw new Error("Invalid or unmapped storage reference");
        }
        const tombstone = row.verification_status === "deleted" || row.deleted_at != null || String(row.object_path).endsWith(".deleted");
        if (tombstone) {
          const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
          const parts = typeof row.object_path === "string" ? row.object_path.split("/") : [];
          if (row.verification_status !== "deleted" || typeof row.deleted_at !== "string" || !Number.isFinite(Date.parse(row.deleted_at))
            || parts.length !== 3 || parts[0] !== row.submission_id || parts[1] !== row.id
            || !uuid.test(parts[0]) || !uuid.test(parts[1]) || !parts[2].endsWith(".deleted") || !uuid.test(parts[2].slice(0, -8))) {
            throw new Error("Invalid registration document tombstone");
          }
          consumedPathFields.set(row, new Set(["object_path"]));
          continue;
        }
        addPath(row, ["object_path"], row.bucket_id, submissions.has(row.submission_id) || drafts.has(row.draft_id));
      } else if (dataset === "archived_years" && isRecord(row.snapshot)) {
        if (Array.isArray(row.snapshot.posts)) for (const post of row.snapshot.posts) {
          if (isRecord(post)) addPath(post, ["thumbnailPath"], "blog-thumbnails", false);
        }
        if (Array.isArray(row.snapshot.albums)) for (const album of row.snapshot.albums) addAlbumShape(album);
        if (Array.isArray(row.snapshot.events)) for (const event of row.snapshot.events) {
          if (isRecord(event)) addPath(event, ["storagePath"], "event-images", false);
        }
      }
    }
  }
  const assertNoUnmappedPath = (value: unknown) => {
    if (Array.isArray(value)) { for (const item of value) assertNoUnmappedPath(item); return; }
    if (!isRecord(value)) return;
    for (const [key, item] of Object.entries(value)) {
      const pathKey = normalizedPathKey(key);
      if (/(?:^|_)(?:storage_path|object_path|file_path|thumbnail_path|image_path)$/.test(pathKey)
        && item !== null && item !== "" && !consumedPathFields.get(value)?.has(key)) {
        throw new Error("Invalid or unmapped storage reference");
      }
      if (typeof item === "object") assertNoUnmappedPath(item);
    }
  };
  assertNoUnmappedPath(snapshot.data);
  return [...refs.values()].sort((a, b) => compare(a.bucket, b.bucket) || compare(a.path, b.path)).map((ref, index) => {
    // The ordinal prevents collisions even on case-insensitive extractors after
    // different original names normalize to the same safe ASCII basename.
    const basename = (ref.path.split("/").pop() ?? "file").replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/^\.+/, "_").slice(-100) || "file";
    return { ...ref, archivePath: `files/${String(index + 1).padStart(6, "0")}-${ref.bucket.slice(0, 60)}-${basename}` };
  });
}

export function createDeterministicZipEntries(
  files: Array<{ archivePath: string; bytes: Uint8Array }>,
  manifestBytes: Uint8Array
): Record<string, DeterministicZipEntry> {
  const entries: Record<string, DeterministicZipEntry> = Object.create(null);
  const add = (archivePath: string, bytes: Uint8Array) => {
    // ZIP timestamps are local DOS fields. Constructing the fixed date in local
    // time keeps the encoded fields identical in every runtime timezone.
    entries[archivePath] = [bytes, { mtime: new Date(2000, 0, 1, 0, 0, 0, 0) }];
  };
  for (const file of files) add(file.archivePath, file.bytes);
  add("manifest.json", manifestBytes);
  return entries;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBackupManifest(
  snapshot: BackupSnapshot,
  csvFiles: CsvExport[],
  references: StorageReference[],
  downloaded: DownloadedFile[],
  generatedAt: string
) {
  const downloadedByKey = new Map(downloaded.map((file) => [referenceKey(file), file]));
  const missing = references.filter((ref) => {
    const file = downloadedByKey.get(referenceKey(ref));
    return !file || file.archivePath !== ref.archivePath;
  }).map(({ bucket, path }) => ({ bucket, path }));
  if (downloadedByKey.size !== downloaded.length || downloaded.some((file) => !references.some((ref) => referenceKey(ref) === referenceKey(file)))) {
    throw new Error("Unexpected backup file inventory");
  }
  const files = await Promise.all([
    ...csvFiles.map(async (file) => ({ archivePath: file.archivePath, dataset: file.dataset, sizeBytes: file.bytes.length, sha256: await sha256Hex(file.bytes) })),
    ...downloaded.map(async (file) => ({ archivePath: file.archivePath, bucket: file.bucket, path: file.path, deleteWithYear: file.deleteWithYear, sizeBytes: file.bytes.length, sha256: await sha256Hex(file.bytes) }))
  ]);
  const filesComplete = missing.length === 0;
  return {
    version: 1, complete: filesComplete, filesComplete,
    yearId: snapshot.yearId, yearLabel: String(snapshot.data.scout_years[0].label ?? ""),
    generatedAt, snapshotHash: snapshot.snapshotHash, counts: snapshot.counts, files, missing
  };
}
