import { describe, expect, it, jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import healthController from '@controllers/HealthController';
import { HttpStatusCode } from '@utils/HttpStatusCode';

describe('HealthController.check', () => {
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
    expect(['connected', 'disconnected']).toContain(payload.cache);
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
});
