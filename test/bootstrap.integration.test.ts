import assert from 'node:assert/strict';
import test from 'node:test';

import { AppDataSource } from '../src/config/data-source.js';
import { startApplication } from '../src/bootstrap.js';

test('startApplication opens HTTP server and can be closed', async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  const server = await startApplication();

  try {
    assert.equal(server.listening, true);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
});
