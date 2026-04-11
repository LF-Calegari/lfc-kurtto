import winston from 'winston';

import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';

const isoTimestamp = winston.format.timestamp({
  format: (): string => new Date().toISOString(),
});

const devFormat = winston.format.combine(
  isoTimestamp,
  winston.format.colorize({ level: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, context } = info;
    let ctx = '';
    if (context !== undefined && context !== null && context !== '') {
      if (typeof context === 'object') {
        ctx = ` [${JSON.stringify(context)}]`;
      } else if (typeof context === 'string') {
        ctx = ` [${context}]`;
      } else if (
        typeof context === 'number' ||
        typeof context === 'boolean' ||
        typeof context === 'bigint'
      ) {
        ctx = ` [${context}]`;
      } else if (typeof context === 'symbol') {
        ctx = ` [${context.toString()}]`;
      } else if (typeof context === 'function') {
        const fn = context as { name?: string };
        ctx = ` [Function: ${fn.name || 'anonymous'}]`;
      } else {
        ctx = ' [unknown]';
      }
    }
    return `${timestamp} ${level}:${ctx} ${message}`;
  }),
);

const prodFormat = winston.format.combine(
  isoTimestamp,
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
});
