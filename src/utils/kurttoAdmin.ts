import type { AuthVerificationResult } from '@services/AuthVerificationService';

/**
 * Route codes seedados no auth-service (`KurttoAccessSeeder`) para operações
 * que antes exigiam credencial além do escopo por proprietário. Usuário com
 * **todos** estes códigos é tratado como administrador Kurtto (sem filtro
 * `owner_id` nas operações de URL).
 */
export const KURTTO_ADMIN_ROUTE_CODES = [
  'KURTTO_V1_URLS_PATCH_RESTORE',
  'KURTTO_V1_URLS_LIST_INCLUDE_DELETED',
  'KURTTO_V1_URLS_GET_BY_CODE_INCLUDE_DELETED',
] as const;

export function isKurttoAdmin(user: AuthVerificationResult): boolean {
  return KURTTO_ADMIN_ROUTE_CODES.every((code) =>
    user.routeCodes.includes(code),
  );
}
