import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase, withNeonRetry } from '@/lib/neon-sql';
import { collectDescendantIds, normalizePage, FINEACOUSTIC_WIKI_DEPARTMENT } from '@/lib/knowledge';
import { DEPARTMENT_IDS } from '@/lib/internal';
import {
  FINEACOUSTIC_WIKI_SEED,
  isFinecousticWikiPlaceholderContent,
  patchFinecousticWikiContent,
  RETIRED_FINEACOUSTIC_WIKI_TITLES,
} from '@/lib/finecoustic-wiki-seed';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'knowledge-pages.json');

let tableReady = false;
let tableReadyPromise = null;

function useDatabase() {
  return hasDatabase();
}

function sql() {
  const client = getNeonSql();
  if (!client) throw new Error('DATABASE_URL not configured');
  return client;
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = withNeonRetry(async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS knowledge_pages (
          id TEXT PRIMARY KEY,
          department TEXT NOT NULL,
          parent_id TEXT,
          title TEXT NOT NULL DEFAULT 'Untitled',
          content TEXT NOT NULL DEFAULT '',
          sort_order INT NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql()`CREATE INDEX IF NOT EXISTS knowledge_pages_dept_idx ON knowledge_pages (department)`;
      await sql()`CREATE INDEX IF NOT EXISTS knowledge_pages_parent_idx ON knowledge_pages (parent_id)`;
      await sql()`ALTER TABLE knowledge_pages ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT ''`;
      tableReady = true;
    }).catch(err => {
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
    updated_by: row.updated_by,
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
    try {
      await ensureTable();
      const rows = await withNeonRetry(() => sql()`
        SELECT id, department, parent_id, title, content, sort_order, created_by, updated_by, created_at, updated_at
        FROM knowledge_pages
        ORDER BY sort_order ASC, title ASC
      `);
      return rows.map(rowToPage);
    } catch (err) {
      console.error('[knowledge-data] database unavailable, using file fallback', err);
    }
  }
  return readFileStore();
}

async function writeOne(page) {
  const normalized = normalizePage(page);
  if (useDatabase()) {
    try {
      await ensureTable();
      await withNeonRetry(() => sql()`
        INSERT INTO knowledge_pages (
          id, department, parent_id, title, content, sort_order, created_by, updated_by, created_at, updated_at
        ) VALUES (
          ${normalized.id},
          ${normalized.department},
          ${normalized.parent_id},
          ${normalized.title},
          ${normalized.content},
          ${normalized.sort_order},
          ${normalized.created_by},
          ${normalized.updated_by},
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
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `);
      return normalized;
    } catch (err) {
      console.error('[knowledge-data] writeOne database unavailable, using file fallback', err);
    }
  }

  const pages = readFileStore();
  const idx = pages.findIndex(p => p.id === normalized.id);
  if (idx === -1) pages.push(normalized);
  else pages[idx] = normalized;
  writeFileStore(pages);
  return normalized;
}

function assertDepartment(department) {
  const allowed = [...DEPARTMENT_IDS, FINEACOUSTIC_WIKI_DEPARTMENT];
  if (!allowed.includes(department)) {
    const err = new Error('invalid_department');
    err.status = 400;
    throw err;
  }
}

/** Seed or refresh canonical wiki pages (by title). Updates placeholder stubs only. */
export async function ensureFinecousticWikiSeed(actorName = 'Fine Teams') {
  const existing = await listPagesForDepartment(FINEACOUSTIC_WIKI_DEPARTMENT);
  const byTitle = new Map(existing.map(p => [p.title.trim().toLowerCase(), p]));
  const actor = { displayName: actorName };
  const result = [];

  for (const seed of FINEACOUSTIC_WIKI_SEED) {
    const key = seed.title.trim().toLowerCase();
    const found = byTitle.get(key);

    if (!found) {
      const page = await createPage(
        {
          department: FINEACOUSTIC_WIKI_DEPARTMENT,
          title: seed.title,
          content: seed.content,
          sort_order: seed.sort_order,
        },
        actor
      );
      result.push(page);
      byTitle.set(key, page);
      continue;
    }

    const patch = {};
    if (isFinecousticWikiPlaceholderContent(found.content) && seed.content) {
      patch.content = seed.content;
    } else {
      const cleaned = patchFinecousticWikiContent(seed.title, found.content);
      if (cleaned !== found.content) patch.content = cleaned;
    }
    if (Number.isFinite(seed.sort_order) && found.sort_order !== seed.sort_order) {
      patch.sort_order = seed.sort_order;
    }

    if (Object.keys(patch).length) {
      const updated = await updatePage(found.id, patch, actor);
      result.push(updated);
    } else {
      result.push(found);
    }
  }

  const current = await listPagesForDepartment(FINEACOUSTIC_WIKI_DEPARTMENT);
  for (const page of current) {
    const key = page.title.trim().toLowerCase();
    if (!RETIRED_FINEACOUSTIC_WIKI_TITLES.has(key)) continue;
    await deletePage(page.id);
  }

  return result.length ? result : existing;
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
      sort_order: Number.isFinite(input.sort_order) ? input.sort_order : siblings.length,
      created_by: actor.displayName,
      updated_by: actor.displayName,
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
      updated_by: actor.displayName,
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
    try {
      await ensureTable();
      for (const removeId of removeIds) {
        await withNeonRetry(() => sql()`DELETE FROM knowledge_pages WHERE id = ${removeId}`);
      }
      return { deleted: removeIds.size };
    } catch (err) {
      console.error('[knowledge-data] deletePage database unavailable, using file fallback', err);
    }
  }

  const pages = readFileStore().filter(p => !removeIds.has(p.id));
  writeFileStore(pages);
  return { deleted: removeIds.size };
}
