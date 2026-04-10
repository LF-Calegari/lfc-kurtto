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
    const ctx =
      context !== undefined && context !== null && context !== ''
        ? ` [${String(context)}]`
        : '';
    return `${String(timestamp)} ${level}:${ctx} ${String(message)}`;
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
