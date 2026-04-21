import { createHash } from 'node:crypto';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { getRedisClient } from '@config/redis';
import { AppError } from '@errors/AppError';
import { HttpStatusCode } from '@utils/HttpStatusCode';

/**
 * Resultado de uma verificação bem-sucedida de token no auth-service.
 * Corresponde ao corpo de `GET /api/v1/auth/verify-token`, mantendo apenas
 * os campos usados pelo kurtto-api para decisões de autorização.
 */
export type AuthVerificationResult = {
  id: string;
  permissions: string[];
  routeCodes: string[];
};

function buildVerifyTokenEndpoint(): URL {
  const baseUrl = new URL(env.AUTH_SERVICE_URL);
  const path = env.AUTH_SERVICE_VERIFY_TOKEN_PATH.startsWith('/')
    ? env.AUTH_SERVICE_VERIFY_TOKEN_PATH
    : `/${env.AUTH_SERVICE_VERIFY_TOKEN_PATH}`;
  baseUrl.pathname = path;
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl;
}

function cacheKey(token: string): string {
  // Hash para evitar armazenar o JWT puro em Redis.
  const digest = createHash('sha256').update(token).digest('hex');
  return `auth:verify-token:${digest}`;
}

function extractErrno(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') {
    return direct;
  }
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string') {
      return causeCode;
    }
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry !== '') {
      out.push(entry);
    } else if (
      entry !== null &&
      entry !== undefined &&
      typeof (entry as { toString?: () => string }).toString === 'function'
    ) {
      out.push(String(entry));
    }
  }
  return out;
}

function normalizeResponseBody(raw: unknown): AuthVerificationResult | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  const idValue = candidate.id ?? candidate.Id;
  if (typeof idValue !== 'string' || idValue === '') {
    return null;
  }
  const permissions = normalizeStringArray(
    candidate.permissions ?? candidate.Permissions,
  );
  const routeCodes = normalizeStringArray(
    candidate.routeCodes ?? candidate.RouteCodes,
  );
  return { id: idValue, permissions, routeCodes };
}

async function readFromCache(
  token: string,
): Promise<AuthVerificationResult | null> {
  if (env.AUTH_SERVICE_CACHE_TTL_SECONDS === 0) {
    return null;
  }
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(cacheKey(token));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeResponseBody(parsed);
  } catch (error: unknown) {
    logger.warn('Redis GET verify-token cache failed', {
      context: 'auth',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeToCache(
  token: string,
  result: AuthVerificationResult,
): Promise<void> {
  if (env.AUTH_SERVICE_CACHE_TTL_SECONDS === 0) {
    return;
  }
  const redis = getRedisClient();
  if (!redis) {
    return;
  }
  try {
    await redis.setex(
      cacheKey(token),
      env.AUTH_SERVICE_CACHE_TTL_SECONDS,
      JSON.stringify(result),
    );
  } catch (error: unknown) {
    logger.warn('Redis SET verify-token cache failed', {
      context: 'auth',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchFromAuthService(
  token: string,
): Promise<AuthVerificationResult> {
  const endpoint = buildVerifyTokenEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.AUTH_SERVICE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === HttpStatusCode.OK) {
      const raw = (await response.json().catch(() => null)) as unknown;
      const normalized = normalizeResponseBody(raw);
      if (!normalized) {
        logger.error('Auth-service verify-token returned invalid body', {
          context: 'auth',
          statusCode: response.status,
        });
        throw new AppError(
          'Authorization service unavailable',
          HttpStatusCode.SERVICE_UNAVAILABLE,
        );
      }
      return normalized;
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

    logger.error('Auth-service returned unexpected status on verify-token', {
      context: 'auth',
      statusCode: response.status,
    });
    throw new AppError(
      'Authorization service unavailable',
      HttpStatusCode.SERVICE_UNAVAILABLE,
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError');
    const errno = extractErrno(error);
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Failed to verify token via auth-service', {
      context: 'auth',
      timeout: isTimeout,
      errno,
      message,
    });

    if (isTimeout) {
      throw new AppError(
        'Authorization service timeout',
        HttpStatusCode.GATEWAY_TIMEOUT,
      );
    }

    throw new AppError(
      'Authorization service unreachable',
      HttpStatusCode.BAD_GATEWAY,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyToken(
  token: string,
): Promise<AuthVerificationResult> {
  const cached = await readFromCache(token);
  if (cached) {
    return cached;
  }
  const fresh = await fetchFromAuthService(token);
  await writeToCache(token, fresh);
  return fresh;
}
