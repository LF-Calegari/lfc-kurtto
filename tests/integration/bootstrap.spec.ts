import { jest } from '@jest/globals';

import { AppDataSource } from '@config/data-source';

import { startApplication } from '../../src/bootstrap.js';

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

    try {
      const server = await startApplication();

      try {
        expect(server.listening).toBe(true);
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
      exitSpy.mockRestore();
    }
  });
});
