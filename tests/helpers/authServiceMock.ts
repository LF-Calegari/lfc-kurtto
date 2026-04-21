import { jest } from '@jest/globals';

import { HttpStatusCode } from '@utils/HttpStatusCode';

/**
 * Route codes do seed `KurttoAccessSeeder` no auth-service. Usuário com
 * **todos** estes códigos é administrador Kurtto (sem filtro `owner_id`).
 */
export const ALL_URL_ROUTE_CODES: ReadonlyArray<string> = Object.freeze([
  'KURTTO_V1_URLS_PATCH_RESTORE',
  'KURTTO_V1_URLS_LIST_INCLUDE_DELETED',
  'KURTTO_V1_URLS_GET_BY_CODE_INCLUDE_DELETED',
]);

/** Identidade padrão dos testes de integração (não é o UUID legado sem dono). */
export const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export const TEST_USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

/**
 * Monta um Response compatível com o que o auth-service devolveria em
 * `GET /api/v1/auth/verify-token`: quando status=200 embute JSON com
 * `routeCodes`; outros status mantêm body vazio (401/403/5xx).
 */
export function makeAuthServiceResponse(
  status: number,
  routeCodes: ReadonlyArray<string> = ALL_URL_ROUTE_CODES,
  userId: string = TEST_USER_ID,
): Response {
  if (status === HttpStatusCode.OK) {
    return new Response(
      JSON.stringify({
        id: userId,
        permissions: [],
        routeCodes,
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(null, { status });
}

/**
 * Helper curto para substituir `globalThis.fetch` por um spy que responde
 * sempre com o Response gerado por `makeAuthServiceResponse(status)`.
 * Retorna o próprio spy para asserções adicionais.
 *
 * Usa `mockImplementation` (não `mockResolvedValue`) porque o body de um
 * `Response` é um stream consumível uma única vez: reutilizar a mesma
 * instância entre chamadas faria `response.json()` falhar a partir da
 * segunda requisição.
 */
export function mockAuthServiceResponse(
  status: number,
  routeCodes?: ReadonlyArray<string>,
  userId?: string,
): jest.SpiedFunction<typeof fetch> {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      makeAuthServiceResponse(
        status,
        routeCodes ?? ALL_URL_ROUTE_CODES,
        userId ?? TEST_USER_ID,
      ),
    ),
  );
}
