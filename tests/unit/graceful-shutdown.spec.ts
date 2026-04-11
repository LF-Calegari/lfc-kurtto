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
const dsState = { initialized: true };

jest.unstable_mockModule('@config/data-source', () => ({
  AppDataSource: {
    get isInitialized() {
      return dsState.initialized;
    },
    destroy,
  },
}));

const quitRedis = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('@config/redis', () => ({
  quitRedis,
}));

const loggerMocks = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
jest.unstable_mockModule('@config/logger', () => ({
  logger: loggerMocks,
}));

const envState = { GRACEFUL_SHUTDOWN_TIMEOUT_MS: 30_000 };
jest.unstable_mockModule('@config/env', () => ({
  env: envState,
}));

describe('setupGracefulShutdown', () => {
  const savedOn = process.on.bind(process);

  beforeEach(() => {
    jest.resetModules();
    dsState.initialized = true;
    envState.GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000;
    destroy.mockClear();
    destroy.mockResolvedValue(undefined);
    quitRedis.mockClear();
    loggerMocks.info.mockClear();
    loggerMocks.error.mockClear();
    loggerMocks.warn.mockClear();
  });

  afterEach(() => {
    process.on = savedOn;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function flushShutdownMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        setImmediate(resolve);
      });
    });
  }

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

    await flushShutdownMicrotasks();

    expect(close).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(quitRedis).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });

  it('on SIGINT closes server and exits 0', async () => {
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

    handlers.SIGINT?.();

    await flushShutdownMicrotasks();

    expect(close).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });

  it('ignores duplicate signals after shutdown started', async () => {
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
    handlers.SIGTERM?.();

    await flushShutdownMicrotasks();

    expect(close).toHaveBeenCalledTimes(1);

    exitMock.mockRestore();
  });

  it('exits 1 when server.close reports an error', async () => {
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
        cb?.(new Error('close failed'));
      });
    });
    const server = { close } as unknown as Server;

    const { setupGracefulShutdown } = await import('@config/graceful-shutdown');
    setupGracefulShutdown(server);

    handlers.SIGTERM?.();

    await flushShutdownMicrotasks();

    expect(loggerMocks.error).toHaveBeenCalledWith(
      'Error closing HTTP server',
      expect.objectContaining({ context: 'shutdown' }),
    );
    expect(destroy).toHaveBeenCalled();
    expect(quitRedis).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(1);

    exitMock.mockRestore();
  });

  it('skips DataSource.destroy when not initialized', async () => {
    dsState.initialized = false;

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

    await flushShutdownMicrotasks();

    expect(destroy).not.toHaveBeenCalled();
    expect(quitRedis).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });

  it('warns and continues when DataSource.destroy fails', async () => {
    destroy.mockRejectedValueOnce(new Error('destroy failed'));

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

    await flushShutdownMicrotasks();

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      'DataSource.destroy failed during shutdown',
      expect.objectContaining({ context: 'shutdown' }),
    );
    expect(quitRedis).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });

  it('exits 1 when graceful shutdown times out', async () => {
    jest.useFakeTimers();

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

    envState.GRACEFUL_SHUTDOWN_TIMEOUT_MS = 100;

    const close = jest.fn(() => {
      /* never invoke callback — simulates hung close */
    });
    const server = { close } as unknown as Server;

    const { setupGracefulShutdown } = await import('@config/graceful-shutdown');
    setupGracefulShutdown(server);

    handlers.SIGTERM?.();

    await jest.advanceTimersByTimeAsync(100);

    expect(loggerMocks.error).toHaveBeenCalledWith(
      'Graceful shutdown timed out',
      expect.objectContaining({ context: 'shutdown', timeoutMs: 100 }),
    );
    expect(exitMock).toHaveBeenCalledWith(1);

    exitMock.mockRestore();
  });
});
