import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { AppDataSource } from '../src/config/data-source.js';
import { Url } from '../src/entities/Url.js';
import { runUrlSeedCli } from '../src/seeds/url.seed.cli.js';
import { registerDatabaseForTests } from './register-db.js';

registerDatabaseForTests();

test('runUrlSeedCli completes and DB stays usable afterwards', async () => {
  const logCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]): void => {
    logCalls.push(args);
  };
  console.error = (...args: unknown[]): void => {
    errorCalls.push(args);
  };

  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    await runUrlSeedCli();

    assert.equal(process.exitCode, undefined);
    assert.equal(errorCalls.length, 0);
    assert.ok(
      logCalls.some(
        (args) =>
          typeof args[0] === 'string' &&
          args[0].includes('URL seed completed successfully'),
      ),
    );

    await AppDataSource.initialize();

    const repo = AppDataSource.getRepository(Url);
    const count = await repo.count();
    assert.ok(count >= 5);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = undefined;
  }
});
