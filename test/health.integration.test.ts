import 'reflect-metadata';
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import express from 'express';
import request from 'supertest';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import errorHandler from '../src/middlewares/errorHandler.js';
import { registerDatabaseForTests } from './register-db.js';

registerDatabaseForTests();

test('GET /api/v1/health returns 200 with expected contract', async () => {
  const response = await request(app).get('/api/v1/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.message, 'API is running');
  assert.equal(response.body.environment, 'test');
  assert.equal(typeof response.body.uptime, 'number');
  assert.ok(Number.isFinite(response.body.uptime));
  assert.ok(!Number.isNaN(Date.parse(response.body.timestamp)));
});

test('GET /api/v1/health returns 503 when SELECT 1 fails', async () => {
  const { AppDataSource } = await import('../src/config/data-source.js');

  const queryMock = mock.method(AppDataSource, 'query', async () => {
    throw new Error('simulated query failure');
  });

  try {
    const response = await request(app).get('/api/v1/health');

    assert.equal(response.status, 503);
    assert.equal(response.body.database, 'disconnected');
    assert.equal(response.body.status, 'degraded');
  } finally {
    queryMock.mock.restore();
  }
});

test('GET /api/v1/health returns 503 when database is down', async () => {
  const { AppDataSource } = await import('../src/config/data-source.js');

  await AppDataSource.destroy();

  try {
    const response = await request(app).get('/api/v1/health');

    assert.equal(response.status, 503);
    assert.equal(response.body.status, 'degraded');
    assert.equal(response.body.database, 'disconnected');
  } finally {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      await AppDataSource.runMigrations();
    }
  }
});

test('GET unknown route returns 404 contract', async () => {
  const response = await request(app).get('/api/v1/unknown');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    message: 'Route not found',
  });
});

test('error handler returns 500 with details outside production', async () => {
  const errorApp = express();
  const errorSpy = mock.method(logger, 'error', () => {});

  errorApp.get('/boom', () => {
    throw new Error('boom');
  });
  errorApp.use(errorHandler);

  try {
    const response = await request(errorApp).get('/boom');

    assert.equal(response.status, 500);
    assert.equal(response.body.message, 'Internal server error');
    assert.equal(response.body.details, 'boom');
    assert.equal(typeof response.body.stack, 'string');
    assert.ok(String(response.body.stack).includes('boom'));
    assert.equal(errorSpy.mock.calls.length, 1);
  } finally {
    errorSpy.mock.restore();
  }
});

test('error handler omits details in production', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const errorApp = express();
  const errorSpy = mock.method(logger, 'error', () => {});

  errorApp.get('/boom', () => {
    throw new Error('boom');
  });
  errorApp.use(errorHandler);

  env.NODE_ENV = 'production';

  try {
    const response = await request(errorApp).get('/boom');

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      message: 'Internal server error',
    });
    assert.equal(errorSpy.mock.calls.length, 1);
  } finally {
    env.NODE_ENV = originalNodeEnv;
    errorSpy.mock.restore();
  }
});
