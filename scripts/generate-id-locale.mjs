/**
 * Build lib/i18n/locales/id.js from English — full hub Indonesian locale.
 * Uses MyMemory free API (cached on disk). Re-run safely.
 *
 *   node scripts/generate-id-locale.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CACHE_PATH = path.join(ROOT, 'lib/i18n/.id-translate-cache.json');
const OUT_PATH = path.join(ROOT, 'lib/i18n/locales/id.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function collectStrings(node, set) {
  if (typeof node === 'string') {
    set.add(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, set);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) collectStrings(v, set);
  }
}

function applyTranslations(node, map) {
  if (typeof node === 'string') return map.get(node) ?? node;
  if (Array.isArray(node)) return node.map(item => applyTranslations(item, map));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = applyTranslations(v, map);
    }
    return out;
  }
  return node;
}

async function translateEnToId(text, cache) {
  if (cache[text]) return cache[text];
  if (!text.trim()) {
    cache[text] = text;
    return text;
  }

  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text.slice(0, 450));
  url.searchParams.set('langpair', 'en|id');

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      const body = await res.json();
      const translated = body?.responseData?.translatedText;
      if (translated && typeof translated === 'string') {
        cache[text] = translated;
        return translated;
      }
    } catch {
      /* retry */
    }
    await sleep(600 * (attempt + 1));
  }

  cache[text] = text;
  return text;
}

function serializeLocale(obj) {
  return `/** Auto-generated Indonesian locale — run scripts/generate-id-locale.mjs to refresh */\nexport default ${JSON.stringify(obj, null, 2)};\n`;
}

async function main() {
  const messagesUrl = pathToFileURL(path.join(ROOT, 'lib/i18n/messages.js')).href;
  const mod = await import(messagesUrl);
  const en = mod.messages?.en;
  if (!en) {
    console.error('Could not load messages.en');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const cache = loadCache();
  const unique = new Set();
  collectStrings(en, unique);
  const list = [...unique].sort((a, b) => a.length - b.length);

  let done = 0;
  for (const text of list) {
    if (!cache[text]) {
      await translateEnToId(text, cache);
      await sleep(150);
    }
    done += 1;
    if (done % 50 === 0) {
      saveCache(cache);
      console.log(`Progress ${done}/${list.length}`);
    }
  }
  saveCache(cache);

  const map = new Map(list.map(s => [s, cache[s] || s]));
  const id = applyTranslations(structuredClone(en), map);
  fs.writeFileSync(OUT_PATH, serializeLocale(id), 'utf8');
  console.log(`Wrote ${OUT_PATH} (${list.length} unique strings).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
