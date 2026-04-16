import { z } from 'zod';

const LIST_LIKE_MAX_LEN = 200;
const LIST_EXACT_URL_MAX_LEN = 8192;
const LIST_EXACT_SHORT_CODE_MAX_LEN = 10;

function queryScalarToOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const first = Array.isArray(value) ? value[0] : value;
  if (first === undefined || first === null) {
    return undefined;
  }
  if (typeof first === 'string') {
    return first === '' ? undefined : first;
  }
  if (typeof first === 'number' || typeof first === 'boolean') {
    return String(first);
  }
  return undefined;
}

function optionalQueryString(
  schema: z.ZodString,
): z.ZodType<string | undefined> {
  return z.preprocess(
    (v) => queryScalarToOptionalString(v),
    schema.optional(),
  );
}

/** Inteiro >= 0 para filtros de `clicks` (contador não admite valores negativos). */
function optionalQueryCoercedNonNegativeInt(): z.ZodType<number | undefined> {
  return z.preprocess(
    (v) => queryScalarToOptionalString(v),
    z.union([
      z.undefined(),
      z
        .string()
        .regex(/^-?\d+$/, { message: 'must be an integer' })
        .transform((s) => Number.parseInt(s, 10))
        .pipe(z.number().int().min(0)),
    ]),
  );
}

export function parseIntPair(s: string): [number, number] | null {
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length !== 2) {
    return null;
  }
  const a = Number.parseInt(parts[0], 10);
  const b = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  return [a, b];
}

export function parseDatePair(s: string): [Date, Date] | null {
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length !== 2) {
    return null;
  }
  const d1 = new Date(parts[0]);
  const d2 = new Date(parts[1]);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    return null;
  }
  return [d1, d2];
}

export const CreateUrlSchema = z
  .object({
    originalUrl: z.url(),
    customCode: z
      .string()
      .regex(/^[a-zA-Z0-9]{3,10}$/, {
        message: 'custom_code must be 3-10 alphanumeric characters',
      })
      .optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.expiresAt !== undefined && data.expiresAt <= new Date()) {
      ctx.addIssue({
        code: 'custom',
        message: 'expires_at must be in the future',
        path: ['expiresAt'],
      });
    }
  });

export type CreateUrlDto = z.infer<typeof CreateUrlSchema>;

export const PatchUrlSchema = z
  .object({
    originalUrl: z.url().optional(),
    expiresAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasField =
      data.originalUrl !== undefined ||
      data.expiresAt !== undefined ||
      data.isActive !== undefined;
    if (!hasField) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field is required',
        path: [],
      });
    }
    if (data.expiresAt !== undefined && data.expiresAt <= new Date()) {
      ctx.addIssue({
        code: 'custom',
        message: 'expires_at must be in the future',
        path: ['expiresAt'],
      });
    }
  });

export type PatchUrlDto = z.infer<typeof PatchUrlSchema>;

const listUrlsQueryObjectSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    active: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : val === 'true',
      ),
    include_deleted: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : val === 'true',
      ),
    is_active__exact: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) =>
        val === undefined ? undefined : val === 'true',
      ),
    id__exact: optionalQueryString(z.string().uuid()),
    id__like: optionalQueryString(z.string().min(1).max(LIST_LIKE_MAX_LEN)),
    original_url__exact: optionalQueryString(
      z.string().min(1).max(LIST_EXACT_URL_MAX_LEN),
    ),
    original_url__like: optionalQueryString(
      z.string().min(1).max(LIST_LIKE_MAX_LEN),
    ),
    short_code__exact: optionalQueryString(
      z.string().min(1).max(LIST_EXACT_SHORT_CODE_MAX_LEN),
    ),
    short_code__like: optionalQueryString(
      z.string().min(1).max(LIST_LIKE_MAX_LEN),
    ),
    clicks__lt: optionalQueryCoercedNonNegativeInt(),
    clicks__gt: optionalQueryCoercedNonNegativeInt(),
    clicks__exact: optionalQueryCoercedNonNegativeInt(),
    clicks__between: optionalQueryString(z.string().min(1)),
    expires_at__lt: optionalQueryString(z.string().min(1)),
    expires_at__gt: optionalQueryString(z.string().min(1)),
    expires_at__exact: optionalQueryString(z.string().min(1)),
    expires_at__between: optionalQueryString(z.string().min(1)),
    created_at__lt: optionalQueryString(z.string().min(1)),
    created_at__gt: optionalQueryString(z.string().min(1)),
    created_at__exact: optionalQueryString(z.string().min(1)),
    created_at__between: optionalQueryString(z.string().min(1)),
    updated_at__lt: optionalQueryString(z.string().min(1)),
    updated_at__gt: optionalQueryString(z.string().min(1)),
    updated_at__exact: optionalQueryString(z.string().min(1)),
    updated_at__between: optionalQueryString(z.string().min(1)),
    deleted_at__lt: optionalQueryString(z.string().min(1)),
    deleted_at__gt: optionalQueryString(z.string().min(1)),
    deleted_at__exact: optionalQueryString(z.string().min(1)),
    deleted_at__between: optionalQueryString(z.string().min(1)),
  })
  .superRefine((data, ctx) => {
    const checkBetweenInts = (
      raw: string | undefined,
      path: 'clicks__between',
    ): void => {
      if (raw === undefined) {
        return;
      }
      const pair = parseIntPair(raw);
      if (!pair) {
        ctx.addIssue({
          code: 'custom',
          message:
            'clicks__between must be two integers separated by a comma ' +
            '(e.g. 0,100)',
          path: [path],
        });
        return;
      }
      if (pair[0] < 0 || pair[1] < 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'clicks__between bounds must be >= 0',
          path: [path],
        });
        return;
      }
      if (pair[0] > pair[1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'clicks__between: lower bound must be <= upper bound',
          path: [path],
        });
      }
    };

    const checkBetweenDates = (
      raw: string | undefined,
      path:
        | 'expires_at__between'
        | 'created_at__between'
        | 'updated_at__between'
        | 'deleted_at__between',
    ): void => {
      if (raw === undefined) {
        return;
      }
      const pair = parseDatePair(raw);
      if (!pair) {
        ctx.addIssue({
          code: 'custom',
          message:
            `${path} must be two ISO 8601 datetimes separated by a comma (closed interval)`,
          path: [path],
        });
        return;
      }
      if (pair[0].getTime() > pair[1].getTime()) {
        ctx.addIssue({
          code: 'custom',
          message: `${path}: start must be <= end`,
          path: [path],
        });
      }
    };

    const checkScalarDate = (
      raw: string | undefined,
      path: string,
    ): void => {
      if (raw === undefined) {
        return;
      }
      if (Number.isNaN(new Date(raw).getTime())) {
        ctx.addIssue({
          code: 'custom',
          message: `${path} must be a valid ISO 8601 datetime`,
          path: [path],
        });
      }
    };

    checkBetweenInts(data.clicks__between, 'clicks__between');
    checkBetweenDates(data.expires_at__between, 'expires_at__between');
    checkBetweenDates(data.created_at__between, 'created_at__between');
    checkBetweenDates(data.updated_at__between, 'updated_at__between');
    checkBetweenDates(data.deleted_at__between, 'deleted_at__between');

    for (const [val, path] of [
      [data.expires_at__lt, 'expires_at__lt'],
      [data.expires_at__gt, 'expires_at__gt'],
      [data.expires_at__exact, 'expires_at__exact'],
      [data.created_at__lt, 'created_at__lt'],
      [data.created_at__gt, 'created_at__gt'],
      [data.created_at__exact, 'created_at__exact'],
      [data.updated_at__lt, 'updated_at__lt'],
      [data.updated_at__gt, 'updated_at__gt'],
      [data.updated_at__exact, 'updated_at__exact'],
      [data.deleted_at__lt, 'deleted_at__lt'],
      [data.deleted_at__gt, 'deleted_at__gt'],
      [data.deleted_at__exact, 'deleted_at__exact'],
    ] as const) {
      checkScalarDate(val, path);
    }
  });

export const ListUrlsQuerySchema = z.preprocess((raw) => {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const q = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(q)) {
      out[k] = Array.isArray(v) ? v[0] : v;
    }
    return out;
  }
  return raw;
}, listUrlsQueryObjectSchema);

export type ListUrlsQueryDto = z.infer<typeof ListUrlsQuerySchema>;

/** Query opcional em `GET /urls/:code` para incluir registro soft-deleted (com admin). */
export const GetUrlByCodeQuerySchema = z.object({
  include_deleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === 'true',
    ),
});

export type GetUrlByCodeQueryDto = z.infer<typeof GetUrlByCodeQuerySchema>;
