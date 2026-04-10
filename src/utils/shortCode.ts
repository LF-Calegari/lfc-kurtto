import { customAlphabet } from 'nanoid';

import { env } from '../config/env.js';

/** A–Z, a–z, 0–9 (URL-safe alfanumérico, sem `_` / `-`). */
const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShortCode(length?: number): string {
  const len = length ?? env.SHORT_CODE_LENGTH;
  return customAlphabet(ALPHABET, len)();
}
