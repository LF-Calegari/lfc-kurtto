import { ErrorRequestHandler } from 'express';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { AppError } from '@errors/AppError';
import { ValidationError } from '@errors/ValidationError';
import { HttpStatusCode } from '@utils/HttpStatusCode';

const errorHandler: ErrorRequestHandler = (err, req, res, _next): void => {
  const isProduction = env.NODE_ENV === 'production';

  if (err instanceof ValidationError) {
    logger.warn(err.message, {
      context: 'error',
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
      path: req.originalUrl,
      method: req.method,
    });
    res.status(HttpStatusCode.UNPROCESSABLE_ENTITY).json(err.body);
    return;
  }

  if (err instanceof AppError) {
    const log =
      err.statusCode >= HttpStatusCode.INTERNAL_SERVER_ERROR
        ? logger.error
        : logger.warn;
    log(err.message, {
      context: 'error',
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
      ...(!isProduction && err.stack ? { stack: err.stack } : {}),
    });

    const body: Record<string, unknown> = { message: err.message };
    if (
      !isProduction &&
      err.statusCode >= HttpStatusCode.INTERNAL_SERVER_ERROR &&
      err.stack
    ) {
      body.stack = err.stack;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  const stack = err instanceof Error ? err.stack : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  logger.error('Internal server error', {
    context: 'error',
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    path: req.originalUrl,
    method: req.method,
    message: msg,
    ...(!isProduction && stack ? { stack } : {}),
  });

  const body: Record<string, unknown> = {
    message: 'Internal server error',
  };
  if (!isProduction && err instanceof Error) {
    body.details = err.message;
    body.stack = err.stack;
  }
  res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(body);
};

export default errorHandler;
