#!/usr/bin/env node
/**
 * Pull KOL POOLS from Notion → hub_kol_pool (Neon) or data/hub-kol-pool.json
 * Usage: node scripts/sync-kol-pool.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { fetchAllKolFromNotion, notionConfigured } from '../lib/notion-kol.js';
import { normalizeKolPoolRecord } from '../lib/kol-pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const DATA_DIR = join(root, 'data');
const FILE = join(DATA_DIR, 'hub-kol-pool.json');

function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const envPath = join(root, name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTables(db) {
  await db`
    CREATE TABLE IF NOT EXISTS hub_kol_pool (
      notion_page_id TEXT PRIMARY KEY,
      channel_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      links TEXT NOT NULL DEFAULT '',
      main_platform TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      kol_category TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      outreach_status TEXT NOT NULL DEFAULT '',
      notion_url TEXT NOT NULL DEFAULT '',
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS hub_kol_sync_meta (
      id TEXT PRIMARY KEY DEFAULT 'default',
      last_synced_at TIMESTAMPTZ,
      last_synced_by TEXT NOT NULL DEFAULT '',
      record_count INT NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT ''
    )
  `;
}

async function writeMetaDb(db, meta) {
  await db`
    INSERT INTO hub_kol_sync_meta (id, last_synced_at, last_synced_by, record_count, last_error)
    VALUES ('default', ${meta.last_synced_at}, ${meta.last_synced_by}, ${meta.record_count}, ${meta.last_error})
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      last_synced_by = EXCLUDED.last_synced_by,
      record_count = EXCLUDED.record_count,
      last_error = EXCLUDED.last_error
  `;
}

function writeFileStore(records, meta) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ records, meta }, null, 2));
}

loadEnvLocal();

if (!notionConfigured()) {
  console.error('Notion not configured — set NOTION_API_KEY and NOTION_KOL_DATABASE_ID in .env.local');
  process.exit(1);
}

const actor = process.argv[2] || 'cli-sync';
const syncedAt = new Date().toISOString();

console.log('Fetching KOL records from Notion...');
const records = await fetchAllKolFromNotion();
const normalized = records.map(r => normalizeKolPoolRecord({ ...r, synced_at: syncedAt }));
const meta = {
  last_synced_at: syncedAt,
  last_synced_by: actor,
  record_count: normalized.length,
  last_error: '',
};

if (useDatabase()) {
  const db = sql();
  await ensureTables(db);
  await db`DELETE FROM hub_kol_pool`;
  for (const rec of normalized) {
    await db`
      INSERT INTO hub_kol_pool (
        notion_page_id, channel_name, description, links,
        main_platform, country, kol_category, tags,
        outreach_status, notion_url, synced_at
      ) VALUES (
        ${rec.notion_page_id}, ${rec.channel_name}, ${rec.description}, ${rec.links},
        ${rec.main_platform}, ${rec.country}, ${rec.kol_category}, ${rec.tags},
        ${rec.outreach_status}, ${rec.notion_url}, ${rec.synced_at}
      )
    `;
  }
  await writeMetaDb(db, meta);
  console.log(`Synced ${normalized.length} records → Neon hub_kol_pool (${syncedAt})`);
} else {
  writeFileStore(normalized, meta);
  console.log(`Synced ${normalized.length} records → ${FILE}`);
}
