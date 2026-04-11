import { afterEach, describe, expect, it, jest } from '@jest/globals';

const registerRedisShutdownHooks = jest.fn();
jest.unstable_mockModule('@config/redis', () => ({
  registerRedisShutdownHooks,
  isRedisConfigured: jest.fn(),
  getRedisClient: jest.fn(),
  pingRedis: jest.fn(),
  quitRedis: jest.fn(),
}));

const initialize = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@config/data-source', () => ({
  AppDataSource: { initialize },
}));

const listenCb = { server: null as { on: jest.Mock } | null };
const listen = jest.fn((port: number, cb: () => void) => {
  const server = { on: jest.fn() };
  listenCb.server = server;
  queueMicrotask(() => {
    cb();
  });
  return server;
});

jest.unstable_mockModule('../../src/app.js', () => ({
  default: { listen },
}));

describe('startApplication', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers Redis hooks, initializes database and listens', async () => {
    const { startApplication } = await import('../../src/bootstrap.js');
    const server = await startApplication();
    expect(registerRedisShutdownHooks).toHaveBeenCalled();
    expect(initialize).toHaveBeenCalled();
    expect(listen).toHaveBeenCalled();
    expect(server).toBe(listenCb.server);
  });
});
