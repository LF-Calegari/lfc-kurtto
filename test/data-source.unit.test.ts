import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppDataSource } from '../src/config/data-source.js';
import { env } from '../src/config/env.js';

test('createAppDataSource: url mode for postgres URL override', () => {
  const url = 'postgresql://u:p@db.example:5432/mydb';
  const ds = createAppDataSource({ databaseUrlOverride: url });

  assert.equal(ds.options.type, 'postgres');
  assert.equal(ds.options.url, url);
});

test('createAppDataSource: host mode when URL override empty', () => {
  const originalUser = process.env.POSTGRES_USER;
  process.env.POSTGRES_USER = 'from_postgres_env';

  try {
    const ds = createAppDataSource({ databaseUrlOverride: '' });

    assert.equal(ds.options.type, 'postgres');
    assert.equal(ds.options.url, undefined);
    assert.equal(ds.options.host, env.DB_HOST);
    assert.equal(ds.options.username, 'from_postgres_env');
  } finally {
    if (originalUser === undefined) {
      delete process.env.POSTGRES_USER;
    } else {
      process.env.POSTGRES_USER = originalUser;
    }
  }
});
