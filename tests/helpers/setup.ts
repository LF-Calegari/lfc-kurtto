import { afterEach, beforeAll } from '@jest/globals';

import { AppDataSource } from '@config/data-source';

/**
 * Hooks for integration tests: migrations on first connect, truncate between
 * cases. The process exit at the end of Jest closes DB connections; avoiding
 * per-file destroy prevents races with --forceExit and the next file's hooks.
 */
export function useIntegrationDatabase(): void {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
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
}
