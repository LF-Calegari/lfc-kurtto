import { QueryFailedError } from 'typeorm';

import { env } from '@config/env';
import { logger } from '@config/logger';
import cacheService from '@services/CacheService';
import { AppError } from '@errors/AppError';
import { ConflictError } from '@errors/ConflictError';
import {
  type CreateUrlDto,
  type ListUrlsQueryDto,
  type PatchUrlDto,
  parseDatePair,
  parseIntPair,
} from '@dtos/UrlDto';
import type { Url } from '@entities/Url';
import {
  createUrlEntity,
  findUrlByShortCode,
  incrementClicksAtomic,
  listUrls,
  restoreUrlByShortCode,
  saveUrl,
  softDeleteUrlByShortCode,
  updateUrlByShortCode,
} from '@repositories/UrlRepository';
import type {
  UrlDateFilterField,
  UrlListRepoFilter,
} from '@repositories/UrlRepository';
import { HttpStatusCode } from '@utils/HttpStatusCode';
import { generateShortCode } from '@utils/shortCode';

const MAX_SHORT_CODE_ATTEMPTS = 5;

function emptyUrlListRepoFilter(): UrlListRepoFilter {
  return { stringExact: [], stringLike: [], clicks: [], dates: [] };
}

function buildUrlListRepoFilter(query: ListUrlsQueryDto): UrlListRepoFilter {
  const f = emptyUrlListRepoFilter();
  if (query.id__exact) {
    f.stringExact.push({ field: 'id', value: query.id__exact });
  }
  if (query.id__like) {
    f.stringLike.push({ field: 'id', pattern: query.id__like });
  }
  if (query.original_url__exact) {
    f.stringExact.push({
      field: 'originalUrl',
      value: query.original_url__exact,
    });
  }
  if (query.original_url__like) {
    f.stringLike.push({
      field: 'originalUrl',
      pattern: query.original_url__like,
    });
  }
  if (query.short_code__exact) {
    f.stringExact.push({
      field: 'shortCode',
      value: query.short_code__exact,
    });
  }
  if (query.short_code__like) {
    f.stringLike.push({
      field: 'shortCode',
      pattern: query.short_code__like,
    });
  }
  if (query.clicks__lt !== undefined) {
    f.clicks.push({ op: 'lt', value: query.clicks__lt });
  }
  if (query.clicks__gt !== undefined) {
    f.clicks.push({ op: 'gt', value: query.clicks__gt });
  }
  if (query.clicks__exact !== undefined) {
    f.clicks.push({ op: 'exact', value: query.clicks__exact });
  }
  if (query.clicks__between) {
    const pair = parseIntPair(query.clicks__between);
    if (pair) {
      f.clicks.push({ op: 'between', low: pair[0], high: pair[1] });
    }
  }

  const pushDateScalar = (
    field: UrlDateFilterField,
    op: 'lt' | 'gt' | 'exact',
    raw: string | undefined,
  ): void => {
    if (raw === undefined) {
      return;
    }
    f.dates.push({ field, op, at: new Date(raw) });
  };

  const pushDateBetween = (
    field: UrlDateFilterField,
    raw: string | undefined,
  ): void => {
    if (raw === undefined) {
      return;
    }
    const pair = parseDatePair(raw);
    if (pair) {
      f.dates.push({
        field,
        op: 'between',
        low: pair[0],
        high: pair[1],
      });
    }
  };

  pushDateScalar('expiresAt', 'lt', query.expires_at__lt);
  pushDateScalar('expiresAt', 'gt', query.expires_at__gt);
  pushDateScalar('expiresAt', 'exact', query.expires_at__exact);
  pushDateBetween('expiresAt', query.expires_at__between);

  pushDateScalar('createdAt', 'lt', query.created_at__lt);
  pushDateScalar('createdAt', 'gt', query.created_at__gt);
  pushDateScalar('createdAt', 'exact', query.created_at__exact);
  pushDateBetween('createdAt', query.created_at__between);

  pushDateScalar('updatedAt', 'lt', query.updated_at__lt);
  pushDateScalar('updatedAt', 'gt', query.updated_at__gt);
  pushDateScalar('updatedAt', 'exact', query.updated_at__exact);
  pushDateBetween('updatedAt', query.updated_at__between);

  pushDateScalar('deletedAt', 'lt', query.deleted_at__lt);
  pushDateScalar('deletedAt', 'gt', query.deleted_at__gt);
  pushDateScalar('deletedAt', 'exact', query.deleted_at__exact);
  pushDateBetween('deletedAt', query.deleted_at__between);

  return f;
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const code = (error as QueryFailedError & { driverError?: { code?: string } })
    .driverError?.code;
  return code === '23505';
}

function buildShortUrl(shortCode: string): string {
  const base = env.BASE_URL.replace(/\/$/, '');
  return `${base}/${shortCode}`;
}

export type RedirectResolution =
  | { outcome: 'not_found' }
  | { outcome: 'gone_inactive' }
  | { outcome: 'gone_expired' }
  | { outcome: 'redirect'; originalUrl: string };

export function serializeUrl(url: Url): Record<string, unknown> {
  return {
    id: url.id,
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    shortUrl: buildShortUrl(url.shortCode),
    clicks: url.clicks,
    isActive: url.isActive,
    expiresAt: url.expiresAt?.toISOString() ?? null,
    createdAt: url.createdAt.toISOString(),
    updatedAt: url.updatedAt.toISOString(),
    deletedAt: url.deletedAt?.toISOString() ?? null,
  };
}

export class UrlService {
  public async create(dto: CreateUrlDto): Promise<Url> {
    const expiresAt =
      dto.expiresAt === undefined ? null : new Date(dto.expiresAt);

    if (dto.customCode) {
      const taken = await findUrlByShortCode(dto.customCode);
      if (taken) {
        throw new ConflictError();
      }
      const entity = createUrlEntity({
        originalUrl: dto.originalUrl,
        shortCode: dto.customCode,
        expiresAt,
      });
      const saved = await saveUrl(entity);
      logger.info('created with custom short_code', {
        context: 'url',
        id: saved.id,
        shortCode: saved.shortCode,
      });
      return saved;
    }

    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();
      const entity = createUrlEntity({
        originalUrl: dto.originalUrl,
        shortCode,
        expiresAt,
      });
      try {
        const saved = await saveUrl(entity);
        logger.info('created with generated short_code', {
          context: 'url',
          id: saved.id,
          shortCode: saved.shortCode,
          attempt: attempt + 1,
        });
        return saved;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_SHORT_CODE_ATTEMPTS - 1) {
          continue;
        }
        if (isUniqueViolation(error)) {
          throw new AppError(
            'Could not generate a unique short code',
            HttpStatusCode.INTERNAL_SERVER_ERROR,
          );
        }
        throw error;
      }
    }

    throw new AppError(
      'Could not generate a unique short code',
      HttpStatusCode.INTERNAL_SERVER_ERROR,
    );
  }

  public async list(query: ListUrlsQueryDto): Promise<{
    data: ReturnType<typeof serializeUrl>[];
    meta: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const isActiveFilter =
      query.is_active__exact !== undefined
        ? query.is_active__exact
        : query.active;
    const { rows, total } = await listUrls({
      page: query.page,
      limit: query.limit,
      active: isActiveFilter,
      withDeleted: query.include_deleted === true,
      filters: buildUrlListRepoFilter(query),
    });
    const totalPages =
      total === 0 ? 0 : Math.ceil(total / query.limit);
    return {
      data: rows.map((u) => serializeUrl(u)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: totalPages,
      },
    };
  }

  public async getByShortCode(
    shortCode: string,
    options?: { withDeleted?: boolean },
  ): Promise<Url | null> {
    return findUrlByShortCode(shortCode, options);
  }

  public async resolveRedirect(shortCode: string): Promise<RedirectResolution> {
    const cached = await cacheService.get(shortCode);
    if (cached) {
      const now = Date.now();
      const exp =
        cached.expires_at !== null && cached.expires_at !== ''
          ? new Date(cached.expires_at).getTime()
          : null;
      if (exp !== null && !Number.isNaN(exp) && exp <= now) {
        await cacheService.delete(shortCode);
        return this.resolveRedirectFromDatabase(shortCode);
      }
      if (!cached.is_active) {
        return { outcome: 'gone_inactive' };
      }
      return { outcome: 'redirect', originalUrl: cached.original_url };
    }

    return this.resolveRedirectFromDatabase(shortCode);
  }

  private async resolveRedirectFromDatabase(
    shortCode: string,
  ): Promise<RedirectResolution> {
    const url = await findUrlByShortCode(shortCode);
    if (!url) {
      return { outcome: 'not_found' };
    }
    const now = Date.now();
    if (url.expiresAt !== null && url.expiresAt.getTime() <= now) {
      await updateUrlByShortCode(shortCode, { isActive: false });
      await cacheService.delete(shortCode);
      return { outcome: 'gone_expired' };
    }
    if (!url.isActive) {
      return { outcome: 'gone_inactive' };
    }
    await cacheService.set(shortCode, {
      original_url: url.originalUrl,
      is_active: url.isActive,
      expires_at: url.expiresAt?.toISOString() ?? null,
    });
    return { outcome: 'redirect', originalUrl: url.originalUrl };
  }

  public scheduleClickIncrement(shortCode: string): void {
    setImmediate(() => {
      void incrementClicksAtomic(shortCode).catch((error: unknown) => {
        logger.warn('atomic click increment failed', {
          context: 'redirect',
          shortCode,
          error:
            error instanceof Error
              ? { message: error.message, name: error.name }
              : String(error),
        });
      });
    });
  }

  public async patch(shortCode: string, dto: PatchUrlDto): Promise<Url | null> {
    const patch: {
      originalUrl?: string;
      expiresAt?: Date | null;
      isActive?: boolean;
    } = {};
    if (dto.originalUrl !== undefined) {
      patch.originalUrl = dto.originalUrl;
    }
    if (dto.expiresAt !== undefined) {
      patch.expiresAt = new Date(dto.expiresAt);
    }
    if (dto.isActive !== undefined) {
      patch.isActive = dto.isActive;
    }
    const updated = await updateUrlByShortCode(shortCode, patch);
    if (updated) {
      await cacheService.delete(shortCode);
      logger.info('patched', { context: 'url', shortCode, id: updated.id });
    }
    return updated;
  }

  public async remove(shortCode: string): Promise<boolean> {
    const removed = await softDeleteUrlByShortCode(shortCode);
    if (removed) {
      await cacheService.delete(shortCode);
      logger.info('soft deleted', { context: 'url', shortCode });
    }
    return removed;
  }

  public async restore(shortCode: string): Promise<boolean> {
    const restored = await restoreUrlByShortCode(shortCode);
    if (restored) {
      await cacheService.delete(shortCode);
      logger.info('restored from soft delete', { context: 'url', shortCode });
    }
    return restored;
  }
}

export default new UrlService();
