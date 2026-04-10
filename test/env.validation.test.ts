import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

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

test('env module throws when NODE_ENV is invalid', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const tsxCli = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
  const result = spawnSync(tsxCli, ['--eval', invalidNodeEnvSnippet()], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, NODE_ENV: undefined },
  });

  assert.equal(result.status, 2);
  assert.match(
    result.stderr + result.stdout,
    /Invalid environment variables/i,
  );
});
