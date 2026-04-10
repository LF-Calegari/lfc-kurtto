import { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

import { ValidationError } from '@errors/ValidationError';

export function zodErrorResponse(error: ZodError): {
  error: string;
  details: { field: string; message: string }[];
} {
  return {
    error: 'Validation failed',
    details: error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'body',
      message: issue.message,
    })),
  };
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(zodErrorResponse(parsed.error)));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
