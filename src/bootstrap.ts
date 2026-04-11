import 'reflect-metadata';

import type { Server } from 'node:http';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { registerRedisShutdownHooks } from '@config/redis';

import app from './app.js';

function exitAfterDbFailure(error: unknown): never {
  logger.error('Failed to initialize database connection', {
    context: 'bootstrap',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
}

export async function startApplication(): Promise<Server> {
  registerRedisShutdownHooks();
  try {
    await AppDataSource.initialize();
    logger.info('Database connection established successfully.', {
      context: 'bootstrap',
    });
  } catch (error) {
    exitAfterDbFailure(error);
  }

  return await new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, () => {
      logger.info(
        `Kurtto service listening on port ${env.PORT} (${env.NODE_ENV})`,
        { context: 'bootstrap', port: env.PORT, nodeEnv: env.NODE_ENV },
      );
      resolve(server);
    });
    server.on('error', reject);
  });
}
