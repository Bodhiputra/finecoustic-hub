#!/usr/bin/env node
/**
 * Delete all provisioned Fine Hub users (hub_users table / hub-users.json).
 * Master admin (FCS-建宏 + HUB_MASTER_PASSWORD) is unaffected.
 *
 * Usage: npm run db:clear-hub-users
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const DATA_DIR = join(root, 'data');
const FILE = join(DATA_DIR, 'hub-users.json');

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

async function clearHubUsers() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    const rows = await sql`DELETE FROM hub_users RETURNING id`;
    return rows.length;
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  let count = 0;
  if (existsSync(FILE)) {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    count = Array.isArray(raw?.users) ? raw.users.length : 0;
  }
  writeFileSync(FILE, JSON.stringify({ users: [] }, null, 2));
  return count;
}

const count = await clearHubUsers();
console.log(`Removed ${count} hub user(s). Master admin login is unchanged.`);
