import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const getRedisClient = jest.fn();

jest.unstable_mockModule('@config/redis', () => ({
  getRedisClient,
}));

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRedisClient.mockReturnValue(null);
  });

  it('get returns null when Redis is not configured', async () => {
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.get('abc')).resolves.toBeNull();
  });

  it('get returns null for empty string payload', async () => {
    const redis = { get: jest.fn().mockResolvedValue('') };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.get('abc')).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledWith('url:abc');
  });

  it('get returns parsed payload when valid', async () => {
    const payload = {
      original_url: 'https://ok.example',
      is_active: true,
      expires_at: null as string | null,
    };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(payload)),
    };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.get('x')).resolves.toEqual({
      original_url: 'https://ok.example',
      is_active: true,
      expires_at: null,
    });
  });

  it('get deletes and returns null when shape is invalid', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify({ bad: true })),
      del: jest.fn().mockResolvedValue(1),
    };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.get('x')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('url:x');
  });

  it('get returns null on JSON parse error', async () => {
    const redis = { get: jest.fn().mockResolvedValue('not-json') };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.get('x')).resolves.toBeNull();
  });

  it('set is no-op when Redis is not configured', async () => {
    const { default: cache } = await import('@services/CacheService');
    await cache.set('a', {
      original_url: 'https://x',
      is_active: true,
      expires_at: null,
    });
    expect(getRedisClient).toHaveBeenCalled();
  });

  it('set writes with setex', async () => {
    const redis = { setex: jest.fn().mockResolvedValue('OK') };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await cache.set('code', {
      original_url: 'https://y',
      is_active: false,
      expires_at: '2099-01-01T00:00:00.000Z',
    });
    expect(redis.setex).toHaveBeenCalledWith(
      'url:code',
      expect.any(Number),
      expect.stringContaining('https://y'),
    );
  });

  it('set swallows Redis errors', async () => {
    const redis = {
      setex: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(
      cache.set('c', {
        original_url: 'https://z',
        is_active: true,
        expires_at: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('delete is no-op when Redis is not configured', async () => {
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.delete('k')).resolves.toBeUndefined();
  });

  it('delete calls del', async () => {
    const redis = { del: jest.fn().mockResolvedValue(1) };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await cache.delete('k');
    expect(redis.del).toHaveBeenCalledWith('url:k');
  });

  it('delete swallows Redis errors', async () => {
    const redis = { del: jest.fn().mockRejectedValue(new Error('fail')) };
    getRedisClient.mockReturnValue(redis);
    const { default: cache } = await import('@services/CacheService');
    await expect(cache.delete('k')).resolves.toBeUndefined();
  });
});
