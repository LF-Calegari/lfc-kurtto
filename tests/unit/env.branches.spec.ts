import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from '@jest/globals';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const tsxCli = path.join(repoRoot, 'node_modules', '.bin', 'tsx');

function runTsxEval(
  source: string,
  env: NodeJS.ProcessEnv,
  cwd: string = repoRoot,
): {
  status: number | null;
  out: string;
} {
  const result = spawnSync(tsxCli, ['--eval', source], {
    cwd,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...env },
  });
  return {
    status: result.status,
    out: `${result.stderr ?? ''}${result.stdout ?? ''}`,
  };
}

describe('env.ts ramos (subprocess)', () => {
  it('falha em production sem CORS_ORIGINS útil', () => {
    const { status, out } = runTsxEval(
      [
        'process.env.NODE_ENV = \'production\';',
        'process.env.CORS_ORIGINS = \'\';',
        'import(\'./src/config/env.ts\').catch((e) => {',
        '  console.error(e instanceof Error ? e.message : String(e));',
        '  process.exit(2);',
        '});',
      ].join(''),
      { NODE_ENV: 'production', CORS_ORIGINS: '' },
    );
    expect(status).toBe(2);
    expect(out).toMatch(/CORS_ORIGINS|Invalid environment/i);
  });

  it('REQUEST_LOG_SKIP_PATHS: default (sem .env), vazio e CSV', () => {
    const noEnvDir = mkdtempSync(path.join(tmpdir(), 'kurtto-env-'));
    const envModuleUrl = pathToFileURL(
      path.join(repoRoot, 'src/config/env.ts'),
    ).href;
    const def = [
      'process.env.NODE_ENV = \'development\';',
      `import('${envModuleUrl}').then((m) => {`,
      '  console.log(JSON.stringify(m.env.requestLogSkipPaths));',
      '  process.exit(0);',
      '});',
    ].join('');
    const r0 = runTsxEval(
      def,
      {
        NODE_ENV: 'development',
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
      },
      noEnvDir,
    );
    expect(r0.status).toBe(0);
    expect(r0.out).toContain('["/api/v1/health"]');

    const empty = [
      'process.env.NODE_ENV = \'development\';',
      'process.env.REQUEST_LOG_SKIP_PATHS = \'  \';',
      'import(\'./src/config/env.ts\').then((m) => {',
      '  console.log(JSON.stringify(m.env.requestLogSkipPaths));',
      '  process.exit(0);',
      '});',
    ].join('');
    const r1 = runTsxEval(empty, {
      NODE_ENV: 'development',
      REQUEST_LOG_SKIP_PATHS: '  ',
    });
    expect(r1.status).toBe(0);
    expect(r1.out).toContain('[]');

    const csv = [
      'process.env.NODE_ENV = \'development\';',
      'process.env.REQUEST_LOG_SKIP_PATHS = \' a , b \';',
      'import(\'./src/config/env.ts\').then((m) => {',
      '  console.log(JSON.stringify(m.env.requestLogSkipPaths));',
      '  process.exit(0);',
      '});',
    ].join('');
    const r2 = runTsxEval(csv, {
      NODE_ENV: 'development',
      REQUEST_LOG_SKIP_PATHS: ' a , b ',
    });
    expect(r2.status).toBe(0);
    expect(r2.out).toContain('["a","b"]');
  });

});
