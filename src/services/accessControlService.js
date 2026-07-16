import { normalizeEffectiveAccess } from "./accessControlResolver.js";
import { normalizeAuthorizationMigrationDifference } from "./supabaseMappers.js";
import { callSupabaseRpc, getSupabaseRows } from "./supabaseClient.js";

export function createAccessControlService({ callRpc = callSupabaseRpc, getRows = getSupabaseRows } = {}) {
  const getMyEffectiveAccess = async () => {
    try {
      return normalizeEffectiveAccess(await callRpc("get_my_effective_access", {}));
    } catch {
      return { ...normalizeEffectiveAccess(), loadError: "Effective access could not be loaded." };
    }
  };

  const getAuthorizationMigrationDifferences = async ({ limit = 200 } = {}) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const rows = await getRows(
      "authorization_migration_differences",
      `select=*&resolved_at=is.null&order=created_at.desc&limit=${safeLimit}`
    );
    return rows.map(normalizeAuthorizationMigrationDifference);
  };

  const getBootstrapShadowAccess = async ({ isLegacyAdmin = false } = {}) => {
    const effectiveAccess = await getMyEffectiveAccess();
    if (!isLegacyAdmin) return { effectiveAccess, authorizationMigrationDifferences: [] };

    try {
      return {
        effectiveAccess,
        authorizationMigrationDifferences: await getAuthorizationMigrationDifferences()
      };
    } catch {
      return {
        effectiveAccess,
        authorizationMigrationDifferences: [],
        authorizationMigrationDifferencesLoadError: "Authorization migration differences could not be loaded."
      };
    }
  };

  return { getMyEffectiveAccess, getAuthorizationMigrationDifferences, getBootstrapShadowAccess };
}

const accessControlService = createAccessControlService();
export const getMyEffectiveAccess = accessControlService.getMyEffectiveAccess;
export const getAuthorizationMigrationDifferences = accessControlService.getAuthorizationMigrationDifferences;
export const getBootstrapShadowAccess = accessControlService.getBootstrapShadowAccess;
