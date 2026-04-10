import { jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { ValidationError } from '@errors/ValidationError';
import { validateBody, zodErrorResponse } from '@middlewares/validate';

describe('zodErrorResponse', () => {
  it('maps Zod issues to field and message', () => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const body = zodErrorResponse(parsed.error);
    expect(body.error).toBe('Validation failed');
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0]).toMatchObject({
      field: expect.any(String),
      message: expect.any(String),
    });
  });
});

describe('validateBody', () => {
  it('calls next with ValidationError when body is invalid', () => {
    const schema = z.object({ originalUrl: z.string().url() });
    const middleware = validateBody(schema);
    const req = {
      body: { originalUrl: 'not-a-url' },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('parses valid body and replaces req.body', () => {
    const schema = z.object({ originalUrl: z.string().url() });
    const middleware = validateBody(schema);
    const req = {
      body: { originalUrl: 'https://example.com' },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ originalUrl: 'https://example.com' });
  });
});
