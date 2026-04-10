import type { Request } from 'express';
import rateLimit, {
  type Options,
  type RateLimitExceededEventHandler,
} from 'express-rate-limit';

import { env } from '@config/env';
import { HttpStatusCode } from '@utils/HttpStatusCode';

const skipOptions: Options['skip'] = (req: Request) => req.method === 'OPTIONS';

const rateLimitMessage =
  'Too many requests for this endpoint. Please try again later.';

export const rateLimitJsonHandler: RateLimitExceededEventHandler = (
  req,
  res,
  _next,
  optionsUsed,
) => {
  const rl = (
    req as Request & {
      rateLimit?: { resetTime?: Date };
    }
  ).rateLimit;
  let retryAfterSeconds = 1;
  if (rl?.resetTime instanceof Date) {
    retryAfterSeconds = Math.max(
      1,
      Math.ceil((rl.resetTime.getTime() - Date.now()) / 1000),
    );
  }
  const message =
    typeof optionsUsed.message === 'string'
      ? optionsUsed.message
      : rateLimitMessage;
  res.status(HttpStatusCode.TOO_MANY_REQUESTS).json({
    error: 'too_many_requests',
    message,
    retry_after: retryAfterSeconds,
  });
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitJsonHandler,
  skip: skipOptions,
} as const;

export const globalRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  limit: env.RATE_LIMIT_GLOBAL_MAX,
  message: rateLimitMessage,
});

export const postUrlsRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: env.RATE_LIMIT_POST_URLS_WINDOW_MS,
  limit: env.RATE_LIMIT_POST_URLS_MAX,
  message: rateLimitMessage,
});

export const redirectRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: env.RATE_LIMIT_REDIRECT_WINDOW_MS,
  limit: env.RATE_LIMIT_REDIRECT_MAX,
  message: rateLimitMessage,
});
