'use client';

import Icon from '@/components/Icon';

const SECTIONS = ['login', 'create', 'assign', 'workflow', 'discuss', 'files'];

export default function AppdevHelp({ open, onClose, onToggle, t }) {
  return (
    <>
      {open && (
        <section className="appdev-help" role="region" aria-label={t('appdev.help.title')}>
          <header className="appdev-help-header">
            <div className="appdev-help-head-text">
              <h2 className="appdev-help-title">{t('appdev.help.title')}</h2>
              <p className="appdev-help-intro">{t('appdev.help.intro')}</p>
            </div>
            <button type="button" className="appdev-help-dismiss" onClick={onClose}>
              {t('appdev.help.dismiss')}
            </button>
          </header>
          <div className="appdev-help-grid">
            {SECTIONS.map(key => (
              <article key={key} className="appdev-help-card">
                <h3 className="appdev-help-card-title">{t(`appdev.help.${key}Title`)}</h3>
                <p className="appdev-help-card-body">{t(`appdev.help.${key}Body`)}</p>
              </article>
            ))}
          </div>
          <p className="appdev-help-foot">{t('appdev.help.footer')}</p>
        </section>
      )}

      <button
        type="button"
        className={`appdev-help-fab${open ? ' is-open' : ''}`}
        onClick={onToggle}
        aria-label={open ? t('appdev.help.hide') : t('appdev.help.show')}
        title={open ? t('appdev.help.hide') : t('appdev.help.show')}
      >
        <Icon name="helpCircle" size={22} />
      </button>
    </>
  );
}
