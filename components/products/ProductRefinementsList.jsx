'use client';

import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';

const STATUS_LABELS = {
  idea: 'Idea',
  planned: 'Planned',
  done: 'Done',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');
}

export default function ProductRefinementsList({
  refinements = [],
  onAdd,
  onOpen,
}) {
  const { t } = useLocale();

  return (
    <section className="products-section">
      <header className="products-section-head">
        <div className="products-section-intro">
          <h2>{t('hub.products.refinementsTitle')}</h2>
          <p>{t('hub.products.refinementsDesc')}</p>
        </div>
        <button type="button" className="appdev-btn-primary" onClick={onAdd}>
          <Icon name="plus" size={16} />
          {t('hub.products.addRefinement')}
        </button>
      </header>

      {!refinements.length ? (
        <div className="products-section-empty">
          <Icon name="layout" size={28} />
          <p>{t('hub.products.noRefinements')}</p>
          <button type="button" className="appdev-btn-primary" onClick={onAdd}>
            <Icon name="plus" size={16} />
            {t('hub.products.addRefinement')}
          </button>
        </div>
      ) : (
        <ul className="products-refinement-list">
          {refinements.map(item => (
            <li key={item.id}>
              <button type="button" className="products-refinement-row" onClick={() => onOpen(item)}>
                <span className={`products-refinement-status is-${item.status || 'idea'}`}>
                  {statusLabel(item.status)}
                </span>
                <span className="products-refinement-copy">
                  <span className="products-refinement-title">{item.title}</span>
                  {item.body ? (
                    <span className="products-refinement-preview">
                      {item.body.length > 120 ? `${item.body.slice(0, 120)}…` : item.body}
                    </span>
                  ) : null}
                </span>
                <Icon name="chevronRight" size={16} className="products-refinement-chevron" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
