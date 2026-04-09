import { startApplication } from './bootstrap.js';

void startApplication().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
