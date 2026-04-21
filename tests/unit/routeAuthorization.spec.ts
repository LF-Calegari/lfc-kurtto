import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import { HttpStatusCode } from '@utils/HttpStatusCode';

const envMock = {
  AUTH_SERVICE_URL: 'http://127.0.0.1:9',
  AUTH_SERVICE_VERIFY_TOKEN_PATH: '/api/v1/auth/verify-token',
  AUTH_SERVICE_TIMEOUT_MS: 5000,
  AUTH_SERVICE_CACHE_TTL_SECONDS: 0,
};

jest.unstable_mockModule('@config/env', () => ({
  env: envMock,
}));

jest.unstable_mockModule('@config/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.unstable_mockModule('@config/redis', () => ({
  getRedisClient: jest.fn(() => null),
  isRedisConfigured: jest.fn(() => false),
}));

type VerifyTokenBody = {
  id: string;
  permissions: string[];
  routeCodes: string[];
};

const okResponse = (routeCodes: string[] = []): Response => {
  const body: VerifyTokenBody = {
    id: 'test-user',
    permissions: [],
    routeCodes,
  };
  return new Response(JSON.stringify(body), {
    status: HttpStatusCode.OK,
    headers: { 'Content-Type': 'application/json' },
  });
};

const baseReq = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'get',
    headers: { authorization: 'Bearer t1' },
    baseUrl: '/api/v1',
    route: { path: '/urls' },
    path: '/urls',
    ...overrides,
  }) as unknown as Request;

describe('authorizeRoute', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips auth when shouldAuthorize returns false', async () => {
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute(() => false);
    const next = jest.fn() as NextFunction;
    await mw({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requires Bearer token', async () => {
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw({ headers: {} } as Request, {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Unauthorized: Bearer token is required.',
      statusCode: HttpStatusCode.UNAUTHORIZED,
    });
  });

  it('calls verify-token via GET Authorization header and allows granted route', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okResponse(['CODE_X']));
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute(
      () => true,
      () => 'CODE_X',
    );
    const next = jest.fn() as NextFunction;

    await mw(baseReq(), {} as Response, next);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/verify-token');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer t1',
    });
    expect(init?.body).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when required route code is not granted', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(['OTHER']));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute(
      () => true,
      () => 'CODE_X',
    );
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Forbidden: token has no permission for this route.',
      statusCode: HttpStatusCode.FORBIDDEN,
    });
  });

  it('allows when no route code is required (even with empty grants)', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse([]));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute(() => true);
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('maps 401 from auth-service to Unauthorized', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: HttpStatusCode.UNAUTHORIZED }));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: HttpStatusCode.UNAUTHORIZED,
    });
  });

  it('maps 403 from auth-service to Forbidden', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: HttpStatusCode.FORBIDDEN }));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: HttpStatusCode.FORBIDDEN,
    });
  });

  it('returns 503 on unexpected upstream status', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service unavailable',
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    });
  });

  it('returns 503 when upstream returns 200 with malformed body', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('not-a-json', {
          status: HttpStatusCode.OK,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service unavailable',
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
    });
  });

  it('returns 502 Bad Gateway when fetch throws (network error)', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service unreachable',
      statusCode: HttpStatusCode.BAD_GATEWAY,
    });
  });

  it('returns 504 Gateway Timeout when fetch is aborted', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const next = jest.fn() as NextFunction;
    await mw(baseReq(), {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service timeout',
      statusCode: HttpStatusCode.GATEWAY_TIMEOUT,
    });
  });
});
