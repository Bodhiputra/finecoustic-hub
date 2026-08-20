import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { normalizeCampaignKolEntry } from '@/lib/campaign-kol';
import { getKolPoolRecord, listKolPoolRecords } from '@/lib/kol-pool-data';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-campaign-kol.json');

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
      CREATE TABLE IF NOT EXISTS hub_campaign_kol (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        kol_notion_page_id TEXT NOT NULL,
        pipeline_status TEXT NOT NULL DEFAULT 'not_started',
        deal_type TEXT NOT NULL DEFAULT '',
        approach_date DATE,
        socials_approached JSONB NOT NULL DEFAULT '[]'::jsonb,
        shipping_date DATE,
        tracking_link TEXT NOT NULL DEFAULT '',
        arrival_date DATE,
        publish_status TEXT NOT NULL DEFAULT 'not_published',
        notes TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (campaign_id, kol_notion_page_id)
      )
    `
      .then(() => sql()`
        CREATE INDEX IF NOT EXISTS hub_campaign_kol_campaign_idx ON hub_campaign_kol (campaign_id)
      `)
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
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ entries: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.entries) ? raw.entries.map(normalizeCampaignKolEntry) : [];
}

function writeFileStore(entries) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ entries }, null, 2));
}

function rowToEntry(row, kol = null) {
  return normalizeCampaignKolEntry({
    id: row.id,
    campaign_id: row.campaign_id,
    kol_notion_page_id: row.kol_notion_page_id,
    pipeline_status: row.pipeline_status,
    deal_type: row.deal_type,
    approach_date: row.approach_date,
    socials_approached: row.socials_approached,
    shipping_date: row.shipping_date,
    tracking_link: row.tracking_link,
    arrival_date: row.arrival_date,
    publish_status: row.publish_status,
    notes: row.notes,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    kol,
  });
}

async function attachKolRecords(entries) {
  const { records } = await listKolPoolRecords();
  const byId = new Map(records.map(r => [r.notion_page_id, r]));
  return entries.map(e => {
    const kolId = e.kol_notion_page_id;
    return rowToEntry(e, byId.get(kolId) || null);
  });
}

export async function listCampaignKolEntries(campaignId) {
  const cid = String(campaignId || '').trim();
  if (!cid) return [];

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_campaign_kol
      WHERE campaign_id = ${cid}
      ORDER BY sort_order ASC, created_at ASC
    `;
    return attachKolRecords(rows);
  }

  const entries = readFileStore().filter(e => e.campaign_id === cid);
  return attachKolRecords(entries);
}

export async function addCampaignKolFromPool(campaignId, kolNotionPageIds = []) {
  const cid = String(campaignId || '').trim();
  const ids = [...new Set(kolNotionPageIds.map(id => String(id || '').trim()).filter(Boolean))];
  if (!cid || !ids.length) {
    const err = new Error('invalid_payload');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const created = [];

  for (const kolId of ids) {
    const kol = await getKolPoolRecord(kolId);
    if (!kol) continue;

    const entry = normalizeCampaignKolEntry({
      id: randomUUID(),
      campaign_id: cid,
      kol_notion_page_id: kolId,
      pipeline_status: 'not_started',
      publish_status: 'not_published',
      sort_order: created.length,
      created_at: now,
      updated_at: now,
      kol,
    });

    if (useDatabase()) {
      await ensureTables();
      try {
        await sql()`
          INSERT INTO hub_campaign_kol (
            id, campaign_id, kol_notion_page_id, pipeline_status, deal_type,
            approach_date, socials_approached, shipping_date, tracking_link,
            arrival_date, publish_status, notes, sort_order, created_at, updated_at
          ) VALUES (
            ${entry.id}, ${entry.campaign_id}, ${entry.kol_notion_page_id}, ${entry.pipeline_status},
            ${entry.deal_type}, ${entry.approach_date}, ${JSON.stringify(entry.socials_approached)},
            ${entry.shipping_date}, ${entry.tracking_link}, ${entry.arrival_date},
            ${entry.publish_status}, ${entry.notes}, ${entry.sort_order}, ${entry.created_at}, ${entry.updated_at}
          )
        `;
        created.push(entry);
      } catch (e) {
        if (!String(e?.message || '').includes('hub_campaign_kol_campaign_id_kol_notion_page_id_key')) {
          throw e;
        }
      }
    } else {
      const all = readFileStore();
      if (all.some(e => e.campaign_id === cid && e.kol_notion_page_id === kolId)) continue;
      all.push(entry);
      writeFileStore(all);
      created.push(entry);
    }
  }

  return created;
}

export async function updateCampaignKolEntry(entryId, patchIn = {}) {
  const id = String(entryId || '').trim();
  if (!id) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`SELECT * FROM hub_campaign_kol WHERE id = ${id} LIMIT 1`;
    if (!rows.length) {
      const err = new Error('not_found');
      err.status = 404;
      throw err;
    }
    const current = rowToEntry(rows[0]);
    const merged = normalizeCampaignKolEntry({ ...current, ...patchIn, id, updated_at: new Date().toISOString() });

    await sql()`
      UPDATE hub_campaign_kol SET
        pipeline_status = ${merged.pipeline_status},
        deal_type = ${merged.deal_type},
        approach_date = ${merged.approach_date},
        socials_approached = ${JSON.stringify(merged.socials_approached)},
        shipping_date = ${merged.shipping_date},
        tracking_link = ${merged.tracking_link},
        arrival_date = ${merged.arrival_date},
        publish_status = ${merged.publish_status},
        notes = ${merged.notes},
        sort_order = ${merged.sort_order},
        updated_at = ${merged.updated_at}
      WHERE id = ${id}
    `;

    const kol = await getKolPoolRecord(merged.kol_notion_page_id);
    return normalizeCampaignKolEntry({ ...merged, kol });
  }

  const all = readFileStore();
  const idx = all.findIndex(e => e.id === id);
  if (idx < 0) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const merged = normalizeCampaignKolEntry({
    ...all[idx],
    ...patchIn,
    id,
    updated_at: new Date().toISOString(),
  });
  all[idx] = merged;
  writeFileStore(all);
  const kol = await getKolPoolRecord(merged.kol_notion_page_id);
  return normalizeCampaignKolEntry({ ...merged, kol });
}

export async function deleteCampaignKolByCampaignId(campaignId) {
  const cid = String(campaignId || '').trim();
  if (!cid) return 0;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`DELETE FROM hub_campaign_kol WHERE campaign_id = ${cid} RETURNING id`;
    return rows.length;
  }

  const all = readFileStore();
  const next = all.filter(e => e.campaign_id !== cid);
  const removed = all.length - next.length;
  if (removed) writeFileStore(next);
  return removed;
}

export async function deleteCampaignKolEntry(entryId) {
  const id = String(entryId || '').trim();
  if (!id) return false;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`DELETE FROM hub_campaign_kol WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }

  const all = readFileStore();
  const next = all.filter(e => e.id !== id);
  if (next.length === all.length) return false;
  writeFileStore(next);
  return true;
}
