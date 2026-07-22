import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const SALT_LEN = 16;

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'too_short' };
  }
  return { ok: true };
}

export function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(String(password), salt, KEY_LEN);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const raw = String(stored || '');
  if (!raw.startsWith('scrypt:')) return false;
  const parts = raw.split(':');
  if (parts.length !== 3) return false;
  try {
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const actual = scryptSync(String(password), salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
