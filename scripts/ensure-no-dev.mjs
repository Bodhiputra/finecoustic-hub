#!/usr/bin/env node
/**
 * Refuse production build while the dev server is running — `next build`
 * overwrites `.next` and breaks an active `next dev` session (500 errors).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markerPath = join(root, '.next-dev-marker.json');

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(markerPath)) process.exit(0);

let marker;
try {
  marker = JSON.parse(readFileSync(markerPath, 'utf8'));
} catch {
  process.exit(0);
}

if (isPidAlive(marker.pid)) {
  console.error(
    '\nerror: Dev server is running (pid %s). Stop it before `npm run build`.\n' +
      '       Running build during dev corrupts .next and causes 500 errors.\n',
    marker.pid,
  );
  process.exit(1);
}
