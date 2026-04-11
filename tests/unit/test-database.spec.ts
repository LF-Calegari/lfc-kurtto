import { describe, expect, it } from '@jest/globals';

import {
  assertIntegrationTestDatabaseConfigured,
  resolveIntegrationTestDatabaseUrlFromEnv,
  shouldDropIntegrationTestDatabaseAfterRun,
} from '@config/test-database';

describe('test-database', () => {
  it('resolveIntegrationTestDatabaseUrlFromEnv: undefined fora de test', () => {
    expect(
      resolveIntegrationTestDatabaseUrlFromEnv({
        NODE_ENV: 'development',
        KURTTO_TEST_DATABASE_URL: 'postgresql://u:p@h:1/db',
        DATABASE_URL_TEST: 'postgresql://x:x@y:2/z',
      }),
    ).toBeUndefined();
  });

  it('resolveIntegrationTestDatabaseUrlFromEnv: prefere KURTTO em test', () => {
    expect(
      resolveIntegrationTestDatabaseUrlFromEnv({
        NODE_ENV: 'test',
        KURTTO_TEST_DATABASE_URL: 'postgresql://a/a',
        DATABASE_URL_TEST: 'postgresql://b/b',
      }),
    ).toBe('postgresql://a/a');
  });

  it('resolveIntegrationTestUrlFromEnv usa DATABASE_URL_TEST', () => {
    expect(
      resolveIntegrationTestDatabaseUrlFromEnv({
        NODE_ENV: 'test',
        DATABASE_URL_TEST: 'postgresql://legacy/db',
      }),
    ).toBe('postgresql://legacy/db');
  });

  it('assertIntegrationTestDatabaseConfigured: erro sem URL dedicada', () => {
    expect(() =>
      assertIntegrationTestDatabaseConfigured({
        NODE_ENV: 'test',
        KURTTO_TEST_DATABASE_URL: undefined,
        DATABASE_URL_TEST: undefined,
        KURTTO_INTEGRATION_USE_ENV_DATABASE: undefined,
      }),
    ).toThrow(/KURTTO_TEST_DATABASE_URL/);
  });

  it('assertIntegrationTestDatabaseConfigured: aceita USE_ENV_DATABASE', () => {
    expect(() =>
      assertIntegrationTestDatabaseConfigured({
        NODE_ENV: 'test',
        KURTTO_INTEGRATION_USE_ENV_DATABASE: 'true',
      }),
    ).not.toThrow();
  });

  it('assertIntegrationTestDatabaseConfigured: noop fora de test', () => {
    expect(() =>
      assertIntegrationTestDatabaseConfigured({
        NODE_ENV: 'development',
      }),
    ).not.toThrow();
  });

  it('shouldDropIntegrationTestDatabaseAfterRun: false por padrão', () => {
    expect(shouldDropIntegrationTestDatabaseAfterRun({})).toBe(false);
    expect(
      shouldDropIntegrationTestDatabaseAfterRun({
        KURTTO_TEST_DATABASE_DROP_AFTER_RUN: 'false',
      }),
    ).toBe(false);
  });

  it(
    'shouldDropIntegrationTestDatabaseAfterRun: true quando flag ativa',
    () => {
      expect(
        shouldDropIntegrationTestDatabaseAfterRun({
          KURTTO_TEST_DATABASE_DROP_AFTER_RUN: 'true',
        }),
      ).toBe(true);
    },
  );
});
