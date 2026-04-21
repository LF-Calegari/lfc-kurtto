import { config as loadDotenv } from 'dotenv';

import { deriveIntegrationTestDatabaseUrlForWorker } from
  '@config/test-database';

loadDotenv({ quiet: true });

if (process.env.NODE_ENV === 'test') {
  const admin = process.env.ADMIN_API_SECRET?.trim();
  if (!admin) {
    process.env.ADMIN_API_SECRET = 'test-admin-secret';
  }
  // Sem cache de verify-token nos testes: cada request deve cair no mock
  // de fetch. Quem quiser cobrir cache explicitamente sobrescreve a env.
  if (process.env.AUTH_SERVICE_CACHE_TTL_SECONDS === undefined) {
    process.env.AUTH_SERVICE_CACHE_TTL_SECONDS = '0';
  }
  if (!process.env.AUTH_SERVICE_URL?.trim()) {
    process.env.AUTH_SERVICE_URL = 'http://auth-service.test';
  }
}

const baseKurtto = process.env.KURTTO_TEST_DATABASE_URL?.trim();
const baseLegacy = process.env.DATABASE_URL_TEST?.trim();
const integrationTestBaseUrl = baseKurtto || baseLegacy;

if (integrationTestBaseUrl) {
  const derived = deriveIntegrationTestDatabaseUrlForWorker(
    integrationTestBaseUrl,
    process.env.JEST_WORKER_ID,
  );
  if (baseKurtto) {
    process.env.KURTTO_TEST_DATABASE_URL = derived;
  }
  if (baseLegacy) {
    process.env.DATABASE_URL_TEST = derived;
  }
  process.env.DATABASE_URL = derived;
}
