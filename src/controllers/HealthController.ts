import { NextFunction, Request, Response } from 'express';

import { AppDataSource } from '@config/data-source';
import { env } from '@config/env';

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

  public async check(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const database = await this.resolveDatabaseStatus();
      const degraded = database === 'disconnected';

      res.status(degraded ? 503 : 200).json({
        status: degraded ? 'degraded' : 'ok',
        message: degraded
          ? 'API is running but database is unavailable'
          : 'API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new HealthController();
