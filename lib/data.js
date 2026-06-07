import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { BRAND_SLUG } from './ops';

const ROOT = process.cwd();

function seedPath(slug) {
  return join(ROOT, 'brands', slug, 'ops-data.json');
}

function readFileStore(slug) {
  const file = seedPath(slug);
  if (!existsSync(file)) throw new Error(`Brand not found: ${slug}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable() {
  await sql()`
    CREATE TABLE IF NOT EXISTS brand_ops_data (
      slug TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function readDb(slug) {
  await ensureTable();
  const rows = await sql()`SELECT data FROM brand_ops_data WHERE slug = ${slug}`;
  if (!rows.length) return null;
  return rows[0].data;
}

async function writeDb(slug, payload) {
  await ensureTable();
  const updated = payload.meta?.updated_at || new Date().toISOString();
  await sql()`
    INSERT INTO brand_ops_data (slug, data, updated_at)
    VALUES (${slug}, ${JSON.stringify(payload)}::jsonb, ${updated})
    ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `;
}

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getOpsData(slug = BRAND_SLUG) {
  if (useDatabase()) {
    const fromDb = await readDb(slug);
    if (fromDb) return fromDb;
    const seed = readFileStore(slug);
    await writeDb(slug, seed);
    return seed;
  }
  return readFileStore(slug);
}
