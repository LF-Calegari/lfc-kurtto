import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('@config/env', () => ({
  env: {
    swaggerEnabled: true,
    NODE_ENV: 'test',
    SWAGGER_ENABLED: undefined,
  },
}));

jest.unstable_mockModule('@config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

describe('Swagger habilitado', () => {
  let setupSwagger: typeof import('@config/swagger').setupSwagger;
  let buildSwaggerSpec: typeof import('@config/swagger').buildSwaggerSpec;

  beforeAll(async () => {
    const m = await import('@config/swagger');
    setupSwagger = m.setupSwagger;
    buildSwaggerSpec = m.buildSwaggerSpec;
  });

  it('buildSwaggerSpec retorna OpenAPI 3.0', () => {
    const spec = buildSwaggerSpec();
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info).toMatchObject({ title: 'Kurtto API' });
  });

  it('GET /api/docs.json retorna o spec', async () => {
    const app = express();
    setupSwagger(app);
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
  });
});
