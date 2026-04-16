import { describe, expect, it } from '@jest/globals';

import {
  GetUrlByCodeQuerySchema,
  ListUrlsQuerySchema,
  parseDatePair,
  parseIntPair,
} from '@dtos/UrlDto';

describe('parseIntPair', () => {
  it('parses two comma-separated integers', () => {
    expect(parseIntPair('0,10')).toEqual([0, 10]);
    expect(parseIntPair(' 1 , 2 ')).toEqual([1, 2]);
  });

  it('returns null when not exactly two parts', () => {
    expect(parseIntPair('1')).toBeNull();
    expect(parseIntPair('1,2,3')).toBeNull();
  });

  it('returns null when values are not finite integers', () => {
    expect(parseIntPair('a,b')).toBeNull();
  });
});

describe('parseDatePair', () => {
  it('parses two ISO datetimes', () => {
    const r = parseDatePair(
      '2000-01-01T00:00:00.000Z,2099-12-31T23:59:59.999Z',
    );
    expect(r).not.toBeNull();
    expect(r![0].toISOString()).toBe('2000-01-01T00:00:00.000Z');
  });

  it('returns null for invalid dates or wrong shape', () => {
    expect(parseDatePair('x,y')).toBeNull();
    expect(parseDatePair('only-one')).toBeNull();
  });
});

describe('ListUrlsQuerySchema', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('applies defaults for page and limit', () => {
    const r = ListUrlsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.page).toBe(1);
    expect(r.data.limit).toBe(10);
  });

  it('dedupes repeated query keys taking first value (preprocess)', () => {
    const raw = { page: ['2', '3'], limit: ['5', '9'] };
    const r = ListUrlsQuerySchema.safeParse(raw);
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.page).toBe(2);
    expect(r.data.limit).toBe(5);
  });

  it('parses active and include_deleted as booleans', () => {
    const r = ListUrlsQuerySchema.safeParse({
      active: 'false',
      include_deleted: 'true',
    });
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.active).toBe(false);
    expect(r.data.include_deleted).toBe(true);
  });

  it('accepts id__exact uuid and id__like pattern', () => {
    const r = ListUrlsQuerySchema.safeParse({
      id__exact: uuid,
      id__like: '%550e%',
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid id__exact', () => {
    const r = ListUrlsQuerySchema.safeParse({ id__exact: 'not-uuid' });
    expect(r.success).toBe(false);
  });

  it('accepts click filters and between', () => {
    const r = ListUrlsQuerySchema.safeParse({
      clicks__lt: '5',
      clicks__gt: '1',
      clicks__exact: '3',
      clicks__between: '0,100',
    });
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.clicks__lt).toBe(5);
    expect(r.data.clicks__between).toBe('0,100');
  });

  it('rejects negative click scalars', () => {
    for (const key of ['clicks__exact', 'clicks__lt', 'clicks__gt'] as const) {
      const r = ListUrlsQuerySchema.safeParse({ [key]: '-1' });
      expect(r.success).toBe(false);
    }
  });

  it('coerces numeric values for click filters (preprocess)', () => {
    const r = ListUrlsQuerySchema.safeParse({
      clicks__exact: 3,
      clicks__lt: 10,
    } as Record<string, unknown>);
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.clicks__exact).toBe(3);
    expect(r.data.clicks__lt).toBe(10);
  });

  it('rejects clicks__between with wrong order, negatives, or shape', () => {
    expect(
      ListUrlsQuerySchema.safeParse({ clicks__between: '10,1' }).success,
    ).toBe(false);
    expect(
      ListUrlsQuerySchema.safeParse({ clicks__between: '-1,5' }).success,
    ).toBe(false);
    const onePart = ListUrlsQuerySchema.safeParse({
      clicks__between: '1',
    });
    expect(onePart.success).toBe(false);
  });

  it('validates date between fields', () => {
    const ok = ListUrlsQuerySchema.safeParse({
      created_at__between:
        '2000-01-01T00:00:00.000Z,2099-01-01T00:00:00.000Z',
    });
    expect(ok.success).toBe(true);

    const badOrder = ListUrlsQuerySchema.safeParse({
      expires_at__between:
        '2099-01-01T00:00:00.000Z,2000-01-01T00:00:00.000Z',
    });
    expect(badOrder.success).toBe(false);

    const badDates = ListUrlsQuerySchema.safeParse({
      updated_at__between: 'bad,also-bad',
    });
    expect(badDates.success).toBe(false);
  });

  it('rejects invalid scalar datetimes', () => {
    const r = ListUrlsQuerySchema.safeParse({
      expires_at__exact: 'not-a-date',
    });
    expect(r.success).toBe(false);
  });

  it('accepts valid scalar datetimes for date filters', () => {
    const r = ListUrlsQuerySchema.safeParse({
      expires_at__lt: '2099-01-01T00:00:00.000Z',
      deleted_at__gt: '2000-01-01T00:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });
});

describe('GetUrlByCodeQuerySchema', () => {
  it('parses include_deleted', () => {
    const r = GetUrlByCodeQuerySchema.safeParse({ include_deleted: 'true' });
    expect(r.success).toBe(true);
    if (!r.success) {
      return;
    }
    expect(r.data.include_deleted).toBe(true);
  });
});
