import { Brackets } from 'typeorm';

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
        /**
         * PostgreSQL: `ORDER BY deleted_at DESC` coloca NULL primeiro (linha ativa),
         * depois tumbas da mais recente à mais antiga — alinhado ao restore.
         */
        order: { deletedAt: 'DESC' },
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

/** Remove metacaracteres de LIKE para uso seguro em ILIKE com parâmetro. */
function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '');
}

export async function listUrls(params: {
  page: number;
  limit: number;
  active?: boolean;
  withDeleted?: boolean;
  q?: string;
  shortUrlSearchBase?: string;
}): Promise<{ rows: Url[]; total: number }> {
  const repo = AppDataSource.getRepository(Url);
  const qb = repo.createQueryBuilder('url');

  if (params.withDeleted === true) {
    qb.withDeleted();
  }

  if (params.active !== undefined) {
    qb.andWhere('url.isActive = :isActive', { isActive: params.active });
  }

  const rawTerm = params.q?.trim();
  if (rawTerm && rawTerm.length > 0) {
    const safe = sanitizeLikeFragment(rawTerm);
    if (safe.length > 0) {
      const pat = `%${safe}%`;
      const base = params.shortUrlSearchBase?.replace(/\/$/, '') ?? '';
      qb.andWhere(
        new Brackets((w) => {
          w.where('url.shortCode ILIKE :searchPat', { searchPat: pat }).orWhere(
            'url.originalUrl ILIKE :searchPat',
            { searchPat: pat },
          );
          if (base.length > 0) {
            w.orWhere("CONCAT(:searchBase, '/', url.shortCode) ILIKE :searchPat", {
              searchBase: base,
              searchPat: pat,
            });
          }
        }),
      );
    }
  }

  qb.orderBy('url.createdAt', 'DESC');
  qb.skip((params.page - 1) * params.limit).take(params.limit);

  const [rows, total] = await qb.getManyAndCount();
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
