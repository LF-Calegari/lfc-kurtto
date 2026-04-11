import { afterEach, describe, expect, it, jest } from '@jest/globals';

const baseEnvSnapshot = { ...process.env };

function restoreProcessEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(baseEnvSnapshot, key)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(baseEnvSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('env.ts (recarregado via resetModules)', () => {
  afterEach(() => {
    restoreProcessEnv();
    jest.resetModules();
  });

  it('rejeita production sem CORS_ORIGINS', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '';
    await expect(import('@config/env')).rejects.toThrow(
      /CORS_ORIGINS|Invalid environment/i,
    );
  });

  it('REQUEST_LOG_SKIP_PATHS vazio vira lista vazia', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REQUEST_LOG_SKIP_PATHS = '   ';
    const { env } = await import('@config/env');
    expect(env.requestLogSkipPaths).toEqual([]);
  });

  it('REQUEST_LOG_SKIP_PATHS CSV gera entradas trimadas', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REQUEST_LOG_SKIP_PATHS = ' a , b ';
    const { env } = await import('@config/env');
    expect(env.requestLogSkipPaths).toEqual(['a', 'b']);
  });

  it('PORT inválido dispara erro de variáveis', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = 'not-a-port';
    await expect(import('@config/env')).rejects.toThrow(
      /Invalid environment variables/i,
    );
  });

  it('RATE_LIMIT_GLOBAL_MAX elevado em NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    const { env } = await import('@config/env');
    expect(env.RATE_LIMIT_GLOBAL_MAX).toBe(1_000_000);
  });

  it('RATE_LIMIT_GLOBAL_MAX padrão em development', async () => {
    process.env.NODE_ENV = 'development';
    const { env } = await import('@config/env');
    expect(env.RATE_LIMIT_GLOBAL_MAX).toBe(100);
  });
});
