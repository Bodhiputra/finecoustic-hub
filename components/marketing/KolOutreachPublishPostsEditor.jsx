'use client';

import Icon from '@/components/Icon';

export default function KolOutreachPublishPostsEditor({
  rows,
  onChange,
  t,
  disabled = false,
  requireUrl = false,
}) {
  function updateRow(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...rows, { url: '', date: '' }]);
  }

  function removeRow(index) {
    if (rows.length <= 1) {
      onChange([{ url: '', date: '' }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="kol-publish-posts">
      <ul className="kol-publish-posts-list">
        {rows.map((row, index) => (
          <li key={`publish-${index}`} className="kol-publish-posts-item">
            <div className="kol-publish-posts-fields">
              <label className="appdev-field kol-publish-posts-field">
                <span>{t('hub.campaignKol.publishUrl')}</span>
                <input
                  type="url"
                  value={row.url}
                  onChange={e => updateRow(index, { url: e.target.value })}
                  disabled={disabled}
                  required={requireUrl && index === 0}
                  placeholder="https://"
                />
              </label>
              <label className="appdev-field kol-publish-posts-field">
                <span>{t('hub.campaignKol.publishDate')}</span>
                <input
                  type="date"
                  value={row.date}
                  onChange={e => updateRow(index, { date: e.target.value })}
                  disabled={disabled}
                  required={requireUrl && index === 0}
                />
              </label>
            </div>
            {rows.length > 1 ? (
              <button
                type="button"
                className="hub-icon-btn kol-publish-posts-remove"
                onClick={() => removeRow(index)}
                disabled={disabled}
                aria-label={t('hub.campaignKol.removePublishPost')}
              >
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="appdev-btn-ghost kol-publish-posts-add"
        onClick={addRow}
        disabled={disabled}
      >
        <Icon name="plus" size={16} />
        {t('hub.campaignKol.addPublishPost')}
      </button>
    </div>
  );
}