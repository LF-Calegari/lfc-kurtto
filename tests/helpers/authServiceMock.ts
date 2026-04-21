import { jest } from '@jest/globals';

import { HttpStatusCode } from '@utils/HttpStatusCode';

/**
 * Lista default de routeCodes que o mock do auth-service concede para o
 * usuário de teste. Reflete o seed real em `KurttoAccessSeeder` do
 * auth-service: apenas as operações "admin" são autorizadas por route
 * code; POST/PATCH/DELETE normais são públicos e não passam por
 * verify-token.
 */
export const ALL_URL_ROUTE_CODES: ReadonlyArray<string> = Object.freeze([
  'KURTTO_V1_URLS_PATCH_RESTORE',
  'KURTTO_V1_URLS_LIST_INCLUDE_DELETED',
  'KURTTO_V1_URLS_GET_BY_CODE_INCLUDE_DELETED',
]);

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Monta um Response compatível com o que o auth-service devolveria em
 * `GET /api/v1/auth/verify-token`: quando status=200 embute JSON com
 * `routeCodes`; outros status mantêm body vazio (401/403/5xx).
 */
export function makeAuthServiceResponse(
  status: number,
  routeCodes: ReadonlyArray<string> = ALL_URL_ROUTE_CODES,
): Response {
  if (status === HttpStatusCode.OK) {
    return new Response(
      JSON.stringify({
        id: TEST_USER_ID,
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
): jest.SpiedFunction<typeof fetch> {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(makeAuthServiceResponse(status, routeCodes)),
    );
}
