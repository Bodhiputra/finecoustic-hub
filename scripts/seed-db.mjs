#!/usr/bin/env node
/**
 * Push local ops-data.json → Neon Postgres
 * Usage: DATABASE_URL=postgres://... npm run db:seed [brand-slug]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const slug = process.argv[2] || 'finecoustic';
const url = process.env.DATABASE_URL;

if (!url) {
  console.error('Set DATABASE_URL first (Neon connection string).');
  process.exit(1);
}

const file = join(__dirname, '..', 'brands', slug, 'ops-data.json');
if (!existsSync(file)) {
  console.error(`Missing ${file}`);
  process.exit(1);
}

const seed = JSON.parse(readFileSync(file, 'utf8'));
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS brand_ops_data (
    slug TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`
  INSERT INTO brand_ops_data (slug, data, updated_at)
  VALUES (${slug}, ${JSON.stringify(seed)}::jsonb, ${seed.meta?.updated_at || new Date().toISOString()})
  ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
`;
console.log(`Seeded ${slug} → brand_ops_data`);
