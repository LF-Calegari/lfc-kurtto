import 'reflect-metadata';

import type { Server } from 'node:http';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';

import app from './app.js';

function exitAfterDbFailure(error: unknown): never {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
}

export async function startApplication(): Promise<Server> {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully.');
  } catch (error) {
    exitAfterDbFailure(error);
  }

  return await new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, () => {
      console.log(
        `Kurtto service listening on port ${env.PORT} (${env.NODE_ENV})`,
      );
      resolve(server);
    });
    server.on('error', reject);
  });
}
