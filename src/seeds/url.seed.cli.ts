import 'reflect-metadata';

import { AppDataSource } from '../config/data-source.js';
import { runUrlSeed } from './url.seed.js';

export async function runUrlSeedCli(): Promise<void> {
  try {
    await AppDataSource.initialize();
    await runUrlSeed();
    console.log('URL seed completed successfully.');
  } catch (error) {
    console.error('URL seed failed:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}
