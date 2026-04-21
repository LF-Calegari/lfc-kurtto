import { jest } from '@jest/globals';
import request from 'supertest';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { Url } from '@entities/Url';
import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

import {
  ALL_URL_ROUTE_CODES,
  makeAuthServiceResponse,
  mockAuthServiceResponse,
} from '../helpers/authServiceMock';
import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

const authHeaders = { Authorization: 'Bearer test-token' };

function mockAuthServiceUnavailable(): void {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('auth-service down'));
}

async function waitForClicks(
  shortCode: string,
  minClicks: number,
): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const res = await request(app)
      .get(`/api/v1/urls/${shortCode}`)
      .set(authHeaders);
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
  beforeEach(() => {
    mockAuthServiceResponse(HttpStatusCode.OK);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /api/v1/urls: generated short code (201)', async () => {
    const res = await request(app).post('/api/v1/urls').set(authHeaders).send({
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
    const create = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://example.com/custom',
        customCode: code,
      });
    expect(create.status).toBe(HttpStatusCode.CREATED);
    expect(create.body.shortCode).toBe(code);

    const getOne = await request(app)
      .get(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(getOne.status).toBe(HttpStatusCode.OK);
    expect(getOne.body.shortCode).toBe(code);
  });

  it('POST /api/v1/urls returns 409 for duplicate custom code', async () => {
    const code = `d${Date.now().toString(36)}`.slice(0, 10);
    const first = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://example.com/a',
        customCode: code,
      });
    expect(first.status).toBe(HttpStatusCode.CREATED);

    const second = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://example.com/b',
        customCode: code,
      });
    expect(second.status).toBe(HttpStatusCode.CONFLICT);
    expect(second.body.message).toBe('custom_code already exists');
  });

  it('POST /api/v1/urls returns 422 for invalid body', async () => {
    const res = await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'not-a-url',
    });
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('POST /api/v1/urls returns 422 when expiresAt is past', async () => {
    const res = await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://example.com/exp',
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(
      res.body.details.some((d: { field: string }) => d.field === 'expiresAt'),
    ).toBe(true);
  });

  it('GET /api/v1/urls returns paginated list with meta', async () => {
    const res = await request(app)
      .get('/api/v1/urls?page=1&limit=5')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(5);
    expect(typeof res.body.meta.total).toBe('number');
    expect(typeof res.body.meta.total_pages).toBe('number');
  });

  it('GET /api/v1/urls?active=false filters inactive rows', async () => {
    const code = `e${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://inactive.example.com',
      customCode: code,
    });
    await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({ isActive: false });

    const res = await request(app)
      .get('/api/v1/urls?active=false&limit=100')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeTruthy();
  });

  it('GET /api/v1/urls short_code__exact returns single row', async () => {
    const code = `fe${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://filter-exact.example.com',
      customCode: code,
    });
    const res = await request(app)
      .get('/api/v1/urls')
      .query({ short_code__exact: code, limit: 10 })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].shortCode).toBe(code);
  });

  it('GET /api/v1/urls original_url__like matches substring', async () => {
    const marker = `like-${Date.now()}`;
    const code = `lk${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: `https://example.com/${marker}/path`,
      customCode: code,
    });
    const res = await request(app)
      .get('/api/v1/urls')
      .query({ original_url__like: `%${marker}%`, limit: 50 })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeTruthy();
  });

  it('GET /api/v1/urls clicks__between and short_code__exact', async () => {
    const code = `cb${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://clicks-between.example.com',
      customCode: code,
    });
    const res = await request(app)
      .get('/api/v1/urls')
      .query({
        clicks__between: '0,1000',
        short_code__exact: code,
        limit: 10,
      })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].shortCode).toBe(code);
  });

  it('GET /api/v1/urls created_at__between inclusive range', async () => {
    const code = `dt${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://date-between.example.com',
      customCode: code,
    });
    const start = '2000-01-01T00:00:00.000Z';
    const end = '2099-12-31T23:59:59.999Z';
    const res = await request(app)
      .get('/api/v1/urls')
      .query({
        created_at__between: `${start},${end}`,
        short_code__exact: code,
        limit: 10,
      })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/v1/urls unknown short_code__exact empty list', async () => {
    const res = await request(app)
      .get('/api/v1/urls')
      .query({ short_code__exact: 'zznonexist', limit: 10 })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('GET /api/v1/urls returns 422 for invalid id__exact', async () => {
    const res = await request(app)
      .get('/api/v1/urls?id__exact=not-a-uuid')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

  it('GET /api/v1/urls 422 when clicks__between order invalid', async () => {
    const res = await request(app)
      .get('/api/v1/urls?clicks__between=10,1')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

  it('GET /api/v1/urls 422 when clicks__between malformed', async () => {
    const res = await request(app)
      .get('/api/v1/urls?clicks__between=1')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

  it('GET /api/v1/urls 422 when clicks filter is negative', async () => {
    for (const q of [
      'clicks__exact=-1',
      'clicks__gt=-1',
      'clicks__lt=-1',
    ]) {
      const res = await request(app)
        .get(`/api/v1/urls?${q}`)
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    }
  });

  it('GET /api/v1/urls 422 for negative clicks__between bounds', async () => {
    for (const between of ['-1,5', '0,-1']) {
      const res = await request(app)
        .get('/api/v1/urls')
        .query({ clicks__between: between, limit: 10 })
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    }
  });

  it('is_active__exact overrides active when both are sent', async () => {
    const code = `ov${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://override-active.example.com',
      customCode: code,
    });
    await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({ isActive: false });

    const res = await request(app)
      .get('/api/v1/urls')
      .query({ active: 'true', is_active__exact: 'false', limit: 100 })
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeTruthy();
  });

  it('GET /api/v1/urls/:code returns 404 when missing', async () => {
    const res = await request(app)
      .get('/api/v1/urls/zzzzzzzzzz')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
    expect(res.body.message).toBe('URL not found');
  });

  it('PATCH /api/v1/urls/:code applies partial update', async () => {
    const code = `f${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://patch.example.com',
      customCode: code,
    });

    const res = await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({
        originalUrl: 'https://patched.example.com',
      });
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.originalUrl).toBe('https://patched.example.com');
  });

  it('PATCH /api/v1/urls/:code returns 404 when not found', async () => {
    const res = await request(app)
      .patch('/api/v1/urls/zzzzzzzzzz')
      .set(authHeaders)
      .send({ isActive: true });
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('DELETE soft delete: 204, row has deletedAt, GET detail 404', async () => {
    const code = `g${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://delete.example.com',
      customCode: code,
    });

    const del = await request(app)
      .delete(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(del.status).toBe(HttpStatusCode.NO_CONTENT);

    const row = await AppDataSource.getRepository(Url).findOne({
      where: { shortCode: code },
      withDeleted: true,
    });
    expect(row?.deletedAt).toBeTruthy();

    const getOne = await request(app)
      .get(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(getOne.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('default list omits soft-deleted rows', async () => {
    const code = `sd${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://soft-list.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const res = await request(app)
      .get('/api/v1/urls?limit=100')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeUndefined();
  });

  it('include_deleted list without bearer token: 401', async () => {
    const res = await request(app).get(
      '/api/v1/urls?include_deleted=true',
    );
    expect(res.status).toBe(HttpStatusCode.UNAUTHORIZED);
  });

  it('include_deleted list with valid token shows deleted rows', async () => {
    const code = `ad${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://admin-list.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const res = await request(app)
      .get('/api/v1/urls?include_deleted=true&limit=100')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    const found = res.body.data.find(
      (row: { shortCode: string }) => row.shortCode === code,
    );
    expect(found).toBeTruthy();
    expect(found.deletedAt).toBeTruthy();
  });

  it(
    'GET detail with include_deleted and valid token returns row',
    async () => {
      const code = `gd${Date.now().toString(36)}`.slice(0, 10);
      await request(app).post('/api/v1/urls').set(authHeaders).send({
        originalUrl: 'https://get-deleted.example.com',
        customCode: code,
      });
      await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

      const res = await request(app)
        .get(`/api/v1/urls/${code}?include_deleted=true`)
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.OK);
      expect(res.body.shortCode).toBe(code);
      expect(res.body.deletedAt).toBeTruthy();
    },
  );

  it('PATCH restore clears deletedAt and default GET works', async () => {
    const code = `rs${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://restore.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const rest = await request(app)
      .patch(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(rest.status).toBe(HttpStatusCode.OK);
    expect(rest.body.deletedAt).toBeNull();

    const getOne = await request(app)
      .get(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(getOne.status).toBe(HttpStatusCode.OK);
    expect(getOne.body.shortCode).toBe(code);
  });

  it('PATCH restore without bearer token returns 401', async () => {
    const code = `ra${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://restore-admin.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const res = await request(app).patch(`/api/v1/urls/${code}/restore`);
    expect(res.status).toBe(HttpStatusCode.UNAUTHORIZED);
  });

  it('POST /api/v1/urls/:code/restore is not supported (404)', async () => {
    const code = `np${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://legacy-post-restore.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const res = await request(app)
      .post(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('PATCH restore returns 422 when URL is not soft-deleted', async () => {
    const code = `nr${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://not-restore.example.com',
      customCode: code,
    });

    const res = await request(app)
      .patch(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(res.body.message).toBe('URL is not soft-deleted');
  });

  it('PATCH restore returns 404 for unknown short code', async () => {
    const res = await request(app)
      .patch('/api/v1/urls/zzzzzzzzzz/restore')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('PATCH restore 422 when short code active after reuse', async () => {
    const code = `ru${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://reuse-restore-a.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://reuse-restore-b.example.com',
      customCode: code,
    });

    const res = await request(app)
      .patch(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(res.body.message).toBe('URL is not soft-deleted');
  });

  it('PATCH restore: two tombstones, second restore 422', async () => {
    const code = `tb${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://tomb-a.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://tomb-b.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const rest1 = await request(app)
      .patch(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(rest1.status).toBe(HttpStatusCode.OK);

    const activeCount = await AppDataSource.getRepository(Url).count({
      where: { shortCode: code },
    });
    expect(activeCount).toBe(1);

    const rest2 = await request(app)
      .patch(`/api/v1/urls/${code}/restore`)
      .set(authHeaders);
    expect(rest2.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
    expect(rest2.body.message).toBe('URL is not soft-deleted');

    const activeAfter = await AppDataSource.getRepository(Url).count({
      where: { shortCode: code },
    });
    expect(activeAfter).toBe(1);
  });

  it('POST same custom_code after soft delete on prior row: 201', async () => {
    const code = `rc${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://reuse-a.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const second = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://reuse-b.example.com',
        customCode: code,
      });
    expect(second.status).toBe(HttpStatusCode.CREATED);
    expect(second.body.shortCode).toBe(code);
  });

  it('include_deleted GET after reuse returns active row body', async () => {
    const code = `id${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://reuse-detail-a.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);

    const second = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
        originalUrl: 'https://reuse-detail-b.example.com',
        customCode: code,
      });
    expect(second.status).toBe(HttpStatusCode.CREATED);

    const res = await request(app)
      .get(`/api/v1/urls/${code}?include_deleted=true`)
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.OK);
    expect(res.body.shortCode).toBe(code);
    expect(res.body.deletedAt).toBeNull();
    expect(res.body.originalUrl).toBe('https://reuse-detail-b.example.com');
  });

  it('second DELETE on same code after soft delete returns 404', async () => {
    const code = `2d${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://twicedel.example.com',
      customCode: code,
    });
    await request(app).delete(`/api/v1/urls/${code}`).set(authHeaders);
    const again = await request(app)
      .delete(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(again.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('include_deleted list without permission returns 403', async () => {
    mockAuthServiceResponse(HttpStatusCode.FORBIDDEN);
    const res = await request(app)
      .get('/api/v1/urls?include_deleted=true')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.FORBIDDEN);
  });

  it(
    'include_deleted list with bearer when auth-service returns 401',
    async () => {
      mockAuthServiceResponse(HttpStatusCode.UNAUTHORIZED);
      const res = await request(app)
        .get('/api/v1/urls?include_deleted=true')
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.UNAUTHORIZED);
      expect(res.body.message).toBe(
        'Unauthorized: token missing, invalid, or expired.',
      );
    },
  );

  it(
    'include_deleted chama verify-token via GET Authorization header (sem body)',
    async () => {
      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(makeAuthServiceResponse(HttpStatusCode.OK)),
        );

      const code = `mp${Date.now().toString(36)}`.slice(0, 10);
      const createRes = await request(app)
        .post('/api/v1/urls')
        .set(authHeaders)
        .send({
          originalUrl: 'https://method-path.example.com',
          customCode: code,
        });
      expect(createRes.status).toBe(HttpStatusCode.CREATED);
      // POST /urls é público agora; não deve ter tocado no auth-service.
      expect(fetchSpy).toHaveBeenCalledTimes(0);

      const res = await request(app)
        .get(`/api/v1/urls/${code}?include_deleted=true`)
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.OK);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain(env.AUTH_SERVICE_VERIFY_TOKEN_PATH);
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      });
    },
  );

  it(
    'retorna 403 quando routeCode de include_deleted nao esta concedido',
    async () => {
      mockAuthServiceResponse(
        HttpStatusCode.OK,
        ALL_URL_ROUTE_CODES.filter(
          (c) => c !== 'KURTTO_V1_URLS_LIST_INCLUDE_DELETED',
        ),
      );
      const res = await request(app)
        .get('/api/v1/urls?include_deleted=true')
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.FORBIDDEN);
    },
  );

  it(
    'GET /urls (sem include_deleted) nao bate no auth-service',
    async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const res = await request(app).get('/api/v1/urls');
      expect(res.status).toBe(HttpStatusCode.OK);
      expect(fetchSpy).toHaveBeenCalledTimes(0);
    },
  );

  it(
    'include_deleted retorna 502 quando auth-service inalcancavel',
    async () => {
      mockAuthServiceUnavailable();
      const res = await request(app)
        .get('/api/v1/urls?include_deleted=true')
        .set(authHeaders);
      expect(res.status).toBe(HttpStatusCode.BAD_GATEWAY);
    },
  );

  it('DELETE /api/v1/urls/:code returns 404 when missing', async () => {
    const res = await request(app)
      .delete('/api/v1/urls/zzzzzzzzzz')
      .set(authHeaders);
    expect(res.status).toBe(HttpStatusCode.NOT_FOUND);
  });

  it('PATCH /api/v1/urls/:code returns 422 for empty body', async () => {
    const code = `h${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://empty-patch.example.com',
      customCode: code,
    });

    const res = await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({});
    expect(res.status).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

  it('POST /api/v1/urls accepts optional future expiresAt', async () => {
    const res = await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://future.example.com',
      expiresAt: futureIso(),
    });
    expect(res.status).toBe(HttpStatusCode.CREATED);
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('GET /:code: 302, cache headers, async click increment', async () => {
    const code = `r${Date.now().toString(36)}`.slice(0, 10);
    const create = await request(app)
      .post('/api/v1/urls')
      .set(authHeaders)
      .send({
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
    expect(res.body).toEqual({
      error: 'Not Found',
      message: 'Short link not found',
    });
  });

  it('GET /:code returns 410 when inactive', async () => {
    const code = `i${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
      originalUrl: 'https://inactive-redirect.example.com',
      customCode: code,
    });
    await request(app)
      .patch(`/api/v1/urls/${code}`)
      .set(authHeaders)
      .send({ isActive: false });

    const res = await request(app).get(`/${code}`).redirects(0);
    expect(res.status).toBe(HttpStatusCode.GONE);
    expect(res.body).toEqual({
      error: 'Gone',
      message: 'This link has been deactivated',
    });
  });

  it('GET /:code returns 410 when expired and deactivates row', async () => {
    const code = `x${Date.now().toString(36)}`.slice(0, 10);
    await request(app).post('/api/v1/urls').set(authHeaders).send({
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
    expect(res.body).toEqual({
      error: 'Gone',
      message: 'This link has expired',
    });

    const getOne = await request(app)
      .get(`/api/v1/urls/${code}`)
      .set(authHeaders);
    expect(getOne.status).toBe(HttpStatusCode.OK);
    expect(getOne.body.isActive).toBe(false);
  });
});
