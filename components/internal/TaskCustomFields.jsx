'use client';

import DatePicker from '@/components/appdev/DatePicker';
import { useLocale } from '@/components/LocaleProvider';
import { boardFieldTypeLabel } from '@/lib/board-properties';

export default function TaskCustomFields({
  properties = [],
  values = {},
  onChange,
  onManageFields,
  disabled = false,
  teamMembers = [],
  locale = 'en',
}) {
  const { t } = useLocale();
  if (!properties.length && !onManageFields) return null;

  function setValue(propId, value) {
    onChange?.({ ...values, [propId]: value });
  }

  return (
    <div className="task-custom-fields">
      <div className="task-custom-fields-head">
        <h4 className="task-custom-fields-title">{t('hub.internal.customFieldsTitle')}</h4>
        {onManageFields ? (
          <button type="button" className="hub-inline-link" onClick={onManageFields}>
            {properties.length ? t('hub.internal.manageFields') : t('hub.internal.addCustomField')}
          </button>
        ) : null}
      </div>

      {!properties.length ? (
        <p className="appdev-field-hint">{t('hub.internal.customFieldsEmpty')}</p>
      ) : (
        properties.map(prop => {
          const val = values[prop.id] || '';
          if (prop.type === 'date') {
            return (
              <label key={prop.id} className="appdev-field">
                <span>{prop.label}</span>
                <DatePicker
                  value={val || null}
                  onChange={v => setValue(prop.id, v || '')}
                  disabled={disabled}
                  locale={locale}
                  placeholder={t('hub.internal.taskPanel.pickDate')}
                />
              </label>
            );
          }
          if (prop.type === 'select') {
            return (
              <label key={prop.id} className="appdev-field">
                <span>{prop.label}</span>
                <select
                  value={val}
                  onChange={e => setValue(prop.id, e.target.value)}
                  disabled={disabled}
                >
                  <option value="">{t('hub.internal.fieldSelectEmpty')}</option>
                  {(prop.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            );
          }
          if (prop.type === 'person') {
            return (
              <label key={prop.id} className="appdev-field">
                <span>{prop.label}</span>
                <select
                  value={val}
                  onChange={e => setValue(prop.id, e.target.value)}
                  disabled={disabled}
                >
                  <option value="">{t('hub.internal.fieldSelectEmpty')}</option>
                  {teamMembers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            );
          }
          if (prop.type === 'link') {
            return (
              <label key={prop.id} className="appdev-field">
                <span>{prop.label}</span>
                <input
                  type="url"
                  value={val}
                  onChange={e => setValue(prop.id, e.target.value)}
                  disabled={disabled}
                  placeholder="https://"
                />
              </label>
            );
          }
          return (
            <label key={prop.id} className="appdev-field">
              <span>{prop.label}</span>
              <input
                type="text"
                value={val}
                onChange={e => setValue(prop.id, e.target.value)}
                disabled={disabled}
                placeholder={boardFieldTypeLabel(prop.type, t)}
              />
            </label>
          );
        })
      )}
    </div>
  );
}
