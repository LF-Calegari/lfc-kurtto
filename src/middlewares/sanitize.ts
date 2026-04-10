import type { NextFunction, Request, Response } from 'express';

/** Campos que representam URL bruta: apenas trim, sem remocao de tags HTML. */
const URL_BODY_KEYS = new Set(['originalUrl', 'original_url']);

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

function sanitizeStringField(key: string, value: string): string {
  const trimmed = value.trim();
  if (URL_BODY_KEYS.has(key)) {
    return trimmed;
  }
  return stripHtmlTags(trimmed);
}

function sanitizeUnknown(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeStringField(key, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(key, item));
  }
  if (typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeUnknown(k, v);
  }
  return out;
}

/**
 * Normaliza strings do JSON do body: trim em todos os campos;
 * remove tags HTML em campos textuais, exceto URLs (`originalUrl` / `original_url`).
 */
export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (
    req.body !== null &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body)
  ) {
    req.body = sanitizeRecord(req.body as Record<string, unknown>);
  }
  next();
}
