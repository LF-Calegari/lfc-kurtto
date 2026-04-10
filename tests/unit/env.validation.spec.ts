import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@jest/globals';

function invalidNodeEnvSnippet(): string {
  return [
    'process.env.NODE_ENV = \'not-a-real-env\';',
    'import(\'./src/config/env.ts\')',
    '  .then(() => process.exit(0))',
    '  .catch((e) => {',
    '    console.error(e instanceof Error ? e.message : String(e));',
    '    process.exit(2);',
    '  });',
  ].join('');
}

describe('env validation', () => {
  it('throws when NODE_ENV is invalid', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, '../..');
    const tsxCli = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
    const result = spawnSync(tsxCli, ['--eval', invalidNodeEnvSnippet()], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, NODE_ENV: undefined },
    });

    expect(result.status).toBe(2);
    expect(String(result.stderr) + String(result.stdout)).toMatch(
      /Invalid environment variables/i,
    );
  });
});
