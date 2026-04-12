import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';

export async function findUrlByShortCode(
  shortCode: string,
  options?: { withDeleted?: boolean },
): Promise<Url | null> {
  const repo = AppDataSource.getRepository(Url);
  const withDeleted = options?.withDeleted === true;
  return repo.findOne({
    where: { shortCode },
    withDeleted,
    ...(withDeleted
      ? {
        /** Ativo (`deleted_at` nulo) antes de tumbas, quando ambos existem (reuso de codigo). */
        order: { deletedAt: 'ASC' },
      }
      : {}),
  });
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
  withDeleted?: boolean;
}): Promise<{ rows: Url[]; total: number }> {
  const repo = AppDataSource.getRepository(Url);
  const where =
    params.active === undefined ? {} : { isActive: params.active };

  const [rows, total] = await repo.findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (params.page - 1) * params.limit,
    take: params.limit,
    withDeleted: params.withDeleted === true,
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

export async function softDeleteUrlByShortCode(
  shortCode: string,
): Promise<boolean> {
  const repo = AppDataSource.getRepository(Url);
  const existing = await repo.findOne({ where: { shortCode } });
  if (!existing) {
    return false;
  }
  const result = await repo.softDelete({ id: existing.id });
  return (result.affected ?? 0) > 0;
}

/**
 * Reativa no maximo uma linha soft-deleted: a mais recentemente excluida.
 * Nao altera nada se ja existir URL ativa com o mesmo `short_code` (evita violar
 * indice unico parcial e evita restaurar multiplas tumbas de uma vez).
 */
export async function restoreUrlByShortCode(
  shortCode: string,
): Promise<boolean> {
  const repo = AppDataSource.getRepository(Url);
  const active = await repo.findOne({ where: { shortCode } });
  if (active) {
    return false;
  }
  const tombstone = await repo
    .createQueryBuilder('url')
    .withDeleted()
    .where('url.shortCode = :code', { code: shortCode })
    .andWhere('url.deletedAt IS NOT NULL')
    .orderBy('url.deletedAt', 'DESC')
    .getOne();
  if (!tombstone) {
    return false;
  }
  const result = await repo.restore({ id: tombstone.id });
  return (result.affected ?? 0) > 0;
}

/** Atomic `clicks = clicks + 1` for active (non-soft-deleted) rows. */
export async function incrementClicksAtomic(shortCode: string): Promise<void> {
  await AppDataSource.query(
    [
      'UPDATE urls SET clicks = clicks + 1',
      'WHERE short_code = $1 AND deleted_at IS NULL',
    ].join(' '),
    [shortCode],
  );
}
