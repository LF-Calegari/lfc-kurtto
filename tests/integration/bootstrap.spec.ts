import { jest } from '@jest/globals';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';

import { startApplication } from '../../src/bootstrap.js';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

describe('bootstrap', () => {
  it('startApplication opens HTTP server and can be closed', async () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${String(code)})`);
      }) as (code?: number) => never);

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    const savedPort = env.PORT;
    env.PORT = 0;

    try {
      const server = await startApplication();

      try {
        expect(server.listening).toBe(true);
        const addr = server.address();
        expect(addr && typeof addr === 'object' && addr.port > 0).toBe(true);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
        }
        if (!AppDataSource.isInitialized) {
          await AppDataSource.initialize();
        }
      }
    } finally {
      env.PORT = savedPort;
      exitSpy.mockRestore();
    }
  });
});
