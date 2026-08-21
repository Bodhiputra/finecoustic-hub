import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNeonSql, hasDatabase } from './neon-sql';
import { emptyBoard, normalizeBoard, normalizeIssue, dedupeIssuesById, STATUSES, PRIORITIES, touchPeople, formatIssueId, normalizeComment, parseIssueDatePatch, mergePeople, personKey, normalizeIssueType, mergeTaskTypes } from './appdev';
import { normalizeImageUrls, normalizeVideoUrls } from './appdev-media';
import { normalizeFileUrls } from './appdev-files';
import { normalizeWorkers, getIssueWorkers, hasWorkers, workersInPool } from './appdev-workers';
import { validateIssueUpdate, canDeleteIssue, canCommentOnIssue, isTaskOwner } from './appdev-task-permissions';
import { listAssignablePeople } from './appdev-users';
import {
  notifyWorkersAssigned,
  notifyWorkersRemoved,
  notifyStatusChange,
  notifyReviewRequest,
  resolveActionNotifications,
  notifyNewComment,
  syncDueDateNotifications,
} from './appdev-notifications';
import {
  useRelationalStorage,
  loadRelationalBoard,
  getRelationalBoardUpdatedAt,
  getRelationalIssueById,
  insertRelationalIssue,
  updateRelationalIssue,
  deleteRelationalIssue,
  insertRelationalComment,
  touchRelationalPeople,
  syncRelationalTaskTypes,
  refreshRelationalPeopleFromAssignable,
  allocateRelationalNextNumber,
} from './appdev-relational';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data');
const FILE = join(DATA_DIR, 'appdev-board.json');
const TEMPLATE = join(DATA_DIR, '_template', 'appdev-board.json');
const DB_KEY = 'default';

function useDatabase() {
  return hasDatabase();
}

function sql() {
  return getNeonSql();
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

/** Mutation path — skip full-board normalize on read (write still normalizes changed rows). */
async function loadBoardForWrite() {
  if (useRelationalStorage()) {
    return loadRelationalBoard();
  }
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`SELECT data FROM appdev_board WHERE id = ${DB_KEY}`;
    if (!rows.length) {
      const seed = readFileStore();
      await writeDb(seed);
      return seed;
    }
    const board = rows[0].data;
    if (!board.meta) {
      board.meta = { project: 'Finecoustic App Development', updated_at: new Date().toISOString(), people: [] };
    }
    if (!Array.isArray(board.issues)) board.issues = [];
    if (typeof board.next_number !== 'number') board.next_number = board.issues.length + 1;
    return board;
  }
  ensureDataFile();
  const board = JSON.parse(readFileSync(FILE, 'utf8'));
  if (!board.meta) {
    board.meta = { project: 'Finecoustic App Development', updated_at: new Date().toISOString(), people: [] };
  }
  if (!Array.isArray(board.issues)) board.issues = [];
  if (typeof board.next_number !== 'number') board.next_number = board.issues.length + 1;
  return board;
}

/** Board revision timestamp without loading assignable people or enrichment. */
async function getBoardUpdatedAt() {
  if (useRelationalStorage()) {
    return getRelationalBoardUpdatedAt();
  }
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`SELECT updated_at FROM appdev_board WHERE id = ${DB_KEY}`;
    if (rows.length) return new Date(rows[0].updated_at).toISOString();
    return '';
  }
  ensureDataFile();
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return raw.meta?.updated_at || '';
}

async function mergeRegisteredPeopleList(existing = [], assignable = null) {
  const pool = assignable ?? (await listAssignablePeople());
  const registered = new Set(pool.map(name => personKey(name)));
  const kept = (existing || []).filter(name => registered.has(personKey(name)));
  return mergePeople(kept, pool);
}

async function enrichBoardForRead(board, { includeAssignable = true } = {}) {
  board.issues = dedupeIssuesById((board.issues || []).map(normalizeIssue));
  board.meta.task_types = mergeTaskTypes(board.meta?.task_types, board.issues);
  const assignable = await listAssignablePeople();
  if (includeAssignable) {
    board.meta.people = await mergeRegisteredPeopleList(board.meta?.people, assignable);
  }
  board.meta.assignable_people = assignable;
  return board;
}

async function refreshBoardPeople(board, { touch = [], assignable = null } = {}) {
  if (touch.length) touchPeople(board, ...touch);
  board.meta.people = await mergeRegisteredPeopleList(board.meta?.people, assignable);
  return board.meta.people;
}

async function syncBoardTaskTypes(board, ...extras) {
  board.meta.task_types = mergeTaskTypes(board.meta?.task_types, board.issues, extras);
  return board.meta.task_types;
}

function stampBoardUpdated(board) {
  if (!board.meta) {
    board.meta = { project: 'Finecoustic App Development', updated_at: new Date().toISOString(), people: [] };
  }
  board.meta.updated_at = new Date().toISOString();
  return board;
}

async function runIssueUpdateSideEffects({
  next,
  actor,
  prevStatus,
  patch,
  addedWorkers,
  removedWorkers,
}) {
  const jobs = [];
  if (addedWorkers.length) jobs.push(notifyWorkersAssigned(next, actor, addedWorkers));
  if (removedWorkers.length) jobs.push(notifyWorkersRemoved(next, actor, removedWorkers));
  if (patch.status !== undefined && next.status !== prevStatus) {
    if (prevStatus === 'in_review' && next.status !== 'in_review') {
      jobs.push(resolveActionNotifications(next.id, ['review_request']));
    }
    const assignerKey = personKey(next.assignee);
    const actorKey = personKey(actor?.displayName);
    if (next.status === 'in_review' && actorKey && actorKey !== assignerKey) {
      jobs.push(notifyReviewRequest(next, actor));
      jobs.push(
        notifyStatusChange(next, actor, prevStatus, next.status, {
          excludeNames: [next.assignee],
        })
      );
    } else {
      jobs.push(notifyStatusChange(next, actor, prevStatus, next.status));
    }
  }
  await Promise.all(jobs);
}

/** Lightweight due-date notification pass — throttled to at most once per 5 minutes. */
let dueSyncAt = 0;
const DUE_SYNC_MS = 5 * 60_000;

export async function syncDueDateNotificationsForBoard({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - dueSyncAt < DUE_SYNC_MS) return;
  dueSyncAt = now;
  const board = await loadBoardForWrite();
  await syncDueDateNotifications(board.issues || []);
}

export async function getAppdevData() {
  return enrichBoardForRead(await loadBoardForWrite(), { includeAssignable: true });
}

/** Skip full payload when board has not changed since `since` (ISO timestamp). */
export async function getAppdevDataSince(since = '') {
  if (since) {
    const updatedAt = await getBoardUpdatedAt();
    if (updatedAt && since >= updatedAt) {
      return { unchanged: true, updated_at: updatedAt };
    }
  }
  const enriched = await enrichBoardForRead(await loadBoardForWrite(), { includeAssignable: false });
  return { unchanged: false, ...enriched };
}

export async function saveAppdevData(board, { syncDueDates = false, normalize = false } = {}) {
  if (useRelationalStorage()) {
    const normalized = normalize ? normalizeBoard(board) : stampBoardUpdated(board);
    if (syncDueDates) {
      try {
        await syncDueDateNotifications(normalized.issues || []);
      } catch (err) {
        console.error('[appdev] due date notification sync failed:', err);
      }
    }
    return normalized;
  }
  const normalized = normalize ? normalizeBoard(board) : stampBoardUpdated(board);
  if (useDatabase()) {
    await writeDb(normalized);
  } else {
    writeFileStore(normalized);
  }
  if (syncDueDates) {
    try {
      await syncDueDateNotifications(normalized.issues || []);
    } catch (err) {
      console.error('[appdev] due date notification sync failed:', err);
    }
  }
  return normalized;
}

/** After admin removes a user — drop them from the board people registry. */
export async function refreshBoardPeopleRegistry() {
  const assignable = await listAssignablePeople();
  if (useRelationalStorage()) {
    const board = await loadRelationalBoard();
    const merged = await mergeRegisteredPeopleList(board.meta?.people, assignable);
    await refreshRelationalPeopleFromAssignable(merged);
    return;
  }
  const board = await loadBoardRaw();
  await refreshBoardPeople(board, { assignable });
  await saveAppdevData(board);
}

export async function createIssue(input, actor = null) {
  const assigner = actor?.authDisabled
    ? String(input.assigner || input.assignee || '').trim()
    : String(actor?.displayName || '').trim();
  if (!assigner) return null;

  const assignable = await listAssignablePeople();
  const workers = normalizeWorkers(input.workers ?? input.worker);
  if (workers.length && !workersInPool(workers, assignable)) {
    return { forbidden: true, reason: 'workers_not_registered' };
  }

  const status = STATUSES.includes(input.status) ? input.status : 'todo';
  const now = new Date().toISOString();

  if (useRelationalStorage()) {
    const num = await allocateRelationalNextNumber();
    const issue = normalizeIssue({
      id: formatIssueId(num),
      title: String(input.title || '').trim() || 'Untitled',
      description: String(input.description || '').trim(),
      type: normalizeIssueType(input.type),
      status,
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'none',
      assignee: assigner,
      workers,
      worker: workers[0] || '',
      assigned_at: workers.length ? now : null,
      completed_at: status === 'done' ? now : null,
      due_at: null,
      image_urls: normalizeImageUrls(input.image_urls),
      video_urls: normalizeVideoUrls(input.video_urls, input.video_url),
      file_urls: normalizeFileUrls(input.file_urls),
      comments: [],
      created_at: now,
      updated_at: now,
    });
    const inserted = await insertRelationalIssue(issue);
    if (!inserted) return null;
    const people = await touchRelationalPeople(issue.assignee, ...issue.workers);
    const task_types = await syncRelationalTaskTypes(issue.type);
    const board_updated_at = await getRelationalBoardUpdatedAt();
    void notifyWorkersAssigned(inserted, actor, workers).catch(err => {
      console.error('[appdev] assign notification failed:', err);
    });
    return {
      issue: inserted,
      people,
      task_types,
      next_number: num + 1,
      board_updated_at,
    };
  }

  const board = await loadBoardForWrite();
  const num = board.next_number;
  const issue = {
    id: formatIssueId(num),
    title: String(input.title || '').trim() || 'Untitled',
    description: String(input.description || '').trim(),
    type: normalizeIssueType(input.type),
    status,
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'none',
    assignee: assigner,
    workers,
    worker: workers[0] || '',
    assigned_at: workers.length ? now : null,
    completed_at: status === 'done' ? now : null,
    due_at: null,
    image_urls: normalizeImageUrls(input.image_urls),
    video_urls: normalizeVideoUrls(input.video_urls, input.video_url),
    file_urls: normalizeFileUrls(input.file_urls),
    comments: [],
    created_at: now,
    updated_at: now,
  };
  board.next_number = num + 1;
  board.issues.unshift(issue);
  touchPeople(board, issue.assignee, ...issue.workers);
  const people = board.meta?.people || [];
  const task_types = await syncBoardTaskTypes(board, issue.type);
  await saveAppdevData(board, { normalize: true });
  void notifyWorkersAssigned(issue, actor, workers).catch(err => {
    console.error('[appdev] assign notification failed:', err);
  });
  return { issue, people, task_types, next_number: board.next_number, board_updated_at: board.meta.updated_at };
}

export async function updateIssue(id, patch, options = {}) {
  const actor = options?.actor;

  if (useRelationalStorage()) {
    const current = await getRelationalIssueById(id);
    if (!current) return null;

    const prevStatus = current.status;
    const prevWorkers = getIssueWorkers(current);
    let assignable = null;

    const validation = validateIssueUpdate(current, patch, actor);
    if (!validation.ok) {
      return { forbidden: true, reason: validation.reason };
    }

    const next = { ...current, updated_at: new Date().toISOString() };

    if (patch.title !== undefined) next.title = String(patch.title).trim() || 'Untitled';
    if (patch.description !== undefined) next.description = String(patch.description).trim();
    if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) next.priority = patch.priority;
    if (patch.type !== undefined) next.type = normalizeIssueType(patch.type);
    if (patch.workers !== undefined) {
      const nextWorkers = normalizeWorkers(patch.workers);
      const owner = isTaskOwner(actor, current) || Boolean(actor?.isAdmin || actor?.authDisabled);
      if (owner && nextWorkers.length) {
        assignable = await listAssignablePeople();
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
    if (patch.file_urls !== undefined) next.file_urls = normalizeFileUrls(patch.file_urls);
    if (patch.video_urls !== undefined || patch.video_url !== undefined) {
      next.video_urls = normalizeVideoUrls(
        patch.video_urls !== undefined ? patch.video_urls : next.video_urls,
        patch.video_url
      );
    }
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
    if (patch.due_at !== undefined) {
      const parsed = parseIssueDatePatch(patch.due_at);
      if (parsed !== undefined) next.due_at = parsed;
    }

    const normalized = normalizeIssue(next);
    const updated = await updateRelationalIssue(id, normalized);
    if (!updated) return null;
    const people = await touchRelationalPeople(normalized.assignee, ...getIssueWorkers(normalized));
    const task_types = await syncRelationalTaskTypes(normalized.type);
    const board_updated_at = await getRelationalBoardUpdatedAt();

    if (patch.due_at !== undefined) {
      try {
        await syncDueDateNotifications([updated]);
      } catch (err) {
        console.error('[appdev] due date notification sync failed:', err);
      }
    }

    const nextWorkers = getIssueWorkers(normalized);
    const addedWorkers = nextWorkers.filter(
      w => !prevWorkers.some(p => personKey(p) === personKey(w))
    );
    const removedWorkers = prevWorkers.filter(
      w => !nextWorkers.some(p => personKey(p) === personKey(w))
    );
    void runIssueUpdateSideEffects({
      next: updated,
      actor,
      prevStatus,
      patch,
      addedWorkers,
      removedWorkers,
    }).catch(err => {
      console.error('[appdev] issue side effects failed:', err);
    });

    return { issue: updated, people, task_types, board_updated_at };
  }

  const board = await loadBoardForWrite();
  const idx = board.issues.findIndex(i => i.id === id);
  if (idx === -1) return null;

  const current = board.issues[idx];
  const prevStatus = current.status;
  const prevWorkers = getIssueWorkers(current);
  let assignable = null;

  const validation = validateIssueUpdate(current, patch, actor);
  if (!validation.ok) {
    return { forbidden: true, reason: validation.reason };
  }

  const next = { ...current, updated_at: new Date().toISOString() };

  if (patch.title !== undefined) next.title = String(patch.title).trim() || 'Untitled';
  if (patch.description !== undefined) next.description = String(patch.description).trim();
  if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) next.priority = patch.priority;
  if (patch.type !== undefined) next.type = normalizeIssueType(patch.type);
  if (patch.workers !== undefined) {
    const nextWorkers = normalizeWorkers(patch.workers);
    const owner = isTaskOwner(actor, current) || Boolean(actor?.isAdmin || actor?.authDisabled);
    if (owner && nextWorkers.length) {
      assignable = await listAssignablePeople();
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
  if (patch.file_urls !== undefined) next.file_urls = normalizeFileUrls(patch.file_urls);
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
  if (patch.due_at !== undefined) {
    const parsed = parseIssueDatePatch(patch.due_at);
    if (parsed !== undefined) next.due_at = parsed;
  }

  board.issues[idx] = normalizeIssue(next);
  touchPeople(board, next.assignee, ...getIssueWorkers(next));
  const people = board.meta?.people || [];
  const task_types = await syncBoardTaskTypes(board, next.type);
  const syncDueDates = patch.due_at !== undefined;
  await saveAppdevData(board, { syncDueDates });

  const nextWorkers = getIssueWorkers(next);
  const addedWorkers = nextWorkers.filter(
    w => !prevWorkers.some(p => personKey(p) === personKey(w))
  );
  const removedWorkers = prevWorkers.filter(
    w => !nextWorkers.some(p => personKey(p) === personKey(w))
  );
  void runIssueUpdateSideEffects({
    next,
    actor,
    prevStatus,
    patch,
    addedWorkers,
    removedWorkers,
  }).catch(err => {
    console.error('[appdev] issue side effects failed:', err);
  });

  return { issue: next, people, task_types, board_updated_at: board.meta.updated_at };
}

export async function addIssueComment(id, input, actor = null) {
  if (useRelationalStorage()) {
    const current = await getRelationalIssueById(id);
    if (!current) return null;
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

    const updated = await insertRelationalComment(id, comment, { touchAuthor: author });
    const board = await loadRelationalBoard();
    void notifyNewComment(updated, actor, comment).catch(err => {
      console.error('[appdev] comment notification failed:', err);
    });
    return {
      issue: updated,
      people: board.meta?.people || [],
      board_updated_at: board.meta?.updated_at || '',
    };
  }

  const board = await loadBoardForWrite();
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
  board.issues[idx] = normalizeIssue(next);
  touchPeople(board, author);
  const people = board.meta?.people || [];
  await saveAppdevData(board);
  void notifyNewComment(next, actor, comment).catch(err => {
    console.error('[appdev] comment notification failed:', err);
  });
  return { issue: next, people, board_updated_at: board.meta.updated_at };
}

export async function deleteIssue(id, options = {}) {
  const actor = options?.actor;

  if (useRelationalStorage()) {
    const issue = await getRelationalIssueById(id);
    if (!issue) return { ok: false, reason: 'not_found' };
    if (!canDeleteIssue(issue, actor)) {
      return { ok: false, reason: 'not_owner' };
    }
    await deleteRelationalIssue(id);
    const board_updated_at = await getRelationalBoardUpdatedAt();
    return { ok: true, board_updated_at };
  }

  const board = await loadBoardForWrite();
  const issue = board.issues.find(i => i.id === id);
  if (!issue) return { ok: false, reason: 'not_found' };
  if (!canDeleteIssue(issue, actor)) {
    return { ok: false, reason: 'not_owner' };
  }

  board.issues = board.issues.filter(i => i.id !== id);
  await saveAppdevData(board);
  return { ok: true, board_updated_at: board.meta.updated_at };
}
