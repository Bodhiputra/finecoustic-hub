import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { emptyBoard, normalizeBoard, STATUSES, PRIORITIES, ISSUE_TYPES, touchPeople, formatIssueId, normalizeComment, parseIssueDatePatch, mergePeople, personKey } from './appdev';
import { normalizeImageUrls, normalizeVideoUrls } from './appdev-media';
import { normalizeWorkers, getIssueWorkers, hasWorkers, workersInPool } from './appdev-workers';
import { validateIssueUpdate, canDeleteIssue, canCommentOnIssue, isTaskOwner } from './appdev-task-permissions';
import { listAssignablePeople } from './appdev-users';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const FILE = join(DATA_DIR, 'appdev-board.json');
const TEMPLATE = join(DATA_DIR, '_template', 'appdev-board.json');
const DB_KEY = 'default';

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

function ensureDataFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    if (existsSync(TEMPLATE)) {
      copyFileSync(TEMPLATE, FILE);
    } else {
      writeFileSync(FILE, JSON.stringify(emptyBoard(), null, 2));
    }
  }
}

function readFileStore() {
  ensureDataFile();
  return normalizeBoard(JSON.parse(readFileSync(FILE, 'utf8')));
}

function writeFileStore(board) {
  ensureDataFile();
  board.meta.updated_at = new Date().toISOString();
  writeFileSync(FILE, JSON.stringify(board, null, 2));
}

let tableReady = false;
let tableReadyPromise = null;

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS appdev_board (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => {
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

async function readDb() {
  await ensureTable();
  const rows = await sql()`SELECT data FROM appdev_board WHERE id = ${DB_KEY}`;
  if (!rows.length) return null;
  return normalizeBoard(rows[0].data);
}

async function writeDb(board) {
  await ensureTable();
  board.meta.updated_at = new Date().toISOString();
  await sql()`
    INSERT INTO appdev_board (id, data, updated_at)
    VALUES (${DB_KEY}, ${JSON.stringify(board)}::jsonb, ${board.meta.updated_at})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `;
}

async function loadBoardRaw() {
  if (useDatabase()) {
    const fromDb = await readDb();
    if (fromDb) return fromDb;
    const seed = readFileStore();
    await writeDb(seed);
    return seed;
  }
  return readFileStore();
}

async function mergeRegisteredPeopleList(existing = []) {
  const assignable = await listAssignablePeople();
  const registered = new Set(assignable.map(name => personKey(name)));
  const kept = (existing || []).filter(name => registered.has(personKey(name)));
  return mergePeople(kept, assignable);
}

async function withRegisteredPeople(board) {
  return {
    ...board,
    meta: {
      ...board.meta,
      people: await mergeRegisteredPeopleList(board.meta?.people),
    },
  };
}

async function syncBoardPeople(board, ...touchNames) {
  if (touchNames.length) touchPeople(board, ...touchNames);
  board.meta.people = await mergeRegisteredPeopleList(board.meta?.people);
  return board.meta.people;
}

export async function getAppdevData() {
  const board = await withRegisteredPeople(await loadBoardRaw());
  board.meta.assignable_people = await listAssignablePeople();
  return board;
}

export async function saveAppdevData(board) {
  const normalized = normalizeBoard(board);
  if (useDatabase()) {
    await writeDb(normalized);
    return normalized;
  }
  writeFileStore(normalized);
  return normalized;
}

/** After admin removes a user — drop them from the board people registry. */
export async function refreshBoardPeopleRegistry() {
  const board = await loadBoardRaw();
  await syncBoardPeople(board);
  await saveAppdevData(board);
}

export async function createIssue(input, actor = null) {
  const board = await getAppdevData();
  const assigner = actor?.authDisabled
    ? String(input.assigner || input.assignee || '').trim()
    : String(actor?.displayName || '').trim();
  if (!assigner) return null;

  const num = board.next_number;
  const now = new Date().toISOString();
  const workers = normalizeWorkers(input.workers ?? input.worker);
  const assignable = await listAssignablePeople();
  if (workers.length && !workersInPool(workers, assignable)) {
    return { forbidden: true, reason: 'workers_not_registered' };
  }
  const status = STATUSES.includes(input.status) ? input.status : 'todo';
  const issue = {
    id: formatIssueId(num),
    title: String(input.title || '').trim() || 'Untitled',
    description: String(input.description || '').trim(),
    type: ISSUE_TYPES.includes(input.type) ? input.type : 'task',
    status,
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'none',
    assignee: assigner,
    workers,
    worker: workers[0] || '',
    assigned_at: workers.length ? now : null,
    completed_at: status === 'done' ? now : null,
    image_urls: normalizeImageUrls(input.image_urls),
    video_urls: normalizeVideoUrls(input.video_urls, input.video_url),
    comments: [],
    created_at: now,
    updated_at: now,
  };
  board.next_number = num + 1;
  board.issues.unshift(issue);
  const people = await syncBoardPeople(board, issue.assignee, ...issue.workers);
  await saveAppdevData(board);
  return { issue, people, next_number: board.next_number };
}

export async function updateIssue(id, patch, options = {}) {
  const board = await getAppdevData();
  const idx = board.issues.findIndex(i => i.id === id);
  if (idx === -1) return null;

  const current = board.issues[idx];
  const actor = options?.actor;

  const validation = validateIssueUpdate(current, patch, actor);
  if (!validation.ok) {
    return { forbidden: true, reason: validation.reason };
  }

  const next = { ...current, updated_at: new Date().toISOString() };

  if (patch.title !== undefined) next.title = String(patch.title).trim() || 'Untitled';
  if (patch.description !== undefined) next.description = String(patch.description).trim();
  if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) next.priority = patch.priority;
  if (patch.type !== undefined && ISSUE_TYPES.includes(patch.type)) next.type = patch.type;
  if (patch.workers !== undefined) {
    const nextWorkers = normalizeWorkers(patch.workers);
    const owner = isTaskOwner(actor, current) || Boolean(actor?.isAdmin || actor?.authDisabled);
    if (owner && nextWorkers.length) {
      const assignable = await listAssignablePeople();
      if (!workersInPool(nextWorkers, assignable)) {
        return { forbidden: true, reason: 'workers_not_registered' };
      }
    }
    const hadWorkers = hasWorkers(current);
    next.workers = nextWorkers;
    next.worker = nextWorkers[0] || '';
    if (patch.assigned_at === undefined) {
      if (nextWorkers.length && !hadWorkers) {
        next.assigned_at = new Date().toISOString();
      } else if (!nextWorkers.length) {
        next.assigned_at = null;
      }
    }
  }
  if (patch.image_urls !== undefined) next.image_urls = normalizeImageUrls(patch.image_urls);
  if (patch.video_urls !== undefined || patch.video_url !== undefined) {
    next.video_urls = normalizeVideoUrls(
      patch.video_urls !== undefined ? patch.video_urls : next.video_urls,
      patch.video_url
    );
  }

  // Task assigner is set at creation (admin only) and cannot change.
  if (patch.assigned_at !== undefined) {
    const parsed = parseIssueDatePatch(patch.assigned_at);
    if (parsed !== undefined) next.assigned_at = parsed;
  }
  if (patch.status !== undefined && STATUSES.includes(patch.status)) {
    const newStatus = patch.status;
    if (patch.completed_at === undefined) {
      if (newStatus === 'done' && current.status !== 'done') {
        next.completed_at = new Date().toISOString();
      } else if (newStatus !== 'done' && current.status === 'done') {
        next.completed_at = null;
      }
    }
    next.status = newStatus;
  }
  if (patch.completed_at !== undefined) {
    const parsed = parseIssueDatePatch(patch.completed_at);
    if (parsed !== undefined) next.completed_at = parsed;
  }

  board.issues[idx] = next;
  const people = await syncBoardPeople(board, next.assignee, ...next.workers);
  await saveAppdevData(board);
  return { issue: next, people };
}

export async function addIssueComment(id, input, actor = null) {
  const board = await getAppdevData();
  const idx = board.issues.findIndex(i => i.id === id);
  if (idx === -1) return null;

  const current = board.issues[idx];
  if (!canCommentOnIssue(current, actor)) {
    return { forbidden: true, reason: 'assignee_required' };
  }

  const author = actor?.authDisabled
    ? String(input?.author || '').trim()
    : String(actor?.displayName || '').trim();
  const body = String(input?.body || '').trim();
  const image_urls = normalizeImageUrls(input?.image_urls);
  const video_urls = normalizeVideoUrls(input?.video_urls, input?.video_url);
  if (!author || (!body && !image_urls.length && !video_urls.length)) return null;

  const comment = normalizeComment({
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author,
    body,
    image_urls,
    video_urls,
    created_at: new Date().toISOString(),
  });
  if (!comment) return null;

  const next = {
    ...current,
    comments: [...(current.comments || []), comment],
    updated_at: new Date().toISOString(),
  };
  board.issues[idx] = next;
  const people = await syncBoardPeople(board, author);
  await saveAppdevData(board);
  return { issue: next, people };
}

export async function deleteIssue(id, options = {}) {
  const board = await getAppdevData();
  const issue = board.issues.find(i => i.id === id);
  if (!issue) return { ok: false, reason: 'not_found' };
  const actor = options?.actor;
  if (!canDeleteIssue(issue, actor)) {
    return { ok: false, reason: 'not_owner' };
  }

  board.issues = board.issues.filter(i => i.id !== id);
  await saveAppdevData(board);
  return { ok: true };
}
