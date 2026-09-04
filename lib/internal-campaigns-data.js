import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase, withNeonRetry } from '@/lib/neon-sql';
import { normalizeBoard, normalizeCampaign, normalizeFlowData, normalizeStatusColumns, ensureWorkflowStatusColumns } from '@/lib/internal-campaigns';
import { normalizeMapMode } from '@/lib/framework-map';
import { isMarketingKolOutreachScope } from '@/lib/campaign-kol';
import { syncBoardNameInFlow } from '@/lib/campaign-flow-utils';
import { normalizeBoardProperties } from '@/lib/board-properties';
import { deleteCampaignKolByCampaignId } from '@/lib/campaign-kol-data';
import { ALL_DEPARTMENTS_ID, normalizeDepartmentId, PERSONAL_DEPARTMENT_ID } from '@/lib/internal';
import { personKey } from '@/lib/appdev';
import { clearTasksBoardId } from '@/lib/internal-board-tasks';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'internal-campaigns.json');

let tablesReady = false;
let tablesReadyPromise = null;

function useDatabase() {
  return hasDatabase();
}

function sql() {
  return getNeonSql();
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
        flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
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
        await sql()`ALTER TABLE internal_campaigns ADD COLUMN IF NOT EXISTS flow_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb`;
        await sql()`ALTER TABLE internal_boards ADD COLUMN IF NOT EXISTS custom_properties JSONB NOT NULL DEFAULT '[]'::jsonb`;
        await sql()`ALTER TABLE internal_boards ADD COLUMN IF NOT EXISTS owner_key TEXT NOT NULL DEFAULT ''`;
        await sql()`CREATE INDEX IF NOT EXISTS internal_boards_owner_idx ON internal_boards (owner_key)`;
        await sql()`ALTER TABLE internal_campaigns ADD COLUMN IF NOT EXISTS map_mode TEXT NOT NULL DEFAULT 'workflow'`;
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
    flow_data: row.flow_data,
    map_mode: row.map_mode,
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
    owner_key: row.owner_key,
    name: row.name,
    description: row.description,
    kanban_only: row.kanban_only,
    status_columns: row.status_columns,
    custom_properties: row.custom_properties,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function readAllCampaignsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, department, name, description, flow_enabled, flow_data, map_mode, sort_order, created_by, created_at, updated_at
      FROM internal_campaigns
      ORDER BY sort_order ASC, name ASC
    `);
    return rows.map(rowToCampaign);
  }
  return readFileStore().campaigns;
}

async function readCampaignByIdRaw(id) {
  if (!id) return null;
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, department, name, description, flow_enabled, flow_data, map_mode, sort_order, created_by, created_at, updated_at
      FROM internal_campaigns
      WHERE id = ${id}
      LIMIT 1
    `);
    return rows.length ? rowToCampaign(rows[0]) : null;
  }
  return readFileStore().campaigns.find(c => c.id === id) || null;
}

async function readAllBoardsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      ORDER BY sort_order ASC, name ASC
    `);
    return rows.map(rowToBoard);
  }
  return readFileStore().boards;
}

async function readBoardByIdRaw(id) {
  if (!id) return null;
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      WHERE id = ${id}
      LIMIT 1
    `);
    return rows.length ? rowToBoard(rows[0]) : null;
  }
  return readFileStore().boards.find(b => b.id === id) || null;
}

async function readBoardsByCampaignIdRaw(campaignId) {
  if (!campaignId) return [];
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      WHERE campaign_id = ${campaignId}
      ORDER BY sort_order ASC, name ASC
    `);
    return rows.map(rowToBoard);
  }
  return sortBoards(readFileStore().boards.filter(b => b.campaign_id === campaignId));
}

async function readBoardsForDepartmentRaw(departmentId) {
  const dept = normalizeDepartmentId(departmentId);
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      WHERE department != ${PERSONAL_DEPARTMENT_ID}
        AND (department = ${dept} OR department = ${ALL_DEPARTMENTS_ID})
      ORDER BY sort_order ASC, name ASC
    `);
    return rows.map(rowToBoard);
  }
  return sortBoards(
    readFileStore().boards.filter(
      b => b.department !== PERSONAL_DEPARTMENT_ID
        && (b.department === dept || b.department === ALL_DEPARTMENTS_ID)
    )
  );
}

async function writeCampaign(campaign) {
  const normalized = normalizeCampaign(campaign);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO internal_campaigns (
        id, department, name, description, flow_enabled, flow_data, map_mode, sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id}, ${normalized.department}, ${normalized.name}, ${normalized.description},
        ${normalized.flow_enabled}, ${JSON.stringify(normalized.flow_data)}::jsonb, ${normalized.map_mode}, ${normalized.sort_order}, ${normalized.created_by},
        ${normalized.created_at}, ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        department = EXCLUDED.department,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        flow_enabled = EXCLUDED.flow_enabled,
        flow_data = EXCLUDED.flow_data,
        map_mode = EXCLUDED.map_mode,
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
        id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties,
        sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id}, ${normalized.campaign_id}, ${normalized.department}, ${normalized.owner_key}, ${normalized.name},
        ${normalized.description}, ${normalized.kanban_only}, ${JSON.stringify(normalized.status_columns)}::jsonb,
        ${JSON.stringify(normalized.custom_properties)}::jsonb,
        ${normalized.sort_order}, ${normalized.created_by}, ${normalized.created_at}, ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        campaign_id = EXCLUDED.campaign_id,
        department = EXCLUDED.department,
        owner_key = EXCLUDED.owner_key,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        kanban_only = EXCLUDED.kanban_only,
        status_columns = EXCLUDED.status_columns,
        custom_properties = EXCLUDED.custom_properties,
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

export async function listCampaignsForList({ department } = {}) {
  const dept = department ? normalizeDepartmentId(department) : '';
  if (useDatabase()) {
    await ensureTables();
    const rows = dept
      ? await withNeonRetry(() => sql()`
          SELECT id, department, name, description, flow_enabled, flow_data, map_mode, sort_order, created_by, created_at, updated_at
          FROM internal_campaigns
          WHERE department = ${dept}
          ORDER BY sort_order ASC, name ASC
        `)
      : await withNeonRetry(() => sql()`
          SELECT id, department, name, description, flow_enabled, flow_data, map_mode, sort_order, created_by, created_at, updated_at
          FROM internal_campaigns
          ORDER BY sort_order ASC, name ASC
        `);
    return sortCampaigns(rows.map(rowToCampaign));
  }
  let campaigns = readFileStore().campaigns;
  if (dept) campaigns = campaigns.filter(c => c.department === dept);
  return sortCampaigns(campaigns);
}

export async function listCampaigns({ department } = {}) {
  const dept = department ? normalizeDepartmentId(department) : '';
  const campaigns = await listCampaignsForList({ department: dept || undefined });
  const boards = dept ? await readBoardsForDepartmentRaw(dept) : await readAllBoardsRaw();
  const boardsByCampaign = new Map();
  for (const board of sortBoards(boards)) {
    const key = board.campaign_id || '';
    if (!boardsByCampaign.has(key)) boardsByCampaign.set(key, []);
    boardsByCampaign.get(key).push(board);
  }
  return campaigns.map(campaign => ({
    ...campaign,
    boards: boardsByCampaign.get(campaign.id) || [],
  }));
}

export async function getCampaignById(id) {
  const campaign = await readCampaignByIdRaw(id);
  if (!campaign) return null;
  const boards = sortBoards(await readBoardsByCampaignIdRaw(id));
  return { ...campaign, boards };
}

export async function getBoardById(id) {
  const board = await readBoardByIdRaw(id);
  if (!board) return null;
  if (!board.campaign_id) return { ...board, campaign: null };
  const campaign = await readCampaignByIdRaw(board.campaign_id);
  return { ...board, campaign };
}

/** Boards owned by a department (native + campaign-linked). Includes company-wide (`all`). Excludes personal boards. */
export async function listBoardsForDepartment(departmentId) {
  return readBoardsForDepartmentRaw(departmentId);
}

/** Personal kanban boards owned by the signed-in user. */
export async function listPersonalBoardsForActor(actor) {
  const key = personKey(actor?.displayName);
  if (!key) return [];
  if (useDatabase()) {
    await ensureTables();
    const rows = await withNeonRetry(() => sql()`
      SELECT id, campaign_id, department, owner_key, name, description, kanban_only, status_columns, custom_properties, sort_order, created_by, created_at, updated_at
      FROM internal_boards
      WHERE department = ${PERSONAL_DEPARTMENT_ID}
        AND owner_key = ${key}
      ORDER BY sort_order ASC, name ASC
    `);
    return rows.map(rowToBoard);
  }
  const boards = readFileStore().boards;
  return sortBoards(
    boards.filter(
      b => b.department === PERSONAL_DEPARTMENT_ID && personKey(b.owner_key || b.created_by) === key
    )
  );
}

export function isPersonalBoard(board) {
  return board?.department === PERSONAL_DEPARTMENT_ID || Boolean(board?.owner_key);
}

export function canAccessBoard(actor, board) {
  if (!board) return false;
  if (actor?.isAdmin) return true;
  if (isPersonalBoard(board)) {
    return personKey(board.owner_key || board.created_by) === personKey(actor?.displayName);
  }
  return true;
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
    department: input?.department ? normalizeDepartmentId(input.department) : ALL_DEPARTMENTS_ID,
    name,
    description: input?.description || '',
    flow_enabled: input?.flow_enabled !== false,
    flow_data: normalizeFlowData(input?.flow_data),
    map_mode: input?.map_mode,
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
  const isPersonal = input?.scope === 'personal'
    || input?.department === PERSONAL_DEPARTMENT_ID
    || normalizeDepartmentId(input?.department) === PERSONAL_DEPARTMENT_ID;
  let campaign = null;
  if (campaignId) {
    campaign = await readCampaignByIdRaw(campaignId);
    if (!campaign) {
      const err = new Error('campaign_not_found');
      err.status = 404;
      throw err;
    }
  }
  const now = new Date().toISOString();
  const ownerKey = isPersonal ? personKey(actor?.displayName) : '';
  return writeBoard({
    id: randomUUID(),
    campaign_id: campaignId,
    department: isPersonal
      ? PERSONAL_DEPARTMENT_ID
      : (input?.department
        ? normalizeDepartmentId(input.department)
        : (campaign?.department || ALL_DEPARTMENTS_ID)),
    owner_key: ownerKey,
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
  const existing = await readCampaignByIdRaw(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const next = { ...existing, ...patch, id: existing.id };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('name_required');
      err.status = 400;
      throw err;
    }
    next.name = name.slice(0, 120);
  }
  if (patch.flow_data !== undefined) {
    next.flow_data = normalizeFlowData(patch.flow_data);
  }
  if (patch.flow_enabled !== undefined) {
    next.flow_enabled = Boolean(patch.flow_enabled);
  }
  if (patch.map_mode !== undefined) {
    next.map_mode = normalizeMapMode(patch.map_mode);
  }

  const now = new Date().toISOString();
  return writeCampaign({ ...next, updated_at: now });
}

export async function enableCampaignFlow(id) {
  const existing = await readCampaignByIdRaw(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  if (existing.flow_enabled) {
    return getCampaignById(id);
  }
  const now = new Date().toISOString();
  return writeCampaign({
    ...existing,
    flow_enabled: true,
    flow_data: normalizeFlowData(existing.flow_data),
    updated_at: now,
  });
}

export async function updateBoard(id, patch) {
  const existing = await readBoardByIdRaw(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const next = { ...existing, ...patch, id: existing.id };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('name_required');
      err.status = 400;
      throw err;
    }
    next.name = name.slice(0, 120);
  }
  if (patch.status_columns !== undefined) {
    const outreachBoard = isMarketingKolOutreachScope(id);
    const cols = outreachBoard
      ? normalizeStatusColumns(patch.status_columns)
      : ensureWorkflowStatusColumns(patch.status_columns);
    if (!cols.length) {
      const err = new Error('status_columns_required');
      err.status = 400;
      throw err;
    }
    const maxCols = outreachBoard ? 20 : 12;
    if (cols.length > maxCols) {
      const err = new Error('status_columns_limit');
      err.status = 400;
      throw err;
    }
    next.status_columns = cols;
  }
  if (patch.custom_properties !== undefined) {
    next.custom_properties = normalizeBoardProperties(patch.custom_properties);
  }

  const now = new Date().toISOString();
  const saved = await writeBoard({ ...next, updated_at: now });

  if (patch.name !== undefined && existing.campaign_id && next.name !== existing.name) {
    const campaign = await readCampaignByIdRaw(existing.campaign_id);
    if (campaign) {
      const flow_data = syncBoardNameInFlow(campaign.flow_data, id, next.name);
      if (flow_data !== campaign.flow_data) {
        await writeCampaign({ ...campaign, flow_data, updated_at: now });
      }
    }
  }

  return saved;
}

function stripBoardFromFlowData(flowData, boardId) {
  const data = normalizeFlowData(flowData);
  const nodes = (data.nodes || []).filter(node => {
    if (node?.boardId === boardId) return false;
    if (node?.id === `kanban-${boardId}`) return false;
    return true;
  });
  return { ...data, nodes };
}

export async function deleteBoard(id) {
  const existing = await readBoardByIdRaw(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  await clearTasksBoardId(id);

  if (existing.campaign_id) {
    const campaign = await readCampaignByIdRaw(existing.campaign_id);
    if (campaign) {
      const flow_data = stripBoardFromFlowData(campaign.flow_data, id);
      if (flow_data !== campaign.flow_data) {
        await writeCampaign({ ...campaign, flow_data, updated_at: new Date().toISOString() });
      }
    }
  }

  if (useDatabase()) {
    await ensureTables();
    await sql()`DELETE FROM internal_boards WHERE id = ${id}`;
  } else {
    const store = readFileStore();
    store.boards = store.boards.filter(b => b.id !== id);
    writeFileStore(store);
  }
  return true;
}

export async function deleteCampaign(id) {
  const existing = await readCampaignByIdRaw(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  if (useDatabase()) {
    await ensureTables();
    await deleteCampaignKolByCampaignId(id);
    const campaignBoards = await sql()`SELECT id FROM internal_boards WHERE campaign_id = ${id}`;
    for (const row of campaignBoards || []) {
      await clearTasksBoardId(row.id);
    }
    await sql()`DELETE FROM internal_boards WHERE campaign_id = ${id}`;
    await sql()`DELETE FROM internal_campaigns WHERE id = ${id}`;
  } else {
    await deleteCampaignKolByCampaignId(id);
    const store = readFileStore();
    const boardIds = store.boards.filter(b => b.campaign_id === id).map(b => b.id);
    for (const boardId of boardIds) {
      await clearTasksBoardId(boardId);
    }
    store.campaigns = store.campaigns.filter(c => c.id !== id);
    store.boards = store.boards.filter(b => b.campaign_id !== id);
    writeFileStore(store);
  }
  return true;
}

/** Insert or update a board with a fixed id (system seeds). */
export async function writeBoardSeed(board) {
  return writeBoard(board);
}
