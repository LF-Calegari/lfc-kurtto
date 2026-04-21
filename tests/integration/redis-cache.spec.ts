import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';

import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';
import { getRedisClient } from '@config/redis';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

import { mockAuthServiceResponse } from '../helpers/authServiceMock';
import { useIntegrationDatabase } from '../helpers/setup';

const hasRedis = Boolean(process.env.REDIS_URL?.trim());
const describeRedis = hasRedis ? describe : describe.skip;

const authHeaders = { Authorization: 'Bearer test-token' };

describeRedis('Redis redirect cache', () => {
  useIntegrationDatabase();

  beforeEach(() => {
    mockAuthServiceResponse(HttpStatusCode.OK);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    const r = getRedisClient();
    if (r) {
      await r.flushdb();
    }
  });

  it('stores redirect in Redis; second GET uses same key', async () => {
    const r = getRedisClient();
    expect(r).not.toBeNull();
    const code = `q${Date.now().toString(36)}`.slice(0, 10);

    const create = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://cache-hit.example.com',
        customCode: code,
      });
    expect(create.status).toBe(HttpStatusCode.CREATED);

    const first = await request(app).get(`/${code}`).redirects(0);
    expect(first.status).toBe(HttpStatusCode.FOUND);

    const cached = await r!.get(`url:${code}`);
    expect(cached).toBeTruthy();
    const payload = JSON.parse(String(cached)) as {
      original_url: string;
      is_active: boolean;
    };
    expect(payload.original_url).toBe('https://cache-hit.example.com');
    expect(payload.is_active).toBe(true);

    const second = await request(app).get(`/${code}`).redirects(0);
    expect(second.status).toBe(HttpStatusCode.FOUND);
    expect(await r!.get(`url:${code}`)).toBe(cached);
  });

  it('invalidates cache after PATCH for redirect target', async () => {
    const r = getRedisClient();
    expect(r).not.toBeNull();
    const code = `w${Date.now().toString(36)}`.slice(0, 10);

    await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://before-patch.example.com',
        customCode: code,
      });
    await request(app).get(`/${code}`).redirects(0);
    const beforePatch = await r!.get(`url:${code}`);
    expect(beforePatch).toBeTruthy();

    await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({
        originalUrl: 'https://after-patch.example.com',
      });

    expect(await r!.get(`url:${code}`)).toBeNull();

    const redir = await request(app).get(`/${code}`).redirects(0);
    expect(redir.status).toBe(HttpStatusCode.FOUND);
    expect(redir.headers.location).toBe('https://after-patch.example.com');

    const afterPatch = await r!.get(`url:${code}`);
    expect(afterPatch).toBeTruthy();
    expect(JSON.parse(String(afterPatch)).original_url).toBe(
      'https://after-patch.example.com',
    );
  });

  it('invalidates cache after DELETE', async () => {
    const code = `z${Date.now().toString(36)}`.slice(0, 10);
    await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://to-delete.example.com',
        customCode: code,
      });
    await request(app).get(`/${code}`).redirects(0);
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('drops stale cache when cached expires_at is in the past', async () => {
    const code = `v${Date.now().toString(36)}`.slice(0, 10);
    const r = getRedisClient();
    expect(r).not.toBeNull();

    await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://stale-exp.example.com',
        customCode: code,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });
    await request(app).get(`/${code}`).redirects(0);

    const past = new Date('2000-01-01T00:00:00.000Z');
    await AppDataSource.getRepository(Url).update(
      { shortCode: code },
      { expiresAt: past },
    );

    await r!.set(
      `url:${code}`,
      JSON.stringify({
        original_url: 'https://stale-exp.example.com',
        is_active: true,
        expires_at: '2000-01-01T00:00:00.000Z',
      }),
      'EX',
      3600,
    );

    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(HttpStatusCode.GONE);
    expect(res.body.message).toBe('This link has expired');
  });
});
