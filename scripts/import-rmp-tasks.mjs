#!/usr/bin/env node
/**
 * One-time import of RemindMePlease tasks into data/warzone-tasks.json (local dev).
 * Usage: npm run import:rmp -- [path-to-tasks.json] [displayName]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const rmpPath = process.argv[2] || join(process.env.HOME || '', '.remindmeplease/tasks.json');
const displayName = process.argv[3] || 'FCS-建宏';
const outFile = join(process.cwd(), 'data/warzone-tasks.json');

const deptMap = {
  Marketing: 'marketing',
  Product: 'products',
  WebsiteDev: 'creatives',
  Shopify: 'operations',
  FinecousticApp: 'products',
  Personal: 'operations',
  SideProject: 'products',
};

if (!existsSync(rmpPath)) {
  console.error('RMP tasks file not found:', rmpPath);
  process.exit(1);
}

const data = JSON.parse(readFileSync(rmpPath, 'utf8'));
const incoming = data.tasks || [];

let store = { tasks: [] };
if (existsSync(outFile)) {
  store = JSON.parse(readFileSync(outFile, 'utf8'));
}
const byRmp = new Map((store.tasks || []).filter(t => t.rmp_id).map(t => [t.rmp_id, t]));

let imported = 0;
let updated = 0;

for (const raw of incoming) {
  const rmpId = String(raw.id || '');
  if (!rmpId) continue;
  const existing = byRmp.get(rmpId);
  const now = new Date().toISOString();
  const task = {
    id: existing?.id || randomUUID(),
    kind: 'task',
    title: raw.title || 'Untitled',
    notes: raw.notes || '',
    department: deptMap[raw.category] || 'operations',
    subtype: raw.category || '',
    status: raw.status === 'done' ? 'done' : raw.status === 'archived' ? 'archived' : 'todo',
    priority: raw.priority || 'none',
    deadline: raw.deadline ? String(raw.deadline).slice(0, 10) : null,
    planned_for: raw.plannedFor ? String(raw.plannedFor).slice(0, 10) : null,
    visibility: 'private',
    owner: displayName,
    assignee: '',
    link_url: '',
    created_by: displayName,
    source: 'rmp',
    rmp_id: rmpId,
    created_at: raw.createdAt || now,
    updated_at: now,
    completed_at: raw.completedAt || null,
  };
  if (existing) updated += 1;
  else imported += 1;
  byRmp.set(rmpId, task);
}

store.tasks = [...byRmp.values()];
mkdirSync(join(process.cwd(), 'data'), { recursive: true });
writeFileSync(outFile, JSON.stringify(store, null, 2));
console.log({ imported, updated, total: incoming.length, outFile });
