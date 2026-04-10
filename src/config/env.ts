import { config } from 'dotenv';
import { z } from 'zod';

config();

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_MIN_MS = 60 * 1000;

const isTestEnv = process.env.NODE_ENV === 'test';
const defaultGlobalMax = isTestEnv ? 1_000_000 : 100;
const defaultPostUrlsMax = isTestEnv ? 1_000_000 : 10;
const defaultRedirectMax = isTestEnv ? 1_000_000 : 60;

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1).optional(),
    DB_HOST: z.string().min(1).default('db'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().min(1).default('postgres'),
    DB_PASSWORD: z.string().min(1).default('postgres'),
    DB_NAME: z.string().min(1).default('kurtto'),
    BASE_URL: z
      .string()
      .url()
      .default('http://localhost:3000'),
    SHORT_CODE_LENGTH: z.coerce.number().int().min(3).max(10).default(7),
    /** Origens CORS em producao (CSV). Em development/test, se vazio, usa `*`. */
    CORS_ORIGINS: z.string().optional(),
    RATE_LIMIT_GLOBAL_MAX: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultGlobalMax),
    RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(FIFTEEN_MIN_MS),
    RATE_LIMIT_POST_URLS_MAX: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultPostUrlsMax),
    RATE_LIMIT_POST_URLS_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(FIFTEEN_MIN_MS),
    RATE_LIMIT_REDIRECT_MAX: z.coerce
      .number()
      .int()
      .positive()
      .default(defaultRedirectMax),
    RATE_LIMIT_REDIRECT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(ONE_MIN_MS),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.CORS_ORIGINS?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'CORS_ORIGINS is required when NODE_ENV is production',
        path: ['CORS_ORIGINS'],
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables: ${parsedEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`,
  );
}

export const env = parsedEnv.data;
