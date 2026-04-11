import { NextFunction, Request, Response } from 'express';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';
import { isRedisConfigured, pingRedis } from '@config/redis';
import { HttpStatusCode } from '@utils/HttpStatusCode';

class HealthController {
  private async resolveDatabaseStatus(): Promise<
    'connected' | 'disconnected'
  > {
    if (!AppDataSource.isInitialized) {
      return 'disconnected';
    }
    try {
      await AppDataSource.query('SELECT 1');
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private async resolveCacheStatus(): Promise<'connected' | 'disconnected'> {
    if (!isRedisConfigured()) {
      return 'disconnected';
    }
    return (await pingRedis()) ? 'connected' : 'disconnected';
  }

  public async live(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      res.status(HttpStatusCode.OK).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  public async ready(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const database = await this.resolveDatabaseStatus();
      const cacheConfigured = isRedisConfigured();
      const cache = await this.resolveCacheStatus();
      const dbOk = database === 'connected';
      const cacheOk = !cacheConfigured || cache === 'connected';
      const ready = dbOk && cacheOk;

      res
        .status(
          ready ? HttpStatusCode.OK : HttpStatusCode.SERVICE_UNAVAILABLE,
        )
        .json({
          status: ready ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          database,
          cache,
        });
    } catch (error) {
      next(error);
    }
  }

  public async check(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const database = await this.resolveDatabaseStatus();
      const cache = await this.resolveCacheStatus();
      const degraded = database === 'disconnected';

      res
        .status(
          degraded ? HttpStatusCode.SERVICE_UNAVAILABLE : HttpStatusCode.OK,
        )
        .json({
          status: degraded ? 'degraded' : 'ok',
          message: degraded
            ? 'API is running but database is unavailable'
            : 'API is running',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: env.NODE_ENV,
          database,
          cache,
        });
    } catch (error) {
      next(error);
    }
  }
}

export default new HealthController();
