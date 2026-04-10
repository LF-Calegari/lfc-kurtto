import { logger } from './config/logger.js';
import { startApplication } from './bootstrap.js';

process.on('uncaughtException', (error: Error) => {
  logger.error(error.message, {
    context: 'process',
    name: error.name,
    stack: error.stack,
    kind: 'uncaughtException',
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof Error) {
    logger.error(reason.message, {
      context: 'process',
      name: reason.name,
      stack: reason.stack,
      kind: 'unhandledRejection',
    });
  } else {
    logger.error('unhandledRejection', {
      context: 'process',
      reason: String(reason),
      kind: 'unhandledRejection',
    });
  }
  process.exit(1);
});

void startApplication().catch((error: unknown) => {
  logger.error('Failed to start application', {
    context: 'bootstrap',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
