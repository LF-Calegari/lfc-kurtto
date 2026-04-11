import request from 'supertest';

import { HttpStatusCode } from '@utils/HttpStatusCode';

import app from '../../src/app.js';

describe('Swagger OpenAPI', () => {
  it('GET /api/docs.json retorna OpenAPI 3 e paths', async () => {
    const response = await request(app).get('/api/docs.json');

    expect(response.status).toBe(HttpStatusCode.OK);
    expect(response.headers['content-type']).toMatch(/json/i);

    const body = response.body as Record<string, unknown>;
    expect(body.openapi).toBe('3.0.0');
    expect(body.info).toMatchObject({
      title: 'Kurtto API',
      version: '1.0.0',
    });
    const info = body.info as { 'x-logo'?: { url?: string } };
    expect(info['x-logo']?.url).toBe(
      '/api/swagger-static/images/kurtto-logo-compact.svg',
    );

    const paths = body.paths as Record<string, unknown>;
    expect(paths['/health']).toBeDefined();
    expect(paths['/urls']).toBeDefined();
    expect(paths['/urls/{code}']).toBeDefined();
    expect(paths['/{code}']).toBeDefined();

    const components = body.components as {
      schemas?: Record<string, unknown>;
    };
    expect(components.schemas?.UrlResponse).toBeDefined();
    expect(components.schemas?.CreateUrlRequest).toBeDefined();
    expect(components.schemas?.UpdateUrlRequest).toBeDefined();
    expect(components.schemas?.PaginatedResponse).toBeDefined();
    expect(components.schemas?.ErrorResponse).toBeDefined();
    expect(components.schemas?.ValidationErrorResponse).toBeDefined();
  });

  it('GET /api/docs.json inclui GET /health e POST /urls', async () => {
    const response = await request(app).get('/api/docs.json');
    expect(response.status).toBe(HttpStatusCode.OK);

    type Paths = Record<string, unknown> | undefined;
    const paths = (response.body as { paths?: Paths }).paths;
    const health = paths?.['/health'] as { get?: unknown } | undefined;
    expect(health?.get).toBeDefined();

    const urls = paths?.['/urls'] as
      | { post?: unknown; get?: unknown }
      | undefined;
    expect(urls?.post).toBeDefined();
    expect(urls?.get).toBeDefined();
  });
});
