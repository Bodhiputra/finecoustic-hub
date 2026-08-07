#!/usr/bin/env node
/**
 * Copy-only migration: appdev_board JSON blob → relational tables.
 * Never deletes or modifies the legacy blob row.
 *
 * Usage: npm run db:migrate-appdev
 * Requires DATABASE_URL (loads .env.local if present).
 *
 * Note: migration also runs automatically on first appdev API request after deploy.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first (Neon connection string).');
  process.exit(1);
}

const sql = neon(url);
const META_KEY = 'default';
const BLOB_KEY = 'default';

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS appdev_board (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS appdev_board_meta (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL DEFAULT 'Finecoustic App Development',
      next_number INTEGER NOT NULL DEFAULT 1,
      people JSONB NOT NULL DEFAULT '[]',
      task_types JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
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
  await sql`
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
}

function workersOf(issue) {
  if (Array.isArray(issue.workers) && issue.workers.length) return issue.workers;
  if (issue.worker) return [issue.worker];
  return [];
}

const beforeIssues = await sql`SELECT COUNT(*)::int AS c FROM appdev_issues`;
const beforeComments = await sql`SELECT COUNT(*)::int AS c FROM appdev_comments`;
const blobRows = await sql`SELECT data, updated_at FROM appdev_board WHERE id = ${BLOB_KEY}`;

console.log('Before migration:');
console.log('  legacy blob row:', blobRows.length ? blobRows[0].updated_at : '(none)');
console.log('  relational issues:', beforeIssues[0]?.c ?? 0);
console.log('  relational comments:', beforeComments[0]?.c ?? 0);

if (!blobRows.length) {
  console.log('\nNo legacy blob found — nothing to migrate.');
  process.exit(0);
}

await ensureSchema();

const board = blobRows[0].data;
const issues = Array.isArray(board.issues) ? board.issues : [];
const existing = beforeIssues[0]?.c ?? 0;

if (existing >= issues.length && issues.length > 0) {
  console.log('\nAlready synced — relational store has all blob issues. Legacy blob preserved.');
  process.exit(0);
}

if (existing > 0) {
  console.log(`\nResuming migration (${existing}/${issues.length} issues already copied)...`);
}

for (const issue of issues) {
  const workers = workersOf(issue);
  await sql`
    INSERT INTO appdev_issues (
      id, title, description, type, status, priority, assignee, workers,
      assigned_at, completed_at, due_at, image_urls, video_urls, created_at, updated_at
    ) VALUES (
      ${issue.id},
      ${issue.title || 'Untitled'},
      ${issue.description || ''},
      ${issue.type || 'task'},
      ${issue.status || 'todo'},
      ${issue.priority || 'none'},
      ${issue.assignee || ''},
      ${JSON.stringify(workers)}::jsonb,
      ${issue.assigned_at || null},
      ${issue.completed_at || null},
      ${issue.due_at || null},
      ${JSON.stringify(issue.image_urls || [])}::jsonb,
      ${JSON.stringify(issue.video_urls || [])}::jsonb,
      ${issue.created_at || new Date().toISOString()},
      ${issue.updated_at || new Date().toISOString()}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  for (const c of issue.comments || []) {
    if (!c?.id) continue;
    await sql`
      INSERT INTO appdev_comments (id, issue_id, author, body, image_urls, video_urls, created_at)
      VALUES (
        ${c.id},
        ${issue.id},
        ${c.author || ''},
        ${c.body || ''},
        ${JSON.stringify(c.image_urls || [])}::jsonb,
        ${JSON.stringify(c.video_urls || [])}::jsonb,
        ${c.created_at || new Date().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

const metaUpdated = board.meta?.updated_at || new Date().toISOString();
await sql`
  INSERT INTO appdev_board_meta (id, project, next_number, people, task_types, updated_at)
  VALUES (
    ${META_KEY},
    ${board.meta?.project || 'Finecoustic App Development'},
    ${board.next_number || 1},
    ${JSON.stringify(board.meta?.people || [])}::jsonb,
    ${JSON.stringify(board.meta?.task_types || [])}::jsonb,
    ${metaUpdated}
  )
  ON CONFLICT (id) DO NOTHING
`;

const afterIssues = await sql`SELECT COUNT(*)::int AS c FROM appdev_issues`;
const afterComments = await sql`SELECT COUNT(*)::int AS c FROM appdev_comments`;
const blobAfter = await sql`SELECT updated_at FROM appdev_board WHERE id = ${BLOB_KEY}`;

if (issues.length > 0 && afterIssues[0].c < issues.length) {
  console.error(`\nVerification failed: expected ${issues.length} issues, got ${afterIssues[0].c}`);
  process.exit(1);
}

console.log('\nMigration complete:');
console.log('  relational issues:', afterIssues[0]?.c ?? 0);
console.log('  relational comments:', afterComments[0]?.c ?? 0);
console.log('  legacy blob preserved:', Boolean(blobAfter.length), blobAfter[0]?.updated_at || '');
