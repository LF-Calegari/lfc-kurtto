import { QueryFailedError } from 'typeorm';

import { env } from '@config/env';
import type {
  CreateUrlDto,
  ListUrlsQueryDto,
  PatchUrlDto,
} from '@dtos/UrlDto';
import type { Url } from '@entities/Url';
import {
  createUrlEntity,
  findUrlByShortCode,
  hardDeleteUrlByShortCode,
  listUrls,
  saveUrl,
  updateUrlByShortCode,
} from '@repositories/UrlRepository';
import { generateShortCode } from '@utils/shortCode';

const MAX_SHORT_CODE_ATTEMPTS = 5;

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
  };
}

export class UrlService {
  public async create(dto: CreateUrlDto): Promise<Url> {
    const expiresAt =
      dto.expiresAt !== undefined ? new Date(dto.expiresAt) : null;

    if (dto.customCode) {
      const taken = await findUrlByShortCode(dto.customCode);
      if (taken) {
        const err = new Error('custom_code already exists');
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }
      const entity = createUrlEntity({
        originalUrl: dto.originalUrl,
        shortCode: dto.customCode,
        expiresAt,
      });
      const saved = await saveUrl(entity);
      console.info('[url] created with custom short_code', {
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
        console.info('[url] created with generated short_code', {
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
          const err = new Error('Could not generate a unique short code');
          (err as Error & { statusCode: number }).statusCode = 500;
          throw err;
        }
        throw error;
      }
    }

    const err = new Error('Could not generate a unique short code');
    (err as Error & { statusCode: number }).statusCode = 500;
    throw err;
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
    const { rows, total } = await listUrls({
      page: query.page,
      limit: query.limit,
      active: query.active,
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

  public async getByShortCode(shortCode: string): Promise<Url | null> {
    return findUrlByShortCode(shortCode);
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
      console.info('[url] patched', { shortCode, id: updated.id });
    }
    return updated;
  }

  public async remove(shortCode: string): Promise<boolean> {
    const removed = await hardDeleteUrlByShortCode(shortCode);
    if (removed) {
      console.info('[url] hard deleted', { shortCode });
    }
    return removed;
  }
}

export default new UrlService();
