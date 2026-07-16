import { SCOPE_TYPES } from "./accessControlCatalog.js";

const ACTIVE_ACCOUNT_STATUS = "active";
const APPROVED_SCOPE_TYPES = new Set(SCOPE_TYPES);
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseOptionalTimestamp(entry, key) {
  const supplied = Object.hasOwn(entry, key) && entry[key] !== null && entry[key] !== undefined;
  if (!supplied) return null;
  if (typeof entry[key] !== "string") return Number.NaN;

  const match = entry[key].match(ISO_TIMESTAMP_PATTERN);
  if (!match) return Number.NaN;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(hour, minute, second, 0);
  if (
    calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day
    || calendarDate.getUTCHours() !== hour
    || calendarDate.getUTCMinutes() !== minute
    || calendarDate.getUTCSeconds() !== second
  ) return Number.NaN;

  return Date.parse(entry[key]);
}

function isCurrent(entry, now) {
  if (!entry || typeof entry !== "object") return false;

  const startsAt = parseOptionalTimestamp(entry, "startsAt");
  const expiresAt = parseOptionalTimestamp(entry, "expiresAt");

  if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt > now)) return false;
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) return false;
  return true;
}

function normalizeEntries(entries, now) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => isCurrent(entry, now)).map((entry) => ({ ...entry }));
}

function scopeMatches(candidate, scope) {
  if (!APPROVED_SCOPE_TYPES.has(candidate.scopeType)) return false;
  if (scope && !APPROVED_SCOPE_TYPES.has(scope.type)) return false;
  if (candidate.scopeType === "global") {
    return Object.hasOwn(candidate, "scopeId") && candidate.scopeId === null;
  }
  if (!scope || candidate.scopeType !== scope.type) return false;

  if (candidate.scopeType === "own_records") {
    return Object.hasOwn(candidate, "scopeId")
      && candidate.scopeId === null
      && Object.hasOwn(scope, "id")
      && scope.id === null;
  }
  if (typeof candidate.scopeId !== "string" || !candidate.scopeId.trim()) return false;
  if (typeof scope.id !== "string" || !scope.id.trim()) return false;
  return candidate.scopeId === scope.id;
}

function restrictionMatches(restriction, scope) {
  const validScopeType = ["global", "group", "team", "event", "own_records"].includes(restriction.scopeType);
  if (!validScopeType) return true;
  if (["global", "own_records"].includes(restriction.scopeType)) {
    if (!Object.hasOwn(restriction, "scopeId") || restriction.scopeId !== null) return true;
  }
  if (["group", "team", "event"].includes(restriction.scopeType)) {
    if (
      typeof restriction.scopeId !== "string"
      || !restriction.scopeId.length
      || restriction.scopeId !== restriction.scopeId.trim()
    ) return true;
  }
  return scopeMatches(restriction, scope);
}

export function normalizeEffectiveAccess(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const now = Date.now();

  return {
    accountStatus: source.accountStatus ?? "missing",
    roles: normalizeEntries(source.roles, now),
    permissions: normalizeEntries(source.permissions, now),
    groupAssignments: normalizeEntries(source.groupAssignments, now),
    teamMemberships: normalizeEntries(source.teamMemberships, now),
    restrictions: normalizeEntries(source.restrictions, now),
    generatedAt: source.generatedAt ?? null
  };
}

export function hasEffectivePermission(access, permissionKey, scope = null) {
  const normalizedAccess = normalizeEffectiveAccess(access);
  if (normalizedAccess.accountStatus !== ACTIVE_ACCOUNT_STATUS || !permissionKey) return false;

  const denied = normalizedAccess.restrictions.some((restriction) => (
    restriction.effect === "deny"
    && restriction.key === permissionKey
    && restrictionMatches(restriction, scope)
  ));
  if (denied) return false;

  return normalizedAccess.permissions.some((permission) => (
    permission.key === permissionKey && scopeMatches(permission, scope)
  ));
}

export function getAccessibleGroupIds(access) {
  const normalizedAccess = normalizeEffectiveAccess(access);
  if (normalizedAccess.accountStatus !== ACTIVE_ACCOUNT_STATUS) return [];

  return [...new Set(
    normalizedAccess.groupAssignments
      .map((assignment) => assignment.groupId)
      .filter((groupId) => typeof groupId === "string" && groupId.length > 0 && groupId === groupId.trim())
  )].sort((left, right) => left.localeCompare(right));
}

export function compareLegacyAndNormalized({
  legacyAllowed,
  normalizedAllowed,
  permissionKey,
  scope = null
}) {
  const normalizedLegacyAllowed = Boolean(legacyAllowed);
  const normalizedNewAllowed = Boolean(normalizedAllowed);

  return {
    matches: normalizedLegacyAllowed === normalizedNewAllowed,
    legacyAllowed: normalizedLegacyAllowed,
    normalizedAllowed: normalizedNewAllowed,
    permissionKey,
    scopeType: scope?.type ?? "global",
    scopeId: scope?.id ?? null
  };
}
