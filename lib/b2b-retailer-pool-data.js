import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { normalizeB2bRetailerRecord, normalizeB2bRetailerTag, B2B_RETAILER_TAG_IDS } from '@/lib/b2b-retailer-pool';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-b2b-retailers.json');

let tablesReady = false;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

function rowToRecord(row) {
  return normalizeB2bRetailerRecord({
    id: row.id,
    name: row.name,
    website: row.website,
    country: row.country,
    partner_code: row.partner_code,
    links: row.links,
    tag: row.tag,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function readFileStore() {
  if (!existsSync(FILE)) {
    return { records: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
    const records = Array.isArray(parsed?.records) ? parsed.records.map(normalizeB2bRetailerRecord) : [];
    return { records };
  } catch {
    return { records: [] };
  }
}

function writeFileStore(records) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ records }, null, 2), 'utf8');
}

async function ensureTables() {
  if (!useDatabase() || tablesReady) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS hub_b2b_retailers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      partner_code TEXT NOT NULL DEFAULT '',
      links TEXT NOT NULL DEFAULT '',
      tag TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql()`CREATE INDEX IF NOT EXISTS hub_b2b_retailers_tag_idx ON hub_b2b_retailers (tag)`;
  await sql()`CREATE INDEX IF NOT EXISTS hub_b2b_retailers_name_idx ON hub_b2b_retailers (name)`;
  tablesReady = true;
}

export async function listB2bRetailerRecords() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_b2b_retailers ORDER BY name ASC
    `;
    return { records: rows.map(rowToRecord) };
  }
  return readFileStore();
}

export async function getB2bRetailerRecord(id) {
  const rid = String(id || '').trim();
  if (!rid) return null;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`SELECT * FROM hub_b2b_retailers WHERE id = ${rid} LIMIT 1`;
    return rows.length ? rowToRecord(rows[0]) : null;
  }

  const { records } = readFileStore();
  return records.find(r => r.id === rid) || null;
}

async function insertRecord(record) {
  const rec = normalizeB2bRetailerRecord(record);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_b2b_retailers (
        id, name, website, country, partner_code, links, tag, created_at, updated_at
      ) VALUES (
        ${rec.id}, ${rec.name}, ${rec.website}, ${rec.country}, ${rec.partner_code},
        ${rec.links}, ${rec.tag}, ${rec.created_at}, ${rec.updated_at}
      )
    `;
    return rec;
  }

  const store = readFileStore();
  store.records.push(rec);
  writeFileStore(store.records);
  return rec;
}

function validateTag(tag) {
  if (!tag || !B2B_RETAILER_TAG_IDS.includes(tag)) {
    const err = new Error('tag_required');
    err.status = 400;
    throw err;
  }
}

export async function createB2bRetailerRecord(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }

  const tag = normalizeB2bRetailerTag(body.tag);
  validateTag(tag);

  const partnerCode = String(body.partner_code || '').trim();
  if (partnerCode) {
    const { records } = await listB2bRetailerRecords();
    const dup = records.find(r => r.partner_code && r.partner_code === partnerCode);
    if (dup) {
      const err = new Error('partner_code_duplicate');
      err.status = 409;
      throw err;
    }
  }

  const now = new Date().toISOString();
  return insertRecord({
    id: randomUUID(),
    name,
    website: body.website || '',
    country: body.country || '',
    partner_code: partnerCode,
    links: body.links || '',
    tag,
    created_at: now,
    updated_at: now,
  });
}

export async function updateB2bRetailerRecord(id, patchIn = {}) {
  const rid = String(id || '').trim();
  if (!rid) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }

  const existing = await getB2bRetailerRecord(rid);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const patch = { ...patchIn };
  if (patch.tag !== undefined) {
    patch.tag = normalizeB2bRetailerTag(patch.tag);
    validateTag(patch.tag);
  }
  if (patch.name !== undefined && !String(patch.name || '').trim()) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  if (patch.partner_code !== undefined) {
    const code = String(patch.partner_code || '').trim();
    if (code) {
      const { records } = await listB2bRetailerRecords();
      const dup = records.find(r => r.id !== rid && r.partner_code === code);
      if (dup) {
        const err = new Error('partner_code_duplicate');
        err.status = 409;
        throw err;
      }
    }
    patch.partner_code = code;
  }

  const merged = normalizeB2bRetailerRecord({
    ...existing,
    ...patch,
    id: rid,
    updated_at: new Date().toISOString(),
  });

  if (useDatabase()) {
    await ensureTables();
    await sql()`
      UPDATE hub_b2b_retailers SET
        name = ${merged.name},
        website = ${merged.website},
        country = ${merged.country},
        partner_code = ${merged.partner_code},
        links = ${merged.links},
        tag = ${merged.tag},
        updated_at = ${merged.updated_at}
      WHERE id = ${rid}
    `;
    return merged;
  }

  const store = readFileStore();
  const idx = store.records.findIndex(r => r.id === rid);
  store.records[idx] = merged;
  writeFileStore(store.records);
  return merged;
}

export async function deleteB2bRetailerRecord(id) {
  const rid = String(id || '').trim();
  if (!rid) return false;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`DELETE FROM hub_b2b_retailers WHERE id = ${rid} RETURNING id`;
    return rows.length > 0;
  }

  const store = readFileStore();
  const next = store.records.filter(r => r.id !== rid);
  if (next.length === store.records.length) return false;
  writeFileStore(next);
  return true;
}
