import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { normalizeBoard, normalizeCampaign } from '@/lib/internal-campaigns';
import { normalizeDepartmentId } from '@/lib/internal';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'internal-campaigns.json');

let tablesReady = false;
let tablesReadyPromise = null;

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTables() {
  if (tablesReady) return;
  if (!tablesReadyPromise) {
    tablesReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS internal_campaigns (
        id TEXT PRIMARY KEY,
        department TEXT NOT NULL DEFAULT 'marketing',
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        flow_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS internal_boards (
          id TEXT PRIMARY KEY,
          campaign_id TEXT,
          department TEXT NOT NULL DEFAULT 'marketing',
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          kanban_only BOOLEAN NOT NULL DEFAULT TRUE,
          status_columns JSONB NOT NULL DEFAULT '["todo","in_progress","in_review","done"]'::jsonb,
          sort_order INT NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS internal_campaigns_dept_idx ON internal_campaigns (department)`;
        await sql()`CREATE INDEX IF NOT EXISTS internal_boards_campaign_idx ON internal_boards (campaign_id)`;
        await sql()`CREATE INDEX IF NOT EXISTS internal_boards_dept_idx ON internal_boards (department)`;
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
    writeFileSync(FILE, JSON.stringify({ campaigns: [], boards: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  const campaigns = Array.isArray(raw?.campaigns) ? raw.campaigns.map(c => normalizeCampaign(c)) : [];
  const boards = Array.isArray(raw?.boards) ? raw.boards.map(b => normalizeBoard(b)) : [];
  return { campaigns, boards };
}

function writeFileStore({ campaigns, boards }) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ campaigns, boards }, null, 2));
}

function rowToCampaign(row) {
  return normalizeCampaign({
    id: row.id,
    department: row.department,
    name: row.name,
    description: row.description,
    flow_enabled: row.flow_enabled,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function rowToBoard(row) {
  return normalizeBoard({
    id: row.id,
    campaign_id: row.campaign_id,
    department: row.department,
    name: row.name,
    description: row.description,
    kanban_only: row.kanban_only,
    status_columns: row.status_columns,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function readAllCampaignsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT id, department, name, description, flow_enabled, sort_order, created_by, created_at, updated_at
      FROM internal_campaigns
      ORDER BY sort_order ASC, name ASC
    `;
    return rows.map(rowToCampaign);
  }
  return readFileStore().campaigns;
}

async function readAllBoardsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT id, campaign_id, department, name, description, kanban_only, status_columns, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      ORDER BY sort_order ASC, name ASC
    `;
    return rows.map(rowToBoard);
  }
  return readFileStore().boards;
}

async function writeCampaign(campaign) {
  const normalized = normalizeCampaign(campaign);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO internal_campaigns (
        id, department, name, description, flow_enabled, sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id}, ${normalized.department}, ${normalized.name}, ${normalized.description},
        ${normalized.flow_enabled}, ${normalized.sort_order}, ${normalized.created_by},
        ${normalized.created_at}, ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        department = EXCLUDED.department,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        flow_enabled = EXCLUDED.flow_enabled,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const store = readFileStore();
    const idx = store.campaigns.findIndex(c => c.id === normalized.id);
    if (idx === -1) store.campaigns.push(normalized);
    else store.campaigns[idx] = normalized;
    writeFileStore(store);
  }
  return normalized;
}

async function writeBoard(board) {
  const normalized = normalizeBoard(board);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO internal_boards (
        id, campaign_id, department, name, description, kanban_only, status_columns,
        sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id}, ${normalized.campaign_id}, ${normalized.department}, ${normalized.name},
        ${normalized.description}, ${normalized.kanban_only}, ${JSON.stringify(normalized.status_columns)}::jsonb,
        ${normalized.sort_order}, ${normalized.created_by}, ${normalized.created_at}, ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        campaign_id = EXCLUDED.campaign_id,
        department = EXCLUDED.department,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        kanban_only = EXCLUDED.kanban_only,
        status_columns = EXCLUDED.status_columns,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const store = readFileStore();
    const idx = store.boards.findIndex(b => b.id === normalized.id);
    if (idx === -1) store.boards.push(normalized);
    else store.boards[idx] = normalized;
    writeFileStore(store);
  }
  return normalized;
}

function sortCampaigns(items) {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function sortBoards(items) {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

export async function listCampaigns({ department } = {}) {
  const dept = department ? normalizeDepartmentId(department) : '';
  let campaigns = await readAllCampaignsRaw();
  if (dept) campaigns = campaigns.filter(c => c.department === dept);
  const boards = await readAllBoardsRaw();
  const boardsByCampaign = new Map();
  for (const board of sortBoards(boards)) {
    if (dept && board.department !== dept) continue;
    const key = board.campaign_id || '';
    if (!boardsByCampaign.has(key)) boardsByCampaign.set(key, []);
    boardsByCampaign.get(key).push(board);
  }
  return sortCampaigns(campaigns).map(campaign => ({
    ...campaign,
    boards: boardsByCampaign.get(campaign.id) || [],
  }));
}

export async function getCampaignById(id) {
  const campaigns = await readAllCampaignsRaw();
  const campaign = campaigns.find(c => c.id === id);
  if (!campaign) return null;
  const boards = sortBoards((await readAllBoardsRaw()).filter(b => b.campaign_id === id));
  return { ...campaign, boards };
}

export async function getBoardById(id) {
  const boards = await readAllBoardsRaw();
  const board = boards.find(b => b.id === id);
  if (!board) return null;
  if (!board.campaign_id) return { ...board, campaign: null };
  const campaigns = await readAllCampaignsRaw();
  const campaign = campaigns.find(c => c.id === board.campaign_id) || null;
  return { ...board, campaign };
}

export async function createCampaign(input, actor) {
  const name = String(input?.name || '').trim();
  if (!name) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  return writeCampaign({
    id: randomUUID(),
    department: input?.department || 'marketing',
    name,
    description: input?.description || '',
    flow_enabled: Boolean(input?.flow_enabled),
    sort_order: Number(input?.sort_order) || 0,
    created_by: actor?.displayName || '',
    created_at: now,
    updated_at: now,
  });
}

export async function createBoard(input, actor) {
  const name = String(input?.name || '').trim();
  if (!name) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  const campaignId = input?.campaign_id ? String(input.campaign_id) : null;
  if (campaignId) {
    const campaign = (await readAllCampaignsRaw()).find(c => c.id === campaignId);
    if (!campaign) {
      const err = new Error('campaign_not_found');
      err.status = 404;
      throw err;
    }
  }
  const now = new Date().toISOString();
  return writeBoard({
    id: randomUUID(),
    campaign_id: campaignId,
    department: input?.department || 'marketing',
    name,
    description: input?.description || '',
    kanban_only: input?.kanban_only !== false,
    status_columns: input?.status_columns,
    sort_order: Number(input?.sort_order) || 0,
    created_by: actor?.displayName || '',
    created_at: now,
    updated_at: now,
  });
}

export async function updateCampaign(id, patch) {
  const campaigns = await readAllCampaignsRaw();
  const existing = campaigns.find(c => c.id === id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const now = new Date().toISOString();
  return writeCampaign({
    ...existing,
    ...patch,
    id: existing.id,
    updated_at: now,
  });
}

export async function deleteCampaign(id) {
  const campaigns = await readAllCampaignsRaw();
  const existing = campaigns.find(c => c.id === id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  if (useDatabase()) {
    await ensureTables();
    await sql()`DELETE FROM internal_boards WHERE campaign_id = ${id}`;
    await sql()`DELETE FROM internal_campaigns WHERE id = ${id}`;
  } else {
    const store = readFileStore();
    store.campaigns = store.campaigns.filter(c => c.id !== id);
    store.boards = store.boards.filter(b => b.campaign_id !== id);
    writeFileStore(store);
  }
  return true;
}
