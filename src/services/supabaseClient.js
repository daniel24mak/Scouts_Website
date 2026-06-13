const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
const storageBucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? "scouts-files";
const sessionStorageKey = "scouts-supabase-session";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function getStoredSupabaseSession() {
  const rawSession = window.localStorage.getItem(sessionStorageKey);

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession);
    if (!session?.access_token) {
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

export function storeSupabaseSession(session) {
  if (session?.access_token) {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    return;
  }

  window.localStorage.removeItem(sessionStorageKey);
}

export function clearSupabaseSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

export function getCurrentSupabaseUserId() {
  return getStoredSupabaseSession()?.user?.id ?? null;
}

export async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = options.accessToken ?? getStoredSupabaseSession()?.access_token;
  const authToken = accessToken ?? supabasePublishableKey;
  const headers = {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${authToken}`,
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {})
  };

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getSupabaseTable(table, query = "select=*") {
  return supabaseRequest(`/rest/v1/${table}?${query}`);
}

export function getSupabaseRows(table, query = "select=*") {
  return getSupabaseTable(table, query);
}

export function insertSupabaseRow(table, row) {
  return supabaseRequest(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
}

export function insertSupabaseRows(table, rows) {
  return supabaseRequest(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows)
  });
}

export function upsertSupabaseRows(table, rows, onConflict) {
  const conflict = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";

  return supabaseRequest(`/rest/v1/${table}${conflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows)
  });
}

export function updateSupabaseRow(table, id, row) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
}

export function patchSupabaseRows(table, filter, row) {
  return supabaseRequest(`/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
}

export function deleteSupabaseRows(table, filter) {
  return supabaseRequest(`/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
}

export function callSupabaseAuth(path, payload, options = {}) {
  return supabaseRequest(`/auth/v1/${path}`, {
    method: options.method ?? "POST",
    accessToken: options.accessToken,
    body: payload ? JSON.stringify(payload) : undefined
  });
}

export async function uploadSupabaseFile(path, file, bucket = storageBucket) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = getStoredSupabaseSession()?.access_token;
  const authToken = accessToken ?? supabasePublishableKey;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    }
  );

  if (!response.ok) {
    throw new Error((await response.text()) || `Supabase storage upload failed: ${response.status}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export async function deleteSupabaseFiles(paths, bucket = storageBucket) {
  const cleanPaths = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);

  if (!cleanPaths.length) {
    return null;
  }

  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = getStoredSupabaseSession()?.access_token;
  const authToken = accessToken ?? supabasePublishableKey;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prefixes: cleanPaths })
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `Supabase storage delete failed: ${response.status}`);
  }

  return response.json();
}

export function deleteSupabaseFile(path, bucket = storageBucket) {
  return deleteSupabaseFiles([path], bucket);
}

export function getSupabasePublicFileUrl(path, bucket = storageBucket) {
  if (!path || /^https?:\/\//i.test(path)) {
    return path ?? null;
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}
