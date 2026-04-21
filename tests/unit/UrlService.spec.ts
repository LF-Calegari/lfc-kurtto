import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryFailedError } from 'typeorm';

import type { Url } from '@entities/Url';
import {
  LEGACY_UNASSIGNED_OWNER_ID,
} from '../../src/constants/urlOwnership.js';

const repoMocks = {
  findUrlByShortCode: jest.fn(),
  createUrlEntity: jest.fn(),
  saveUrl: jest.fn(),
  listUrls: jest.fn(),
  updateUrlByShortCode: jest.fn(),
  softDeleteUrlByShortCode: jest.fn(),
  restoreUrlByShortCode: jest.fn(),
  incrementClicksAtomic: jest.fn(),
};

jest.unstable_mockModule('@repositories/UrlRepository', () => repoMocks);

const loggerMocks = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule('@config/logger', () => ({
  logger: loggerMocks,
}));

const genMock = jest.fn();
jest.unstable_mockModule('@utils/shortCode', () => ({
  generateShortCode: genMock,
}));

function makeSavedUrl(partial: Partial<Url>): Url {
  return {
    id: 'id-1',
    ownerId: partial.ownerId ?? LEGACY_UNASSIGNED_OWNER_ID,
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
    const row = await urlService.create(
      {
        originalUrl: 'https://example.com/x',
      },
      '11111111-1111-1111-1111-111111111111',
    );
    expect(row.shortCode).toBe('abc1234');
    expect(repoMocks.createUrlEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: '11111111-1111-1111-1111-111111111111',
      }),
    );
    expect(repoMocks.saveUrl).toHaveBeenCalled();
  });

  it('uses custom code when provided', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const row = await urlService.create(
      {
        originalUrl: 'https://example.com/y',
        customCode: 'mycode',
      },
      '11111111-1111-1111-1111-111111111111',
    );
    expect(row.shortCode).toBe('mycode');
    expect(genMock).not.toHaveBeenCalled();
  });

  it('rejects legacy sentinel owner id', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const { ValidationError } = await import('@errors/ValidationError');
    await expect(
      urlService.create(
        {
          originalUrl: 'https://example.com/sentinel',
        },
        LEGACY_UNASSIGNED_OWNER_ID,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repoMocks.saveUrl).not.toHaveBeenCalled();
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
    const row = await urlService.create(
      {
        originalUrl: 'https://example.com/z',
      },
      '11111111-1111-1111-1111-111111111111',
    );
    expect(row.shortCode).toBe('uniq22');
    expect(genMock).toHaveBeenCalledTimes(2);
  });
});

describe('UrlService.list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repoMocks.listUrls.mockResolvedValue({ rows: [], total: 0 });
  });

  it('logs when list includes sentinel-owned URLs (legacy audit)', async () => {
    repoMocks.listUrls.mockResolvedValue({
      rows: [
        makeSavedUrl({
          ownerId: LEGACY_UNASSIGNED_OWNER_ID,
          shortCode: 'leg01',
        }),
      ],
      total: 1,
    });
    const { default: urlService } = await import('@services/UrlService');
    await urlService.list(
      {
        page: 1,
        limit: 10,
        active: undefined,
        is_active__exact: undefined,
        include_deleted: undefined,
      },
      {
        userId: '11111111-1111-1111-1111-111111111111',
        isAdmin: true,
      },
    );
    expect(loggerMocks.info).toHaveBeenCalledWith(
      'legacy unassigned URL list',
      expect.objectContaining({
        context: 'url',
        count: 1,
      }),
    );
  });

  it('maps query to repository filters and meta', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const adminActor = {
      userId: '11111111-1111-1111-1111-111111111111',
      isAdmin: true,
    };
    const result = await urlService.list({
      page: 2,
      limit: 5,
      active: true,
      include_deleted: false,
      is_active__exact: undefined,
      id__exact: '550e8400-e29b-41d4-a716-446655440000',
      id__like: '%55%',
      original_url__exact: 'https://a.com',
      original_url__like: '%b%',
      short_code__exact: 'abc',
      short_code__like: '%c%',
      clicks__lt: 10,
      clicks__gt: 1,
      clicks__exact: 5,
      clicks__between: '0,9',
      expires_at__lt: '2099-01-01T00:00:00.000Z',
      expires_at__gt: '2000-01-01T00:00:00.000Z',
      expires_at__exact: '2020-01-01T00:00:00.000Z',
      expires_at__between: '2000-01-01T00:00:00.000Z,2099-01-01T00:00:00.000Z',
      created_at__lt: '2099-01-01T00:00:00.000Z',
      created_at__gt: '2000-01-01T00:00:00.000Z',
      created_at__exact: '2020-01-01T00:00:00.000Z',
      created_at__between: '2000-01-01T00:00:00.000Z,2099-01-01T00:00:00.000Z',
      updated_at__lt: '2099-01-01T00:00:00.000Z',
      updated_at__gt: '2000-01-01T00:00:00.000Z',
      updated_at__exact: '2020-01-01T00:00:00.000Z',
      updated_at__between: '2000-01-01T00:00:00.000Z,2099-01-01T00:00:00.000Z',
      deleted_at__lt: '2099-01-01T00:00:00.000Z',
      deleted_at__gt: '2000-01-01T00:00:00.000Z',
      deleted_at__exact: '2020-01-01T00:00:00.000Z',
      deleted_at__between: '2000-01-01T00:00:00.000Z,2099-01-01T00:00:00.000Z',
    }, adminActor);

    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(5);
    expect(result.meta.total).toBe(0);
    expect(result.meta.total_pages).toBe(0);
    expect(repoMocks.listUrls).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 5,
        active: true,
        withDeleted: false,
        ownership: { kind: 'all' },
        filters: expect.objectContaining({
          stringExact: expect.arrayContaining([
            { field: 'id', value: '550e8400-e29b-41d4-a716-446655440000' },
            { field: 'originalUrl', value: 'https://a.com' },
            { field: 'shortCode', value: 'abc' },
          ]),
          stringLike: expect.arrayContaining([
            { field: 'id', pattern: '%55%' },
            { field: 'originalUrl', pattern: '%b%' },
            { field: 'shortCode', pattern: '%c%' },
          ]),
          clicks: expect.arrayContaining([
            { op: 'lt', value: 10 },
            { op: 'gt', value: 1 },
            { op: 'exact', value: 5 },
            { op: 'between', low: 0, high: 9 },
          ]),
        }),
      }),
    );
  });

  it('uses is_active__exact over active when both are set', async () => {
    const { default: urlService } = await import('@services/UrlService');
    const adminActor = {
      userId: '11111111-1111-1111-1111-111111111111',
      isAdmin: true,
    };
    await urlService.list({
      page: 1,
      limit: 10,
      active: true,
      is_active__exact: false,
      include_deleted: undefined,
    }, adminActor);
    expect(repoMocks.listUrls).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, ownership: { kind: 'all' } }),
    );
  });

  it('never treats legacy sentinel as a normal owner scope', async () => {
    const { default: urlService } = await import('@services/UrlService');
    await urlService.list({
      page: 1,
      limit: 10,
      active: undefined,
      is_active__exact: undefined,
      include_deleted: undefined,
    }, {
      userId: LEGACY_UNASSIGNED_OWNER_ID,
      isAdmin: false,
    });
    expect(repoMocks.listUrls).toHaveBeenCalledWith(
      expect.objectContaining({ ownership: { kind: 'none' } }),
    );
  });
});

describe('UrlService.getByShortCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repoMocks.findUrlByShortCode.mockResolvedValue(null);
  });

  it('uses no-access scope for legacy sentinel actor', async () => {
    const { default: urlService } = await import('@services/UrlService');
    await urlService.getByShortCode('legacy01', {
      userId: LEGACY_UNASSIGNED_OWNER_ID,
      isAdmin: false,
    });
    expect(repoMocks.findUrlByShortCode).toHaveBeenCalledWith(
      'legacy01',
      expect.objectContaining({ ownership: { kind: 'none' } }),
    );
  });
});
