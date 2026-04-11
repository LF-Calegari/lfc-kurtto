import type { Server } from 'node:http';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { quitRedis } from '@config/redis';

let shutdownStarted = false;

export function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    logger.info(`Received ${signal}, starting graceful shutdown`, {
      context: 'shutdown',
      signal,
    });

    const timeoutMs = env.GRACEFUL_SHUTDOWN_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out', {
        context: 'shutdown',
        timeoutMs,
      });
      process.exit(1);
    }, timeoutMs);

    server.close((closeError?: Error) => {
      if (closeError) {
        logger.error('Error closing HTTP server', {
          context: 'shutdown',
          message: closeError.message,
        });
      } else {
        logger.info('HTTP server closed', { context: 'shutdown' });
      }

      void (async () => {
        try {
          if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            logger.info('Database connection closed', { context: 'shutdown' });
          }
        } catch (error: unknown) {
          logger.warn('DataSource.destroy failed during shutdown', {
            context: 'shutdown',
            error:
              error instanceof Error
                ? { message: error.message, name: error.name }
                : String(error),
          });
        }
        await quitRedis();
        clearTimeout(timeout);
        process.exit(closeError ? 1 : 0);
      })();
    });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}
