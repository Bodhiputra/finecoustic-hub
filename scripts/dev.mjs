#!/usr/bin/env node
/**
 * Start exactly one Next.js dev server on port 3000.
 * Kills stale listeners, auto-clears .next after an unclean exit, uses Turbopack.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const PORTS = [3000, 3001, 3002];
const clean = process.argv.includes('--clean');
const noTurbo = process.argv.includes('--no-turbo');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markerPath = join(root, '.next-dev-marker.json');

function killPort(port) {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (!out) return;
    for (const pid of out.split(/\s+/)) {
      if (pid) {
        try {
          process.kill(Number(pid), 'SIGKILL');
        } catch {
          /* already gone */
        }
      }
    }
    console.log(`Stopped process(es) on port ${port}`);
  } catch {
    /* nothing listening */
  }
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readMarker() {
  if (!existsSync(markerPath)) return null;
  try {
    return JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch {
    return null;
  }
}

function clearNextCache(reason) {
  execSync('rm -rf .next', { stdio: 'inherit', cwd: root });
  console.log(reason);
}

function removeMarker() {
  try {
    unlinkSync(markerPath);
  } catch {
    /* already gone */
  }
}

function writeMarker(pid) {
  writeFileSync(
    markerPath,
    JSON.stringify({ pid, started: Date.now(), port: PORT }),
    'utf8',
  );
}

for (const port of PORTS) killPort(port);

const marker = readMarker();
const uncleanExit = marker && !isPidAlive(marker.pid);

if (clean) {
  clearNextCache('Cleared .next cache (--clean)');
} else if (uncleanExit) {
  clearNextCache(
    'Previous dev server exited uncleanly — cleared .next to avoid 500 / stale HMR errors',
  );
}

removeMarker();

const nextArgs = ['next', 'dev', '-p', String(PORT)];
if (!noTurbo) nextArgs.push('--turbo');

console.log(`Starting dev server on http://localhost:${PORT}${noTurbo ? '' : ' (Turbopack)'}`);

const child = spawn('npx', nextArgs, {
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    // Reduces Next 15 dev overlay noise that can trip RSC manifests during HMR.
    NEXT_DISABLE_DEVTOOLS: '1',
  },
});

if (child.pid) writeMarker(child.pid);

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  removeMarker();
  child.kill(signal);
}

child.on('exit', code => {
  removeMarker();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
