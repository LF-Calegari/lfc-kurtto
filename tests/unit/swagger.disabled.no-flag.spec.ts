import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';

const loggerInfo = jest.fn();

jest.unstable_mockModule('@config/env', () => ({
  env: {
    swaggerEnabled: false,
    NODE_ENV: 'test',
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

describe('setupSwagger desabilitado sem SWAGGER_ENABLED no env', () => {
  let setupSwagger: typeof import('@config/swagger').setupSwagger;

  beforeAll(async () => {
    ({ setupSwagger } = await import('@config/swagger'));
  });

  it('log usa placeholder quando SWAGGER_ENABLED está ausente', () => {
    loggerInfo.mockClear();
    setupSwagger(express());
    expect(loggerInfo).toHaveBeenCalledWith(
      'Swagger UI desabilitado pela configuracao',
      expect.objectContaining({
        SWAGGER_ENABLED: '(nao definido)',
      }),
    );
  });
});
