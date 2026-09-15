import { listKolPoolRecords } from '@/lib/kol-pool-data';
import {
  KOL_POOL_SECTION_IDS,
  collectKolCollabInitiativeOptions,
  collectKolCountryOptions,
  collectKolMainPlatformOptions,
  countKolBySection,
  filterKolBySection,
  filterVisibleKolPool,
  kolMatchesCollabInitiativeFilter,
  kolMatchesCountryFilter,
  kolMatchesPlatformFilter,
  kolShippingSummary,
} from '@/lib/kol-pool';

/** Server-side segment + filter + pagination (one DB read per request — not on marketing layout). */
export async function queryKolPoolPage({
  section = 'masterlist',
  limit = 25,
  offset = 0,
  q = '',
  platform = 'all',
  country = 'all',
  collabInitiative = 'all',
} = {}) {
  const safeSection = KOL_POOL_SECTION_IDS.includes(section) ? section : 'masterlist';
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { records, meta } = await listKolPoolRecords();
  const visible = filterVisibleKolPool(records);
  const counts = countKolBySection(visible);
  const sectionRecords = filterKolBySection(visible, safeSection);

  const needle = String(q || '').trim().toLowerCase();
  const filtered = sectionRecords.filter(r => {
    if (!kolMatchesPlatformFilter(r, platform)) return false;
    if (!kolMatchesCountryFilter(r, country)) return false;
    if (!kolMatchesCollabInitiativeFilter(r, collabInitiative)) return false;
    if (!needle) return true;
    const hay = [
      r.channel_name,
      r.country,
      r.main_platform,
      r.kol_category,
      r.tags,
      r.description,
      (r.collaboration_products || []).join(' '),
      kolShippingSummary(r),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });

  const total = filtered.length;
  const pageRecords = filtered.slice(safeOffset, safeOffset + safeLimit);

  return {
    records: pageRecords,
    total,
    counts,
    meta,
    section: safeSection,
    limit: safeLimit,
    offset: safeOffset,
    platformOptions: collectKolMainPlatformOptions(sectionRecords),
    countryOptions: collectKolCountryOptions(sectionRecords),
    collabInitiativeOptions: collectKolCollabInitiativeOptions(sectionRecords),
  };
}
