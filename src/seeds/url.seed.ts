import 'reflect-metadata';

import { AppDataSource } from '../config/data-source.js';
import { Url } from '../entities/url.entity.js';

const expiredAt = new Date('2020-01-01T00:00:00.000Z');

type UrlSeedRow = Pick<
  Url,
  'originalUrl' | 'shortCode' | 'clicks' | 'isActive' | 'expiresAt'
>;

const seedRows: UrlSeedRow[] = [
  {
    originalUrl: 'https://github.com/LF-Calegari',
    shortCode: 'github',
    clicks: 0,
    isActive: true,
    expiresAt: null,
  },
  {
    originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    shortCode: 'yt',
    clicks: 0,
    isActive: true,
    expiresAt: null,
  },
  {
    originalUrl: 'https://www.google.com',
    shortCode: 'goog',
    clicks: 0,
    isActive: true,
    expiresAt: null,
  },
  {
    originalUrl: 'https://docs.example.com/kurtto',
    shortCode: 'docs',
    clicks: 0,
    isActive: true,
    expiresAt: null,
  },
  {
    originalUrl: 'https://expired.example.com',
    shortCode: 'expired',
    clicks: 0,
    isActive: false,
    expiresAt: expiredAt,
  },
];

export async function runUrlSeed(): Promise<void> {
  const repo = AppDataSource.getRepository(Url);

  for (const row of seedRows) {
    const existing = await repo.findOne({
      where: { shortCode: row.shortCode },
    });
    if (existing) {
      continue;
    }
    await repo.save(repo.create(row));
  }
}
