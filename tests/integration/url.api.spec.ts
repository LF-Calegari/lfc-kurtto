import request from 'supertest';

import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

async function waitForClicks(
  shortCode: string,
  minClicks: number,
): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/api/v1/urls/${shortCode}`);
    expect(res.status).toBe(HttpStatusCode.OK);
    if (res.body.clicks >= minClicks) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error(`clicks did not reach ${minClicks} for ${shortCode}`);
}

const futureIso = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
};

describe('URL API and redirect', () => {
  it('POST /api/v1/urls: generated short code (201)', async () => {
    const res = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://example.com/generated',
    });

    expect(res.status).toBe(HttpStatusCode.CREATED);
    expect(typeof res.body.shortCode).toBe('string');
    expect(res.body.shortCode).toHaveLength(7);
    expect(res.body.shortUrl).toMatch(/^http:\/\/localhost:3000\//);
    expect(res.body.originalUrl).toBe('https://example.com/generated');
    expect(res.body.isActive).toBe(true);
  });

  it('POST /api/v1/urls: custom code 201 and GET by code', async () => {
    const code = `c${Date.now().toString(36)}`.slice(0, 10);
    const create = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://example.com/custom',
      customCode: code,
    });
    expect(create.status).toBe(HttpStatusCode.CREATED);
    expect(create.body.shortCode).toBe(code);

    const getOne = await request(app).get(`/api/v1/urls/${code}`);
    expect(getOne.status).toBe(HttpStatusCode.OK);
    expect(getOne.body.shortCode).toBe(code);
  });

  it('POST /api/v1/urls returns 409 for duplicate custom code', async () => {
    const code = `d${Date.now().toString(36)}`.slice(0, 10);
    const first = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://example.com/a',
      customCode: code,
    });
    expect(first.status).toBe(HttpStatusCode.CREATED);

    const second = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://example.com/b',
      customCode: code,
    });
    expect(second.status).toBe(HttpStatusCode.CONFLICT);
    expect(second.body.message).toBe('custom_code already exists');
  });

  it('POST /api/v1/urls returns 422 for invalid body', async () => {
    const res = await request(app).post('/api/v1/urls').send({
      originalUrl: 'not-a-url',
    });
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('POST /api/v1/urls returns 422 when expiresAt is past', async () => {
    const res = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://example.com/exp',
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(
      res.body.details.some((d: { field: string }) => d.field === 'expiresAt'),
    ).toBe(true);
  });

  it('GET /api/v1/urls returns paginated list with meta', async () => {
    const res = await request(app).get('/api/v1/urls?page=1&limit=5');
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(5);
    expect(typeof res.body.meta.total).toBe('number');
    expect(typeof res.body.meta.total_pages).toBe('number');
  });

  it('GET /api/v1/urls?active=false filters inactive rows', async () => {
    const code = `e${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://inactive.example.com',
      customCode: code,
    });
    await request(app).patch(`/api/v1/urls/${code}`).send({ isActive: false });

    const res = await request(app).get('/api/v1/urls?active=false&limit=100');
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeTruthy();
  });

  it('GET /api/v1/urls/:code returns 404 when missing', async () => {
    const res = await request(app).get('/api/v1/urls/zzzzzzzzzz');
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
    expect(res.body.message).toBe('URL not found');
  });

  it('PATCH /api/v1/urls/:code applies partial update', async () => {
    const code = `f${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://patch.example.com',
      customCode: code,
    });

    const res = await request(app).patch(`/api/v1/urls/${code}`).send({
      originalUrl: 'https://patched.example.com',
    });
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.originalUrl).toBe('https://patched.example.com');
  });

  it('PATCH /api/v1/urls/:code returns 404 when not found', async () => {
    const res = await request(app)
      .patch('/api/v1/urls/zzzzzzzzzz')
      .send({ isActive: true });
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('DELETE /api/v1/urls/:code: 204 then GET 404', async () => {
    const code = `g${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://delete.example.com',
      customCode: code,
    });

    const del = await request(app).delete(`/api/v1/urls/${code}`);
    expect(del.status).toBe(HttpStatusCode.NO_CONTENT);

    const getOne = await request(app).get(`/api/v1/urls/${code}`);
    expect(getOne.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('DELETE /api/v1/urls/:code returns 404 when missing', async () => {
    const res = await request(app).delete('/api/v1/urls/zzzzzzzzzz');
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('PATCH /api/v1/urls/:code returns 422 for empty body', async () => {
    const code = `h${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://empty-patch.example.com',
      customCode: code,
    });

    const res = await request(app).patch(`/api/v1/urls/${code}`).send({});
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

  it('POST /api/v1/urls accepts optional future expiresAt', async () => {
    const res = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://future.example.com',
      expiresAt: futureIso(),
    });
    expect(res.status).toBe(HttpStatusCode.CREATED);
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('GET /:code: 302, cache headers, async click increment', async () => {
    const code = `r${Date.now().toString(36)}`.slice(0, 10);
    const create = await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://redirect.example.com/path',
      customCode: code,
    });
    expect(create.status).toBe(HttpStatusCode.CREATED);
    expect(create.body.clicks).toBe(0);

    const redir = await request(app).get(`/${code}`).redirects(0);
    expect(redir.status).toBe(HttpStatusCode.FOUND);
    expect(redir.headers.location).toBe('https://redirect.example.com/path');
    const cache = String(redir.headers['cache-control'] ?? '');
    expect(cache).toMatch(/no-cache/i);
    expect(cache).toMatch(/no-store/i);
    expect(cache).toMatch(/must-revalidate/i);

    await waitForClicks(code, 1);
  });

  it('GET /:code returns 404 when short code missing', async () => {
    const res = await request(app).get('/zzzzzzzzzz').redirects(0);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
    expect(res.body.message).toBe('URL not found');
  });

  it('GET /:code returns 410 when inactive', async () => {
    const code = `i${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://inactive-redirect.example.com',
      customCode: code,
    });
    await request(app).patch(`/api/v1/urls/${code}`).send({ isActive: false });

    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(HttpStatusCode.GONE);
    expect(res.body.message).toBe('This short link is inactive.');
  });

  it('GET /:code returns 410 when expired and deactivates row', async () => {
    const code = `x${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').send({
      originalUrl: 'https://expired-redirect.example.com',
      customCode: code,
      expiresAt: futureIso(),
    });

    const past = new Date('2000-01-01T00:00:00.000Z');
    await AppDataSource.getRepository(Url).update(
      { shortCode: code },
      { expiresAt: past },
    );

    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(HttpStatusCode.GONE);
    expect(res.body.message).toBe('This short link has expired.');

    const getOne = await request(app).get(`/api/v1/urls/${code}`);
    expect(getOne.status).toBe(HttpStatusCode.OK);
    expect(getOne.body.isActive).toBe(false);
  });
});
