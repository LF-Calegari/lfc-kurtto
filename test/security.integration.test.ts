import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';

import app from '../src/app.js';
import { rateLimitJsonHandler } from '../src/middlewares/rateLimit.js';
import { registerDatabaseForTests } from './register-db.js';

registerDatabaseForTests();

test('Helmet adds security headers on API responses', async () => {
  const res = await request(app).get('/api/v1/health');

  assert.equal(res.status, 200);
  assert.equal(
    String(res.headers['x-content-type-options'] ?? '').toLowerCase(),
    'nosniff',
  );
});

test('CORS preflight allows configured methods and headers', async () => {
  const res = await request(app).options('/api/v1/urls')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set(
      'Access-Control-Request-Headers',
      'content-type,authorization',
    );

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  const methods = String(res.headers['access-control-allow-methods'] ?? '');
  assert.match(methods, /GET/i);
  assert.match(methods, /POST/i);
  assert.match(methods, /PATCH/i);
  assert.match(methods, /DELETE/i);
  assert.match(methods, /OPTIONS/i);
});

test('rate limit 429 body has error, message, retry_after', async () => {
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
    res.status(204).send();
  });

  assert.equal((await request(mini).post('/x').send({})).status, 204);
  assert.equal((await request(mini).post('/x').send({})).status, 204);
  const third = await request(mini).post('/x').send({});

  assert.equal(third.status, 429);
  assert.equal(third.body.error, 'too_many_requests');
  assert.equal(typeof third.body.message, 'string');
  assert.ok(third.body.message.length > 0);
  assert.equal(typeof third.body.retry_after, 'number');
  assert.ok(third.body.retry_after >= 1);
});

test('sanitizeBody trims originalUrl before validation', async () => {
  const res = await request(app).post('/api/v1/urls').send({
    originalUrl: '  https://sanitize-trim.example.com/path  ',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.originalUrl, 'https://sanitize-trim.example.com/path');
});

test(
  'sanitizeBody strips HTML tags from customCode (not from originalUrl)',
  async () => {
    const suffix = Date.now().toString(36).slice(-6);
    const code = `k${suffix}`;
    const res = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://sanitize-strip.example.com',
      customCode: `  <b>${code}</b>  `,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.shortCode, code);
  },
);
