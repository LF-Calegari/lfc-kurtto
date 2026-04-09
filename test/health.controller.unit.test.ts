import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';

import healthController from '../src/controllers/HealthController.js';
import { env } from '../src/config/env.js';

const successCaseName =
  'HealthController.check returns 200 with expected payload contract';

test(successCaseName, async () => {
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
  const next = ((error?: unknown) => {
    nextCalls.push(error);
  }) as NextFunction;

  await healthController.check({} as Request, res, next);

  assert.deepEqual(statusCalls, [200]);
  assert.equal(jsonCalls.length, 1);
  assert.equal(nextCalls.length, 0);

  const payload = jsonCalls[0] as Record<string, unknown>;
  assert.equal(payload.status, 'ok');
  assert.equal(payload.message, 'API is running');
  assert.equal(payload.environment, env.NODE_ENV);
  assert.equal(typeof payload.uptime, 'number');
  assert.ok(!Number.isNaN(Date.parse(String(payload.timestamp))));
});

test('HealthController.check forwards errors to next', async () => {
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
  const next = ((error?: unknown) => {
    nextCalls.push(error);
  }) as NextFunction;

  await healthController.check({} as Request, res, next);

  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], expectedError);
});
