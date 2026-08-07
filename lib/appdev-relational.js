/**
 * Relational appdev storage (Neon) — one row per issue/comment.
 * Legacy blob in appdev_board is NEVER deleted; migration is copy-only.
 */
import { getNeonSql, hasDatabase } from './neon-sql';
import {
  emptyBoard,
  normalizeIssue,
  normalizeComment,
  normalizeBoard,
  dedupeIssuesById,
  mergeTaskTypes,
  mergePeople,
  formatIssueId,
} from './appdev';
import { getIssueWorkers } from './appdev-workers';

const META_KEY = 'default';
const BLOB_KEY = 'default';

let schemaReady = false;
let schemaPromise = null;
let migrationDone = false;
let migrationPromise = null;

function sql() {
  return getNeonSql();
}

export function useRelationalStorage() {
  return hasDatabase();
}

async function ensureLegacyBoardTable() {
  await sql()`
    CREATE TABLE IF NOT EXISTS appdev_board (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function ensureRelationalSchema() {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await ensureLegacyBoardTable();
      await sql()`
        CREATE TABLE IF NOT EXISTS appdev_board_meta (
          id TEXT PRIMARY KEY,
          project TEXT NOT NULL DEFAULT 'Finecoustic App Development',
          next_number INTEGER NOT NULL DEFAULT 1,
          people JSONB NOT NULL DEFAULT '[]',
          task_types JSONB NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql()`
        CREATE TABLE IF NOT EXISTS appdev_issues (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'Untitled',
          description TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL DEFAULT 'task',
          status TEXT NOT NULL DEFAULT 'todo',
          priority TEXT NOT NULL DEFAULT 'none',
          assignee TEXT NOT NULL DEFAULT '',
          workers JSONB NOT NULL DEFAULT '[]',
          assigned_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          due_at TEXT,
          image_urls JSONB NOT NULL DEFAULT '[]',
          video_urls JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql()`
        CREATE TABLE IF NOT EXISTS appdev_comments (
          id TEXT PRIMARY KEY,
          issue_id TEXT NOT NULL REFERENCES appdev_issues(id) ON DELETE CASCADE,
          author TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          image_urls JSONB NOT NULL DEFAULT '[]',
          video_urls JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql()`CREATE INDEX IF NOT EXISTS appdev_comments_issue_idx ON appdev_comments (issue_id, created_at)`;
      await sql()`CREATE INDEX IF NOT EXISTS appdev_issues_updated_idx ON appdev_issues (updated_at DESC)`;
      schemaReady = true;
    })().catch(err => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
}

async function readLegacyBlobRaw() {
  await ensureLegacyBoardTable();
  const rows = await sql()`SELECT data FROM appdev_board WHERE id = ${BLOB_KEY}`;
  if (!rows.length) return null;
  return rows[0].data;
}

function rowToIssue(row, comments = []) {
  return normalizeIssue({
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    workers: row.workers,
    worker: Array.isArray(row.workers) ? row.workers[0] || '' : '',
    assigned_at: row.assigned_at ? new Date(row.assigned_at).toISOString() : null,
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    due_at: row.due_at || null,
    image_urls: row.image_urls,
    video_urls: row.video_urls,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    comments,
  });
}

function issueToRow(issue) {
  const normalized = normalizeIssue(issue);
  const workers = getIssueWorkers(normalized);
  return {
    id: normalized.id,
    title: normalized.title,
    description: normalized.description || '',
    type: normalized.type,
    status: normalized.status,
    priority: normalized.priority || 'none',
    assignee: normalized.assignee || '',
    workers,
    assigned_at: normalized.assigned_at || null,
    completed_at: normalized.completed_at || null,
    due_at: normalized.due_at || null,
    image_urls: normalized.image_urls || [],
    video_urls: normalized.video_urls || [],
    created_at: normalized.created_at,
    updated_at: normalized.updated_at,
  };
}

async function countRelationalIssues() {
  const rows = await sql()`SELECT COUNT(*)::int AS c FROM appdev_issues`;
  return rows[0]?.c || 0;
}

/** Copy blob → relational tables. Never deletes or overwrites the legacy blob. */
export async function migrateBlobToRelationalIfNeeded() {
  if (migrationDone) return { skipped: true, reason: 'already_migrated' };
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    await ensureRelationalSchema();
    const existing = await countRelationalIssues();
    const rawBlob = await readLegacyBlobRaw();
    if (!rawBlob) {
      migrationDone = true;
      return { skipped: true, reason: 'no_legacy_blob', issueCount: existing };
    }

    const board = normalizeBoard(rawBlob);
    const issues = dedupeIssuesById(board.issues || []);
    const blobComments = issues.reduce((n, i) => n + (i.comments?.length || 0), 0);

    if (existing >= issues.length && issues.length > 0) {
      migrationDone = true;
      return { skipped: true, reason: 'already_synced', issueCount: existing };
    }

    if (existing > 0 && existing < issues.length) {
      console.info(`[appdev] Resuming blob migration: ${existing}/${issues.length} issues in relational store`);
    }

    for (const issue of issues) {
      const normalized = normalizeIssue(issue);
      const row = issueToRow(normalized);
      await sql()`
        INSERT INTO appdev_issues (
          id, title, description, type, status, priority, assignee, workers,
          assigned_at, completed_at, due_at, image_urls, video_urls, created_at, updated_at
        ) VALUES (
          ${row.id}, ${row.title}, ${row.description}, ${row.type}, ${row.status}, ${row.priority},
          ${row.assignee}, ${JSON.stringify(row.workers)}, ${row.assigned_at}, ${row.completed_at},
          ${row.due_at}, ${JSON.stringify(row.image_urls)}, ${JSON.stringify(row.video_urls)},
          ${row.created_at}, ${row.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      for (const c of normalized.comments || []) {
        const comment = normalizeComment(c);
        if (!comment) continue;
        await sql()`
          INSERT INTO appdev_comments (id, issue_id, author, body, image_urls, video_urls, created_at)
          VALUES (
            ${comment.id}, ${normalized.id}, ${comment.author}, ${comment.body},
            ${JSON.stringify(comment.image_urls || [])}, ${JSON.stringify(comment.video_urls || [])},
            ${comment.created_at}
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    const metaUpdated = board.meta?.updated_at || new Date().toISOString();
    await sql()`
      INSERT INTO appdev_board_meta (id, project, next_number, people, task_types, updated_at)
      VALUES (
        ${META_KEY},
        ${board.meta?.project || 'Finecoustic App Development'},
        ${board.next_number || 1},
        ${JSON.stringify(board.meta?.people || [])},
        ${JSON.stringify(board.meta?.task_types || [])},
        ${metaUpdated}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const migratedIssues = await countRelationalIssues();
    const commentRows = await sql()`SELECT COUNT(*)::int AS c FROM appdev_comments`;
    const migratedComments = commentRows[0]?.c || 0;

    if (issues.length > 0 && migratedIssues < issues.length) {
      throw new Error(
        `[appdev] Migration verification failed: expected ${issues.length} issues, got ${migratedIssues}`
      );
    }
    if (blobComments > 0 && migratedComments < blobComments) {
      console.warn(
        `[appdev] Comment count lower than blob (${migratedComments}/${blobComments}); legacy blob preserved for recovery`
      );
    }

    migrationDone = true;
    console.info(
      `[appdev] Relational migration complete: ${migratedIssues} issues, ${migratedComments} comments (legacy blob preserved)`
    );
    return {
      migrated: true,
      issueCount: migratedIssues,
      commentCount: migratedComments,
      legacyBlobPreserved: true,
    };
  })().catch(err => {
    migrationPromise = null;
    throw err;
  });

  return migrationPromise;
}

async function ensureReady() {
  await ensureRelationalSchema();
  await migrateBlobToRelationalIfNeeded();
}

async function readMetaRow() {
  const rows = await sql()`SELECT * FROM appdev_board_meta WHERE id = ${META_KEY}`;
  if (!rows.length) {
    const now = new Date().toISOString();
    await sql()`
      INSERT INTO appdev_board_meta (id, project, next_number, people, task_types, updated_at)
      VALUES (${META_KEY}, 'Finecoustic App Development', 1, '[]', '[]', ${now})
      ON CONFLICT (id) DO NOTHING
    `;
    return {
      project: 'Finecoustic App Development',
      next_number: 1,
      people: [],
      task_types: [],
      updated_at: now,
    };
  }
  const row = rows[0];
  return {
    project: row.project,
    next_number: row.next_number,
    people: Array.isArray(row.people) ? row.people : [],
    task_types: Array.isArray(row.task_types) ? row.task_types : [],
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

async function bumpMetaUpdated(extra = {}) {
  const now = new Date().toISOString();
  const meta = await readMetaRow();
  const next = { ...meta, ...extra, updated_at: now };
  await sql()`
    UPDATE appdev_board_meta SET
      project = ${next.project},
      next_number = ${next.next_number},
      people = ${JSON.stringify(next.people)}::jsonb,
      task_types = ${JSON.stringify(next.task_types)}::jsonb,
      updated_at = ${now}
    WHERE id = ${META_KEY}
  `;
  return next;
}

export async function getRelationalBoardUpdatedAt() {
  await ensureReady();
  const meta = await readMetaRow();
  return meta.updated_at || '';
}

export async function loadRelationalBoard() {
  await ensureReady();
  const meta = await readMetaRow();
  const issueRows = await sql()`SELECT * FROM appdev_issues ORDER BY created_at DESC`;
  const ids = issueRows.map(r => r.id);
  let commentRows = [];
  if (ids.length) {
    commentRows = await sql()`
      SELECT * FROM appdev_comments WHERE issue_id = ANY(${ids})
      ORDER BY created_at ASC
    `;
  }

  const commentsByIssue = new Map();
  for (const c of commentRows) {
    if (!commentsByIssue.has(c.issue_id)) commentsByIssue.set(c.issue_id, []);
    commentsByIssue.get(c.issue_id).push(c);
  }

  const issues = issueRows.map(row =>
    rowToIssue(
      row,
      (commentsByIssue.get(row.id) || [])
        .map(c =>
          normalizeComment({
            id: c.id,
            author: c.author,
            body: c.body,
            image_urls: c.image_urls,
            video_urls: c.video_urls,
            created_at: c.created_at ? new Date(c.created_at).toISOString() : undefined,
          })
        )
        .filter(Boolean)
    )
  );

  return {
    meta: {
      project: meta.project,
      updated_at: meta.updated_at,
      people: meta.people,
      task_types: meta.task_types,
    },
    next_number: meta.next_number,
    issues,
  };
}

export async function getRelationalIssueById(id) {
  await ensureReady();
  const rows = await sql()`SELECT * FROM appdev_issues WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return null;
  const comments = await sql()`
    SELECT * FROM appdev_comments WHERE issue_id = ${id} ORDER BY created_at ASC
  `;
  return rowToIssue(
    rows[0],
    comments
      .map(c =>
        normalizeComment({
          id: c.id,
          author: c.author,
          body: c.body,
          image_urls: c.image_urls,
          video_urls: c.video_urls,
          created_at: c.created_at ? new Date(c.created_at).toISOString() : undefined,
        })
      )
      .filter(Boolean)
  );
}

export async function insertRelationalIssue(issue, { nextNumber } = {}) {
  await ensureReady();
  const row = issueToRow(issue);
  await sql()`
    INSERT INTO appdev_issues (
      id, title, description, type, status, priority, assignee, workers,
      assigned_at, completed_at, due_at, image_urls, video_urls, created_at, updated_at
    ) VALUES (
      ${row.id}, ${row.title}, ${row.description}, ${row.type}, ${row.status}, ${row.priority},
      ${row.assignee}, ${JSON.stringify(row.workers)}, ${row.assigned_at}, ${row.completed_at},
      ${row.due_at}, ${JSON.stringify(row.image_urls)}, ${JSON.stringify(row.video_urls)},
      ${row.created_at}, ${row.updated_at}
    )
  `;
  const meta = await readMetaRow();
  const people = mergePeople(meta.people, [row.assignee, ...row.workers]);
  const task_types = mergeTaskTypes(meta.task_types, [normalizeIssue(issue)]);
  await bumpMetaUpdated({
    next_number: nextNumber ?? meta.next_number,
    people,
    task_types,
  });
  return getRelationalIssueById(row.id);
}

export async function updateRelationalIssue(id, issue) {
  await ensureReady();
  const row = issueToRow(issue);
  await sql()`
    UPDATE appdev_issues SET
      title = ${row.title},
      description = ${row.description},
      type = ${row.type},
      status = ${row.status},
      priority = ${row.priority},
      assignee = ${row.assignee},
      workers = ${JSON.stringify(row.workers)}::jsonb,
      assigned_at = ${row.assigned_at},
      completed_at = ${row.completed_at},
      due_at = ${row.due_at},
      image_urls = ${JSON.stringify(row.image_urls)}::jsonb,
      video_urls = ${JSON.stringify(row.video_urls)}::jsonb,
      updated_at = ${row.updated_at}
    WHERE id = ${id}
  `;
  return getRelationalIssueById(id);
}

export async function deleteRelationalIssue(id) {
  await ensureReady();
  await sql()`DELETE FROM appdev_issues WHERE id = ${id}`;
  await bumpMetaUpdated();
}

export async function insertRelationalComment(issueId, comment, { touchAuthor } = {}) {
  await ensureReady();
  const normalized = normalizeComment(comment);
  if (!normalized) return null;

  await sql()`
    INSERT INTO appdev_comments (id, issue_id, author, body, image_urls, video_urls, created_at)
    VALUES (
      ${normalized.id}, ${issueId}, ${normalized.author}, ${normalized.body},
      ${JSON.stringify(normalized.image_urls || [])}, ${JSON.stringify(normalized.video_urls || [])},
      ${normalized.created_at}
    )
  `;
  const now = new Date().toISOString();
  await sql()`UPDATE appdev_issues SET updated_at = ${now} WHERE id = ${issueId}`;

  if (touchAuthor) {
    const meta = await readMetaRow();
    await bumpMetaUpdated({ people: mergePeople(meta.people, [touchAuthor]) });
  } else {
    await bumpMetaUpdated();
  }

  return getRelationalIssueById(issueId);
}

export async function touchRelationalPeople(...names) {
  await ensureReady();
  const meta = await readMetaRow();
  const people = mergePeople(meta.people, names);
  await bumpMetaUpdated({ people });
  return people;
}

export async function syncRelationalTaskTypes(...extras) {
  await ensureReady();
  const board = await loadRelationalBoard();
  const task_types = mergeTaskTypes(board.meta?.task_types, board.issues, extras);
  await bumpMetaUpdated({ task_types });
  return task_types;
}

export async function refreshRelationalPeopleFromAssignable(mergedPeople) {
  await ensureReady();
  await bumpMetaUpdated({ people: mergedPeople });
  return mergedPeople;
}

export async function getRelationalNextNumber() {
  await ensureReady();
  const meta = await readMetaRow();
  return meta.next_number;
}

export async function bumpRelationalNextNumber(nextNumber) {
  await ensureReady();
  await bumpMetaUpdated({ next_number: nextNumber });
}
