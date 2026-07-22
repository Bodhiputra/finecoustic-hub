'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_HOLIDAY_COUNTRIES } from '@/lib/holidays';

const SHOW_KEY = 'finehub-show-holidays';
const COUNTRIES_KEY = 'finehub-holiday-countries';

export const HOLIDAY_COUNTRY_OPTIONS = ['CN', 'US'];

function readPrefs() {
  if (typeof window === 'undefined') {
    return { show: true, countries: [...DEFAULT_HOLIDAY_COUNTRIES] };
  }
  const show = localStorage.getItem(SHOW_KEY) !== '0';
  let countries = [...DEFAULT_HOLIDAY_COUNTRIES];
  try {
    const raw = localStorage.getItem(COUNTRIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) countries = parsed.map(c => String(c).toUpperCase());
    }
  } catch {
    /* ignore */
  }
  return { show, countries };
}

export function useCalendarHolidays(year, { enabled = true } = {}) {
  const [showHolidays, setShowHolidays] = useState(true);
  const [countries, setCountries] = useState(DEFAULT_HOLIDAY_COUNTRIES);
  const [holidaysByDate, setHolidaysByDate] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const prefs = readPrefs();
    setShowHolidays(prefs.show);
    setCountries(prefs.countries);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!enabled || !ready || !showHolidays || !countries.length) {
      setHolidaysByDate({});
      return undefined;
    }

    let cancelled = false;
    const qs = new URLSearchParams({
      year: String(year),
      countries: countries.join(','),
    });

    fetch(`/api/calendar/holidays?${qs}`, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setHolidaysByDate(data?.byDate || {});
      })
      .catch(() => {
        if (!cancelled) setHolidaysByDate({});
      });

    return () => {
      cancelled = true;
    };
  }, [year, countries, showHolidays, enabled, ready]);

  const toggleShowHolidays = useCallback(() => {
    setShowHolidays(prev => {
      const next = !prev;
      localStorage.setItem(SHOW_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleCountry = useCallback(code => {
    const upper = String(code).toUpperCase();
    setCountries(prev => {
      const has = prev.includes(upper);
      let next = has ? prev.filter(c => c !== upper) : [...prev, upper];
      if (!next.length) next = [...DEFAULT_HOLIDAY_COUNTRIES];
      localStorage.setItem(COUNTRIES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    showHolidays,
    toggleShowHolidays,
    countries,
    toggleCountry,
    holidaysByDate,
  };
}
