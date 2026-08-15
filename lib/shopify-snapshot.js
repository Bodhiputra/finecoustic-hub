import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_SLUG } from '@/lib/ops';

/** Read local Shopify snapshot (gitignored) if present. */
export function readShopifySnapshot(slug = BRAND_SLUG) {
  const file = join(process.cwd(), 'brands', slug, 'shopify-snapshot.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
