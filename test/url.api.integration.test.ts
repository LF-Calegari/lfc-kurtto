import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import request from 'supertest';

import app from '../src/app.js';
import { registerDatabaseForTests } from './register-db.js';

registerDatabaseForTests();

const futureIso = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
};

test('POST /api/v1/urls: generated short code (201)', async () => {
  const res = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://example.com/generated',
  });

  assert.equal(res.status, 201);
  assert.equal(typeof res.body.shortCode, 'string');
  assert.equal(res.body.shortCode.length, 7);
  assert.match(res.body.shortUrl, /^http:\/\/localhost:3000\//);
  assert.equal(res.body.originalUrl, 'https://example.com/generated');
  assert.equal(res.body.isActive, true);
});

test('POST /api/v1/urls: custom code 201 and GET by code', async () => {
  const code = `c${Date.now().toString(36)}`.slice(0, 10);
  const create = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://example.com/custom',
    customCode: code,
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.shortCode, code);

  const getOne = await request(app).get(`/api/v1/urls/${code}`);
  assert.equal(getOne.status, 200);
  assert.equal(getOne.body.shortCode, code);
});

test('POST /api/v1/urls returns 409 for duplicate custom code', async () => {
  const code = `d${Date.now().toString(36)}`.slice(0, 10);
  const first = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://example.com/a',
    customCode: code,
  });
  assert.equal(first.status, 201);

  const second = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://example.com/b',
    customCode: code,
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.message, 'custom_code already exists');
});

test('POST /api/v1/urls returns 422 for invalid body', async () => {
  const res = await request(app).post('/api/v1/urls').send({
    originalUrl: 'not-a-url',
  });
  assert.equal(res.status, 422);
  assert.equal(res.body.error, 'Validation failed');
  assert.ok(Array.isArray(res.body.details));
});

test('POST /api/v1/urls returns 422 when expiresAt is past', async () => {
  const res = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://example.com/exp',
    expiresAt: '2000-01-01T00:00:00.000Z',
  });
  assert.equal(res.status, 422);
  assert.ok(
    res.body.details.some((d: { field: string }) => d.field === 'expiresAt'),
  );
});

test('GET /api/v1/urls returns paginated list with meta', async () => {
  const res = await request(app).get('/api/v1/urls?page=1&limit=5');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.meta.page, 1);
  assert.equal(res.body.meta.limit, 5);
  assert.equal(typeof res.body.meta.total, 'number');
  assert.equal(typeof res.body.meta.total_pages, 'number');
});

test('GET /api/v1/urls?active=false filters inactive rows', async () => {
  const code = `e${Date.now().toString(36)}`.slice(0, 10);
  await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://inactive.example.com',
    customCode: code,
  });
  await request(app).patch(`/api/v1/urls/${code}`).send({ isActive: false });

  const res = await request(app).get('/api/v1/urls?active=false&limit=100');
  assert.equal(res.status, 200);
  const found = res.body.data.find(
    (row: { shortCode: string }) => row.shortCode === code,
  );
  assert.ok(found);
});

test('GET /api/v1/urls/:code returns 404 when missing', async () => {
  const res = await request(app).get('/api/v1/urls/zzzzzzzzzz');
  assert.equal(res.status, 404);
  assert.equal(res.body.message, 'URL not found');
});

test('PATCH /api/v1/urls/:code applies partial update', async () => {
  const code = `f${Date.now().toString(36)}`.slice(0, 10);
  await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://patch.example.com',
    customCode: code,
  });

  const res = await request(app).patch(`/api/v1/urls/${code}`).send({
    originalUrl: 'https://patched.example.com',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.originalUrl, 'https://patched.example.com');
});

test('PATCH /api/v1/urls/:code returns 404 when not found', async () => {
  const res = await request(app)
    .patch('/api/v1/urls/zzzzzzzzzz')
    .send({ isActive: true });
  assert.equal(res.status, 404);
});

test('DELETE /api/v1/urls/:code: 204 then GET 404', async () => {
  const code = `g${Date.now().toString(36)}`.slice(0, 10);
  await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://delete.example.com',
    customCode: code,
  });

  const del = await request(app).delete(`/api/v1/urls/${code}`);
  assert.equal(del.status, 204);

  const getOne = await request(app).get(`/api/v1/urls/${code}`);
  assert.equal(getOne.status, 404);
});

test('DELETE /api/v1/urls/:code returns 404 when missing', async () => {
  const res = await request(app).delete('/api/v1/urls/zzzzzzzzzz');
  assert.equal(res.status, 404);
});

test('PATCH /api/v1/urls/:code returns 422 for empty body', async () => {
  const code = `h${Date.now().toString(36)}`.slice(0, 10);
  await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://empty-patch.example.com',
    customCode: code,
  });

  const res = await request(app).patch(`/api/v1/urls/${code}`).send({});
  assert.equal(res.status, 422);
});

test('POST /api/v1/urls accepts optional future expiresAt', async () => {
  const res = await request(app).post('/api/v1/urls').send({
    originalUrl: 'https://future.example.com',
    expiresAt: futureIso(),
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.expiresAt);
});
