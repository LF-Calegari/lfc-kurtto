import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DataSource } from 'typeorm';

import { Url } from '../entities/Url.js';
import { CreateUrlTable1744190400000 } from
  '../migrations/1744190400000-CreateUrlsTable.js';
import { AddDeletedAtToUrls1744300800000 } from
  '../migrations/1744300800000-AddDeletedAtToUrls.js';
import { env } from './env.js';
import { getIntegrationTestDatabaseUrl } from './test-database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsGlob = path.join(__dirname, '../migrations/*{.ts,.js}');

/**
 * No Jest, usar classes explícitas (ordem cronológica) em vez do glob, que
 * conflita com VM modules / ESM no runner.
 */
const jestMigrationClasses = [
  CreateUrlTable1744190400000,
  AddDeletedAtToUrls1744300800000,
];

const migrationPaths =
  process.env.JEST_WORKER_ID !== undefined
    ? jestMigrationClasses
    : [migrationsGlob];

export type CreateAppDataSourceOptions = {
  /**
   * When defined, overrides how the effective database URL is resolved (inclui
   * `KURTTO_TEST_DATABASE_URL` em `NODE_ENV=test`). Use string vazia para forçar
   * modo host/port/credentials (igual a URL ausente).
   */
  databaseUrlOverride?: string;
};

export function createAppDataSource(
  buildOptions?: CreateAppDataSourceOptions,
): DataSource {
  const testDedicatedUrl = getIntegrationTestDatabaseUrl();
  const databaseUrl =
    buildOptions?.databaseUrlOverride !== undefined
      ? buildOptions.databaseUrlOverride.trim() || undefined
      : testDedicatedUrl ?? env.DATABASE_URL?.trim();

  const common = {
    type: 'postgres' as const,
    entities: [Url],
    migrations: migrationPaths,
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
