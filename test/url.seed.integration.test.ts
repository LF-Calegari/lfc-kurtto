import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { AppDataSource } from '../src/config/data-source.js';
import { Url } from '../src/entities/url.entity.js';
import { runUrlSeed } from '../src/seeds/url.seed.js';
import { registerDatabaseForTests } from './register-db.js';

registerDatabaseForTests();

test('runUrlSeed is idempotent and inserts five rows', async () => {
  await runUrlSeed();
  await runUrlSeed();

  const repo = AppDataSource.getRepository(Url);
  const count = await repo.count();
  assert.equal(count, 5);

  const expired = await repo.findOne({ where: { shortCode: 'expired' } });
  assert.ok(expired);
  assert.equal(expired.isActive, false);
  assert.ok(expired.expiresAt);
  assert.ok(expired.expiresAt! < new Date());
});
