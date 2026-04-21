import { jest } from '@jest/globals';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

import { rateLimitJsonHandler } from '@middlewares/rateLimit';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

import { mockAuthServiceResponse } from '../helpers/authServiceMock';
import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

const authHeaders = { Authorization: 'Bearer test-token' };

describe('security middleware', () => {
  beforeEach(() => {
    mockAuthServiceResponse(HttpStatusCode.OK);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Helmet adds security headers on API responses', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(HttpStatusCode.OK);
    expect(
      String(res.headers['x-content-type-options'] ?? '').toLowerCase(),
    ).toBe('nosniff');
  });

  it('CORS preflight allows configured methods and headers', async () => {
    const res = await request(app).options('/api/v1/urls')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization',
      );

    expect(res.status).toBe(HttpStatusCode.NO_CONTENT);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    const methods = String(res.headers['access-control-allow-methods'] ?? '');
    expect(methods).toMatch(/GET/i);
    expect(methods).toMatch(/POST/i);
    expect(methods).toMatch(/PATCH/i);
    expect(methods).toMatch(/DELETE/i);
    expect(methods).toMatch(/OPTIONS/i);
  });

  it('rate limit 429 body has error, message, retry_after', async () => {
    const mini = express();
    mini.use(express.json());
    const lim = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitJsonHandler,
      skip: (req) => req.method === 'OPTIONS',
      message: 'Too many requests for this endpoint. Please try again later.',
    });
    mini.post('/x', lim, (_req, res) => {
      res.status(HttpStatusCode.NO_CONTENT).send();
    });

    expect(
      (await request(mini).post('/x').send({})).status,
    ).toBe(HttpStatusCode.NO_CONTENT);
    expect(
      (await request(mini).post('/x').send({})).status,
    ).toBe(HttpStatusCode.NO_CONTENT);
    const third = await request(mini).post('/x').send({});

    expect(third.status).toBe(HttpStatusCode.TOO_MANY_REQUESTS);
    expect(third.body.error).toBe('too_many_requests');
    expect(typeof third.body.message).toBe('string');
    expect(third.body.message.length).toBeGreaterThan(0);
    expect(typeof third.body.retry_after).toBe('number');
    expect(third.body.retry_after).toBeGreaterThanOrEqual(1);
  });

  it('sanitizeBody trims originalUrl before validation', async () => {
    const res = await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: '  https://sanitize-trim.example.com/path  ',
    });

    expect(res.status).toBe(HttpStatusCode.CREATED);
    expect(res.body.originalUrl).toBe(
      'https://sanitize-trim.example.com/path',
    );
  });

  it(
    'sanitizeBody strips HTML tags from customCode (not from originalUrl)',
    async () => {
      const suffix = Date.now().toString(36).slice(-6);
      const code = `k${suffix}`;
      const res = await request(app)
        .post('/api/v1/urls')
        .set(authHeaders)
        .send({
          originalUrl: 'https://sanitize-strip.example.com',
          customCode: `  <b>${code}</b>  `,
        });

      expect(res.status).toBe(HttpStatusCode.CREATED);
      expect(res.body.shortCode).toBe(code);
    },
  );
});
