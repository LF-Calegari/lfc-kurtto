import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '@config/logger';
import { AppError } from '@errors/AppError';
import { verifyToken } from '@services/AuthVerificationService';
import { HttpStatusCode } from '@utils/HttpStatusCode';

function extractBearerToken(req: Request): string | undefined {
  const raw = req.headers.authorization;
  const source = Array.isArray(raw) ? raw[0] : raw;
  if (!source) {
    return undefined;
  }

  const [scheme, token] = source.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer') {
    return undefined;
  }
  if (!token || token.trim() === '') {
    return undefined;
  }

  return token.trim();
}

function normalizedRoutePath(req: Request): string {
  const routePath =
    typeof req.route?.path === 'string' ? req.route.path : req.path;
  const basePath = req.baseUrl.endsWith('/')
    ? req.baseUrl.slice(0, -1)
    : req.baseUrl;
  const suffix = routePath === '/' ? '' : routePath;
  return `${basePath}${suffix}` || '/';
}

export function authorizeRoute(
  shouldAuthorize: (req: Request) => boolean = () => true,
  resolveRouteCode?: (req: Request) => string | undefined,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!shouldAuthorize(req)) {
      next();
      return;
    }

    const token = extractBearerToken(req);
    if (!token) {
      next(
        new AppError(
          'Unauthorized: Bearer token is required.',
          HttpStatusCode.UNAUTHORIZED,
        ),
      );
      return;
    }

    const requiredRouteCode = resolveRouteCode?.(req);
    const method = req.method.toUpperCase();
    const path = normalizedRoutePath(req);

    try {
      const result = await verifyToken(token);

      if (requiredRouteCode && !result.routeCodes.includes(requiredRouteCode)) {
        logger.warn('Route code not granted to user', {
          context: 'auth',
          userId: result.id,
          code: requiredRouteCode,
          method,
          path,
        });
        throw new AppError(
          'Forbidden: token has no permission for this route.',
          HttpStatusCode.FORBIDDEN,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
