import { after, before } from 'node:test';

import { AppDataSource } from '../src/config/data-source.js';

export function registerDatabaseForTests(): void {
  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      await AppDataSource.runMigrations();
    }
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
}
