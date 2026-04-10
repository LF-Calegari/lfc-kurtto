import { config as loadDotenv } from 'dotenv';

loadDotenv();

const testUrl = process.env.DATABASE_URL_TEST?.trim();
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}
