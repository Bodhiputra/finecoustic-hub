import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase, withNeonRetry } from '@/lib/neon-sql';
import { normalizeComment } from '@/lib/appdev';
import { normalizeImageUrls, normalizeVideoUrls } from '@/lib/appdev-media';
import {
  normalizeTask,
  taskVisibleToActor,
  taskAssignedToActor,
  PERSONAL_DEPARTMENT_ID,
  isUndatedTask,
  isScheduledTask,
  todayKey,
} from '@/lib/internal';
import { resolveWorkflowPatch, applyAutoStartWhenAssigned, shouldApplyAutoStartOnUpdate, taskAssigneeKey } from '@/lib/task-workflow';
import { canCreateTask, canCreateTaskInDepartment, canDeleteTask, canManageKolOutreach } from '@/lib/hub-permissions';
import { KOL_OUTREACH_BOARD_ID } from '@/lib/campaign-kol';
import { getBoardById } from '@/lib/internal-campaigns-data';
import { runTaskCommentSideEffects, runTaskUpdateSideEffects, notifyTaskAssigned, notifyMeetingScheduled } from '@/lib/internal-task-notifications';
import { listActiveTeamMemberNames } from '@/lib/hub-users';
import { HARDCODED_MASTER_NAMES } from '@/lib/appdev-constants';
import { buildMentionKnownNames } from '@/lib/mention-parse';
import { applyRecurrenceAfterComplete } from '@/lib/task-recurrence';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'internal-tasks.json');
const LEGACY_FILE = join(DATA_DIR, 'warzone-tasks.json');

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

async function migrateLegacyTable() {
  try {
    const rows = await sql()`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('warzone_tasks', 'internal_tasks')
    `;
    const names = new Set(rows.map(r => r.tablename));
    if (names.has('warzone_tasks') && !names.has('internal_tasks')) {
      await sql()`ALTER TABLE warzone_tasks RENAME TO internal_tasks`;
      await sql()`ALTER INDEX IF EXISTS warzone_tasks_dept_idx RENAME TO internal_tasks_dept_idx`;
      await sql()`ALTER INDEX IF EXISTS warzone_tasks_deadline_idx RENAME TO internal_tasks_deadline_idx`;
    }
  } catch {
    // Fresh installs only have internal_tasks.
  }
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = migrateLegacyTable()
      .then(() => sql()`
      CREATE TABLE IF NOT EXISTS internal_tasks (
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
    `)
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS internal_tasks_dept_idx ON internal_tasks (department)`;
        await sql()`CREATE INDEX IF NOT EXISTS internal_tasks_deadline_idx ON internal_tasks (deadline)`;
        await sql()`CREATE INDEX IF NOT EXISTS internal_tasks_assignee_idx ON internal_tasks (assignee_key)`;
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
  const dataFile = existsSync(FILE) ? FILE : LEGACY_FILE;
  if (!existsSync(dataFile)) {
    writeFileSync(FILE, JSON.stringify({ tasks: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(existsSync(FILE) ? FILE : dataFile, 'utf8'));
  return Array.isArray(raw?.tasks) ? raw.tasks.map(t => normalizeTask(t)) : [];
}

function writeFileStore(tasks) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ tasks }, null, 2));
}

async function readAllRaw() {
  if (useDatabase()) {
    await ensureTable();
    const rows = await withNeonRetry(() => sql()`SELECT data FROM internal_tasks ORDER BY updated_at DESC`);
    return rows.map(r => normalizeTask(r.data));
  }
  return readFileStore();
}

/** Milestones and meetings for cron schedule alerts (not department board tasks). */
export async function listAllTasksForScheduleAlerts() {
  const all = await readAllRaw();
  return all.filter(task => task?.kind === 'meeting' || task?.kind === 'milestone');
}

/** KOL outreach board tasks for pipeline automations. */
export async function listKolOutreachTasksForAlerts() {
  const { KOL_OUTREACH_BOARD_ID } = await import('@/lib/campaign-kol');
  const all = await readAllRaw();
  return all.filter(
    task => task?.board_id === KOL_OUTREACH_BOARD_ID && task?.kind !== 'meeting'
  );
}

/** Legacy no_reply rows on the outreach board only — scoped read for hot-path migration. */
export async function listKolOutreachLegacyNoReplyTasks() {
  const { KOL_OUTREACH_BOARD_ID } = await import('@/lib/campaign-kol');
  const items = await readTasksScoped({ board_id: KOL_OUTREACH_BOARD_ID });
  return items.filter(task => String(task.status || '') === 'no_reply');
}

/** Cron/system patch — bypasses actor permission checks. */
export async function systemUpdateTask(id, patch) {
  const existing = await readTaskByIdRaw(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const next = normalizeTask(
    { ...existing, ...patch, id: existing.id, updated_at: now },
    'System'
  );
  const saved = await writeOne(next);
  const { dismissStaleKolOutreachNotifications } = await import('@/lib/kol-outreach-alerts');
  await dismissStaleKolOutreachNotifications(saved).catch(() => {});
  return saved;
}

/** Hub home calendar — milestones and meetings only (not department board tasks). */
async function readTasksForHubHome() {
  const scheduleKinds = new Set(['milestone', 'meeting', 'event']);
  if (!useDatabase()) {
    return readFileStore().filter(
      t => t.status !== 'archived'
        && t.status !== 'cancelled'
        && scheduleKinds.has(t.kind)
    );
  }
  await ensureTable();
  const rows = await withNeonRetry(() => sql()`
    SELECT data FROM internal_tasks
    WHERE status NOT IN ('archived', 'cancelled')
      AND COALESCE(data->>'kind', 'task') IN ('milestone', 'meeting', 'event')
    ORDER BY updated_at DESC
  `);
  return rows.map(r => normalizeTask(r.data));
}

async function readTaskByIdRaw(id) {
  if (!useDatabase()) {
    const task = readFileStore().find(t => t.id === id);
    return task ? normalizeTask(task) : null;
  }
  await ensureTable();
  const rows = await withNeonRetry(() => sql()`
    SELECT data FROM internal_tasks WHERE id = ${id} LIMIT 1
  `);
  if (!rows.length) return null;
  return normalizeTask(rows[0].data);
}

/** Narrow DB reads — avoids loading every task when a board/campaign/dept filter is active. */
async function readTasksScoped({ department, board_id, campaign_id, flow_only } = {}) {
  if (!useDatabase()) {
    let items = readFileStore();
    if (board_id) {
      items = items.filter(t => t.board_id === board_id);
    } else if (campaign_id) {
      items = items.filter(t => t.campaign_id === campaign_id);
      if (flow_only) items = items.filter(t => !t.board_id);
    } else if (department) {
      items = items.filter(t => t.department === department || t.department === 'all');
    }
    return items;
  }

  await ensureTable();

  if (board_id) {
    const rows = await withNeonRetry(() => sql()`
      SELECT data FROM internal_tasks
      WHERE data->>'board_id' = ${board_id}
      ORDER BY updated_at DESC
    `);
    return rows.map(r => normalizeTask(r.data));
  }

  if (campaign_id) {
    if (flow_only) {
      const rows = await withNeonRetry(() => sql()`
        SELECT data FROM internal_tasks
        WHERE data->>'campaign_id' = ${campaign_id}
          AND COALESCE(data->>'board_id', '') = ''
        ORDER BY updated_at DESC
      `);
      return rows.map(r => normalizeTask(r.data));
    }
    const rows = await withNeonRetry(() => sql()`
      SELECT data FROM internal_tasks
      WHERE data->>'campaign_id' = ${campaign_id}
      ORDER BY updated_at DESC
    `);
    return rows.map(r => normalizeTask(r.data));
  }

  if (department) {
    const rows = await withNeonRetry(() => sql()`
      SELECT data FROM internal_tasks
      WHERE department = ${department} OR department = 'all'
      ORDER BY updated_at DESC
    `);
    return rows.map(r => normalizeTask(r.data));
  }

  return readAllRaw();
}

/** Assigned-to-me inbox — index-friendly read instead of loading every task. */
async function readTasksAssignedTo(actor) {
  const key = personKey(actor?.displayName);
  if (!key) return [];

  if (!useDatabase()) {
    return readFileStore().filter(t => taskAssignedToActor(t, actor));
  }

  await ensureTable();
  const rows = await withNeonRetry(() => sql()`
    SELECT data FROM internal_tasks
    WHERE assignee_key = ${key}
       OR (
         COALESCE(assignee_key, '') = ''
         AND lower(COALESCE(data->>'created_by', '')) = ${key}
       )
    ORDER BY updated_at DESC
  `);
  return rows.map(r => normalizeTask(r.data));
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
      INSERT INTO internal_tasks (id, kind, data, department, status, deadline, planned_for, visibility, owner_key, assignee_key, updated_at)
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

export async function listTasksForActor(actor, {
  department,
  bucket,
  board_id,
  campaign_id,
  flow_only,
  assigned_to_me,
  hub_home,
} = {}) {
  const wantsAssignedOnly =
    assigned_to_me || (department === PERSONAL_DEPARTMENT_ID && !board_id);

  let items;
  if (board_id || campaign_id) {
    items = await readTasksScoped({ department, board_id, campaign_id, flow_only });
  } else if (wantsAssignedOnly) {
    items = await readTasksAssignedTo(actor);
  } else if (department) {
    items = await readTasksScoped({ department, board_id, campaign_id, flow_only });
  } else if (hub_home) {
    items = await readTasksForHubHome();
  } else {
    items = await readAllRaw();
  }

  items = items.filter(t => taskVisibleToActor(t, actor));

  if (!wantsAssignedOnly && department && !board_id && !campaign_id) {
    items = items.filter(t => t.department === department || t.department === 'all');
  }

  if (board_id) {
    items = items.filter(t => t.board_id === board_id);
  } else if (campaign_id) {
    items = items.filter(t => t.campaign_id === campaign_id);
    if (flow_only) {
      items = items.filter(t => !t.board_id);
    }
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
      t => t.kind === 'task'
        && t.deadline
        && t.deadline < key
        && t.status !== 'done'
        && t.status !== 'archived'
        && t.status !== 'cancelled'
    );
  } else if (bucket === 'milestones') {
    items = items.filter(t => t.kind === 'milestone');
  }

  items = await repairLegacyAutoStartTasks(items);

  return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

const LEGACY_AUTOSTART_BATCH = 40;

/** Persist assigned tasks stuck in Todo (legacy data) — capped per request. */
async function repairLegacyAutoStartTasks(items) {
  let repaired = 0;
  const out = [];
  for (const task of items) {
    if (
      repaired >= LEGACY_AUTOSTART_BATCH
      || task.kind !== 'task'
      || task.status !== 'todo'
      || !taskAssigneeKey(task)
      || task.paused_at
    ) {
      out.push(task);
      continue;
    }
    const fixed = {
      ...task,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    };
    out.push(await writeOne(fixed));
    repaired += 1;
  }
  return out;
}

export async function getTaskById(id, actor) {
  const task = await readTaskByIdRaw(id);
  if (!task || !taskVisibleToActor(task, actor)) return null;
  return task;
}

export async function createTask(input, actor) {
  const boardId = String(input?.board_id || '');
  const isKolOutreachCard = boardId === KOL_OUTREACH_BOARD_ID
    && input?.kind !== 'milestone'
    && input?.kind !== 'meeting'
    && input?.kind !== 'event';

  if (isKolOutreachCard) {
    if (!canManageKolOutreach(actor)) {
      const err = new Error('forbidden');
      err.status = 403;
      throw err;
    }
  } else if (!canCreateTask(actor)) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }
  const now = new Date().toISOString();
  const visibility = input.visibility === 'private' ? 'private' : 'team';
  const kind = input.kind === 'milestone'
    ? 'milestone'
    : input.kind === 'event'
      ? 'event'
      : input.kind === 'meeting'
        ? 'meeting'
        : 'task';
  const task = normalizeTask(
    {
      ...input,
      id: randomUUID(),
      kind,
      status: kind === 'task' ? (input.status || 'todo') : input.status,
      created_by: actor.displayName,
      owner: visibility === 'private' ? actor.displayName : input.owner || '',
      created_at: now,
      updated_at: now,
      completed_at: kind === 'task' ? null : input.status === 'done' ? now : null,
    },
    actor.displayName
  );

  if (!task.title) {
    const err = new Error('title_required');
    err.status = 400;
    throw err;
  }

  let deptForPermission = task.department;
  if (task.board_id) {
    const board = await getBoardById(task.board_id);
    if (!board) {
      const err = new Error('board_not_found');
      err.status = 400;
      throw err;
    }
    deptForPermission = board.department;
  }

  if (!isKolOutreachCard && !canCreateTaskInDepartment(actor, deptForPermission)) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  if (deptForPermission === PERSONAL_DEPARTMENT_ID) {
    task.assignee = String(actor.displayName || '').trim();
  }

  const saved = await writeOne(applyAutoStartWhenAssigned(task));
  if (saved.kind === 'meeting') {
    await notifyMeetingScheduled(saved, actor).catch(() => {});
  } else {
    await notifyTaskAssigned(saved, actor, { prevAssignee: '' }).catch(() => {});
  }
  return saved;
}

/** Server-only seed/migrate — bypasses create permission checks. */
export async function upsertHubTask(task, actorDisplayName = 'System') {
  const normalized = normalizeTask(task, actorDisplayName);
  if (!normalized.title) {
    const err = new Error('title_required');
    err.status = 400;
    throw err;
  }
  return writeOne(normalized);
}

export async function updateTask(id, patch, actor) {
  const existing = await getTaskById(id, actor);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const { sanitizeTaskPatch } = await import('@/lib/internal-task-panel-permissions');
  const metadataSafe = sanitizeTaskPatch(existing, patch, actor);
  const safePatch = resolveWorkflowPatch(existing, metadataSafe, actor);
  delete safePatch.created_by;

  const now = new Date().toISOString();
  let next = normalizeTask({ ...existing, ...safePatch, id: existing.id, updated_at: now }, actor.displayName);

  if (patch.visibility === 'private') {
    next.owner = actor.displayName;
  }

  if (next.status === 'done' && !next.completed_at) next.completed_at = now;
  if (next.status !== 'done') next.completed_at = null;

  if (next.status === 'done') {
    next = normalizeTask(applyRecurrenceAfterComplete(next), actor.displayName);
  }

  if (existing.department === PERSONAL_DEPARTMENT_ID) {
    next.assignee = String(actor.displayName || '').trim();
  } else if (existing.board_id) {
    const board = await getBoardById(existing.board_id);
    if (board?.department === PERSONAL_DEPARTMENT_ID) {
      next.assignee = String(actor.displayName || '').trim();
    }
  }

  const mergedPatch = { ...patch, ...safePatch };
  if (mergedPatch.status === 'todo' && taskAssigneeKey(next)) {
    next.paused_at = now;
  } else if (
    mergedPatch.status
    && mergedPatch.status !== 'todo'
    && next.paused_at
  ) {
    next.paused_at = null;
  }

  if (shouldApplyAutoStartOnUpdate(existing, next, mergedPatch)) {
    next = applyAutoStartWhenAssigned(next);
    next.paused_at = null;
  }

  if (String(existing.board_id || '') === KOL_OUTREACH_BOARD_ID && next.kind !== 'meeting') {
    const {
      KOL_BOARD_PROP,
      kolOutreachOrderNumber,
      validateKolOrderNumber,
    } = await import('@/lib/kol-outreach-shared');
    const prevOrder = kolOutreachOrderNumber(existing.custom_values);
    const nextOrder = kolOutreachOrderNumber(next.custom_values);
    if (nextOrder && nextOrder !== prevOrder) {
      const result = validateKolOrderNumber(nextOrder);
      next.custom_values = {
        ...(next.custom_values || {}),
        [KOL_BOARD_PROP.orderNumber]: result.normalized,
      };
    }
  }

  const saved = await writeOne(next);
  await runTaskUpdateSideEffects({
    existing,
    next: saved,
    actor,
    patch: { ...patch, ...safePatch },
  }).catch(() => {});
  if (saved.kind === 'meeting') {
    await notifyMeetingScheduled(saved, actor, {
      prevAttendees: existing.meeting_attendees || [],
    }).catch(() => {});
  }
  return saved;
}

export async function addTaskComment(id, input, actor) {
  const existing = await getTaskById(id, actor);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const { assertCanCommentOnTask } = await import('@/lib/internal-task-panel-permissions');
  assertCanCommentOnTask(existing, actor);

  const author = String(actor?.displayName || '').trim();
  const body = String(input?.body || '').trim();
  const image_urls = normalizeImageUrls(input?.image_urls);
  const video_urls = normalizeVideoUrls(input?.video_urls, input?.video_url);
  if (!author || (!body && !image_urls.length && !video_urls.length)) {
    const err = new Error('invalid_comment');
    err.status = 400;
    throw err;
  }

  const comment = normalizeComment({
    id: `cmt-${randomUUID()}`,
    author,
    body,
    image_urls,
    video_urls,
    created_at: new Date().toISOString(),
  });
  if (!comment) {
    const err = new Error('invalid_comment');
    err.status = 400;
    throw err;
  }

  const next = normalizeTask(
    {
      ...existing,
      comments: [...(existing.comments || []), comment],
      updated_at: new Date().toISOString(),
    },
    actor.displayName
  );

  const saved = await writeOne(next);
  const teamList = await listActiveTeamMemberNames().catch(() => []);
  const knownNames = buildMentionKnownNames(teamList, [
    ...HARDCODED_MASTER_NAMES,
    existing.created_by,
    existing.assignee,
  ]);
  await runTaskCommentSideEffects({
    task: saved,
    comment,
    actor,
    knownNames,
  }).catch(() => {});
  return saved;
}

export async function deleteTask(id, actor) {
  const existing = await getTaskById(id, actor);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  if (!canDeleteTask(actor, existing)) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  if (useDatabase()) {
    await ensureTable();
    await sql()`DELETE FROM internal_tasks WHERE id = ${id}`;
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
