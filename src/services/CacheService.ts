import { env } from '@config/env';
import { logger } from '@config/logger';
import { getRedisClient } from '@config/redis';

export type RedirectCachePayload = {
  original_url: string;
  is_active: boolean;
  expires_at: string | null;
};

function cacheKey(shortCode: string): string {
  return `url:${shortCode}`;
}

class CacheService {
  public async get(shortCode: string): Promise<RedirectCachePayload | null> {
    const r = getRedisClient();
    if (!r) {
      return null;
    }
    try {
      const raw = await r.get(cacheKey(shortCode));
      if (raw === null || raw === '') {
        return null;
      }
      const parsed = JSON.parse(raw) as RedirectCachePayload;
      if (
        typeof parsed.original_url !== 'string' ||
        typeof parsed.is_active !== 'boolean' ||
        (parsed.expires_at !== null &&
          parsed.expires_at !== undefined &&
          typeof parsed.expires_at !== 'string')
      ) {
        await this.delete(shortCode);
        return null;
      }
      return {
        original_url: parsed.original_url,
        is_active: parsed.is_active,
        expires_at: parsed.expires_at ?? null,
      };
    } catch (error: unknown) {
      logger.warn('Redis GET redirect cache failed', {
        context: 'cache',
        shortCode,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
      });
      return null;
    }
  }

  public async set(
    shortCode: string,
    payload: RedirectCachePayload,
  ): Promise<void> {
    const r = getRedisClient();
    if (!r) {
      return;
    }
    try {
      const ttl = env.REDIS_CACHE_TTL;
      await r.setex(
        cacheKey(shortCode),
        ttl,
        JSON.stringify({
          original_url: payload.original_url,
          is_active: payload.is_active,
          expires_at: payload.expires_at,
        }),
      );
    } catch (error: unknown) {
      logger.warn('Redis SET redirect cache failed', {
        context: 'cache',
        shortCode,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
      });
    }
  }

  public async delete(shortCode: string): Promise<void> {
    const r = getRedisClient();
    if (!r) {
      return;
    }
    try {
      await r.del(cacheKey(shortCode));
    } catch (error: unknown) {
      logger.warn('Redis DEL redirect cache failed', {
        context: 'cache',
        shortCode,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
      });
    }
  }
}

export default new CacheService();
