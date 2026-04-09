import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DataSource } from 'typeorm';

import { Url } from '../entities/Url.js';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsGlob = path.join(__dirname, '../migrations/*{.ts,.js}');

export type CreateAppDataSourceOptions = {
  /**
   * When defined, overrides how `DATABASE_URL` from env is applied.
   * Use empty string to force host/port/credentials mode (same as unset URL).
   */
  databaseUrlOverride?: string;
};

export function createAppDataSource(
  buildOptions?: CreateAppDataSourceOptions,
): DataSource {
  const databaseUrl =
    buildOptions?.databaseUrlOverride !== undefined
      ? buildOptions.databaseUrlOverride.trim() || undefined
      : env.DATABASE_URL?.trim();

  const common = {
    type: 'postgres' as const,
    entities: [Url],
    migrations: [migrationsGlob],
    synchronize: false,
    logging: env.NODE_ENV === 'development',
    uuidExtension: 'pgcrypto' as const,
  };

  if (databaseUrl) {
    return new DataSource({
      ...common,
      url: databaseUrl,
    });
  }

  const username = process.env.POSTGRES_USER ?? env.DB_USER;
  const password = process.env.POSTGRES_PASSWORD ?? env.DB_PASSWORD;
  const database = process.env.POSTGRES_DB ?? env.DB_NAME;

  return new DataSource({
    ...common,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username,
    password,
    database,
  });
}

export const AppDataSource = createAppDataSource();
