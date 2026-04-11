import type { Server } from 'node:http';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const destroy = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('@config/data-source', () => ({
  AppDataSource: {
    isInitialized: true,
    destroy,
  },
}));

const quitRedis = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@config/redis', () => ({
  quitRedis,
}));

jest.unstable_mockModule('@config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.unstable_mockModule('@config/env', () => ({
  env: { GRACEFUL_SHUTDOWN_TIMEOUT_MS: 30_000 },
}));

describe('setupGracefulShutdown', () => {
  const savedOn = process.on.bind(process);

  beforeEach(() => {
    jest.resetModules();
    destroy.mockClear();
    quitRedis.mockClear();
  });

  afterEach(() => {
    process.on = savedOn;
    jest.restoreAllMocks();
  });

  it('on SIGTERM closes server, destroys DB and quits Redis', async () => {
    const exitMock = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as (code?: number) => never);

    const handlers: Partial<Record<NodeJS.Signals, () => void>> = {};
    process.on = jest.fn((event, listener) => {
      if (event === 'SIGTERM' || event === 'SIGINT') {
        handlers[event] = listener as () => void;
      }
      return process;
    }) as typeof process.on;

    const close = jest.fn((cb?: (err?: Error) => void) => {
      queueMicrotask(() => {
        cb?.();
      });
    });
    const server = { close } as unknown as Server;

    const { setupGracefulShutdown } = await import('@config/graceful-shutdown');
    setupGracefulShutdown(server);

    handlers.SIGTERM?.();

    await new Promise<void>((resolve) => {
      setImmediate(() => {
        setImmediate(resolve);
      });
    });

    expect(close).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(quitRedis).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });
});
