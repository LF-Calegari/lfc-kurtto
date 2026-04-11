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

describe('swagger em production (globs .js)', () => {
  afterEach(() => {
    restoreProcessEnv();
    jest.resetModules();
  });

  it('buildSwaggerSpec roda com NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://api.example';
    const { buildSwaggerSpec } = await import('@config/swagger');
    const spec = buildSwaggerSpec();
    expect(spec.openapi).toBe('3.0.0');
  });
});
