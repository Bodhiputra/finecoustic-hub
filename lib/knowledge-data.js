import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { collectDescendantIds, normalizePage } from '@/lib/knowledge';
import { DEPARTMENT_IDS } from '@/lib/internal';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'knowledge-pages.json');

let tableReady = false;
let tableReadyPromise = null;

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS knowledge_pages (
        id TEXT PRIMARY KEY,
        department TEXT NOT NULL,
        parent_id TEXT,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS knowledge_pages_dept_idx ON knowledge_pages (department)`;
        await sql()`CREATE INDEX IF NOT EXISTS knowledge_pages_parent_idx ON knowledge_pages (parent_id)`;
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

function rowToPage(row) {
  return normalizePage({
    id: row.id,
    department: row.department,
    parent_id: row.parent_id,
    title: row.title,
    content: row.content,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ pages: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.pages) ? raw.pages.map(p => normalizePage(p)) : [];
}

function writeFileStore(pages) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ pages }, null, 2));
}

async function readAllRaw() {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, department, parent_id, title, content, sort_order, created_by, created_at, updated_at
      FROM knowledge_pages
      ORDER BY sort_order ASC, title ASC
    `;
    return rows.map(rowToPage);
  }
  return readFileStore();
}

async function writeOne(page) {
  const normalized = normalizePage(page);
  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO knowledge_pages (
        id, department, parent_id, title, content, sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id},
        ${normalized.department},
        ${normalized.parent_id},
        ${normalized.title},
        ${normalized.content},
        ${normalized.sort_order},
        ${normalized.created_by},
        ${normalized.created_at},
        ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        department = EXCLUDED.department,
        parent_id = EXCLUDED.parent_id,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        sort_order = EXCLUDED.sort_order,
        created_by = EXCLUDED.created_by,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const pages = readFileStore();
    const idx = pages.findIndex(p => p.id === normalized.id);
    if (idx === -1) pages.push(normalized);
    else pages[idx] = normalized;
    writeFileStore(pages);
  }
  return normalized;
}

function assertDepartment(department) {
  if (!DEPARTMENT_IDS.includes(department)) {
    const err = new Error('invalid_department');
    err.status = 400;
    throw err;
  }
}

export async function listPagesForDepartment(department) {
  assertDepartment(department);
  const all = await readAllRaw();
  return all
    .filter(p => p.department === department)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

export async function getPageById(id) {
  const all = await readAllRaw();
  return all.find(p => p.id === id) || null;
}

export async function createPage(input, actor) {
  const department = String(input.department || '');
  assertDepartment(department);

  const parentId = input.parent_id ? String(input.parent_id) : null;
  if (parentId) {
    const parent = await getPageById(parentId);
    if (!parent || parent.department !== department) {
      const err = new Error('invalid_parent');
      err.status = 400;
      throw err;
    }
  }

  const now = new Date().toISOString();
  const siblings = (await listPagesForDepartment(department)).filter(
    p => (p.parent_id || null) === parentId
  );
  const page = normalizePage(
    {
      id: randomUUID(),
      department,
      parent_id: parentId,
      title: input.title || 'Untitled',
      content: input.content || '',
      sort_order: siblings.length,
      created_by: actor.displayName,
      created_at: now,
      updated_at: now,
    },
    actor.displayName
  );

  return writeOne(page);
}

export async function updatePage(id, patch, actor) {
  const existing = await getPageById(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  let parentId = existing.parent_id;
  if (patch.parent_id !== undefined) {
    parentId = patch.parent_id ? String(patch.parent_id) : null;
    if (parentId === id) {
      const err = new Error('invalid_parent');
      err.status = 400;
      throw err;
    }
    if (parentId) {
      const parent = await getPageById(parentId);
      if (!parent || parent.department !== existing.department) {
        const err = new Error('invalid_parent');
        err.status = 400;
        throw err;
      }
      const descendants = collectDescendantIds(await listPagesForDepartment(existing.department), id);
      if (descendants.has(parentId)) {
        const err = new Error('invalid_parent');
        err.status = 400;
        throw err;
      }
    }
  }

  const next = normalizePage(
    {
      ...existing,
      ...patch,
      id: existing.id,
      department: existing.department,
      parent_id: parentId,
      updated_at: now,
      created_by: existing.created_by || actor.displayName,
    },
    actor.displayName
  );

  return writeOne(next);
}

export async function deletePage(id) {
  const existing = await getPageById(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const all = await listPagesForDepartment(existing.department);
  const removeIds = collectDescendantIds(all, id);

  if (useDatabase()) {
    await ensureTable();
    for (const removeId of removeIds) {
      await sql()`DELETE FROM knowledge_pages WHERE id = ${removeId}`;
    }
  } else {
    const pages = readFileStore().filter(p => !removeIds.has(p.id));
    writeFileStore(pages);
  }

  return { deleted: removeIds.size };
}
