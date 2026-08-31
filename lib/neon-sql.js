import { neon } from '@neondatabase/serverless';
import { stripEnvValue } from '@/lib/env';

let client = null;

const TRANSIENT_DB_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']);

function isTransientDbError(err) {
  if (!err) return false;
  const message = String(err.message || err);
  if (message.includes('fetch failed') || message.includes('Error connecting to database')) {
    return true;
  }
  const nested = [err.cause, err.sourceError, err.cause?.cause];
  return nested.some(node => node?.code && TRANSIENT_DB_CODES.has(node.code));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Reuse one Neon HTTP client per runtime — avoids connection setup on every query. */
export function getNeonSql() {
  const url = stripEnvValue(process.env.DATABASE_URL);
  if (!url) return null;
  if (!client) client = neon(url);
  return client;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

/** Retry Neon HTTP queries when the network drops mid-handshake (common on cold starts). */
export async function withNeonRetry(run, { retries = 2, delayMs = 250 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !isTransientDbError(err)) {
        throw err;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}
