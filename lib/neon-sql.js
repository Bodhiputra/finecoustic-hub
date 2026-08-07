import { neon } from '@neondatabase/serverless';

let client = null;

/** Reuse one Neon HTTP client per runtime — avoids connection setup on every query. */
export function getNeonSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!client) client = neon(url);
  return client;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
