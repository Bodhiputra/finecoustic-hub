import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { normalizeComment } from '@/lib/appdev';
import { normalizeImageUrls, normalizeVideoUrls } from '@/lib/appdev-media';
import {
  ITEM_KINDS,
  normalizeProduct,
  normalizeProductItem,
  openIssueCount,
} from '@/lib/products';
import { FINEACOUSTIC_PRODUCT_CATALOG, PRODUCT_CATALOG_VERSION, RETIRED_PRODUCT_SKUS } from '@/lib/product-catalog';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-products.json');

let tablesReady = false;
let tablesReadyPromise = null;

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTables() {
  if (tablesReady) return;
  if (!tablesReadyPromise) {
    tablesReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS hub_products (
        sku TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        specs JSONB NOT NULL DEFAULT '{}'::jsonb,
        price_display TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        launched_at DATE,
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INT NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS hub_product_items (
          id TEXT PRIMARY KEY,
          product_sku TEXT NOT NULL REFERENCES hub_products(sku) ON DELETE CASCADE,
          kind TEXT NOT NULL DEFAULT 'issue',
          title TEXT NOT NULL DEFAULT '',
          body TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'other',
          status TEXT NOT NULL DEFAULT 'open',
          assignee TEXT NOT NULL DEFAULT '',
          source_ref TEXT,
          comments JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_by TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => sql()`
        CREATE INDEX IF NOT EXISTS hub_product_items_sku_idx ON hub_product_items (product_sku)
      `)
      .then(() => sql()`
        CREATE TABLE IF NOT EXISTS hub_product_threads (
          product_sku TEXT PRIMARY KEY REFERENCES hub_products(sku) ON DELETE CASCADE,
          comments JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => {
        tablesReady = true;
      })
      .catch(err => {
        tablesReadyPromise = null;
        throw err;
      });
  }
  await tablesReadyPromise;
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ products: [], items: [], threads: {} }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return {
    products: Array.isArray(raw?.products) ? raw.products : [],
    items: Array.isArray(raw?.items) ? raw.items : [],
    threads: raw?.threads && typeof raw.threads === 'object' ? raw.threads : {},
  };
}

function writeFileStore(store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function rowToProduct(row) {
  return normalizeProduct({
    sku: row.sku,
    name: row.name,
    description: row.description,
    specs: row.specs,
    price_display: row.price_display,
    image_url: row.image_url,
    launched_at: row.launched_at,
    status: row.status,
    sort_order: row.sort_order,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function rowToItem(row) {
  return normalizeProductItem({
    id: row.id,
    product_sku: row.product_sku,
    kind: row.kind,
    title: row.title,
    body: row.body,
    source: row.source,
    status: row.status,
    assignee: row.assignee,
    source_ref: row.source_ref,
    comments: row.comments,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function readAllProductsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT sku, name, description, specs, price_display, image_url, launched_at,
             status, sort_order, created_by, created_at, updated_at
      FROM hub_products
      ORDER BY sort_order ASC, name ASC
    `;
    return rows.map(rowToProduct);
  }
  return readFileStore().products.map(p => normalizeProduct(p));
}

async function readAllItemsRaw() {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT id, product_sku, kind, title, body, source, status, assignee, source_ref,
             comments, created_by, created_at, updated_at
      FROM hub_product_items
      ORDER BY updated_at DESC
    `;
    return rows.map(rowToItem);
  }
  return readFileStore().items.map(i => normalizeProductItem(i));
}

async function writeProduct(product) {
  const normalized = normalizeProduct(product);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_products (
        sku, name, description, specs, price_display, image_url, launched_at,
        status, sort_order, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.sku}, ${normalized.name}, ${normalized.description},
        ${JSON.stringify(normalized.specs)}::jsonb, ${normalized.price_display},
        ${normalized.image_url}, ${normalized.launched_at || null}, ${normalized.status},
        ${normalized.sort_order}, ${normalized.created_by}, ${normalized.created_at},
        ${normalized.updated_at}
      )
      ON CONFLICT (sku) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        specs = EXCLUDED.specs,
        price_display = EXCLUDED.price_display,
        image_url = EXCLUDED.image_url,
        launched_at = EXCLUDED.launched_at,
        status = EXCLUDED.status,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const store = readFileStore();
    const idx = store.products.findIndex(p => p.sku === normalized.sku);
    if (idx === -1) store.products.push(normalized);
    else store.products[idx] = normalized;
    writeFileStore(store);
  }
  return normalized;
}

async function writeItem(item) {
  const normalized = normalizeProductItem(item);
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_product_items (
        id, product_sku, kind, title, body, source, status, assignee, source_ref,
        comments, created_by, created_at, updated_at
      ) VALUES (
        ${normalized.id}, ${normalized.product_sku}, ${normalized.kind}, ${normalized.title},
        ${normalized.body}, ${normalized.source}, ${normalized.status}, ${normalized.assignee},
        ${normalized.source_ref}, ${JSON.stringify(normalized.comments)}::jsonb,
        ${normalized.created_by}, ${normalized.created_at}, ${normalized.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        assignee = EXCLUDED.assignee,
        source_ref = EXCLUDED.source_ref,
        comments = EXCLUDED.comments,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const store = readFileStore();
    const idx = store.items.findIndex(i => i.id === normalized.id);
    if (idx === -1) store.items.push(normalized);
    else store.items[idx] = normalized;
    writeFileStore(store);
  }
  return normalized;
}

async function readThreadComments(sku) {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT comments FROM hub_product_threads WHERE product_sku = ${sku} LIMIT 1
    `;
    return rows.length ? (rows[0].comments || []) : [];
  }
  const store = readFileStore();
  return store.threads?.[sku]?.comments || [];
}

async function writeThreadComments(sku, comments) {
  const now = new Date().toISOString();
  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_product_threads (product_sku, comments, updated_at)
      VALUES (${sku}, ${JSON.stringify(comments)}::jsonb, ${now})
      ON CONFLICT (product_sku) DO UPDATE SET
        comments = EXCLUDED.comments,
        updated_at = EXCLUDED.updated_at
    `;
  } else {
    const store = readFileStore();
    store.threads = store.threads || {};
    store.threads[sku] = { comments, updated_at: now };
    writeFileStore(store);
  }
}

function mapProductsWithCounts(products, items) {
  return products.map(product => {
    const productItems = items.filter(i => i.product_sku === product.sku);
    return {
      ...product,
      open_issue_count: openIssueCount(productItems),
      item_count: productItems.length,
    };
  });
}

function mapProductDetail(product, items, threadComments) {
  const productItems = items.filter(i => i.product_sku === product.sku);
  return {
    product,
    items: productItems,
    thread_comments: threadComments,
    open_issue_count: openIssueCount(productItems),
  };
}

export async function listProductsWithCounts() {
  const [products, items] = await Promise.all([readAllProductsRaw(), readAllItemsRaw()]);
  return mapProductsWithCounts(products, items);
}

/** Single-pass server load for /products — catalog sync + list + optional detail. */
export async function loadProductsForPage(actor, productSku = '') {
  await ensureProductCatalog(actor);
  const [products, items] = await Promise.all([readAllProductsRaw(), readAllItemsRaw()]);
  const productsWithCounts = mapProductsWithCounts(products, items);
  const sku = String(productSku || '').trim().toUpperCase();
  if (!sku) {
    return { products: productsWithCounts, productDetail: null };
  }
  const product = products.find(p => p.sku === sku);
  if (!product) {
    return { products: productsWithCounts, productDetail: null };
  }
  const threadComments = await readThreadComments(sku);
  return {
    products: productsWithCounts,
    productDetail: mapProductDetail(product, items, threadComments),
  };
}

export async function getProductBySku(sku) {
  const key = String(sku || '').trim().toUpperCase();
  if (!key) return null;
  const products = await readAllProductsRaw();
  return products.find(p => p.sku === key) || null;
}

export async function getProductDetail(sku) {
  const key = String(sku || '').trim().toUpperCase();
  if (!key) return null;
  const [products, items] = await Promise.all([readAllProductsRaw(), readAllItemsRaw()]);
  const product = products.find(p => p.sku === key);
  if (!product) return null;
  const threadComments = await readThreadComments(key);
  return mapProductDetail(product, items, threadComments);
}

export async function createProduct(input, actor) {
  const normalized = normalizeProduct({
    ...input,
    sku: input?.sku,
    created_by: actor?.displayName || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (!normalized.sku) {
    const err = new Error('sku_required');
    err.status = 400;
    throw err;
  }
  const existing = await getProductBySku(normalized.sku);
  if (existing) {
    const err = new Error('sku_taken');
    err.status = 409;
    throw err;
  }
  return writeProduct(normalized);
}

export async function updateProduct(sku, patch) {
  const existing = await getProductBySku(sku);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const next = normalizeProduct({
    ...existing,
    ...patch,
    sku: existing.sku,
    updated_at: new Date().toISOString(),
  });
  return writeProduct(next);
}

export async function deleteProductBySku(sku) {
  const key = String(sku || '').trim().toUpperCase();
  if (!key) return false;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`DELETE FROM hub_products WHERE sku = ${key} RETURNING sku`;
    return rows.length > 0;
  }

  const store = readFileStore();
  const nextProducts = store.products.filter(p => String(p.sku).toUpperCase() !== key);
  if (nextProducts.length === store.products.length) return false;
  store.products = nextProducts;
  store.items = store.items.filter(i => String(i.product_sku).toUpperCase() !== key);
  if (store.threads?.[key]) delete store.threads[key];
  writeFileStore(store);
  return true;
}

/** In-process dedupe — avoids re-sync on every navigation within the same dev server. */
let catalogSyncCache = { version: 0, at: 0, promise: null };
const CATALOG_SYNC_TTL_MS = 5 * 60 * 1000;

function catalogEntryNeedsFill(existing, entry) {
  if (!existing.description?.trim() && entry.description) return true;
  if (!existing.price_display?.trim() && entry.price_display) return true;
  if (!existing.image_url?.trim() && entry.image_url) return true;
  if (!existing.status && entry.status) return true;
  if (!existing.sort_order && entry.sort_order) return true;
  const existingMd = String(existing.specs?.md || '').trim();
  const catalogMd = String(entry.specs?.md || '').trim();
  if (!existingMd && catalogMd) return true;
  if (catalogMd) {
    for (const [key, value] of Object.entries(entry.specs || {})) {
      if (key === 'md') continue;
      if (value && !existing.specs?.[key]) return true;
    }
  }
  return false;
}

function catalogSyncNeeded(products, { fillMissing }) {
  const bySku = new Map(products.map(p => [p.sku, p]));
  if (RETIRED_PRODUCT_SKUS.some(sku => bySku.has(sku))) return true;
  for (const entry of FINEACOUSTIC_PRODUCT_CATALOG) {
    const existing = bySku.get(entry.sku);
    if (!existing) return true;
    if (fillMissing && catalogEntryNeedsFill(existing, entry)) return true;
  }
  return false;
}

function buildCatalogPatch(existing, entry, fillMissing) {
  if (!fillMissing) return null;
  const patch = {};
  if (!existing.description?.trim() && entry.description) patch.description = entry.description;
  if (!existing.price_display?.trim() && entry.price_display) patch.price_display = entry.price_display;
  if (!existing.image_url?.trim() && entry.image_url) patch.image_url = entry.image_url;
  if (!existing.status && entry.status) patch.status = entry.status;
  if (!existing.sort_order && entry.sort_order) patch.sort_order = entry.sort_order;

  const existingMd = String(existing.specs?.md || '').trim();
  const catalogMd = String(entry.specs?.md || '').trim();
  if (!existingMd && catalogMd) {
    patch.specs = { ...(existing.specs || {}), ...entry.specs, md: catalogMd };
  } else if (catalogMd) {
    const nextSpecs = { ...(existing.specs || {}) };
    let specsChanged = false;
    for (const [key, value] of Object.entries(entry.specs || {})) {
      if (key === 'md') continue;
      if (value && !nextSpecs[key]) {
        nextSpecs[key] = value;
        specsChanged = true;
      }
    }
    if (specsChanged) patch.specs = nextSpecs;
  }

  return Object.keys(patch).length ? patch : null;
}

async function runEnsureProductCatalog(actor, { fillMissing = true, force = false } = {}) {
  const products = await readAllProductsRaw();
  if (!force && !catalogSyncNeeded(products, { fillMissing })) {
    return { added: 0, updated: 0, removed: 0, total: FINEACOUSTIC_PRODUCT_CATALOG.length, skipped: true };
  }

  const bySku = new Map(products.map(p => [p.sku, p]));
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const sku of RETIRED_PRODUCT_SKUS) {
    if (!bySku.has(sku)) continue;
    if (await deleteProductBySku(sku)) {
      removed += 1;
      bySku.delete(sku);
    }
  }

  for (const entry of FINEACOUSTIC_PRODUCT_CATALOG) {
    const existing = bySku.get(entry.sku);
    if (!existing) {
      const created = await writeProduct(
        normalizeProduct({
          ...entry,
          created_by: actor?.displayName || 'catalog',
        })
      );
      bySku.set(created.sku, created);
      added += 1;
      continue;
    }

    const patch = buildCatalogPatch(existing, entry, fillMissing);
    if (patch) {
      const next = normalizeProduct({
        ...existing,
        ...patch,
        sku: existing.sku,
        updated_at: new Date().toISOString(),
      });
      await writeProduct(next);
      bySku.set(next.sku, next);
      updated += 1;
    }
  }

  return { added, updated, removed, total: FINEACOUSTIC_PRODUCT_CATALOG.length };
}

export async function ensureProductCatalog(actor, { fillMissing = true, force = false } = {}) {
  const now = Date.now();
  const cacheFresh =
    !force &&
    catalogSyncCache.version === PRODUCT_CATALOG_VERSION &&
    now - catalogSyncCache.at < CATALOG_SYNC_TTL_MS;

  if (cacheFresh) {
    return { added: 0, updated: 0, removed: 0, total: FINEACOUSTIC_PRODUCT_CATALOG.length, skipped: true };
  }

  if (!force && catalogSyncCache.promise) {
    return catalogSyncCache.promise;
  }

  catalogSyncCache.promise = runEnsureProductCatalog(actor, { fillMissing, force })
    .then(result => {
      catalogSyncCache = {
        version: PRODUCT_CATALOG_VERSION,
        at: Date.now(),
        promise: null,
      };
      return result;
    })
    .catch(err => {
      catalogSyncCache.promise = null;
      throw err;
    });

  return catalogSyncCache.promise;
}

export async function listProductItems(sku, { kind } = {}) {
  const product = await getProductBySku(sku);
  if (!product) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  let items = (await readAllItemsRaw()).filter(i => i.product_sku === product.sku);
  if (kind && ITEM_KINDS.includes(kind)) {
    items = items.filter(i => i.kind === kind);
  }
  return items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export async function getProductItemById(id) {
  const items = await readAllItemsRaw();
  return items.find(i => i.id === id) || null;
}

export async function createProductItem(sku, input, actor) {
  const product = await getProductBySku(sku);
  if (!product) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const now = new Date().toISOString();
  const item = normalizeProductItem({
    ...input,
    id: randomUUID(),
    product_sku: product.sku,
    created_by: actor?.displayName || '',
    created_at: now,
    updated_at: now,
    comments: [],
  });
  if (!item.title.trim()) {
    const err = new Error('title_required');
    err.status = 400;
    throw err;
  }
  return writeItem(item);
}

export async function updateProductItem(id, patch) {
  const existing = await getProductItemById(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const next = normalizeProductItem({
    ...existing,
    ...patch,
    id: existing.id,
    product_sku: existing.product_sku,
    kind: existing.kind,
    updated_at: new Date().toISOString(),
  });
  return writeItem(next);
}

export async function deleteProductItem(id) {
  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`DELETE FROM hub_product_items WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  const store = readFileStore();
  const next = store.items.filter(i => i.id !== id);
  if (next.length === store.items.length) return false;
  store.items = next;
  writeFileStore(store);
  return true;
}

export async function addProductThreadComment(sku, input, actor) {
  const product = await getProductBySku(sku);
  if (!product) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  const author = String(actor?.displayName || '').trim();
  const body = String(input?.body || '').trim();
  const image_urls = normalizeImageUrls(input?.image_urls);
  const video_urls = normalizeVideoUrls(input?.video_urls, input?.video_url);
  if (!author || (!body && !image_urls.length && !video_urls.length)) {
    const err = new Error('invalid_comment');
    err.status = 400;
    throw err;
  }
  const comments = await readThreadComments(product.sku);
  const comment = normalizeComment({
    id: `cmt-${randomUUID()}`,
    author,
    body,
    image_urls,
    video_urls,
    created_at: new Date().toISOString(),
  });
  comments.push(comment);
  await writeThreadComments(product.sku, comments);
  return { comments, comment };
}

export async function addProductItemComment(id, input, actor) {
  const existing = await getProductItemById(id);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
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
  const comments = [...(existing.comments || []), comment];
  const item = await writeItem({ ...existing, comments, updated_at: new Date().toISOString() });
  return { item, comment };
}
