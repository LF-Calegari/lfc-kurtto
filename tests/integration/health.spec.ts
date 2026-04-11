import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { logger } from '@config/logger';
import errorHandler from '@middlewares/errorHandler';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

describe('health and errors', () => {
  it('GET /api/v1/health returns 200 with expected contract', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(HttpStatusCode.OK);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(response.body.cache).toBe(
      process.env.REDIS_URL?.trim() ? 'connected' : 'disconnected',
    );
    expect(response.body.message).toBe('API is running');
    expect(response.body.environment).toBe('test');
    expect(typeof response.body.uptime).toBe('number');
    expect(Number.isFinite(response.body.uptime)).toBe(true);
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('GET /api/v1/health returns 503 when SELECT 1 fails', async () => {
    const spy = jest
      .spyOn(AppDataSource, 'query')
      .mockRejectedValue(new Error('simulated query failure'));

    try {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(HttpStatusCode.SERVICE_UNAVAILABLE);
      expect(response.body.database).toBe('disconnected');
      expect(['connected', 'disconnected']).toContain(response.body.cache);
      expect(response.body.status).toBe('degraded');
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /api/v1/health returns 503 when database is down', async () => {
    await AppDataSource.destroy();

    try {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(HttpStatusCode.SERVICE_UNAVAILABLE);
      expect(response.body.status).toBe('degraded');
      expect(response.body.database).toBe('disconnected');
      expect(['connected', 'disconnected']).toContain(response.body.cache);
    } finally {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
    }
  });

  it('GET unknown route returns 404 contract', async () => {
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(HttpStatusCode.NOT_FOUND);
    expect(response.body).toEqual({
      message: 'Route not found',
    });
  });

  it('error handler returns 500 with details outside production', async () => {
    const errorApp = express();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    errorApp.get('/boom', () => {
      throw new Error('boom');
    });
    errorApp.use(errorHandler);

    try {
      const response = await request(errorApp).get('/boom');

      expect(response.status).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
      expect(response.body.message).toBe('Internal server error');
      expect(response.body.details).toBe('boom');
      expect(typeof response.body.stack).toBe('string');
      expect(String(response.body.stack).includes('boom')).toBe(true);
      expect(errorSpy.mock.calls.length).toBe(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('error handler omits details in production', async () => {
    const originalNodeEnv = env.NODE_ENV;
    const errorApp = express();
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    errorApp.get('/boom', () => {
      throw new Error('boom');
    });
    errorApp.use(errorHandler);

    env.NODE_ENV = 'production';

    try {
      const response = await request(errorApp).get('/boom');

      expect(response.status).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
      expect(response.body).toEqual({
        message: 'Internal server error',
      });
      expect(errorSpy.mock.calls.length).toBe(1);
    } finally {
      env.NODE_ENV = originalNodeEnv;
      errorSpy.mockRestore();
    }
  });
});
