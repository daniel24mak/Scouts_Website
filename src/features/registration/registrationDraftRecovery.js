const databaseName = "scouts-registration-recovery";
const storeName = "drafts";
const databaseVersion = 1;
const localKeyPrefix = "scouts-registration-recovery:";

function recoveryKey(campaignSlug) {
  return `${localKeyPrefix}${campaignSlug}`;
}

function containsFile(value) {
  if (typeof File === "undefined") return false;
  if (value instanceof File) return true;
  return Array.isArray(value) && value.some((item) => item instanceof File);
}

export function getSerializableRegistrationAnswers(answers = {}) {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => !containsFile(value))
  );
}

function saveLocalFallback(campaignSlug, recovery) {
  try {
    window.localStorage.setItem(recoveryKey(campaignSlug), JSON.stringify({
      ...recovery,
      answers: getSerializableRegistrationAnswers(recovery.answers)
    }));
  } catch {
    // IndexedDB remains the primary store when local storage is unavailable.
  }
}

function loadLocalFallback(campaignSlug) {
  try {
    return JSON.parse(window.localStorage.getItem(recoveryKey(campaignSlug)) || "null");
  } catch {
    return null;
  }
}

function openRecoveryDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Local file recovery is unavailable in this browser."));
      return;
    }
    const request = window.indexedDB.open(databaseName, databaseVersion);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "campaignSlug" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction(mode, operation) {
  const database = await openRecoveryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveRegistrationRecovery(campaignSlug, recovery) {
  if (!campaignSlug) return;
  const saved = {
    ...recovery,
    campaignSlug,
    updatedAt: new Date().toISOString()
  };
  saveLocalFallback(campaignSlug, saved);
  try {
    await runTransaction("readwrite", (store) => store.put(saved));
  } catch {
    // Text answers still recover through the local fallback if IndexedDB is blocked.
  }
}

export async function loadRegistrationRecovery(campaignSlug) {
  const fallback = loadLocalFallback(campaignSlug);
  let stored = null;
  try {
    stored = await runTransaction("readonly", (store) => store.get(campaignSlug));
  } catch {
    // Fall back to text-only recovery when IndexedDB is unavailable.
  }
  if (!stored) return fallback;
  return {
    ...fallback,
    ...stored,
    answers: {
      ...(fallback?.answers ?? {}),
      ...(stored.answers ?? {})
    }
  };
}

export async function clearRegistrationRecovery(campaignSlug) {
  try {
    window.localStorage.removeItem(recoveryKey(campaignSlug));
  } catch {
    // Continue clearing IndexedDB.
  }
  try {
    await runTransaction("readwrite", (store) => store.delete(campaignSlug));
  } catch {
    // Clearing is best-effort when browser storage has already been removed.
  }
}
