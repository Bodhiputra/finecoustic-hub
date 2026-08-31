import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { fetchAllKolFromNotion, notionConfigured, formatNotionSyncError } from '@/lib/notion-kol';
import {
  HUB_NATIVE_KOL_PREFIX,
  applyKolCoreOverrides,
  isHubNativeKol,
  KOL_HUB_FIELD_KEYS,
  normalizeKolPoolRecord,
  pickKolCorePatch,
  pickKolHubPatch,
} from '@/lib/kol-pool';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-kol-pool.json');

let tablesReady = false;
let tablesReadyPromise = null;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

async function mapInChunks(items, size, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const chunkResults = await Promise.all(items.slice(i, i + size).map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function ensureHubColumns() {
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_line1 TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_line2 TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_city TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_state TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_postal TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_country TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_phone TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_email TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS shipping_notes TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS collaboration_products JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql()`ALTER TABLE hub_kol_pool ADD COLUMN IF NOT EXISTS hub_core_overrides JSONB NOT NULL DEFAULT '{}'::jsonb`;
}

async function ensureTables() {
  if (tablesReady) return;
  if (!tablesReadyPromise) {
    tablesReadyPromise = sql()`
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
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        shipping_line1 TEXT NOT NULL DEFAULT '',
        shipping_line2 TEXT NOT NULL DEFAULT '',
        shipping_city TEXT NOT NULL DEFAULT '',
        shipping_state TEXT NOT NULL DEFAULT '',
        shipping_postal TEXT NOT NULL DEFAULT '',
        shipping_country TEXT NOT NULL DEFAULT '',
        shipping_phone TEXT NOT NULL DEFAULT '',
        shipping_email TEXT NOT NULL DEFAULT '',
        shipping_notes TEXT NOT NULL DEFAULT '',
        collaboration_products JSONB NOT NULL DEFAULT '[]'::jsonb,
        hub_core_overrides JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS hub_kol_sync_meta (
          id TEXT PRIMARY KEY DEFAULT 'default',
          last_synced_at TIMESTAMPTZ,
          last_synced_by TEXT NOT NULL DEFAULT '',
          record_count INT NOT NULL DEFAULT 0,
          last_error TEXT NOT NULL DEFAULT ''
        )
      `)
      .then(() => sql()`
        CREATE INDEX IF NOT EXISTS hub_kol_pool_channel_idx ON hub_kol_pool (channel_name)
      `)
      .then(() => ensureHubColumns())
      .then(() => {
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
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ records: [], meta: defaultMeta() }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return {
    records: Array.isArray(raw?.records)
      ? raw.records.map(r => applyKolCoreOverrides(normalizeKolPoolRecord(r)))
      : [],
    meta: normalizeMeta(raw?.meta),
  };
}

function writeFileStore(records, meta) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ records, meta: normalizeMeta(meta) }, null, 2));
}

function defaultMeta() {
  return {
    last_synced_at: null,
    last_synced_by: '',
    record_count: 0,
    last_error: '',
  };
}

function normalizeMeta(raw = {}) {
  return {
    last_synced_at: raw.last_synced_at || null,
    last_synced_by: String(raw.last_synced_by || ''),
    record_count: Number(raw.record_count) || 0,
    last_error: String(raw.last_error || ''),
  };
}

function parseCollaborationProducts(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseHubCoreOverrides(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function rowToRecord(row) {
  const base = normalizeKolPoolRecord({
    notion_page_id: row.notion_page_id,
    channel_name: row.channel_name,
    description: row.description,
    links: row.links,
    main_platform: row.main_platform,
    country: row.country,
    kol_category: row.kol_category,
    tags: row.tags,
    outreach_status: row.outreach_status,
    notion_url: row.notion_url,
    synced_at: row.synced_at,
    shipping_line1: row.shipping_line1,
    shipping_line2: row.shipping_line2,
    shipping_city: row.shipping_city,
    shipping_state: row.shipping_state,
    shipping_postal: row.shipping_postal,
    shipping_country: row.shipping_country,
    shipping_phone: row.shipping_phone,
    shipping_email: row.shipping_email,
    shipping_notes: row.shipping_notes,
    collaboration_products: parseCollaborationProducts(row.collaboration_products),
    hub_core_overrides: parseHubCoreOverrides(row.hub_core_overrides),
  });
  return applyKolCoreOverrides(base);
}

function pickHubFields(record) {
  const hub = {};
  for (const key of KOL_HUB_FIELD_KEYS) {
    hub[key] = record[key];
  }
  return hub;
}

function pickPersistedHubState(record) {
  return {
    ...pickHubFields(record),
    hub_core_overrides: parseHubCoreOverrides(record?.hub_core_overrides),
  };
}

async function readMetaDb() {
  await ensureTables();
  const rows = await sql()`SELECT * FROM hub_kol_sync_meta WHERE id = 'default' LIMIT 1`;
  if (!rows.length) return defaultMeta();
  const row = rows[0];
  return normalizeMeta({
    last_synced_at: row.last_synced_at,
    last_synced_by: row.last_synced_by,
    record_count: row.record_count,
    last_error: row.last_error,
  });
}

async function writeMetaDb(meta) {
  await ensureTables();
  const m = normalizeMeta(meta);
  await sql()`
    INSERT INTO hub_kol_sync_meta (id, last_synced_at, last_synced_by, record_count, last_error)
    VALUES ('default', ${m.last_synced_at}, ${m.last_synced_by}, ${m.record_count}, ${m.last_error})
    ON CONFLICT (id) DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      last_synced_by = EXCLUDED.last_synced_by,
      record_count = EXCLUDED.record_count,
      last_error = EXCLUDED.last_error
  `;
  return m;
}

export async function listKolPoolRecords() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_kol_pool
      ORDER BY channel_name ASC
    `;
    const meta = await readMetaDb();
    return {
      records: rows.map(rowToRecord),
      meta,
    };
  }

  return readFileStore();
}

export async function getKolPoolRecord(notionPageId) {
  const id = String(notionPageId || '').trim();
  if (!id) return null;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`SELECT * FROM hub_kol_pool WHERE notion_page_id = ${id} LIMIT 1`;
    return rows.length ? rowToRecord(rows[0]) : null;
  }

  const { records } = readFileStore();
  const found = records.find(r => r.notion_page_id === id);
  return found ? applyKolCoreOverrides(found) : null;
}

async function insertKolRecord(record) {
  const rec = normalizeKolPoolRecord(record);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_kol_pool (
        notion_page_id, channel_name, description, links,
        main_platform, country, kol_category, tags,
        outreach_status, notion_url, synced_at,
        shipping_line1, shipping_line2, shipping_city, shipping_state,
        shipping_postal, shipping_country, shipping_phone, shipping_email, shipping_notes,
        collaboration_products, hub_core_overrides
      ) VALUES (
        ${rec.notion_page_id}, ${rec.channel_name}, ${rec.description}, ${rec.links},
        ${rec.main_platform}, ${rec.country}, ${rec.kol_category}, ${rec.tags},
        ${rec.outreach_status}, ${rec.notion_url}, ${rec.synced_at},
        ${rec.shipping_line1}, ${rec.shipping_line2}, ${rec.shipping_city}, ${rec.shipping_state},
        ${rec.shipping_postal}, ${rec.shipping_country}, ${rec.shipping_phone}, ${rec.shipping_email}, ${rec.shipping_notes},
        ${JSON.stringify(rec.collaboration_products)}, ${JSON.stringify(rec.hub_core_overrides || {})}
      )
    `;
    return applyKolCoreOverrides(rec);
  }

  const store = readFileStore();
  store.records.push(rec);
  writeFileStore(store.records, store.meta);
  return applyKolCoreOverrides(rec);
}

export async function createKolPoolRecord(body = {}) {
  const channelName = String(body.channel_name || '').trim();
  if (!channelName) {
    const err = new Error('channel_name_required');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const payload = {
    ...pickKolCorePatch(body),
    ...pickKolHubPatch(body),
  };

  const record = normalizeKolPoolRecord({
    notion_page_id: `${HUB_NATIVE_KOL_PREFIX}${randomUUID()}`,
    channel_name: channelName,
    tags: payload.tags || 'stored',
    description: payload.description || '',
    links: payload.links || '',
    main_platform: payload.main_platform || '',
    country: payload.country || '',
    kol_category: payload.kol_category || '',
    outreach_status: payload.outreach_status || '',
    notion_url: '',
    synced_at: now,
    shipping_line1: payload.shipping_line1 || '',
    shipping_line2: payload.shipping_line2 || '',
    shipping_city: payload.shipping_city || '',
    shipping_state: payload.shipping_state || '',
    shipping_postal: payload.shipping_postal || '',
    shipping_country: payload.shipping_country || '',
    shipping_phone: payload.shipping_phone || '',
    shipping_email: payload.shipping_email || '',
    shipping_notes: payload.shipping_notes || '',
    collaboration_products: payload.collaboration_products || [],
    hub_core_overrides: {},
  });

  return insertKolRecord(record);
}

export async function updateKolPoolRecord(notionPageId, patchIn = {}) {
  const id = String(notionPageId || '').trim();
  if (!id) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }

  const corePatch = pickKolCorePatch(patchIn);
  const hubPatch = pickKolHubPatch(patchIn);
  if (!Object.keys(corePatch).length && !Object.keys(hubPatch).length) {
    const err = new Error('empty_patch');
    err.status = 400;
    throw err;
  }

  const existing = await getKolPoolRecord(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  let hubCoreOverrides = { ...(existing.hub_core_overrides || {}) };
  if (!isHubNativeKol(id) && Object.keys(corePatch).length) {
    hubCoreOverrides = { ...hubCoreOverrides, ...corePatch };
  }

  const merged = normalizeKolPoolRecord({
    ...existing,
    ...corePatch,
    ...hubPatch,
    hub_core_overrides: isHubNativeKol(id) ? {} : hubCoreOverrides,
  });

  if (useDatabase()) {
    await ensureTables();
    await sql()`
      UPDATE hub_kol_pool SET
        channel_name = ${merged.channel_name},
        description = ${merged.description},
        links = ${merged.links},
        main_platform = ${merged.main_platform},
        country = ${merged.country},
        kol_category = ${merged.kol_category},
        tags = ${merged.tags},
        outreach_status = ${merged.outreach_status},
        shipping_line1 = ${merged.shipping_line1},
        shipping_line2 = ${merged.shipping_line2},
        shipping_city = ${merged.shipping_city},
        shipping_state = ${merged.shipping_state},
        shipping_postal = ${merged.shipping_postal},
        shipping_country = ${merged.shipping_country},
        shipping_phone = ${merged.shipping_phone},
        shipping_email = ${merged.shipping_email},
        shipping_notes = ${merged.shipping_notes},
        collaboration_products = ${JSON.stringify(merged.collaboration_products)},
        hub_core_overrides = ${JSON.stringify(merged.hub_core_overrides || {})}
      WHERE notion_page_id = ${id}
    `;
    return applyKolCoreOverrides(merged);
  }

  const store = readFileStore();
  const idx = store.records.findIndex(r => r.notion_page_id === id);
  store.records[idx] = merged;
  writeFileStore(store.records, store.meta);
  return applyKolCoreOverrides(merged);
}

/** @deprecated use updateKolPoolRecord */
export async function updateKolPoolHubFields(notionPageId, patchIn = {}) {
  return updateKolPoolRecord(notionPageId, patchIn);
}

async function upsertNotionRecord(rec, persistedById) {
  const persisted = persistedById.get(rec.notion_page_id) || {};
  const overrides = parseHubCoreOverrides(persisted.hub_core_overrides);
  const merged = normalizeKolPoolRecord({
    ...rec,
    ...pickHubFields(persisted),
    ...overrides,
    hub_core_overrides: overrides,
    synced_at: rec.synced_at,
  });

  await sql()`
    INSERT INTO hub_kol_pool (
      notion_page_id, channel_name, description, links,
      main_platform, country, kol_category, tags,
      outreach_status, notion_url, synced_at,
      shipping_line1, shipping_line2, shipping_city, shipping_state,
      shipping_postal, shipping_country, shipping_phone, shipping_email, shipping_notes,
      collaboration_products, hub_core_overrides
    ) VALUES (
      ${merged.notion_page_id}, ${merged.channel_name}, ${merged.description}, ${merged.links},
      ${merged.main_platform}, ${merged.country}, ${merged.kol_category}, ${merged.tags},
      ${merged.outreach_status}, ${merged.notion_url}, ${merged.synced_at},
      ${merged.shipping_line1}, ${merged.shipping_line2}, ${merged.shipping_city}, ${merged.shipping_state},
      ${merged.shipping_postal}, ${merged.shipping_country}, ${merged.shipping_phone}, ${merged.shipping_email}, ${merged.shipping_notes},
      ${JSON.stringify(merged.collaboration_products)}, ${JSON.stringify(merged.hub_core_overrides || {})}
    )
    ON CONFLICT (notion_page_id) DO UPDATE SET
      channel_name = EXCLUDED.channel_name,
      description = EXCLUDED.description,
      links = EXCLUDED.links,
      main_platform = EXCLUDED.main_platform,
      country = EXCLUDED.country,
      kol_category = EXCLUDED.kol_category,
      tags = EXCLUDED.tags,
      outreach_status = EXCLUDED.outreach_status,
      notion_url = EXCLUDED.notion_url,
      synced_at = EXCLUDED.synced_at,
      hub_core_overrides = EXCLUDED.hub_core_overrides
  `;

  return applyKolCoreOverrides(merged);
}

export async function syncKolPoolFromNotion(actorName = '') {
  if (!notionConfigured()) {
    const err = new Error('notion_not_configured');
    err.status = 503;
    throw err;
  }

  const syncedAt = new Date().toISOString();
  let records;

  try {
    records = await fetchAllKolFromNotion();
  } catch (e) {
    const meta = {
      ...(await listKolPoolRecords()).meta,
      last_error: formatNotionSyncError(e),
    };
    if (useDatabase()) await writeMetaDb(meta);
    else {
      const store = readFileStore();
      writeFileStore(store.records, meta);
    }
    throw e;
  }

  const notionIds = new Set(records.map(r => r.notion_page_id));

  const meta = normalizeMeta({
    last_synced_at: syncedAt,
    last_synced_by: String(actorName || ''),
    record_count: records.length,
    last_error: '',
  });

  if (useDatabase()) {
    await ensureTables();
    const existingRows = await sql()`SELECT * FROM hub_kol_pool`;
    const persistedById = new Map(
      existingRows.map(row => [row.notion_page_id, pickPersistedHubState(rowToRecord(row))])
    );

    const normalized = await mapInChunks(records, 25, async rec => {
      const notionRec = { ...rec, synced_at: syncedAt };
      const persisted = persistedById.get(rec.notion_page_id) || {};
      const overrides = parseHubCoreOverrides(persisted.hub_core_overrides);
      const merged = normalizeKolPoolRecord({
        ...notionRec,
        ...pickHubFields(persisted),
        ...overrides,
        hub_core_overrides: overrides,
      });
      await upsertNotionRecord(notionRec, persistedById);
      return applyKolCoreOverrides(merged);
    });

    const hubNativeRows = existingRows.filter(row => isHubNativeKol(row.notion_page_id));
    for (const row of hubNativeRows) {
      normalized.push(rowToRecord(row));
    }

    const staleIds = [...persistedById.keys()].filter(
      id => !notionIds.has(id) && !isHubNativeKol(id)
    );
    if (staleIds.length) {
      await sql`DELETE FROM hub_kol_pool WHERE notion_page_id = ANY(${staleIds})`;
    }

    await writeMetaDb(meta);
    return { records: normalized, meta };
  }

  const store = readFileStore();
  const hubNatives = store.records.filter(r => isHubNativeKol(r));
  const persistedById = new Map(
    store.records.map(r => [r.notion_page_id, pickPersistedHubState(r)])
  );
  const normalized = records.map(rec => {
    const persisted = persistedById.get(rec.notion_page_id) || {};
    const overrides = parseHubCoreOverrides(persisted.hub_core_overrides);
    return applyKolCoreOverrides(
      normalizeKolPoolRecord({
        ...rec,
        ...pickHubFields(persisted),
        ...overrides,
        hub_core_overrides: overrides,
        synced_at: syncedAt,
      })
    );
  });
  const mergedRecords = [...hubNatives.map(r => applyKolCoreOverrides(r)), ...normalized];
  writeFileStore(mergedRecords, meta);
  return { records: mergedRecords, meta };
}

export function isKolPoolConfigured() {
  return notionConfigured();
}
