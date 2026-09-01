/** KOL pool — sections, filters, display helpers. */

import { KOL_INITIATIVES } from '@/lib/kol-outreach-shared';

export const KOL_POOL_SECTIONS = [
  { id: 'masterlist', labelKey: 'hub.kol.masterlist' },
  { id: 'needs_confirmation', labelKey: 'hub.kol.needsConfirmation' },
  { id: 'stored', labelKey: 'hub.kol.stored' },
  { id: 'qualified', labelKey: 'hub.kol.qualified' },
];

export const KOL_POOL_SECTION_IDS = KOL_POOL_SECTIONS.map(s => s.id);

export const HUB_NATIVE_KOL_PREFIX = 'hub:';

/** Core profile fields — editable in hub; Notion sync respects hub_core_overrides. */
export const KOL_CORE_FIELD_KEYS = [
  'channel_name',
  'description',
  'links',
  'main_platform',
  'country',
  'kol_category',
  'tags',
];

export const KOL_PLATFORM_SUGGESTIONS = ['Instagram', 'YouTube', 'X', 'TikTok', 'Facebook', 'Other'];

export const KOL_TAG_SUGGESTIONS = ['stored', 'qualified', 'needs confirmation'];

/** Hub-only fields — preserved across Notion sync. */
export const KOL_HUB_FIELD_KEYS = [
  'shipping_line1',
  'shipping_line2',
  'shipping_city',
  'shipping_state',
  'shipping_postal',
  'shipping_country',
  'shipping_phone',
  'shipping_email',
  'shipping_notes',
  'collaboration_products',
];

export function normalizeCollaborationProducts(raw) {
  if (Array.isArray(raw)) {
    return raw.map(s => String(s || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeCollaborationProducts(parsed);
    } catch {
      return raw.split(/[,;|\n]/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function normalizeKolPoolRecord(raw = {}) {
  return {
    notion_page_id: String(raw.notion_page_id || ''),
    channel_name: String(raw.channel_name || '').trim(),
    description: String(raw.description || '').trim(),
    links: String(raw.links || '').trim(),
    main_platform: String(raw.main_platform || '').trim(),
    country: String(raw.country || '').trim(),
    kol_category: String(raw.kol_category || '').trim(),
    tags: String(raw.tags || '').trim(),
    outreach_status: String(raw.outreach_status || '').trim(),
    notion_url: String(raw.notion_url || '').trim(),
    synced_at: raw.synced_at || null,
    shipping_line1: String(raw.shipping_line1 || '').trim(),
    shipping_line2: String(raw.shipping_line2 || '').trim(),
    shipping_city: String(raw.shipping_city || '').trim(),
    shipping_state: String(raw.shipping_state || '').trim(),
    shipping_postal: String(raw.shipping_postal || '').trim(),
    shipping_country: String(raw.shipping_country || '').trim(),
    shipping_phone: String(raw.shipping_phone || '').trim(),
    shipping_email: String(raw.shipping_email || '').trim(),
    shipping_notes: String(raw.shipping_notes || '').trim(),
    collaboration_products: normalizeCollaborationProducts(raw.collaboration_products),
    hub_core_overrides:
      raw.hub_core_overrides && typeof raw.hub_core_overrides === 'object' ? raw.hub_core_overrides : {},
  };
}

export function isHubNativeKol(recordOrId) {
  const id = typeof recordOrId === 'string' ? recordOrId : recordOrId?.notion_page_id;
  return String(id || '').startsWith(HUB_NATIVE_KOL_PREFIX);
}

export function applyKolCoreOverrides(record) {
  if (!record) return record;
  const overrides = record.hub_core_overrides;
  if (!overrides || typeof overrides !== 'object' || !Object.keys(overrides).length) {
    return record;
  }
  return normalizeKolPoolRecord({ ...record, ...overrides });
}

export function kolRecordSourceLabel(record, t) {
  if (isHubNativeKol(record)) return t('hub.kol.sourceHub');
  if (record?.notion_url) return t('hub.kol.sourceNotion');
  return t('hub.kol.sourceHub');
}

export function kolShippingSummary(record) {
  if (!record) return '';
  const parts = [
    record.shipping_line1,
    record.shipping_line2,
    [record.shipping_city, record.shipping_state, record.shipping_postal].filter(Boolean).join(' '),
    record.shipping_country,
  ].filter(Boolean);
  return parts.join(', ');
}

/** Label keys for hub.kol.* — ordered shipping fields with values. */
export const KOL_SHIPPING_DETAIL_FIELDS = [
  { key: 'shipping_line1', labelKey: 'hub.kol.shippingLine1' },
  { key: 'shipping_line2', labelKey: 'hub.kol.shippingLine2' },
  { key: 'shipping_city', labelKey: 'hub.kol.shippingCity' },
  { key: 'shipping_state', labelKey: 'hub.kol.shippingState' },
  { key: 'shipping_postal', labelKey: 'hub.kol.shippingPostal' },
  { key: 'shipping_country', labelKey: 'hub.kol.shippingCountry' },
  { key: 'shipping_phone', labelKey: 'hub.kol.shippingPhone' },
  { key: 'shipping_email', labelKey: 'hub.kol.shippingEmail' },
  { key: 'shipping_notes', labelKey: 'hub.kol.shippingNotes' },
];

export function kolShippingDetailEntries(record) {
  if (!record) return [];
  return KOL_SHIPPING_DETAIL_FIELDS.map(({ key, labelKey }) => ({
    key,
    labelKey,
    value: String(record[key] || '').trim(),
  })).filter(entry => entry.value);
}

export function kolShippingDetailText(record, labelForKey) {
  const entries = kolShippingDetailEntries(record);
  if (!entries.length) return '';
  return entries.map(entry => `${labelForKey(entry.labelKey)}: ${entry.value}`).join('\n');
}

export function hasKolShippingAddress(record) {
  return Boolean(kolShippingSummary(record));
}

const KOL_LINK_PLATFORM_ICON = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
  x: 'xSocial',
  facebook: 'facebook',
};

export function kolLinkPlatformFromUrl(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  return null;
}

export function kolLinkPlatformFromLabel(platform = '') {
  const p = String(platform).toLowerCase();
  if (p.includes('instagram')) return 'instagram';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('tiktok')) return 'tiktok';
  if (p === 'x' || p.includes('twitter')) return 'x';
  if (p.includes('facebook')) return 'facebook';
  return null;
}

/** Icon name for KolPoolWorkspace link cell — URL wins, then main_platform. */
export function kolLinkIconName(record) {
  const fromUrl = kolLinkPlatformFromUrl(record?.links);
  if (fromUrl) return KOL_LINK_PLATFORM_ICON[fromUrl];
  const fromPlatform = kolLinkPlatformFromLabel(record?.main_platform);
  if (fromPlatform) return KOL_LINK_PLATFORM_ICON[fromPlatform];
  return 'externalLink';
}

export function kolLinkAriaLabel(record, t) {
  const platform = kolLinkPlatformFromUrl(record?.links) || kolLinkPlatformFromLabel(record?.main_platform);
  if (platform === 'instagram') return t('hub.kol.openInstagram');
  if (platform === 'youtube') return t('hub.kol.openYoutube');
  if (platform === 'tiktok') return t('hub.kol.openTiktok');
  if (platform === 'x') return t('hub.kol.openX');
  if (platform === 'facebook') return t('hub.kol.openFacebook');
  return t('hub.kol.openLink');
}

function tagText(record) {
  return String(record?.tags || '').toLowerCase();
}

function hasNoTags(record) {
  return !String(record?.tags || '').trim();
}

function hasNeedsConfirmationTag(record) {
  const tags = tagText(record);
  return tags.includes('need confirmation') || tags.includes('needs confirmation');
}

/** Hide KOLs tagged Unqualified/Disqualified in Notion. */
export function isKolDisqualified(record) {
  const tags = tagText(record);
  return /\bunqualified\b/.test(tags) || /\bdisqualified\b/.test(tags);
}

/** Hub pool segments synced from Notion Tags, plus hub-created KOLs. */
export function isKolVisibleInPool(record) {
  if (!record) return false;
  if (isHubNativeKol(record)) return true;
  if (isKolDisqualified(record)) return false;
  const tags = tagText(record);
  return (
    /\bqualified\b/.test(tags) ||
    /\bstored\b/.test(tags) ||
    hasNeedsConfirmationTag(record) ||
    hasNoTags(record)
  );
}

/** @deprecated use isKolVisibleInPool */
export function isKolQualified(record) {
  return isKolVisibleInPool(record);
}

export function filterVisibleKolPool(records) {
  return (Array.isArray(records) ? records : []).filter(isKolVisibleInPool);
}

export function kolRecordInSection(record, sectionId) {
  if (!record) return false;
  if (sectionId === 'masterlist') return true;
  if (isKolDisqualified(record)) return false;

  const tags = tagText(record);

  if (sectionId === 'needs_confirmation') {
    return hasNeedsConfirmationTag(record) || hasNoTags(record);
  }
  if (sectionId === 'stored') {
    return /\bstored\b/.test(tags);
  }
  if (sectionId === 'qualified') {
    return /\bqualified\b/.test(tags);
  }

  return false;
}

export function filterKolBySection(records, sectionId) {
  const list = Array.isArray(records) ? records : [];
  if (!KOL_POOL_SECTION_IDS.includes(sectionId)) return list;
  return list.filter(r => kolRecordInSection(r, sectionId));
}

export function countKolBySection(records) {
  const counts = Object.fromEntries(KOL_POOL_SECTION_IDS.map(id => [id, 0]));
  for (const id of KOL_POOL_SECTION_IDS) {
    counts[id] = filterKolBySection(records, id).length;
  }
  return counts;
}

export function platformChipClass(platform = '') {
  const p = platform.toLowerCase();
  if (p.includes('instagram')) return 'kol-chip-platform kol-chip-instagram';
  if (p.includes('youtube')) return 'kol-chip-platform kol-chip-youtube';
  if (p === 'x' || p.includes('twitter')) return 'kol-chip-platform kol-chip-x';
  return 'kol-chip-platform';
}

/** Canonical key for main_platform filters — merges X/Twitter, case variants, etc. */
export function kolPlatformFilterKey(platform = '') {
  const slug = kolLinkPlatformFromLabel(platform);
  if (slug) return slug;
  const normalized = String(platform || '').trim().toLowerCase();
  return normalized || 'other';
}

export function kolMatchesPlatformFilter(record, platformFilter) {
  const filter = String(platformFilter || '').trim();
  if (!filter || filter === 'all') return true;
  const recordPlatform = String(record?.main_platform || '').trim();
  if (!recordPlatform) return false;
  return kolPlatformFilterKey(recordPlatform) === filter;
}

/** Canonical key for country filters — case-insensitive match on display label. */
export function kolCountryFilterKey(country = '') {
  return String(country || '').trim().toLowerCase() || '';
}

export function kolMatchesCountryFilter(record, countryFilter) {
  const filter = String(countryFilter || '').trim();
  if (!filter || filter === 'all') return true;
  return kolCountryFilterKey(record?.country) === filter;
}

/** Unique country values from records, sorted alphabetically by label. */
export function collectKolCountryOptions(records) {
  const seen = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const label = String(record?.country || '').trim();
    if (!label) continue;
    const key = kolCountryFilterKey(label);
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, label]) => ({ key, label }));
}

/** Initiative ids parsed from collaboration_products entries, e.g. "Product (FBS, 2026-08-31)". */
export function collabInitiativesFromRecord(record) {
  const products = normalizeCollaborationProducts(record?.collaboration_products);
  const found = new Set();
  for (const entry of products) {
    const text = String(entry || '').trim();
    if (!text) continue;
    const dated = text.match(/\(([A-Za-z]+),\s*\d{4}-\d{2}-\d{2}\)/);
    if (dated) {
      found.add(dated[1].toLowerCase());
      continue;
    }
    for (const item of KOL_INITIATIVES) {
      const lower = text.toLowerCase();
      if (lower.includes(item.id) || text.includes(item.label)) {
        found.add(item.id);
      }
    }
  }
  return [...found];
}

export function kolMatchesCollabInitiativeFilter(record, initiativeFilter) {
  const filter = String(initiativeFilter || '').trim().toLowerCase();
  if (!filter || filter === 'all') return true;
  return collabInitiativesFromRecord(record).includes(filter);
}

/** Initiatives that appear in at least one record's collaboration history. */
export function collectKolCollabInitiativeOptions(records) {
  const found = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    for (const id of collabInitiativesFromRecord(record)) found.add(id);
  }
  return KOL_INITIATIVES.filter(item => found.has(item.id));
}

/** Unique main_platform values from records, known platforms first. */
export function collectKolMainPlatformOptions(records) {
  const seen = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const label = String(record?.main_platform || '').trim();
    if (!label) continue;
    const key = kolPlatformFilterKey(label);
    if (!seen.has(key)) seen.set(key, label);
  }

  const knownOrder = KOL_PLATFORM_SUGGESTIONS.map(p => kolPlatformFilterKey(p));
  return [...seen.entries()]
    .sort((a, b) => {
      const ai = knownOrder.indexOf(a[0]);
      const bi = knownOrder.indexOf(b[0]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a[1].localeCompare(b[1]);
    })
    .map(([key, label]) => ({ key, label }));
}

export function pickKolCorePatch(body = {}) {
  const patch = {};
  for (const key of KOL_CORE_FIELD_KEYS) {
    if (body[key] === undefined) continue;
    patch[key] = String(body[key] ?? '').trim();
  }
  return patch;
}

export function pickKolHubPatch(body = {}) {
  const patch = {};
  for (const key of KOL_HUB_FIELD_KEYS) {
    if (body[key] === undefined) continue;
    if (key === 'collaboration_products') {
      patch[key] = normalizeCollaborationProducts(body[key]);
    } else {
      patch[key] = String(body[key] ?? '').trim();
    }
  }
  return patch;
}

export function kolPayloadFromForm(body = {}) {
  return {
    ...pickKolCorePatch(body),
    ...pickKolHubPatch(body),
  };
}
