import { ErrorRequestHandler, Request, Response } from 'express';

import { env } from '@config/env';
import { logger } from '@config/logger';
import { AppError } from '@errors/AppError';
import { ValidationError } from '@errors/ValidationError';
import { HttpStatusCode } from '@utils/HttpStatusCode';

function optionalDevStack(
  isProduction: boolean,
  stack: string | undefined,
): { stack: string } | Record<string, never> {
  if (isProduction || !stack) {
    return {};
  }
  return { stack };
}

function handleValidationError(
  err: ValidationError,
  req: Request,
  res: Response,
): void {
  logger.warn(err.message, {
    context: 'error',
    statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    path: req.originalUrl,
    method: req.method,
  });
  res.status(HttpStatusCode.UNPROCESSABLE_ENTITY).json(err.body);
}

function handleAppError(
  err: AppError,
  req: Request,
  res: Response,
  isProduction: boolean,
): void {
  const log =
    err.statusCode >= HttpStatusCode.INTERNAL_SERVER_ERROR
      ? logger.error
      : logger.warn;
  log(err.message, {
    context: 'error',
    statusCode: err.statusCode,
    path: req.originalUrl,
    method: req.method,
    ...optionalDevStack(isProduction, err.stack),
  });

  const body: Record<string, unknown> = { message: err.message };
  if (
    isProduction === false &&
    err.statusCode >= HttpStatusCode.INTERNAL_SERVER_ERROR &&
    err.stack
  ) {
    body.stack = err.stack;
  }
  res.status(err.statusCode).json(body);
}

function handleUnexpectedError(
  err: unknown,
  req: Request,
  res: Response,
  isProduction: boolean,
): void {
  const stack = err instanceof Error ? err.stack : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  logger.error('Internal server error', {
    context: 'error',
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    path: req.originalUrl,
    method: req.method,
    message: msg,
    ...optionalDevStack(isProduction, stack),
  });

  const body: Record<string, unknown> = {
    message: 'Internal server error',
  };
  if (isProduction === false && err instanceof Error) {
    body.details = err.message;
    body.stack = err.stack;
  }
  res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(body);
}

const errorHandler: ErrorRequestHandler = (err, req, res, _next): void => {
  const isProduction = env.NODE_ENV === 'production';

  if (err instanceof ValidationError) {
    handleValidationError(err, req, res);
    return;
  }

  if (err instanceof AppError) {
    handleAppError(err, req, res, isProduction);
    return;
  }

  handleUnexpectedError(err, req, res, isProduction);
};

export default errorHandler;
