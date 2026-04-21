import winston from 'winston';

import { env } from './env.js';

const isProduction = env.NODE_ENV === 'production';

const isoTimestamp = winston.format.timestamp({
  format: (): string => new Date().toISOString(),
});

function formatContextTag(context: unknown): string {
  if (context === undefined || context === null || context === '') {
    return '';
  }
  if (typeof context === 'object') {
    return ` [${JSON.stringify(context)}]`;
  }
  if (typeof context === 'string') {
    return ` [${context}]`;
  }
  if (
    typeof context === 'number' ||
    typeof context === 'boolean' ||
    typeof context === 'bigint'
  ) {
    return ` [${context}]`;
  }
  if (typeof context === 'symbol') {
    return ` [${context.toString()}]`;
  }
  if (typeof context === 'function') {
    const fn = context as { name?: string };
    return ` [Function: ${fn.name || 'anonymous'}]`;
  }
  return ' [unknown]';
}

function formatMetaValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}

const RESERVED_KEYS = new Set(['timestamp', 'level', 'message', 'context']);

function formatExtraMeta(info: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of Object.keys(info)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }
    parts.push(`${key}=${formatMetaValue(info[key])}`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

const devFormat = winston.format.combine(
  isoTimestamp,
  winston.format.colorize({ level: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, context } = info;
    const ctx = formatContextTag(context);
    const extra = formatExtraMeta(info as Record<string, unknown>);
    return `${timestamp} ${level}:${ctx} ${message}${extra}`;
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
