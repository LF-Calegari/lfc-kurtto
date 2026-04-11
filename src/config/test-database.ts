/**
 * Resolve a URL dedicada de Postgres para a suíte Jest (`NODE_ENV=test`), no
 * mesmo espírito de `AUTH_SERVICE_TEST_SQL_BASE` no auth-service: conexão de
 * teste explícita, separada de dev/prod.
 */
import { DataSource } from 'typeorm';

/** Limite de identificadores do PostgreSQL (NAMEDATALEN). */
export const POSTGRES_MAX_IDENTIFIER_LENGTH = 63;

const SAFE_DB_NAME = /^[a-z][a-z0-9_]*$/;

export function extractDatabaseNameFromPostgresUrl(urlString: string): string {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error(`URL de Postgres inválida para testes: ${urlString}`);
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    throw new Error(
      `URL de Postgres inválida (esperado postgres:// ou postgresql://): ${urlString}`,
    );
  }
  const path = u.pathname.replace(/^\//, '').split('/')[0];
  const decoded = decodeURIComponent(path);
  if (!decoded) {
    throw new Error(`URL de Postgres sem nome de banco no path: ${urlString}`);
  }
  return decoded;
}

export function replaceDatabaseInPostgresUrl(
  urlString: string,
  databaseName: string,
): string {
  const u = new URL(urlString);
  u.pathname = `/${databaseName}`;
  return u.toString();
}

export function truncatePostgresIdentifier(name: string): string {
  if (name.length <= POSTGRES_MAX_IDENTIFIER_LENGTH) {
    return name;
  }
  return name.slice(0, POSTGRES_MAX_IDENTIFIER_LENGTH);
}

/**
 * A partir da URL base (`KURTTO_TEST_DATABASE_URL` / `DATABASE_URL_TEST`),
 * produz URL com banco dedicado ao worker Jest (`kurtto_test_w2`, etc.).
 * Sem `JEST_WORKER_ID` (fora do Jest ou cenário legado), devolve a URL base.
 */
export function deriveIntegrationTestDatabaseUrlForWorker(
  baseUrl: string,
  workerId: string | undefined,
): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error('URL base de teste vazia.');
  }
  const wid = workerId?.trim();
  if (!wid) {
    return trimmed;
  }
  const baseName = extractDatabaseNameFromPostgresUrl(trimmed);
  const candidate = truncatePostgresIdentifier(`${baseName}_w${wid}`);
  if (!SAFE_DB_NAME.test(candidate)) {
    throw new Error(
      `Nome de banco derivado inválido para PostgreSQL: ${candidate}`,
    );
  }
  return replaceDatabaseInPostgresUrl(trimmed, candidate);
}

function quoteIdent(ident: string): string {
  return `"${ident.replaceAll('"', '""')}"`;
}

/**
 * Conecta ao banco `postgres` com as mesmas credenciais da URL alvo e cria o
 * banco se ainda não existir (idempotente).
 */
export async function ensurePostgresDatabaseExists(
  databaseUrl: string,
): Promise<void> {
  const dbName = extractDatabaseNameFromPostgresUrl(databaseUrl);
  if (!SAFE_DB_NAME.test(dbName)) {
    throw new Error(
      `Nome de banco inválido ou inseguro para CREATE DATABASE: ${dbName}`,
    );
  }
  const adminUrl = replaceDatabaseInPostgresUrl(databaseUrl, 'postgres');
  const adminDs = new DataSource({
    type: 'postgres',
    url: adminUrl,
  });
  await adminDs.initialize();
  try {
    const rows = await adminDs.query(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      [dbName],
    );
    const exists = rows[0]?.exists === true;
    if (!exists) {
      await adminDs.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    }
  } finally {
    await adminDs.destroy();
  }
}

/**
 * Remove o banco de teste (se existir) usando conexão administrativa no banco
 * `postgres`. Finaliza conexões abertas do banco alvo antes do DROP.
 */
export async function dropPostgresDatabaseIfExists(
  databaseUrl: string,
): Promise<void> {
  const dbName = extractDatabaseNameFromPostgresUrl(databaseUrl);
  if (!SAFE_DB_NAME.test(dbName)) {
    throw new Error(
      `Nome de banco inválido ou inseguro para DROP DATABASE: ${dbName}`,
    );
  }
  const adminUrl = replaceDatabaseInPostgresUrl(databaseUrl, 'postgres');
  const adminDs = new DataSource({
    type: 'postgres',
    url: adminUrl,
  });
  await adminDs.initialize();
  try {
    await adminDs.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await adminDs.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`);
  } finally {
    await adminDs.destroy();
  }
}

export function resolveIntegrationTestDatabaseUrlFromEnv(
  envVars: NodeJS.ProcessEnv,
): string | undefined {
  if (envVars.NODE_ENV !== 'test') {
    return undefined;
  }
  const kurtto = envVars.KURTTO_TEST_DATABASE_URL?.trim();
  const legacy = envVars.DATABASE_URL_TEST?.trim();
  return kurtto || legacy || undefined;
}

export function getIntegrationTestDatabaseUrl(): string | undefined {
  return resolveIntegrationTestDatabaseUrlFromEnv(process.env);
}

export function shouldDropIntegrationTestDatabaseAfterRun(
  envVars: NodeJS.ProcessEnv = process.env,
): boolean {
  return envVars.KURTTO_TEST_DATABASE_DROP_AFTER_RUN === 'true';
}

/**
 * Garante que integração Jest não use `DATABASE_URL` / `DB_*` de desenvolvimento
 * por engano. Use `KURTTO_INTEGRATION_USE_ENV_DATABASE=true` apenas quando a URL
 * já for exclusiva de teste (ex.: pipeline que injeta só `DATABASE_URL`).
 */
export function assertIntegrationTestDatabaseConfigured(
  envVars: NodeJS.ProcessEnv = process.env,
): void {
  if (envVars.NODE_ENV !== 'test') {
    return;
  }
  if (envVars.KURTTO_INTEGRATION_USE_ENV_DATABASE === 'true') {
    return;
  }
  const url = resolveIntegrationTestDatabaseUrlFromEnv(envVars);
  if (!url) {
    const msg = [
      'Defina KURTTO_TEST_DATABASE_URL (recomendado) ou DATABASE_URL_TEST',
      'com a URL do PostgreSQL de testes, por exemplo',
      'postgresql://postgres:postgres@127.0.0.1:5432/kurtto_test.',
      'No Docker Compose, o serviço test já define KURTTO_TEST_DATABASE_URL.',
      'Com Jest paralelo, cada worker usa um banco derivado',
      '(ex.: kurtto_test_w1).',
      'Para usar só DATABASE_URL/DB_*, defina',
      'KURTTO_INTEGRATION_USE_ENV_DATABASE=true (avancado).',
    ].join(' ');
    throw new Error(msg);
  }
}
