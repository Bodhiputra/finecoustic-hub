import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { getKolPoolRecord } from '@/lib/kol-pool-data';
import {
  generateKolTrackingCode,
  normalizeKolTrackingCodeEntry,
} from '@/lib/kol-tracking-codes';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-kol-tracking-codes.json');
const CODE_COLLISION_RETRIES = 12;

let tablesReady = false;
let tablesReadyPromise = null;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

async function ensureTables() {
  if (tablesReady) return;
  if (!tablesReadyPromise) {
    tablesReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS hub_kol_tracking_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        kol_pool_id TEXT NOT NULL UNIQUE,
        channel_name TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS hub_kol_tracking_codes_code_idx ON hub_kol_tracking_codes (code)`;
        await sql()`CREATE INDEX IF NOT EXISTS hub_kol_tracking_codes_channel_idx ON hub_kol_tracking_codes (channel_name)`;
        tablesReady = true;
      })
      .catch(err => {
        tablesReadyPromise = null;
        throw err;
      });
  }
  await tablesReadyPromise;
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ entries: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.entries) ? raw.entries.map(normalizeKolTrackingCodeEntry) : [];
}

function writeFileStore(entries) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ entries }, null, 2));
}

function rowToEntry(row) {
  return normalizeKolTrackingCodeEntry({
    id: row.id,
    code: row.code,
    kol_pool_id: row.kol_pool_id,
    channel_name: row.channel_name,
    platform: row.platform,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
  });
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

function filterEntries(entries, query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(entry =>
    [entry.code, entry.channel_name, entry.platform, entry.kol_pool_id, entry.notes]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
}

export async function listKolTrackingCodes({ query = '' } = {}) {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_kol_tracking_codes
      ORDER BY created_at DESC
    `;
    return sortEntries(filterEntries(rows.map(rowToEntry), query));
  }
  return sortEntries(filterEntries(readFileStore(), query));
}

export async function getKolTrackingCodeByKolPoolId(kolPoolId) {
  const id = String(kolPoolId || '').trim();
  if (!id) return null;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_kol_tracking_codes WHERE kol_pool_id = ${id} LIMIT 1
    `;
    return rows[0] ? rowToEntry(rows[0]) : null;
  }

  return readFileStore().find(entry => entry.kol_pool_id === id) || null;
}

async function codeExists(code) {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`SELECT 1 FROM hub_kol_tracking_codes WHERE code = ${code} LIMIT 1`;
    return rows.length > 0;
  }
  return readFileStore().some(entry => entry.code === code);
}

async function allocateUniqueCode() {
  for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt += 1) {
    const code = generateKolTrackingCode();
    if (!(await codeExists(code))) return code;
  }
  throw new Error('code_allocation_failed');
}

export async function createKolTrackingCode(payload = {}) {
  const kolPoolId = String(payload.kol_pool_id || '').trim();
  if (!kolPoolId) throw new Error('kol_pool_id_required');

  const existing = await getKolTrackingCodeByKolPoolId(kolPoolId);
  if (existing) {
    return { entry: existing, created: false };
  }

  const kol = await getKolPoolRecord(kolPoolId);
  if (!kol) throw new Error('kol_not_found');

  const channelName = String(kol.channel_name || '').trim();
  const platform = String(payload.platform || kol.main_platform || '').trim();
  const notes = String(payload.notes || '').trim();
  const createdBy = String(payload.created_by || '').trim();
  const code = await allocateUniqueCode();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const entry = normalizeKolTrackingCodeEntry({
    id,
    code,
    kol_pool_id: kolPoolId,
    channel_name: channelName,
    platform,
    notes,
    created_by: createdBy,
    created_at: createdAt,
  });

  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_kol_tracking_codes (
        id, code, kol_pool_id, channel_name, platform, notes, created_by, created_at
      ) VALUES (
        ${entry.id}, ${entry.code}, ${entry.kol_pool_id}, ${entry.channel_name},
        ${entry.platform}, ${entry.notes}, ${entry.created_by}, ${entry.created_at}
      )
    `;
    return { entry, created: true };
  }

  const entries = readFileStore();
  entries.push(entry);
  writeFileStore(entries);
  return { entry, created: true };
}

export async function deleteKolTrackingCode(id) {
  const entryId = String(id || '').trim();
  if (!entryId) return false;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      DELETE FROM hub_kol_tracking_codes WHERE id = ${entryId} RETURNING id
    `;
    return rows.length > 0;
  }

  const entries = readFileStore();
  const next = entries.filter(entry => entry.id !== entryId);
  if (next.length === entries.length) return false;
  writeFileStore(next);
  return true;
}
