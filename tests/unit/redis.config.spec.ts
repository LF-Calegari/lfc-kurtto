import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const handlers: Record<string, (...args: unknown[]) => void> = {};
const mockPing = jest.fn();
const mockQuit = jest.fn();
const mockDisconnect = jest.fn();

const RedisConstructor = jest.fn().mockImplementation(() => ({
  on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
    handlers[event] = fn;
    return undefined;
  }),
  ping: mockPing,
  quit: mockQuit,
  disconnect: mockDisconnect,
}));

jest.unstable_mockModule('ioredis', () => ({
  default: RedisConstructor,
  Redis: RedisConstructor,
}));

describe('@config/redis', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    RedisConstructor.mockClear();
    mockPing.mockReset();
    mockQuit.mockReset();
    mockDisconnect.mockReset();
    Object.keys(handlers).forEach((k) => {
      delete handlers[k];
    });
    process.env = { ...savedEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('isRedisConfigured is false without REDIS_URL', async () => {
    delete process.env.REDIS_URL;
    const redis = await import('@config/redis');
    expect(redis.isRedisConfigured()).toBe(false);
    expect(redis.getRedisClient()).toBeNull();
    await expect(redis.pingRedis()).resolves.toBe(false);
    await expect(redis.quitRedis()).resolves.toBeUndefined();
  });

  it('getRedisClient is singleton and wires ioredis events', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const redis = await import('@config/redis');
    expect(redis.isRedisConfigured()).toBe(true);
    const a = redis.getRedisClient();
    const b = redis.getRedisClient();
    expect(a).toBe(b);
    expect(RedisConstructor).toHaveBeenCalledWith(
      'redis://127.0.0.1:6379',
      expect.objectContaining({
        lazyConnect: true,
        maxRetriesPerRequest: null,
      }),
    );
    const instance = RedisConstructor.mock.results[0]?.value as {
      on: jest.Mock;
    };
    expect(instance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith(
      'reconnecting',
      expect.any(Function),
    );
    handlers.connect?.();
    handlers.error?.(new Error('e2'));
    handlers.reconnecting?.(100);
  });

  it('pingRedis returns true on PONG', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockPing.mockResolvedValue('PONG');
    const redis = await import('@config/redis');
    redis.getRedisClient();
    await expect(redis.pingRedis()).resolves.toBe(true);
  });

  it('pingRedis returns false on ping failure', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockPing.mockRejectedValue(new Error('down'));
    const redis = await import('@config/redis');
    redis.getRedisClient();
    await expect(redis.pingRedis()).resolves.toBe(false);
  });

  it('quitRedis clears client and disconnects on quit failure', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockQuit.mockRejectedValue(new Error('quit failed'));
    const redis = await import('@config/redis');
    redis.getRedisClient();
    await expect(redis.quitRedis()).resolves.toBeUndefined();
    expect(mockDisconnect).toHaveBeenCalled();
    await expect(redis.quitRedis()).resolves.toBeUndefined();
  });

  it('quitRedis succeeds when quit resolves', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    mockQuit.mockResolvedValue('OK');
    const redis = await import('@config/redis');
    redis.getRedisClient();
    await expect(redis.quitRedis()).resolves.toBeUndefined();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
});
