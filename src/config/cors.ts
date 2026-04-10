import type { CorsOptions } from 'cors';

import { env } from './env.js';

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

export function buildCorsOptions(): CorsOptions {
  const isDevLike = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  const csv = env.CORS_ORIGINS?.trim();

  if (isDevLike && !csv) {
    return {
      origin: '*',
      methods: [...METHODS],
      allowedHeaders: [...ALLOWED_HEADERS],
    };
  }

  const allowed = new Set(
    csv ? csv.split(',').map((o) => o.trim()).filter(Boolean) : [],
  );

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: [...METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
  };
}
