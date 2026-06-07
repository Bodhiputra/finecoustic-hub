#!/usr/bin/env node
/**
 * Pull read-only Shopify data into ops-hub snapshot.
 * Requires Shopify CLI authenticated (see shopify/ repo).
 *
 * Usage: node sync/shopify-pull.mjs finecoustic
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const brand = process.argv[2] || 'finecoustic';
const outDir = join(__dirname, '..', 'brands', brand);
const outFile = join(outDir, 'shopify-snapshot.json');

const STORE = 'j5gawi-vu.myshopify.com';

function shopifyGraphQL(query) {
  const q = query.replace(/"/g, '\\"');
  const cmd = `shopify graphql --store ${STORE} --query "${q}"`;
  try {
    const raw = execSync(cmd, {
      encoding: 'utf8',
      cwd: join(__dirname, '..', '..', 'finecoustic', 'shopify'),
    });
    return JSON.parse(raw);
  } catch (e) {
    console.error('Shopify CLI failed. Run: cd ../finecoustic/shopify && shopify auth login');
    console.error(e.message);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });

// Minimal product + inventory pull — extend as needed
const query = `{ products(first: 20) { edges { node { title variants(first: 10) { edges { node { id sku price inventoryQuantity } } } } } } }`;
const data = shopifyGraphQL(query);

const products = [];
const inventory = [];

for (const { node: product } of data?.data?.products?.edges || []) {
  for (const { node: variant } of product.variants?.edges || []) {
    products.push({ title: product.title, sku: variant.sku, variant_id: variant.id, price: variant.price });
    inventory.push({ sku: variant.sku, variant_id: variant.id, available: variant.inventoryQuantity, location: 'shopify' });
  }
}

const snapshot = {
  meta: { store: STORE, synced_at: new Date().toISOString() },
  products,
  inventory,
  orders_recent: []
};

writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
console.log(`Wrote ${outFile}`);
