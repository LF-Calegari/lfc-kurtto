import { config as loadDotenv } from 'dotenv';

import { deriveIntegrationTestDatabaseUrlForWorker } from
  '@config/test-database';

loadDotenv();

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
