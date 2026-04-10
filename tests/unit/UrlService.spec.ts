import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryFailedError } from 'typeorm';

import type { Url } from '@entities/Url';

const repoMocks = {
  findUrlByShortCode: jest.fn(),
  createUrlEntity: jest.fn(),
  saveUrl: jest.fn(),
  listUrls: jest.fn(),
  updateUrlByShortCode: jest.fn(),
  hardDeleteUrlByShortCode: jest.fn(),
  incrementClicksAtomic: jest.fn(),
};

jest.unstable_mockModule('@repositories/UrlRepository', () => repoMocks);

const genMock = jest.fn();
jest.unstable_mockModule('@utils/shortCode', () => ({
  generateShortCode: genMock,
}));

function makeSavedUrl(partial: Partial<Url>): Url {
  return {
    id: 'id-1',
    originalUrl: partial.originalUrl ?? 'https://example.com',
    shortCode: partial.shortCode ?? 'abc',
    clicks: 0,
    isActive: true,
    expiresAt: partial.expiresAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as Url;
}

describe('UrlService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    genMock.mockReturnValue('abc1234');
    repoMocks.findUrlByShortCode.mockResolvedValue(null);
    repoMocks.createUrlEntity.mockImplementation((p: unknown) =>
      makeSavedUrl(p as Partial<Url>),
    );
    repoMocks.saveUrl.mockImplementation(async (u: unknown) =>
      makeSavedUrl(u as Partial<Url>),
    );
  });

  it('persists URL with generated short code', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const row = await urlService.create({
      originalUrl: 'https://example.com/x',
    });
    expect(row.shortCode).toBe('abc1234');
    expect(repoMocks.saveUrl).toHaveBeenCalled();
  });

  it('uses custom code when provided', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const row = await urlService.create({
      originalUrl: 'https://example.com/y',
      customCode: 'mycode',
    });
    expect(row.shortCode).toBe('mycode');
    expect(genMock).not.toHaveBeenCalled();
  });

  it('retries on unique collision then succeeds', async () => {
    const driverErr = Object.assign(new Error('dup'), { code: '23505' });
    const uniqueErr = new QueryFailedError('INSERT', [], driverErr);

    repoMocks.saveUrl
      .mockRejectedValueOnce(uniqueErr)
      .mockImplementationOnce(async (u: unknown) =>
        makeSavedUrl({ ...(u as Partial<Url>), shortCode: 'uniq22' }),
      );

    genMock.mockReturnValueOnce('dup1111').mockReturnValueOnce('uniq22');

    const { default: urlService } = await import('@services/UrlService');
    const row = await urlService.create({
      originalUrl: 'https://example.com/z',
    });
    expect(row.shortCode).toBe('uniq22');
    expect(genMock).toHaveBeenCalledTimes(2);
  });
});
