import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { AppError } from '@errors/AppError';
import { HttpStatusCode } from '@utils/HttpStatusCode';

type RouteAuthorizationPayload = {
  method: string;
  path: string;
};

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

function buildAuthorizationEndpoint(): URL {
  const baseUrl = new URL(env.AUTH_SERVICE_URL);
  const path = env.AUTH_SERVICE_AUTHORIZE_ROUTE_PATH.startsWith('/')
    ? env.AUTH_SERVICE_AUTHORIZE_ROUTE_PATH
    : `/${env.AUTH_SERVICE_AUTHORIZE_ROUTE_PATH}`;

  // Preserve host/protocol from AUTH_SERVICE_URL and only replace pathname.
  baseUrl.pathname = path;
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl;
}

async function callAuthService(
  token: string,
  payload: RouteAuthorizationPayload,
): Promise<void> {
  const endpoint = buildAuthorizationEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.AUTH_SERVICE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === HttpStatusCode.OK) {
      return;
    }

    if (response.status === HttpStatusCode.UNAUTHORIZED) {
      throw new AppError(
        'Unauthorized: token missing, invalid, or expired.',
        HttpStatusCode.UNAUTHORIZED,
      );
    }

    if (response.status === HttpStatusCode.FORBIDDEN) {
      throw new AppError(
        'Forbidden: token has no permission for this route.',
        HttpStatusCode.FORBIDDEN,
      );
    }

    logger.error(
      'Auth-service returned unexpected status on route authorization',
      {
        context: 'auth',
        method: payload.method,
        path: payload.path,
        statusCode: response.status,
      },
    );

    throw new AppError(
      'Authorization service unavailable',
      HttpStatusCode.SERVICE_UNAVAILABLE,
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Failed to authorize route via auth-service', {
      context: 'auth',
      method: payload.method,
      path: payload.path,
      message: error instanceof Error ? error.message : String(error),
    });

    throw new AppError(
      'Authorization service unavailable',
      HttpStatusCode.SERVICE_UNAVAILABLE,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function authorizeRoute(
  shouldAuthorize: (req: Request) => boolean = () => true,
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

    const payload: RouteAuthorizationPayload = {
      method: req.method.toUpperCase(),
      path: normalizedRoutePath(req),
    };

    try {
      await callAuthService(token, payload);
      next();
    } catch (error) {
      next(error);
    }
  };
}
