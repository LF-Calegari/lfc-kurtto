import { beforeAll, describe, expect, it } from '@jest/globals';

/**
 * Cobre funções de `test-database` que não dependem de Postgres nem entram em
 * conflito com o carregamento real do módulo em `tests/helpers/env-test.ts`
 * (setupFiles antes dos mocks).
 */
describe('test-database (env e validação síncrona)', () => {
  let mod: typeof import('@config/test-database');

  beforeAll(async () => {
    mod = await import('@config/test-database');
  });

  describe('extractDatabaseNameFromPostgresUrl', () => {
    it('aceita esquema postgres://', () => {
      expect(
        mod.extractDatabaseNameFromPostgresUrl(
          'postgres://u:p@localhost:5432/kurtto_test',
        ),
      ).toBe('kurtto_test');
    });

    it('decodifica % no nome do banco', () => {
      expect(
        mod.extractDatabaseNameFromPostgresUrl(
          'postgresql://u:p@h:5432/my%5Fdb',
        ),
      ).toBe('my_db');
    });
  });

  describe('truncatePostgresIdentifier', () => {
    it('não altera identificador curto', () => {
      expect(mod.truncatePostgresIdentifier('kurtto')).toBe('kurtto');
    });
  });

  describe('ensurePostgresDatabaseExists', () => {
    it('rejeita nome de banco inseguro antes de conectar', async () => {
      await expect(
        mod.ensurePostgresDatabaseExists(
          'postgresql://localhost:5432/db-com-hifen',
        ),
      ).rejects.toThrow(/CREATE DATABASE/);
    });
  });

  describe('dropPostgresDatabaseIfExists', () => {
    it('rejeita nome de banco inseguro', async () => {
      await expect(
        mod.dropPostgresDatabaseIfExists(
          'postgresql://localhost:5432/invalid-name',
        ),
      ).rejects.toThrow(/DROP DATABASE/);
    });
  });

  describe('resolveIntegrationTestDatabaseUrlFromEnv', () => {
    it('retorna undefined quando NODE_ENV não é test', () => {
      expect(
        mod.resolveIntegrationTestDatabaseUrlFromEnv({
          NODE_ENV: 'development',
          KURTTO_TEST_DATABASE_URL: 'postgresql://x/y',
        }),
      ).toBeUndefined();
    });

    it('prioriza KURTTO_TEST_DATABASE_URL em test', () => {
      expect(
        mod.resolveIntegrationTestDatabaseUrlFromEnv({
          NODE_ENV: 'test',
          KURTTO_TEST_DATABASE_URL: 'postgresql://a/a',
          DATABASE_URL_TEST: 'postgresql://b/b',
        }),
      ).toBe('postgresql://a/a');
    });

    it('usa DATABASE_URL_TEST como legado', () => {
      expect(
        mod.resolveIntegrationTestDatabaseUrlFromEnv({
          NODE_ENV: 'test',
          DATABASE_URL_TEST: 'postgresql://legacy/db',
        }),
      ).toBe('postgresql://legacy/db');
    });
  });

  describe('shouldDropIntegrationTestDatabaseAfterRun', () => {
    it('é true só com flag explícita', () => {
      expect(
        mod.shouldDropIntegrationTestDatabaseAfterRun({
          KURTTO_TEST_DATABASE_DROP_AFTER_RUN: 'true',
        }),
      ).toBe(true);
      expect(
        mod.shouldDropIntegrationTestDatabaseAfterRun({
          KURTTO_TEST_DATABASE_DROP_AFTER_RUN: 'false',
        }),
      ).toBe(false);
    });
  });

  describe('assertIntegrationTestDatabaseConfigured', () => {
    it('não faz nada fora de NODE_ENV=test', () => {
      expect(() =>
        mod.assertIntegrationTestDatabaseConfigured({
          NODE_ENV: 'development',
        }),
      ).not.toThrow();
    });

    it('permite KURTTO_INTEGRATION_USE_ENV_DATABASE=true', () => {
      expect(() =>
        mod.assertIntegrationTestDatabaseConfigured({
          NODE_ENV: 'test',
          KURTTO_INTEGRATION_USE_ENV_DATABASE: 'true',
        }),
      ).not.toThrow();
    });

    it('lança quando não há URL de teste dedicada', () => {
      expect(() =>
        mod.assertIntegrationTestDatabaseConfigured({
          NODE_ENV: 'test',
          KURTTO_INTEGRATION_USE_ENV_DATABASE: undefined,
        }),
      ).toThrow(/KURTTO_TEST_DATABASE_URL/);
    });
  });
});
