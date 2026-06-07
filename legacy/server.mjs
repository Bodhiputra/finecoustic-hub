#!/usr/bin/env node
/**
 * Local ops hub — static files + read/write API for ops-data.json
 * Usage: node ops-hub/server.mjs
 * Open: http://localhost:3456
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function dataPath(brand) {
  return join(ROOT, 'brands', brand, 'ops-data.json');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: read ops data
  if (req.method === 'GET' && url.pathname.startsWith('/api/brands/')) {
    const brand = url.pathname.split('/')[3];
    const file = dataPath(brand);
    if (!existsSync(file)) return send(res, 404, JSON.stringify({ error: 'Brand not found' }), 'application/json');
    return send(res, 200, readFileSync(file, 'utf8'), 'application/json');
  }

  // API: save ops data
  if (req.method === 'PUT' && url.pathname.startsWith('/api/brands/')) {
    const brand = url.pathname.split('/')[3];
    const file = dataPath(brand);
    if (!existsSync(dirname(file))) return send(res, 404, JSON.stringify({ error: 'Brand not found' }), 'application/json');
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body);
      parsed.meta = parsed.meta || {};
      parsed.meta.updated_at = new Date().toISOString();
      writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n');
      return send(res, 200, JSON.stringify({ ok: true, updated_at: parsed.meta.updated_at }), 'application/json');
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: e.message }), 'application/json');
    }
  }

  // Static files
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = join(ROOT, path);

  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    return send(res, 404, 'Not found');
  }

  const ext = extname(filePath);
  send(res, 200, readFileSync(filePath), MIME[ext] || 'application/octet-stream');
});

server.listen(PORT, () => {
  console.log(`Ops hub → http://localhost:${PORT}`);
  console.log('Edit in browser — saves to brands/finecoustic/ops-data.json');
});
