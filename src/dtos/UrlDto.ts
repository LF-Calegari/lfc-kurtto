import { z } from 'zod';

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

const optionalSearchQ = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (Array.isArray(val)) {
    const first = val[0];
    return typeof first === 'string' ? first : undefined;
  }
  return typeof val === 'string' ? val : String(val);
}, z.string().trim().max(200).optional()).transform((s) => (s === undefined || s === '' ? undefined : s));

export const ListUrlsQuerySchema = z.object({
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
  q: optionalSearchQ,
});

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
