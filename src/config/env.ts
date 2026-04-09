import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1).default('db'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().min(1).default('postgres'),
  DB_NAME: z.string().min(1).default('kurtto'),
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
