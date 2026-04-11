import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Url } from '@entities/Url';

const repoMocks = {
  findUrlByShortCode: jest.fn(),
  updateUrlByShortCode: jest.fn(),
  hardDeleteUrlByShortCode: jest.fn(),
  createUrlEntity: jest.fn(),
  saveUrl: jest.fn(),
  listUrls: jest.fn(),
  incrementClicksAtomic: jest.fn(),
};

const cacheMocks = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.unstable_mockModule('@repositories/UrlRepository', () => repoMocks);
jest.unstable_mockModule('@services/CacheService', () => ({
  default: cacheMocks,
}));

function makeUrl(partial: Partial<Url>): Url {
  return {
    id: 'id-1',
    originalUrl: partial.originalUrl ?? 'https://example.com',
    shortCode: partial.shortCode ?? 'sc',
    clicks: 0,
    isActive: partial.isActive ?? true,
    expiresAt: partial.expiresAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Url;
}

describe('UrlService.resolveRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheMocks.get.mockReset();
    cacheMocks.set.mockReset();
    cacheMocks.delete.mockReset();
    repoMocks.findUrlByShortCode.mockReset();
    repoMocks.updateUrlByShortCode.mockReset();
  });

  it('returns redirect from cache when active', async () => {
    cacheMocks.get.mockResolvedValue({
      original_url: 'https://cached.example',
      is_active: true,
      expires_at: null,
    });
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('ab')).resolves.toEqual({
      outcome: 'redirect',
      originalUrl: 'https://cached.example',
    });
    expect(repoMocks.findUrlByShortCode).not.toHaveBeenCalled();
  });

  it('drops stale cache by expires_at then uses DB', async () => {
    cacheMocks.get
      .mockResolvedValueOnce({
        original_url: 'https://old.example',
        is_active: true,
        expires_at: '2000-01-01T00:00:00.000Z',
      })
      .mockResolvedValueOnce(null);
    const row = makeUrl({
      shortCode: 'ab',
      originalUrl: 'https://db.example',
      expiresAt: new Date('2099-01-01'),
    });
    repoMocks.findUrlByShortCode.mockResolvedValue(row);
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('ab')).resolves.toEqual({
      outcome: 'redirect',
      originalUrl: 'https://db.example',
    });
    expect(cacheMocks.delete).toHaveBeenCalledWith('ab');
    expect(cacheMocks.set).toHaveBeenCalled();
  });

  it('returns gone_inactive from cache', async () => {
    cacheMocks.get.mockResolvedValue({
      original_url: 'https://x.com',
      is_active: false,
      expires_at: null,
    });
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('ab')).resolves.toEqual({
      outcome: 'gone_inactive',
    });
  });

  it('loads from database and populates cache on miss', async () => {
    cacheMocks.get.mockResolvedValue(null);
    const row = makeUrl({
      originalUrl: 'https://fresh.example',
      expiresAt: null,
    });
    repoMocks.findUrlByShortCode.mockResolvedValue(row);
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('xy')).resolves.toEqual({
      outcome: 'redirect',
      originalUrl: 'https://fresh.example',
    });
    expect(cacheMocks.set).toHaveBeenCalledWith('xy', {
      original_url: 'https://fresh.example',
      is_active: true,
      expires_at: null,
    });
  });

  it('returns not_found when absent in database', async () => {
    cacheMocks.get.mockResolvedValue(null);
    repoMocks.findUrlByShortCode.mockResolvedValue(null);
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('zz')).resolves.toEqual({
      outcome: 'not_found',
    });
  });

  it('gone_expired when URL past expiry in DB', async () => {
    cacheMocks.get.mockResolvedValue(null);
    const past = new Date('2000-01-01T00:00:00.000Z');
    const row = makeUrl({ expiresAt: past, isActive: true });
    repoMocks.findUrlByShortCode.mockResolvedValue(row);
    repoMocks.updateUrlByShortCode.mockResolvedValue({
      ...row,
      isActive: false,
    });
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.resolveRedirect('ex')).resolves.toEqual({
      outcome: 'gone_expired',
    });
    expect(repoMocks.updateUrlByShortCode).toHaveBeenCalledWith('ex', {
      isActive: false,
    });
    expect(cacheMocks.delete).toHaveBeenCalledWith('ex');
  });
});

describe('UrlService patch/remove cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheMocks.delete.mockReset();
    repoMocks.updateUrlByShortCode.mockReset();
    repoMocks.hardDeleteUrlByShortCode.mockReset();
  });

  it('patch deletes cache after update', async () => {
    const updated = makeUrl({ shortCode: 'p1' });
    repoMocks.updateUrlByShortCode.mockResolvedValue(updated);
    const { default: urlService } = await import('@services/UrlService');
    await urlService.patch('p1', { originalUrl: 'https://new.example' });
    expect(cacheMocks.delete).toHaveBeenCalledWith('p1');
  });

  it('remove deletes cache after hard delete', async () => {
    repoMocks.hardDeleteUrlByShortCode.mockResolvedValue(true);
    const { default: urlService } = await import('@services/UrlService');
    await expect(urlService.remove('d1')).resolves.toBe(true);
    expect(cacheMocks.delete).toHaveBeenCalledWith('d1');
  });
});
