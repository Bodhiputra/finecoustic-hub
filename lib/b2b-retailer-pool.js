/** B2B retailer pool — CRM tags, filters, display helpers. */

export const B2B_RETAILER_TAG_IDS = ['existing_fantech', 'potential', 'deal'];

export const B2B_RETAILER_SECTIONS = [
  { id: 'all', labelKey: 'hub.b2bRetailers.all' },
  { id: 'existing_fantech', labelKey: 'hub.b2bRetailers.tagExistingFantech' },
  { id: 'potential', labelKey: 'hub.b2bRetailers.tagPotential' },
  { id: 'deal', labelKey: 'hub.b2bRetailers.tagDeal' },
];

export const B2B_RETAILER_SECTION_IDS = B2B_RETAILER_SECTIONS.map(s => s.id);

export const B2B_TAG_LABEL_KEYS = {
  existing_fantech: 'hub.b2bRetailers.tagExistingFantech',
  potential: 'hub.b2bRetailers.tagPotential',
  deal: 'hub.b2bRetailers.tagDeal',
};

export function normalizeB2bRetailerTag(raw = '') {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes('existing') || text.includes('fantech')) return 'existing_fantech';
  if (text === 'deal' || text.includes('finecoustic')) return 'deal';
  if (text.includes('potential')) return 'potential';
  if (B2B_RETAILER_TAG_IDS.includes(text)) return text;
  return '';
}

export function normalizeB2bRetailerRecord(raw = {}) {
  const tag = normalizeB2bRetailerTag(raw.tag) || normalizeB2bRetailerTag(raw.tags);
  return {
    id: String(raw.id || '').trim(),
    name: String(raw.name || '').trim(),
    website: String(raw.website || '').trim(),
    country: String(raw.country || '').trim(),
    partner_code: String(raw.partner_code || '').trim(),
    links: String(raw.links || '').trim(),
    tag,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
  };
}

export function filterB2bBySection(records, sectionId) {
  const section = B2B_RETAILER_SECTION_IDS.includes(sectionId) ? sectionId : 'all';
  if (section === 'all') return records;
  return records.filter(r => r.tag === section);
}

export function countB2bBySection(records) {
  const counts = { all: records.length };
  for (const id of B2B_RETAILER_TAG_IDS) {
    counts[id] = records.filter(r => r.tag === id).length;
  }
  return counts;
}

export function collectB2bCountryOptions(records) {
  const map = new Map();
  for (const r of records) {
    const c = String(r.country || '').trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (!map.has(key)) map.set(key, c);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export { kolLinkAriaLabel, kolLinkIconName } from '@/lib/kol-pool';
