import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import { HttpStatusCode } from '@utils/HttpStatusCode';

const envMock = {
  AUTH_SERVICE_URL: 'http://127.0.0.1:9',
  AUTH_SERVICE_AUTHORIZE_ROUTE_PATH: '/api/v1/auth/authorize-route',
  AUTH_SERVICE_TIMEOUT_MS: 5000,
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
    });
  });

  it('calls auth-service with POST JSON and proceeds on 200', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: HttpStatusCode.OK }));
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute(
      () => true,
      () => 'CODE_X',
    );
    const req = {
      method: 'post',
      headers: { authorization: 'Bearer t1' },
      baseUrl: '/api/v1',
      route: { path: '/urls' },
      path: '/urls',
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await mw(req, {} as Response, next);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/authorize-route');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      code: 'CODE_X',
      method: 'POST',
      path: '/api/v1/urls',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('maps 401/403 from auth-service', async () => {
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const req = {
      method: 'get',
      headers: { authorization: 'Bearer t1' },
      baseUrl: '/x',
      route: { path: '/' },
      path: '/',
    } as unknown as Request;

    const authErrors = [
      HttpStatusCode.UNAUTHORIZED,
      HttpStatusCode.FORBIDDEN,
    ];
    for (const status of authErrors) {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status }),
      );
      const mw = authorizeRoute();
      const next = jest.fn() as NextFunction;
      await mw(req, {} as Response, next);
      expect(next.mock.calls[0][0]).toBeDefined();
    }
  });

  it('returns 503 on unexpected status', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 418 }),
    );
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const req = {
      method: 'get',
      headers: { authorization: 'Bearer t1' },
      baseUrl: '/x',
      route: { path: '/' },
      path: '/',
    } as unknown as Request;
    const next = jest.fn() as NextFunction;
    await mw(req, {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service unavailable',
    });
  });

  it('returns 503 when fetch throws', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));
    const { authorizeRoute } = await import('@middlewares/routeAuthorization');
    const mw = authorizeRoute();
    const req = {
      method: 'get',
      headers: { authorization: 'Bearer t1' },
      baseUrl: '/x',
      route: { path: '/' },
      path: '/',
    } as unknown as Request;
    const next = jest.fn() as NextFunction;
    await mw(req, {} as Response, next);
    expect(next.mock.calls[0][0]).toMatchObject({
      message: 'Authorization service unavailable',
    });
  });
});
