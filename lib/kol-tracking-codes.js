import { randomUUID } from 'node:crypto';

/** 8-char tracking codes for KOL ↔ Shopify redirect / utm_content mapping. */

export const KOL_TRACKING_CODE_LENGTH = 8;

export function normalizeKolTrackingCodeEntry(raw = {}) {
  return {
    id: String(raw.id || '').trim(),
    code: String(raw.code || '').trim().toLowerCase(),
    kol_pool_id: String(raw.kol_pool_id || '').trim(),
    channel_name: String(raw.channel_name || '').trim(),
    platform: String(raw.platform || '').trim(),
    notes: String(raw.notes || '').trim(),
    created_by: String(raw.created_by || '').trim(),
    created_at: raw.created_at || null,
  };
}

/** First 8 hex chars from a UUID — short, neutral, unique enough at KOL scale. */
export function generateKolTrackingCode() {
  return randomUUID().replace(/-/g, '').slice(0, KOL_TRACKING_CODE_LENGTH).toLowerCase();
}
