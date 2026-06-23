#!/usr/bin/env node
/**
 * Start exactly one Next.js dev server on port 3000.
 * Kills any existing listeners on 3000–3002 first (stale/duplicate dev).
 */
import { execSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const PORTS = [3000, 3001, 3002];
const clean = process.argv.includes('--clean');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

for (const port of PORTS) killPort(port);

if (clean) {
  execSync('rm -rf .next', { stdio: 'inherit', cwd: root });
  console.log('Cleared .next cache');
}

console.log(`Starting dev server on http://localhost:${PORT}`);

const child = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  stdio: 'inherit',
  cwd: root,
});

child.on('exit', code => process.exit(code ?? 0));

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
