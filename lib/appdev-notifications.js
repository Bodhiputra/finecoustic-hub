import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { personKey } from '@/lib/appdev';
import { getIssueWorkers } from '@/lib/appdev-workers';
import { isIssueDueSoon, isIssueOverdue } from '@/lib/appdev-due';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'appdev-notifications.json');
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let tableReady = false;
let tableReadyPromise = null;

function useDatabase() {
  return hasDatabase();
}

function sql() {
  return getNeonSql();
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS appdev_notifications (
        id TEXT PRIMARY KEY,
        recipient_key TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        type TEXT NOT NULL,
        issue_id TEXT NOT NULL,
        issue_title TEXT NOT NULL DEFAULT '',
        actor_name TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}',
        dedupe_key TEXT,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS appdev_notifications_recipient_idx ON appdev_notifications (recipient_key, created_at DESC)`;
        await sql()`CREATE UNIQUE INDEX IF NOT EXISTS appdev_notifications_dedupe_idx ON appdev_notifications (dedupe_key) WHERE dedupe_key IS NOT NULL`;
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ items: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.items) ? raw.items : [];
}

function writeFileStore(items) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ items }, null, 2));
}

function pruneOld(items, now = Date.now()) {
  const cutoff = now - MAX_AGE_MS;
  return items.filter(n => new Date(n.created_at).getTime() >= cutoff);
}

function normalizeItem(row) {
  return {
    id: row.id,
    type: row.type,
    issue_id: row.issue_id,
    issue_title: row.issue_title || '',
    actor_name: row.actor_name || '',
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    read_at: row.read_at || null,
    created_at: row.created_at,
  };
}

function issueStakeholders(issue) {
  const names = new Set();
  if (issue?.assignee) names.add(String(issue.assignee).trim());
  for (const w of getIssueWorkers(issue)) {
    if (w) names.add(String(w).trim());
  }
  return [...names];
}

function recipientsExcept(issue, actorName) {
  const actorKey = personKey(actorName);
  return issueStakeholders(issue).filter(name => personKey(name) !== actorKey);
}

export async function createAppdevNotification({
  recipientName,
  type,
  issueId,
  issueTitle = '',
  actorName = '',
  payload = {},
  dedupeKey = null,
}) {
  const recipient = String(recipientName || '').trim();
  const key = personKey(recipient);
  if (!key || !type || !issueId) return null;

  const item = {
    id: randomUUID(),
    recipient_key: key,
    recipient_name: recipient,
    type,
    issue_id: issueId,
    issue_title: String(issueTitle || '').trim(),
    actor_name: String(actorName || '').trim(),
    payload,
    dedupe_key: dedupeKey,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  if (useDatabase()) {
    await ensureTable();
    try {
      await sql()`
        INSERT INTO appdev_notifications (
          id, recipient_key, recipient_name, type, issue_id, issue_title,
          actor_name, payload, dedupe_key, read_at, created_at
        ) VALUES (
          ${item.id}, ${item.recipient_key}, ${item.recipient_name}, ${item.type},
          ${item.issue_id}, ${item.issue_title}, ${item.actor_name},
          ${JSON.stringify(item.payload)}, ${item.dedupe_key}, NULL, ${item.created_at}
        )
      `;
      return normalizeItem(item);
    } catch (err) {
      if (String(err?.message || '').includes('duplicate') || err?.code === '23505') return null;
      throw err;
    }
  }

  const items = pruneOld(readFileStore());
  if (dedupeKey && items.some(n => n.dedupe_key === dedupeKey)) return null;
  items.unshift(item);
  writeFileStore(pruneOld(items));
  return normalizeItem(item);
}

async function notifyMany(recipientNames, fields) {
  await Promise.all(
    recipientNames.map(name => {
      const recipientKey = personKey(name);
      const dedupeKey = fields.dedupeKey
        ? `${fields.dedupeKey}:${recipientKey}`
        : null;
      return createAppdevNotification({ ...fields, recipientName: name, dedupeKey });
    })
  );
}

export async function notifyWorkersAssigned(issue, actor, addedWorkers) {
  const actorName = actor?.displayName || '';
  const assigner = String(issue.assignee || '').trim();
  const jobs = [];

  if (addedWorkers.length && assigner && personKey(assigner) !== personKey(actorName)) {
    for (const name of addedWorkers) {
      jobs.push(
        createAppdevNotification({
          recipientName: assigner,
          type: 'assignee_joined',
          issueId: issue.id,
          issueTitle: issue.title,
          actorName: personKey(name) === personKey(actorName) ? actorName : name,
          payload: { assignee: name },
          dedupeKey: `assignee_joined:${issue.id}:${personKey(name)}:${Date.now()}`,
        })
      );
    }
  }

  for (const name of addedWorkers) {
    if (personKey(name) === personKey(actorName)) continue;
    jobs.push(
      createAppdevNotification({
        recipientName: name,
        type: 'assigned',
        issueId: issue.id,
        issueTitle: issue.title,
        actorName,
        payload: {},
        dedupeKey: `assigned:${issue.id}:${personKey(name)}:${Date.now()}`,
      })
    );
  }

  await Promise.all(jobs);
}

export async function notifyWorkersRemoved(issue, actor, removedWorkers) {
  const actorName = actor?.displayName || '';
  await Promise.all(
    removedWorkers
      .filter(name => personKey(name) !== personKey(actorName))
      .map(name =>
        createAppdevNotification({
          recipientName: name,
          type: 'assignee_removed',
          issueId: issue.id,
          issueTitle: issue.title,
          actorName,
          payload: {},
          dedupeKey: `assignee_removed:${issue.id}:${personKey(name)}:${Date.now()}`,
        })
      )
  );
}

export async function notifyStatusChange(issue, actor, fromStatus, toStatus, { excludeNames = [] } = {}) {
  const actorName = actor?.displayName || '';
  const excludeKeys = new Set((excludeNames || []).map(name => personKey(name)).filter(Boolean));
  const recipients = recipientsExcept(issue, actorName).filter(
    name => !excludeKeys.has(personKey(name))
  );
  await notifyMany(recipients, {
    type: 'status_change',
    issueId: issue.id,
    issueTitle: issue.title,
    actorName,
    payload: { from_status: fromStatus, to_status: toStatus },
    dedupeKey: `status:${issue.id}:${toStatus}:${personKey(actorName)}:${Date.now()}`,
  });
}

/** Assignee moved task to in review — notify task assigner until they approve or send back. */
export async function notifyReviewRequest(issue, actor) {
  const assigner = String(issue.assignee || '').trim();
  const actorName = actor?.displayName || '';
  if (!assigner || personKey(assigner) === personKey(actorName)) return null;

  return createAppdevNotification({
    recipientName: assigner,
    type: 'review_request',
    issueId: issue.id,
    issueTitle: issue.title,
    actorName,
    payload: { from_status: 'in_progress', to_status: 'in_review', requires_action: true, resolved: false },
    dedupeKey: `review_request:${issue.id}:${personKey(assigner)}:${Date.now()}`,
  });
}

/** Clear pending action notifications when assigner confirms or sends back from review. */
export async function resolveActionNotifications(issueId, types = ['review_request']) {
  const id = String(issueId || '').trim();
  if (!id || !types.length) return 0;
  const now = new Date().toISOString();
  const typeSet = new Set(types);

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, payload FROM appdev_notifications
      WHERE issue_id = ${id}
        AND type = ANY(${types})
        AND read_at IS NULL
    `;
    let count = 0;
    for (const row of rows) {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      if (payload.resolved) continue;
      await sql()`
        UPDATE appdev_notifications
        SET read_at = ${now}, payload = ${JSON.stringify({ ...payload, resolved: true, resolved_at: now })}
        WHERE id = ${row.id}
      `;
      count += 1;
    }
    return count;
  }

  const items = readFileStore();
  let count = 0;
  for (const n of items) {
    if (n.issue_id !== id || !typeSet.has(n.type) || n.read_at) continue;
    if (n.payload?.resolved) continue;
    n.payload = { ...(n.payload || {}), resolved: true, resolved_at: now, requires_action: false };
    n.read_at = now;
    count += 1;
  }
  if (count) writeFileStore(items);
  return count;
}

export async function notifyNewComment(issue, actor, comment) {
  const actorName = actor?.displayName || comment?.author || '';
  await notifyMany(recipientsExcept(issue, actorName), {
    type: 'comment',
    issueId: issue.id,
    issueTitle: issue.title,
    actorName,
    payload: { preview: String(comment?.body || '').slice(0, 120) },
    dedupeKey: `comment:${issue.id}:${comment?.id || Date.now()}:${personKey(actorName)}`,
  });
}

export async function syncDueDateNotifications(issues = []) {
  const today = new Date().toISOString().slice(0, 10);
  for (const issue of issues) {
    if (!issue?.due_at || issue.status === 'done') continue;
    const type = isIssueOverdue(issue) ? 'due_overdue' : isIssueDueSoon(issue) ? 'due_soon' : null;
    if (!type) continue;
    for (const name of issueStakeholders(issue)) {
      await createAppdevNotification({
        recipientName: name,
        type,
        issueId: issue.id,
        issueTitle: issue.title,
        actorName: '',
        payload: { due_at: issue.due_at },
        dedupeKey: `${type}:${issue.id}:${personKey(name)}:${today}`,
      });
    }
  }
}

export async function listNotificationsForUser(displayName, { limit = 40 } = {}) {
  const key = personKey(displayName);
  if (!key) return [];

  let items;
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, type, issue_id, issue_title, actor_name, payload, read_at, created_at
      FROM appdev_notifications
      WHERE recipient_key = ${key}
      ORDER BY created_at DESC
      LIMIT ${Math.max(limit, 60)}
    `;
    items = rows.map(normalizeItem);
  } else {
    items = pruneOld(readFileStore())
      .filter(n => n.recipient_key === key)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(normalizeItem);
  }

  items.sort((a, b) => {
    const aPending = a.type === 'review_request' && !a.payload?.resolved ? 1 : 0;
    const bPending = b.type === 'review_request' && !b.payload?.resolved ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return items.slice(0, limit);
}

export async function countUnreadForUser(displayName) {
  const key = personKey(displayName);
  if (!key) return 0;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT COUNT(*)::int AS c FROM appdev_notifications
      WHERE recipient_key = ${key} AND read_at IS NULL
    `;
    return rows[0]?.c || 0;
  }

  return pruneOld(readFileStore()).filter(n => n.recipient_key === key && !n.read_at).length;
}

export async function markNotificationRead(id, displayName) {
  const key = personKey(displayName);
  if (!key || !id) return false;

  const items = useDatabase() ? null : readFileStore();
  if (!useDatabase()) {
    const item = items.find(n => n.id === id && n.recipient_key === key);
    if (item?.type === 'review_request' && !item.payload?.resolved) return false;
  } else {
    await ensureTable();
    const rows = await sql()`
      SELECT type, payload FROM appdev_notifications
      WHERE id = ${id} AND recipient_key = ${key}
      LIMIT 1
    `;
    const row = rows[0];
    if (row?.type === 'review_request') {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      if (!payload.resolved) return false;
    }
  }

  const now = new Date().toISOString();

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      UPDATE appdev_notifications SET read_at = ${now}
      WHERE id = ${id} AND recipient_key = ${key} AND read_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  }

  let changed = false;
  for (const n of items) {
    if (n.id === id && n.recipient_key === key && !n.read_at) {
      n.read_at = now;
      changed = true;
      break;
    }
  }
  if (changed) writeFileStore(items);
  return changed;
}

export async function markAllNotificationsRead(displayName, { excludePersistent = false } = {}) {
  const key = personKey(displayName);
  if (!key) return 0;
  const now = new Date().toISOString();

  if (useDatabase()) {
    await ensureTable();
    if (excludePersistent) {
      const rows = await sql()`
        UPDATE appdev_notifications SET read_at = ${now}
        WHERE recipient_key = ${key}
          AND read_at IS NULL
          AND type <> 'review_request'
        RETURNING id
      `;
      return rows.length;
    }
    const rows = await sql()`
      UPDATE appdev_notifications SET read_at = ${now}
      WHERE recipient_key = ${key} AND read_at IS NULL
      RETURNING id
    `;
    return rows.length;
  }

  const items = readFileStore();
  let count = 0;
  for (const n of items) {
    if (n.recipient_key !== key || n.read_at) continue;
    if (excludePersistent && n.type === 'review_request' && !n.payload?.resolved) continue;
    n.read_at = now;
    count += 1;
  }
  if (count) writeFileStore(items);
  return count;
}
