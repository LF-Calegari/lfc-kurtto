import type { Request } from 'express';

import { env } from '@config/env';
import { AppError } from '@errors/AppError';
import { HttpStatusCode } from '@utils/HttpStatusCode';

const HEADER = 'x-admin-secret';

function headerValue(req: Request): string | undefined {
  const raw = req.headers[HEADER];
  if (Array.isArray(raw)) {
    const first = raw[0]?.trim();
    return first === '' ? undefined : first;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s === '' ? undefined : s;
  }
  return undefined;
}

/** Exige `ADMIN_API_SECRET` configurado e header `X-Admin-Secret` correspondente. */
export function requireAdminOperation(req: Request): void {
  const configured = env.ADMIN_API_SECRET;
  if (!configured) {
    throw new AppError(
      'Admin operations are not configured',
      HttpStatusCode.FORBIDDEN,
    );
  }
  if (headerValue(req) !== configured) {
    throw new AppError('Forbidden', HttpStatusCode.FORBIDDEN);
  }
}
