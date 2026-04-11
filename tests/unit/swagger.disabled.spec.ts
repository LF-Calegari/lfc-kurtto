import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const loggerInfo = jest.fn();

jest.unstable_mockModule('@config/env', () => ({
  env: {
    swaggerEnabled: false,
    NODE_ENV: 'test',
    SWAGGER_ENABLED: 'false',
  },
}));

jest.unstable_mockModule('@config/logger', () => ({
  logger: {
    info: loggerInfo,
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

describe('setupSwagger desabilitado', () => {
  let setupSwagger: typeof import('@config/swagger').setupSwagger;

  beforeAll(async () => {
    ({ setupSwagger } = await import('@config/swagger'));
  });

  it('registra log e não expõe /api/docs.json', async () => {
    loggerInfo.mockClear();
    const app = express();
    setupSwagger(app);

    expect(loggerInfo).toHaveBeenCalledWith(
      'Swagger UI desabilitado pela configuracao',
      expect.objectContaining({ context: 'swagger' }),
    );

    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(404);
  });
});
