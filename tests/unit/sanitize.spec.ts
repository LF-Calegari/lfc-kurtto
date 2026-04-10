import { jest } from '@jest/globals';
import { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '@errors/NotFoundError';
import { sanitizeBody } from '@middlewares/sanitize';

describe('sanitizeBody', () => {
  it('keeps remainder when angle bracket is unclosed', () => {
    const req = { body: { customCode: 'a<b' } } as Request;
    const next = jest.fn() as NextFunction;
    sanitizeBody(req, {} as Response, next);
    expect(req.body.customCode).toBe('a<b');
    expect(next).toHaveBeenCalled();
  });

  it('sanitizes string entries inside arrays', () => {
    const req = { body: { items: [' <b>x</b> '] } } as Request;
    const next = jest.fn() as NextFunction;
    sanitizeBody(req, {} as Response, next);
    expect((req.body as { items: string[] }).items[0]).toBe('x');
  });

  it('sanitizes nested string fields', () => {
    const req = {
      body: { nested: { title: ' <b>y</b> ' } },
    } as Request;
    const next = jest.fn() as NextFunction;
    sanitizeBody(req, {} as Response, next);
    expect(
      (req.body as { nested: { title: string } }).nested.title,
    ).toBe('y');
  });

  it('does not alter array bodies', () => {
    const req = { body: [1, 2] } as unknown as Request;
    const next = jest.fn() as NextFunction;
    sanitizeBody(req, {} as Response, next);
    expect(req.body).toEqual([1, 2]);
  });
});

describe('NotFoundError', () => {
  it('uses default message', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Not found');
  });
});
