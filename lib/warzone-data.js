import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import {
  normalizeTask,
  taskVisibleToActor,
  isUndatedTask,
  isScheduledTask,
  todayKey,
} from '@/lib/warzone';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'warzone-tasks.json');

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
      CREATE TABLE IF NOT EXISTS warzone_tasks (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'task',
        data JSONB NOT NULL,
        department TEXT NOT NULL DEFAULT 'operations',
        status TEXT NOT NULL DEFAULT 'todo',
        deadline DATE,
        planned_for DATE,
        visibility TEXT NOT NULL DEFAULT 'team',
        owner_key TEXT NOT NULL DEFAULT '',
        assignee_key TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS warzone_tasks_dept_idx ON warzone_tasks (department)`;
        await sql()`CREATE INDEX IF NOT EXISTS warzone_tasks_deadline_idx ON warzone_tasks (deadline)`;
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

function personKey(name) {
  return String(name || '').trim().toLowerCase();
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ tasks: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.tasks) ? raw.tasks.map(t => normalizeTask(t)) : [];
}

function writeFileStore(tasks) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ tasks }, null, 2));
}

async function readAllRaw() {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`SELECT data FROM warzone_tasks ORDER BY updated_at DESC`;
    return rows.map(r => normalizeTask(r.data));
  }
  return readFileStore();
}

function rowMeta(task) {
  return {
    department: task.department,
    status: task.status,
    deadline: task.deadline,
    planned_for: task.planned_for,
    visibility: task.visibility,
    owner_key: personKey(task.owner),
    assignee_key: personKey(task.assignee),
    updated_at: task.updated_at,
  };
}

async function writeOne(task) {
  const normalized = normalizeTask(task);
  if (useDatabase()) {
    await ensureTable();
    const meta = rowMeta(normalized);
    await sql()`
      INSERT INTO warzone_tasks (id, kind, data, department, status, deadline, planned_for, visibility, owner_key, assignee_key, updated_at)
      VALUES (
        ${normalized.id}, ${normalized.kind}, ${JSON.stringify(normalized)}::jsonb,
        ${meta.department}, ${meta.status}, ${meta.deadline}, ${meta.planned_for},
        ${meta.visibility}, ${meta.owner_key}, ${meta.assignee_key}, ${meta.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        data = EXCLUDED.data,
        department = EXCLUDED.department,
        status = EXCLUDED.status,
        deadline = EXCLUDED.deadline,
        planned_for = EXCLUDED.planned_for,
        visibility = EXCLUDED.visibility,
        owner_key = EXCLUDED.owner_key,
        assignee_key = EXCLUDED.assignee_key,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const tasks = readFileStore();
    const idx = tasks.findIndex(t => t.id === normalized.id);
    if (idx === -1) tasks.unshift(normalized);
    else tasks[idx] = normalized;
    writeFileStore(tasks);
  }
  return normalized;
}

export async function listTasksForActor(actor, { department, bucket } = {}) {
  const all = await readAllRaw();
  let items = all.filter(t => taskVisibleToActor(t, actor));

  if (department) {
    items = items.filter(t => t.department === department);
  }

  if (bucket === 'bank') {
    items = items.filter(
      t => t.kind === 'task' && t.status !== 'done' && t.status !== 'archived' && isUndatedTask(t)
    );
  } else if (bucket === 'in_progress') {
    items = items.filter(t => t.kind === 'task' && t.status === 'in_progress');
  } else if (bucket === 'scheduled') {
    items = items.filter(
      t => t.kind === 'task' && t.status !== 'archived' && isScheduledTask(t)
    );
  } else if (bucket === 'today') {
    const key = todayKey();
    items = items.filter(t => {
      if (t.status === 'done' || t.status === 'archived' || t.status === 'cancelled') return false;
      return t.deadline === key || t.planned_for === key;
    });
  } else if (bucket === 'overdue') {
    const key = todayKey();
    items = items.filter(
      t => t.deadline && t.deadline < key && t.status !== 'done' && t.status !== 'archived' && t.status !== 'cancelled'
    );
  } else if (bucket === 'milestones') {
    items = items.filter(t => t.kind === 'milestone');
  }

  return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export async function getTaskById(id, actor) {
  const all = await readAllRaw();
  const task = all.find(t => t.id === id);
  if (!task || !taskVisibleToActor(task, actor)) return null;
  return task;
}

export async function createTask(input, actor) {
  const now = new Date().toISOString();
  const visibility = input.visibility === 'private' ? 'private' : 'team';
  const task = normalizeTask(
    {
      ...input,
      id: randomUUID(),
      kind: input.kind === 'milestone' ? 'milestone' : input.kind === 'event' ? 'event' : 'task',
      created_by: actor.displayName,
      owner: visibility === 'private' ? actor.displayName : input.owner || '',
      created_at: now,
      updated_at: now,
      completed_at: input.status === 'done' ? now : null,
    },
    actor.displayName
  );

  if (!task.title) {
    const err = new Error('title_required');
    err.status = 400;
    throw err;
  }

  return writeOne(task);
}

export async function updateTask(id, patch, actor) {
  const existing = await getTaskById(id, actor);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  let next = normalizeTask({ ...existing, ...patch, id: existing.id, updated_at: now }, actor.displayName);

  if (patch.visibility === 'private') {
    next.owner = actor.displayName;
  }

  if (next.status === 'done' && !next.completed_at) next.completed_at = now;
  if (next.status !== 'done') next.completed_at = null;

  return writeOne(next);
}

export async function deleteTask(id, actor) {
  const existing = await getTaskById(id, actor);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const canDelete =
    actor.isManager ||
    personKey(existing.created_by) === personKey(actor.displayName) ||
    (personKey(existing.owner) === personKey(actor.displayName) && existing.visibility === 'private');

  if (!canDelete) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  if (useDatabase()) {
    await ensureTable();
    await sql()`DELETE FROM warzone_tasks WHERE id = ${id}`;
  } else {
    writeFileStore(readFileStore().filter(t => t.id !== id));
  }
  return true;
}

export async function importRmpTasks(tasks, actor) {
  const existing = await readAllRaw();
  const byRmp = new Map(existing.filter(t => t.rmp_id).map(t => [t.rmp_id, t]));
  let imported = 0;
  let updated = 0;

  for (const raw of tasks || []) {
    const rmpId = String(raw.id || '');
    if (!rmpId) continue;

    const deptMap = {
      Marketing: 'marketing',
      Product: 'products',
      WebsiteDev: 'creatives',
      Shopify: 'operations',
      FinecousticApp: 'products',
      Personal: 'operations',
      SideProject: 'products',
    };
    const department = deptMap[raw.category] || 'operations';
    const mapped = normalizeTask({
      id: byRmp.get(rmpId)?.id || randomUUID(),
      kind: 'task',
      title: raw.title || 'Untitled',
      notes: raw.notes || '',
      department,
      subtype: raw.category || '',
      status: raw.status === 'done' ? 'done' : raw.status === 'archived' ? 'archived' : 'todo',
      priority: raw.priority || 'none',
      deadline: raw.deadline ? String(raw.deadline).slice(0, 10) : null,
      planned_for: raw.plannedFor ? String(raw.plannedFor).slice(0, 10) : null,
      visibility: 'private',
      owner: actor.displayName,
      created_by: actor.displayName,
      source: 'rmp',
      rmp_id: rmpId,
      created_at: raw.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: raw.completedAt || null,
    });

    if (byRmp.has(rmpId)) updated += 1;
    else imported += 1;
    await writeOne(mapped);
    byRmp.set(rmpId, mapped);
  }

  return { imported, updated, total: tasks?.length || 0 };
}

export async function exportTasksForRmp(actor) {
  const items = await listTasksForActor(actor, {});
  return items
    .filter(t => t.kind === 'task' && t.visibility === 'private' && personKey(t.owner) === personKey(actor.displayName))
    .map(t => ({
      id: t.rmp_id || t.id,
      title: t.title,
      notes: t.notes,
      status: t.status === 'archived' ? 'archived' : t.status === 'done' ? 'done' : 'todo',
      category: t.subtype || t.department,
      deadline: t.deadline || '',
      plannedFor: t.planned_for || '',
      addedBy: 'finehub',
      createdAt: t.created_at,
      completedAt: t.completed_at,
    }));
}
