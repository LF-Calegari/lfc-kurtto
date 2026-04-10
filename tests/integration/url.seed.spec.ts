import { In } from 'typeorm';

import { AppDataSource } from '@config/data-source';
import { Url } from '@entities/Url';
import { runUrlSeed, urlSeedShortCodes } from '../../src/seeds/url.seed.js';

import { useIntegrationDatabase } from '../helpers/setup';

useIntegrationDatabase();

describe('url seed', () => {
  it('runUrlSeed is idempotent and inserts five rows', async () => {
    await runUrlSeed();
    await runUrlSeed();

    const repo = AppDataSource.getRepository(Url);
    const seedCount = await repo.count({
      where: { shortCode: In(urlSeedShortCodes) },
    });
    expect(seedCount).toBe(5);

    const expired = await repo.findOne({ where: { shortCode: 'expired' } });
    expect(expired).toBeTruthy();
    expect(expired!.isActive).toBe(false);
    expect(expired!.expiresAt).toBeTruthy();
    expect(expired!.expiresAt! < new Date()).toBe(true);
    expect(expired!.deletedAt).toBeNull();
  });
});
