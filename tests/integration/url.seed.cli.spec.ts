import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';
import { runUrlSeedCli } from '../../src/seeds/url.seed.cli.js';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

describe('url seed CLI', () => {
  it('runUrlSeedCli completes and DB stays usable afterwards', async () => {
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

      expect(process.exitCode).toBeUndefined();
      expect(errorCalls.length).toBe(0);
      expect(
        logCalls.some(
          (args) =>
            typeof args[0] === 'string' &&
            args[0].includes('URL seed completed successfully'),
        ),
      ).toBe(true);

      await AppDataSource.initialize();

      const repo = AppDataSource.getRepository(Url);
      const count = await repo.count();
      expect(count).toBeGreaterThanOrEqual(5);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      process.exitCode = undefined;
    }
  });
});
