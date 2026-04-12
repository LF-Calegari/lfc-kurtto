import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true });

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
    /**
     * Limite (ms) para encerramento ordenado apos SIGTERM/SIGINT: fecha o HTTP
     * server, destroy no TypeORM e quit no Redis. Padrao 30s.
     */
    GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30_000),
    DATABASE_URL: z.string().min(1).optional(),
    /**
     * URL Postgres só para Jest (`NODE_ENV=test`); tem precedência sobre
     * `DATABASE_URL` no DataSource. Alinhado ao papel de variável dedicada de
     * teste no auth-service (`AUTH_SERVICE_TEST_SQL_BASE`).
     */
    KURTTO_TEST_DATABASE_URL: z.string().min(1).optional(),
    /** Legado: mesmo efeito de `KURTTO_TEST_DATABASE_URL`. */
    DATABASE_URL_TEST: z.string().min(1).optional(),
    /**
     * Se `true`, integração Jest pode usar `DATABASE_URL` / `DB_*` sem
     * `KURTTO_TEST_DATABASE_URL` (uso avançado; risco de apontar para dev).
     */
    KURTTO_INTEGRATION_USE_ENV_DATABASE: z.string().optional(),
    /**
     * Se `true`, remove o banco derivado do worker ao fim da execução do arquivo
     * de teste (útil para limpeza automática em pipelines locais/CI).
     */
    KURTTO_TEST_DATABASE_DROP_AFTER_RUN: z.enum(['true', 'false']).optional(),
    DB_HOST: z.string().min(1).default('db'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().min(1).default('postgres'),
    DB_PASSWORD: z.string().min(1).default('postgres'),
    DB_NAME: z.string().min(1).default('kurtto'),
    BASE_URL: z.url().default('http://localhost:3000'),
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
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
      .optional(),
    /**
     * CSV de paths (path sem query) para nao registrar request log em GET.
     * Vazio = nao ignorar nenhuma rota. Ausente = padrao health + live/ready.
     */
    REQUEST_LOG_SKIP_PATHS: z.string().optional(),
    /**
     * Em `production`, Swagger so sobe se `true`. Em development/test, padrao ligado;
     * use `false` para desligar.
     */
    SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
    /** Opcional: cache de redirect (ioredis). Sem valor, a API usa só PostgreSQL. */
    REDIS_URL: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') {
        return undefined;
      }
      if (typeof val !== 'string') {
        return undefined;
      }
      const s = val.trim();
      return s === '' ? undefined : s;
    }, z.string().min(1).optional()),
    /** TTL em segundos para entradas `url:{code}` no Redis (padrão 3600). */
    REDIS_CACHE_TTL: z.coerce.number().int().positive().default(3600),
    /**
     * Segredo para operações administrativas (listar URLs soft-deleted,
     * `POST .../restore`). Envie no header `X-Admin-Secret`. Se ausente, essas
     * operações respondem 403.
     */
    ADMIN_API_SECRET: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') {
        return undefined;
      }
      if (typeof val !== 'string') {
        return undefined;
      }
      const s = val.trim();
      return s === '' ? undefined : s;
    }, z.string().min(1).optional()),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.CORS_ORIGINS?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'CORS_ORIGINS is required when NODE_ENV is production',
        path: ['CORS_ORIGINS'],
      });
    }
  })
  .transform((data) => {
    const raw = data.REQUEST_LOG_SKIP_PATHS;
    let requestLogSkipPaths: string[];
    if (raw === undefined) {
      requestLogSkipPaths = [
        '/api/v1/health',
        '/api/v1/health/live',
        '/api/v1/health/ready',
      ];
    } else if (raw.trim() === '') {
      requestLogSkipPaths = [];
    } else {
      requestLogSkipPaths = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const swaggerEnabled =
      data.NODE_ENV === 'production'
        ? data.SWAGGER_ENABLED === 'true'
        : data.SWAGGER_ENABLED !== 'false';

    return { ...data, requestLogSkipPaths, swaggerEnabled };
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
