import type { FindOptionsWhere, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '@config/data-source';
import { LEGACY_UNASSIGNED_OWNER_ID } from '../constants/urlOwnership.js';
import { Url } from '@entities/Url';

/** `all` = administrador Kurtto (sem filtro por proprietário). */
export type UrlOwnershipScope =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'owner'; ownerId: string };

export type UrlStringFilterField = 'id' | 'originalUrl' | 'shortCode';

export type UrlDateFilterField =
  | 'expiresAt'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt';

export type UrlListRepoFilter = {
  stringExact: { field: UrlStringFilterField; value: string }[];
  stringLike: { field: UrlStringFilterField; pattern: string }[];
  clicks: (
    | { op: 'lt' | 'gt' | 'exact'; value: number }
    | { op: 'between'; low: number; high: number }
  )[];
  dates: (
    | { field: UrlDateFilterField; op: 'lt' | 'gt' | 'exact'; at: Date }
    | { field: UrlDateFilterField; op: 'between'; low: Date; high: Date }
  )[];
};

function entityPathForStringField(field: UrlStringFilterField): string {
  switch (field) {
    case 'id':
      return 'url.id';
    case 'originalUrl':
      return 'url.originalUrl';
    case 'shortCode':
      return 'url.shortCode';
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function entityPathForDateField(field: UrlDateFilterField): string {
  switch (field) {
    case 'expiresAt':
      return 'url.expiresAt';
    case 'createdAt':
      return 'url.createdAt';
    case 'updatedAt':
      return 'url.updatedAt';
    case 'deletedAt':
      return 'url.deletedAt';
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

function applyUrlListRepoFilters(
  qb: SelectQueryBuilder<Url>,
  filters: UrlListRepoFilter,
): void {
  let p = 0;
  const next = (): string => {
    p += 1;
    return `f${p}`;
  };

  for (const { field, value } of filters.stringExact) {
    const col = entityPathForStringField(field);
    const name = next();
    qb.andWhere(`${col} = :${name}`, { [name]: value });
  }

  for (const { field, pattern } of filters.stringLike) {
    const name = next();
    if (field === 'id') {
      qb.andWhere(`CAST(url.id AS TEXT) ILIKE :${name}`, { [name]: pattern });
    } else {
      const col = entityPathForStringField(field);
      qb.andWhere(`${col} ILIKE :${name}`, { [name]: pattern });
    }
  }

  for (const c of filters.clicks) {
    if (c.op === 'between') {
      const a = next();
      const b = next();
      qb.andWhere(`url.clicks BETWEEN :${a} AND :${b}`, {
        [a]: c.low,
        [b]: c.high,
      });
    } else {
      const name = next();
      const op = c.op === 'lt' ? '<' : c.op === 'gt' ? '>' : '=';
      qb.andWhere(`url.clicks ${op} :${name}`, { [name]: c.value });
    }
  }

  for (const d of filters.dates) {
    const col = entityPathForDateField(d.field);
    if (d.op === 'between') {
      const a = next();
      const b = next();
      qb.andWhere(`${col} BETWEEN :${a} AND :${b}`, {
        [a]: d.low,
        [b]: d.high,
      });
    } else {
      const name = next();
      const op = d.op === 'lt' ? '<' : d.op === 'gt' ? '>' : '=';
      qb.andWhere(`${col} ${op} :${name}`, { [name]: d.at });
    }
  }
}

function whereForShortCode(
  shortCode: string,
  ownership: UrlOwnershipScope,
): FindOptionsWhere<Url> {
  if (ownership.kind === 'all') {
    return { shortCode };
  }
  if (ownership.kind === 'none') {
    return { shortCode, id: '__no-access__' };
  }
  return { shortCode, ownerId: ownership.ownerId };
}

export async function findUrlByShortCode(
  shortCode: string,
  options?: { withDeleted?: boolean; ownership?: UrlOwnershipScope },
): Promise<Url | null> {
  const repo = AppDataSource.getRepository(Url);
  const withDeleted = options?.withDeleted === true;
  const ownership = options?.ownership ?? { kind: 'all' };
  if (ownership.kind === 'none') {
    return null;
  }
  return repo.findOne({
    where: whereForShortCode(shortCode, ownership),
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
  ownerId?: string;
}): Url {
  const repo = AppDataSource.getRepository(Url);
  return repo.create({
    originalUrl: partial.originalUrl,
    shortCode: partial.shortCode,
    clicks: 0,
    isActive: true,
    expiresAt: partial.expiresAt,
    ownerId: partial.ownerId ?? LEGACY_UNASSIGNED_OWNER_ID,
  });
}

export async function listUrls(params: {
  page: number;
  limit: number;
  active?: boolean;
  withDeleted?: boolean;
  filters: UrlListRepoFilter;
  ownership: UrlOwnershipScope;
}): Promise<{ rows: Url[]; total: number }> {
  if (params.ownership.kind === 'none') {
    return { rows: [], total: 0 };
  }
  const repo = AppDataSource.getRepository(Url);
  const qb = repo.createQueryBuilder('url');
  if (params.withDeleted === true) {
    qb.withDeleted();
  }
  if (params.ownership.kind === 'owner') {
    qb.andWhere('url.ownerId = :ownerId', {
      ownerId: params.ownership.ownerId,
    });
  }
  if (params.active !== undefined) {
    qb.andWhere('url.isActive = :isActive', { isActive: params.active });
  }
  applyUrlListRepoFilters(qb, params.filters);
  qb.orderBy('url.createdAt', 'DESC');
  qb.skip((params.page - 1) * params.limit);
  qb.take(params.limit);
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
  ownership: UrlOwnershipScope,
): Promise<Url | null> {
  if (ownership.kind === 'none') {
    return null;
  }
  const repo = AppDataSource.getRepository(Url);
  const existing = await repo.findOne({
    where: whereForShortCode(shortCode, ownership),
  });
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
  ownership: UrlOwnershipScope,
): Promise<boolean> {
  if (ownership.kind === 'none') {
    return false;
  }
  const repo = AppDataSource.getRepository(Url);
  const existing = await repo.findOne({
    where: whereForShortCode(shortCode, ownership),
  });
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
  ownership: UrlOwnershipScope,
): Promise<boolean> {
  if (ownership.kind === 'none') {
    return false;
  }
  const repo = AppDataSource.getRepository(Url);
  const active = await repo.findOne({
    where: whereForShortCode(shortCode, ownership),
  });
  if (active) {
    return false;
  }
  const tombstoneQb = repo
    .createQueryBuilder('url')
    .withDeleted()
    .where('url.shortCode = :code', { code: shortCode })
    .andWhere('url.deletedAt IS NOT NULL');
  if (ownership.kind === 'owner') {
    tombstoneQb.andWhere('url.ownerId = :ownerId', {
      ownerId: ownership.ownerId,
    });
  }
  const tombstone = await tombstoneQb
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
