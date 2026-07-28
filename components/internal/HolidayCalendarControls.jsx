'use client';

import { useLocale } from '@/components/LocaleProvider';
import { HOLIDAY_COUNTRY_OPTIONS } from '@/components/internal/useCalendarHolidays';

export default function HolidayCalendarControls({
  showHolidays,
  onToggleShow,
  countries,
  onToggleCountry,
}) {
  const { t } = useLocale();

  return (
    <div className="internal-holiday-controls">
      <label className="internal-holiday-toggle">
        <input type="checkbox" checked={showHolidays} onChange={onToggleShow} />
        <span>{t('hub.internal.showHolidays')}</span>
      </label>
      {showHolidays && (
        <div className="internal-holiday-countries" role="group" aria-label={t('hub.internal.holidayCountries')}>
          {HOLIDAY_COUNTRY_OPTIONS.map(code => (
            <button
              key={code}
              type="button"
              className={`internal-holiday-country${countries.includes(code) ? ' is-active' : ''}`}
              onClick={() => onToggleCountry(code)}
              aria-pressed={countries.includes(code)}
            >
              {t(`hub.internal.country${code}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
