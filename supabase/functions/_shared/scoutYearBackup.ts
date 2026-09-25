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
  const campaigns = new Set((snapshot.data.registration_campaigns ?? []).filter((row) => row.scout_year_id === snapshot.yearId).map((row) => row.id));
  const submissions = new Set((snapshot.data.scout_registration_submissions ?? []).filter((row) => campaigns.has(row.campaign_id)).map((row) => row.id));
  const drafts = new Set((snapshot.data.scout_registration_drafts ?? []).filter((row) => campaigns.has(row.campaign_id)).map((row) => row.id));
  const defaultBuckets: Record<string, string> = {
    registration_uploads: uploadBucket,
    gallery_images: "gallery",
    gallery_albums: "album-thumbnails",
    album_revisions: "album-thumbnails",
    posts: "blog-thumbnails",
    post_revisions: "blog-thumbnails",
    calendar_events: "event-images",
    documents: "dashboard-documents",
    reports: uploadBucket
  };
  for (const [dataset, rows] of Object.entries(snapshot.data)) {
    for (const row of rows) {
      // Cross-year derivative documents are in the snapshot but survive deletion.
      const owned = (dataset === "registration_uploads" && row.scout_year_id === snapshot.yearId)
        || (dataset === "scout_registration_documents" && (submissions.has(row.submission_id) || drafts.has(row.draft_id)));
      const visit = (value: unknown, inheritedBucket?: unknown) => {
        if (Array.isArray(value)) { for (const item of value) visit(item, inheritedBucket); return; }
        if (!isRecord(value)) return;
        const bucket = value.bucket_id ?? value.bucketId ?? value.storage_bucket ?? value.storageBucket ?? value.bucket ?? inheritedBucket;
        for (const [key, item] of Object.entries(value)) {
          const pathKey = normalizedPathKey(key);
          if (/(?:^|_)(?:storage_path|object_path|file_path|thumbnail_path|image_path)$/.test(pathKey) && item !== null && item !== "") {
            const ref = safeStorageReference(bucket ?? defaultBuckets[dataset], item);
            const identity = referenceKey(ref);
            const existing = refs.get(identity);
            // A reference from any preserved content always prevents later cleanup.
            refs.set(identity, { ...ref, deleteWithYear: owned && (existing?.deleteWithYear ?? true) });
          } else if (typeof item === "object") visit(item, bucket);
        }
      };
      visit(row);
    }
  }
  return [...refs.values()].sort((a, b) => compare(a.bucket, b.bucket) || compare(a.path, b.path)).map((ref, index) => {
    // The ordinal prevents collisions even on case-insensitive extractors after
    // different original names normalize to the same safe ASCII basename.
    const basename = (ref.path.split("/").pop() ?? "file").replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/^\.+/, "_").slice(-100) || "file";
    return { ...ref, archivePath: `files/${String(index + 1).padStart(6, "0")}-${ref.bucket.slice(0, 60)}-${basename}` };
  });
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
