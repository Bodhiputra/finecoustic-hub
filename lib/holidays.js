export const DEFAULT_HOLIDAY_COUNTRIES = ['CN', 'US'];

const NAGER_BASE = 'https://date.nager.at/api/v3/PublicHolidays';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { ts: number, holidays: object[] }>} */
const memoryCache = new Map();

function normalizeCountries(countries) {
  const list = Array.isArray(countries) ? countries : String(countries || '').split(',');
  const out = [...new Set(list.map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
  return out.length ? out.sort() : [...DEFAULT_HOLIDAY_COUNTRIES];
}

export function buildHolidaysByDate(holidays) {
  const map = {};
  for (const h of holidays) {
    if (!map[h.date]) map[h.date] = [];
    map[h.date].push(h);
  }
  for (const date of Object.keys(map)) {
    map[date].sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

export async function fetchPublicHolidays(year, countries = DEFAULT_HOLIDAY_COUNTRIES) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new Error('invalid_year');
  }

  const codes = normalizeCountries(countries);
  const cacheKey = `${y}-${codes.join(',')}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.holidays;
  }

  const batches = await Promise.all(
    codes.map(async countryCode => {
      try {
        const res = await fetch(`${NAGER_BASE}/${y}/${countryCode}`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) return [];
        const rows = await res.json();
        if (!Array.isArray(rows)) return [];
        return rows.map(row => ({
          id: `${countryCode}-${row.date}-${row.name}`,
          date: String(row.date).slice(0, 10),
          name: String(row.name || '').trim(),
          localName: String(row.localName || row.name || '').trim(),
          countryCode,
        }));
      } catch {
        return [];
      }
    })
  );

  const holidays = batches.flat().filter(h => h.date && h.name);
  memoryCache.set(cacheKey, { ts: Date.now(), holidays });
  return holidays;
}

export function holidayLabel(holiday, locale = 'en') {
  if (!holiday) return '';
  if (locale === 'zh' && holiday.localName) return holiday.localName;
  return holiday.name;
}
