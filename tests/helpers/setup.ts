import { afterAll, afterEach, beforeAll } from '@jest/globals';

import { AppDataSource } from '../../src/config/data-source.js';
import {
  assertIntegrationTestDatabaseConfigured,
  dropPostgresDatabaseIfExists,
  ensurePostgresDatabaseExists,
  getIntegrationTestDatabaseUrl,
  shouldDropIntegrationTestDatabaseAfterRun,
} from '../../src/config/test-database.js';

/**
 * Hooks for integration tests: cria o banco do worker se necessário, aplica
 * migrations na primeira conexão, truncate entre casos. O encerramento do Jest
 * fecha conexões; evitar destroy por arquivo reduz corridas com --forceExit.
 */
export function useIntegrationDatabase(): void {
  beforeAll(async () => {
    assertIntegrationTestDatabaseConfigured();
    const url = getIntegrationTestDatabaseUrl();
    if (!url) {
      throw new Error('URL de teste não resolvida após assert.');
    }
    await ensurePostgresDatabaseExists(url);
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      await AppDataSource.runMigrations();
    }
  });

  afterEach(async () => {
    if (!AppDataSource.isInitialized) {
      return;
    }
    await AppDataSource.query(
      'TRUNCATE TABLE urls RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    if (!shouldDropIntegrationTestDatabaseAfterRun()) {
      return;
    }
    const url = getIntegrationTestDatabaseUrl();
    if (!url) {
      return;
    }
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    await dropPostgresDatabaseIfExists(url);
  });
}
