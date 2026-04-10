import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';

export async function findUrlByShortCode(
  shortCode: string,
): Promise<Url | null> {
  const repo = AppDataSource.getRepository(Url);
  return repo.findOne({ where: { shortCode } });
}

export async function saveUrl(entity: Url): Promise<Url> {
  const repo = AppDataSource.getRepository(Url);
  return repo.save(entity);
}

export function createUrlEntity(partial: {
  originalUrl: string;
  shortCode: string;
  expiresAt: Date | null;
}): Url {
  const repo = AppDataSource.getRepository(Url);
  return repo.create({
    originalUrl: partial.originalUrl,
    shortCode: partial.shortCode,
    clicks: 0,
    isActive: true,
    expiresAt: partial.expiresAt,
  });
}

export async function listUrls(params: {
  page: number;
  limit: number;
  active?: boolean;
}): Promise<{ rows: Url[]; total: number }> {
  const repo = AppDataSource.getRepository(Url);
  const where =
    params.active === undefined ? {} : { isActive: params.active };

  const [rows, total] = await repo.findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (params.page - 1) * params.limit,
    take: params.limit,
  });

  return { rows, total };
}

export async function updateUrlByShortCode(
  shortCode: string,
  patch: {
    originalUrl?: string;
    expiresAt?: Date | null;
    isActive?: boolean;
  },
): Promise<Url | null> {
  const repo = AppDataSource.getRepository(Url);
  const existing = await repo.findOne({ where: { shortCode } });
  if (!existing) {
    return null;
  }
  if (patch.originalUrl !== undefined) {
    existing.originalUrl = patch.originalUrl;
  }
  if (patch.expiresAt !== undefined) {
    existing.expiresAt = patch.expiresAt;
  }
  if (patch.isActive !== undefined) {
    existing.isActive = patch.isActive;
  }
  return repo.save(existing);
}

export async function hardDeleteUrlByShortCode(
  shortCode: string,
): Promise<boolean> {
  const repo = AppDataSource.getRepository(Url);
  const result = await repo.delete({ shortCode });
  return (result.affected ?? 0) > 0;
}
