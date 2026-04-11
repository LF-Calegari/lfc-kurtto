import { Redis } from 'ioredis';

import { env } from './env.js';
import { logger } from './logger.js';

let client: Redis | null = null;
let shutdownHooksRegistered = false;

function redisUrl(): string | undefined {
  const u = env.REDIS_URL?.trim();
  return u || undefined;
}

export function isRedisConfigured(): boolean {
  return redisUrl() !== undefined;
}

export function getRedisClient(): Redis | null {
  const url = redisUrl();
  if (!url) {
    return null;
  }
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    client.on('connect', () => {
      logger.info('Redis connected', { context: 'redis' });
    });
    client.on('error', (err: Error) => {
      logger.error(err.message, {
        context: 'redis',
        kind: 'error',
        name: err.name,
      });
    });
    client.on('reconnecting', (delayMs: number) => {
      logger.warn('Redis reconnecting', { context: 'redis', delayMs });
    });
  }
  return client;
}

export async function pingRedis(): Promise<boolean> {
  const r = getRedisClient();
  if (!r) {
    return false;
  }
  try {
    const reply = await r.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function quitRedis(): Promise<void> {
  if (!client) {
    return;
  }
  const c = client;
  client = null;
  try {
    await c.quit();
  } catch (error: unknown) {
    logger.warn('Redis quit failed', {
      context: 'redis',
      error:
        error instanceof Error
          ? { message: error.message, name: error.name }
          : String(error),
    });
    try {
      c.disconnect();
    } catch {
      /* ignore */
    }
  }
}

export function registerRedisShutdownHooks(): void {
  if (shutdownHooksRegistered) {
    return;
  }
  shutdownHooksRegistered = true;
  const onShutdown = (): void => {
    void quitRedis();
  };
  process.on('SIGTERM', onShutdown);
  process.on('SIGINT', onShutdown);
}
