'use client';

import Icon from '@/components/Icon';
import HubProse from '@/components/HubProse';
import HoverHintTip from '@/components/HoverHintTip';
import { useLocale } from '@/components/LocaleProvider';

const STATUS_LABELS = {
  active: 'Active',
  npd: 'In development',
  discontinued: 'Discontinued',
};

function formatDate(value) {
  if (!value) return null;
  const d = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProductOverview({
  product,
  draft,
  editing = false,
  saving = false,
  canEdit = false,
  onEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
}) {
  const { t } = useLocale();
  if (!product) return null;

  if (editing && draft) {
    return (
      <section className="products-sheet products-sheet--edit">
        <header className="products-sheet-edit-head">
          <h2>Edit product</h2>
          <p>Changes are visible to everyone with access to Products.</p>
        </header>

        <div className="products-sheet-card">
          <h3 className="products-sheet-section-label">Basics</h3>
          <div className="products-edit-grid">
            <label className="appdev-field">
              <span>Product name</span>
              <input
                type="text"
                value={draft.name || ''}
                onChange={e => onDraftChange({ ...draft, name: e.target.value })}
                disabled={saving}
              />
            </label>
            <label className="appdev-field">
              <span>SKU</span>
              <input type="text" value={draft.sku || ''} disabled readOnly />
            </label>
            <label className="appdev-field">
              <span>Price</span>
              <input
                type="text"
                value={draft.price_display || ''}
                onChange={e => onDraftChange({ ...draft, price_display: e.target.value })}
                disabled={saving}
                placeholder="$48.80 USD"
              />
            </label>
            <label className="appdev-field">
              <span>Launch date</span>
              <input
                type="date"
                value={draft.launched_at ? String(draft.launched_at).slice(0, 10) : ''}
                onChange={e => onDraftChange({ ...draft, launched_at: e.target.value || null })}
                disabled={saving}
              />
            </label>
            <label className="appdev-field">
              <span>Status</span>
              <select
                value={draft.status || 'active'}
                onChange={e => onDraftChange({ ...draft, status: e.target.value })}
                disabled={saving}
              >
                <option value="active">Active</option>
                <option value="npd">In development</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </label>
            <label className="appdev-field products-edit-wide">
              <span>Product image URL</span>
              <input
                type="url"
                value={draft.image_url || ''}
                onChange={e => onDraftChange({ ...draft, image_url: e.target.value })}
                disabled={saving}
              />
            </label>
          </div>
        </div>

        <div className="products-sheet-card">
          <h3 className="products-sheet-section-label">About this product</h3>
          <label className="appdev-field">
            <span>Short description</span>
            <textarea
              rows={4}
              value={draft.description || ''}
              onChange={e => onDraftChange({ ...draft, description: e.target.value })}
              disabled={saving}
              placeholder="What customers should know at a glance…"
            />
          </label>
        </div>

        <div className="products-sheet-card">
          <h3 className="products-sheet-section-label">Specifications</h3>
          <p className="products-sheet-hint">Use headings (## Section) and bullet lists. Your team sees this as formatted text, not code.</p>
          <label className="appdev-field">
            <span>Spec sheet</span>
            <textarea
              rows={10}
              value={draft.specs?.md || ''}
              onChange={e => onDraftChange({
                ...draft,
                specs: { ...(draft.specs || {}), md: e.target.value },
              })}
              disabled={saving}
            />
          </label>
        </div>

        <div className="products-sheet-actions">
          <button type="button" className="appdev-btn-ghost" onClick={onCancelEdit} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="appdev-btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>
    );
  }

  const launchLabel = formatDate(product.launched_at);
  const storeUrl = product.specs?.store_url;

  return (
    <section className="products-sheet">
      <article className="products-hero">
        <div className="products-hero-media">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="products-hero-placeholder">{product.sku}</div>
          )}
        </div>

        <div className="products-hero-body">
          <div className="products-hero-top">
            <div>
              <p className="products-hero-eyebrow">{product.sku}</p>
              <h1 className="products-hero-title">{product.name}</h1>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="appdev-btn-ghost products-hero-edit hub-hover-hint hub-hover-hint--below"
                onClick={onEdit}
                aria-label={t('hub.products.editOverview')}
              >
                <Icon name="edit" size={16} />
                Edit
                <HoverHintTip label={t('hub.products.editOverview')} />
              </button>
            ) : null}
          </div>

          <div className="products-hero-meta">
            <span className={`products-status-pill is-${product.status || 'active'}`}>
              {STATUS_LABELS[product.status] || product.status}
            </span>
            {product.price_display ? (
              <span className="products-hero-price">{product.price_display}</span>
            ) : null}
            {launchLabel ? (
              <span className="products-hero-launch">Launched {launchLabel}</span>
            ) : null}
          </div>

          {storeUrl ? (
            <a href={storeUrl} className="products-hero-store-link" target="_blank" rel="noopener noreferrer">
              View on finecoustic.com
              <Icon name="chevronRight" size={14} />
            </a>
          ) : null}
        </div>
      </article>

      {product.description ? (
        <section className="products-sheet-card products-sheet-card--about">
          <h2 className="products-sheet-section-label">About</h2>
          <p className="products-sheet-lead">{product.description}</p>
        </section>
      ) : null}

      {product.specs?.md ? (
        <section className="products-sheet-card products-sheet-card--specs">
          <h2 className="products-sheet-section-label">Specifications</h2>
          <HubProse markdown={product.specs.md} />
        </section>
      ) : null}
    </section>
  );
}
