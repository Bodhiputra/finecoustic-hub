import { NextResponse } from 'next/server';
import { isHubAuthEnabled } from '@/lib/auth';
import { requireHubActor } from '@/lib/hub-actor';
import { buildHolidaysByDate, DEFAULT_HOLIDAY_COUNTRIES, fetchPublicHolidays } from '@/lib/holidays';

export async function GET(request) {
  if (isHubAuthEnabled()) {
    try {
      await requireHubActor();
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const countriesParam = searchParams.get('countries') || DEFAULT_HOLIDAY_COUNTRIES.join(',');

  try {
    const holidays = await fetchPublicHolidays(year, countriesParam.split(','));
    const byDate = buildHolidaysByDate(holidays);
    return NextResponse.json({
      year,
      countries: countriesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean),
      holidays,
      byDate,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'fetch_failed' }, { status: 400 });
  }
}
