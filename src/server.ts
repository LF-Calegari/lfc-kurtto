import 'reflect-metadata';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';

import app from './app.js';

async function bootstrap(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(
      `Kurtto service listening on port ${env.PORT} (${env.NODE_ENV})`,
    );
  });
}

void bootstrap();
