import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { HttpStatusCode } from '@utils/HttpStatusCode';

const isRedisConfigured = jest.fn();
const pingRedis = jest.fn();

jest.unstable_mockModule('@config/redis', () => ({
  isRedisConfigured,
  pingRedis,
}));

const { default: healthController } =
  await import('@controllers/HealthController');

describe('HealthController.check', () => {
  beforeEach(() => {
    isRedisConfigured.mockReturnValue(false);
    pingRedis.mockResolvedValue(false);
  });

  it('returns 503 when database is disconnected', async () => {
    const wasInitialized = AppDataSource.isInitialized;
    Object.defineProperty(AppDataSource, 'isInitialized', {
      value: false,
      configurable: true,
      writable: true,
    });
    const statusCalls: number[] = [];
    const jsonCalls: unknown[] = [];
    const res = {
      status(code: number) {
        statusCalls.push(code);
        return this;
      },
      json(payload: unknown) {
        jsonCalls.push(payload);
        return this;
      },
    } as unknown as Response;

    const nextCalls: unknown[] = [];
    const next = jest.fn(((error?: unknown) => {
      nextCalls.push(error);
    })) as NextFunction;

    try {
      await healthController.check({} as Request, res, next);
    } finally {
      Object.defineProperty(AppDataSource, 'isInitialized', {
        value: wasInitialized,
        configurable: true,
        writable: true,
      });
    }

    expect(statusCalls).toEqual([HttpStatusCode.SERVICE_UNAVAILABLE]);
    expect(jsonCalls).toHaveLength(1);
    expect(nextCalls).toHaveLength(0);

    const payload = jsonCalls[0] as Record<string, unknown>;
    expect(payload.status).toBe('degraded');
    expect(payload.database).toBe('disconnected');
    expect(payload.cache).toBe('disconnected');
    expect(payload.message).toBe(
      'API is running but database is unavailable',
    );
    expect(payload.environment).toBe(env.NODE_ENV);
    expect(typeof payload.uptime).toBe('number');
    expect(Number.isNaN(Date.parse(String(payload.timestamp)))).toBe(false);
  });

  it('forwards errors to next', async () => {
    const expectedError = new Error('res status failed');
    const res = {
      status() {
        throw expectedError;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    const nextCalls: unknown[] = [];
    const next = jest.fn(((error?: unknown) => {
      nextCalls.push(error);
    })) as NextFunction;

    await healthController.check({} as Request, res, next);

    expect(nextCalls).toHaveLength(1);
    expect(nextCalls[0]).toBe(expectedError);
  });

  it('returns 200 when Redis off (cache disconnected)', async () => {
    const wasInitialized = AppDataSource.isInitialized;
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockResolvedValue([{ ok: 1 }]);
    Object.defineProperty(AppDataSource, 'isInitialized', {
      value: true,
      configurable: true,
      writable: true,
    });
    isRedisConfigured.mockReturnValue(false);

    const statusCalls: number[] = [];
    const jsonCalls: unknown[] = [];
    const res = {
      status(code: number) {
        statusCalls.push(code);
        return this;
      },
      json(payload: unknown) {
        jsonCalls.push(payload);
        return this;
      },
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    try {
      await healthController.check({} as Request, res, next);
    } finally {
      query.mockRestore();
      Object.defineProperty(AppDataSource, 'isInitialized', {
        value: wasInitialized,
        configurable: true,
        writable: true,
      });
    }

    expect(statusCalls).toEqual([HttpStatusCode.OK]);
    const payload = jsonCalls[0] as Record<string, unknown>;
    expect(payload.cache).toBe('disconnected');
    expect(payload.database).toBe('connected');
  });

  it('returns 200 when Redis ping ok (cache connected)', async () => {
    const wasInitialized = AppDataSource.isInitialized;
    const query = jest
      .spyOn(AppDataSource, 'query')
      .mockResolvedValue([{ ok: 1 }]);
    Object.defineProperty(AppDataSource, 'isInitialized', {
      value: true,
      configurable: true,
      writable: true,
    });
    isRedisConfigured.mockReturnValue(true);
    pingRedis.mockResolvedValue(true);

    const statusCalls: number[] = [];
    const jsonCalls: unknown[] = [];
    const res = {
      status(code: number) {
        statusCalls.push(code);
        return this;
      },
      json(payload: unknown) {
        jsonCalls.push(payload);
        return this;
      },
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    try {
      await healthController.check({} as Request, res, next);
    } finally {
      query.mockRestore();
      Object.defineProperty(AppDataSource, 'isInitialized', {
        value: wasInitialized,
        configurable: true,
        writable: true,
      });
    }

    expect(statusCalls).toEqual([HttpStatusCode.OK]);
    const payload = jsonCalls[0] as Record<string, unknown>;
    expect(payload.cache).toBe('connected');
  });
});
