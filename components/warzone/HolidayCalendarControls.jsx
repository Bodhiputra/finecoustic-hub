'use client';

import { useLocale } from '@/components/LocaleProvider';
import { HOLIDAY_COUNTRY_OPTIONS } from '@/components/warzone/useCalendarHolidays';

export default function HolidayCalendarControls({
  showHolidays,
  onToggleShow,
  countries,
  onToggleCountry,
}) {
  const { t } = useLocale();

  return (
    <div className="warzone-holiday-controls">
      <label className="warzone-holiday-toggle">
        <input type="checkbox" checked={showHolidays} onChange={onToggleShow} />
        <span>{t('hub.warzone.showHolidays')}</span>
      </label>
      {showHolidays && (
        <div className="warzone-holiday-countries" role="group" aria-label={t('hub.warzone.holidayCountries')}>
          {HOLIDAY_COUNTRY_OPTIONS.map(code => (
            <button
              key={code}
              type="button"
              className={`warzone-holiday-country${countries.includes(code) ? ' is-active' : ''}`}
              onClick={() => onToggleCountry(code)}
              aria-pressed={countries.includes(code)}
            >
              {t(`hub.warzone.country${code}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
