#!/usr/bin/env node
/**
 * Delete all preorder questionnaire responses (Neon or local JSON).
 * Usage:
 *   npm run db:flush-preorder-survey
 *   DATABASE_URL=postgres://... npm run db:flush-preorder-survey
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvFile(name) {
  const envPath = join(root, name);
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

loadEnvFile('.env.local');
loadEnvFile('.env.production.local');

const { clearPreorderSurveyResponses } = await import('../lib/preorder-survey.js');
const result = await clearPreorderSurveyResponses();
console.log(`Flushed ${result.deleted} preorder survey response(s) from ${result.storage}.`);
