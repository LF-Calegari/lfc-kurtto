import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@jest/globals';

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../..');
}

function evalSwaggerEnabled(
  partial: Record<string, string | undefined>,
): string {
  const tsxCli = path.join(repoRoot(), 'node_modules', '.bin', 'tsx');
  const snippet = [
    '(async () => {',
    '  const { env } = await import(\'./src/config/env.ts\');',
    '  console.log(env.swaggerEnabled ? \'true\' : \'false\');',
    '})().catch((e) => { console.error(e); process.exit(2); });',
  ].join('');
  const merged: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  const result = spawnSync(tsxCli, ['--eval', snippet], {
    cwd: repoRoot(),
    encoding: 'utf8',
    shell: false,
    env: merged,
  });
  expect(result.status).toBe(0);
  return String(result.stdout).trim();
}

describe('SWAGGER_ENABLED / swaggerEnabled', () => {
  it('em production: desligado quando SWAGGER_ENABLED=false', () => {
    const out = evalSwaggerEnabled({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
      SWAGGER_ENABLED: 'false',
    });
    expect(out).toBe('false');
  });

  it('em production: ligado apenas quando SWAGGER_ENABLED=true', () => {
    const out = evalSwaggerEnabled({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
      SWAGGER_ENABLED: 'true',
    });
    expect(out).toBe('true');
  });

  it('em production: desligado quando SWAGGER_ENABLED esta ausente', () => {
    const out = evalSwaggerEnabled({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
      SWAGGER_ENABLED: undefined,
    });
    expect(out).toBe('false');
  });

  it('em test: ligado por padrao quando SWAGGER_ENABLED ausente', () => {
    const out = evalSwaggerEnabled({
      NODE_ENV: 'test',
      SWAGGER_ENABLED: undefined,
    });
    expect(out).toBe('true');
  });

  it('em test: desligado quando SWAGGER_ENABLED=false', () => {
    const out = evalSwaggerEnabled({
      NODE_ENV: 'test',
      SWAGGER_ENABLED: 'false',
    });
    expect(out).toBe('false');
  });
});
