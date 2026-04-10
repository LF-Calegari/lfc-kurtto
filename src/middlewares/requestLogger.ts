import type { NextFunction, Request, Response } from 'express';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { HttpStatusCode } from '@utils/HttpStatusCode';

function normalizePath(req: Request): string {
  const raw = req.originalUrl ?? req.url ?? req.path;
  return raw.split('?')[0] ?? raw;
}

function shouldSkipRequestLog(req: Request): boolean {
  if (req.method !== 'GET') {
    return false;
  }
  const path = normalizePath(req);
  return env.requestLogSkipPaths.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = Date.now();
  res.on('finish', () => {
    if (shouldSkipRequestLog(req)) {
      return;
    }
    const ms = Date.now() - started;
    const path = normalizePath(req);
    const status = res.statusCode;
    const message = `${req.method} ${path} ${status} ${ms}ms`;
    const meta = {
      context: 'http',
      method: req.method,
      path,
      status,
      ms,
    };
    if (status >= HttpStatusCode.INTERNAL_SERVER_ERROR) {
      logger.error(message, meta);
    } else if (status >= HttpStatusCode.BAD_REQUEST) {
      logger.warn(message, meta);
    } else {
      logger.info(message, meta);
    }
  });
  next();
}
