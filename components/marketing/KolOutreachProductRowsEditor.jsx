'use client';

import Icon from '@/components/Icon';

export default function KolOutreachProductRowsEditor({ rows, onChange, products, t }) {
  function updateRow(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="kol-outreach-product-rows">
      <span className="appdev-prompt-label">{t('hub.campaignKol.productsGifted')}</span>
      {rows.length === 0 ? (
        <p className="kol-outreach-product-empty">{t('hub.campaignKol.productRowsEmpty')}</p>
      ) : (
        rows.map((row, index) => (
          <div key={`product-row-${index}`} className="kol-outreach-product-row">
            <label className="kol-outreach-product-field kol-outreach-product-field--name">
              <span>{t('hub.campaignKol.productNameLabel')}</span>
              <input
                list="kol-outreach-product-options"
                value={row.product}
                onChange={e => updateRow(index, { product: e.target.value })}
                placeholder={t('hub.campaignKol.productPlaceholderExample')}
                autoComplete="off"
              />
            </label>
            <label className="kol-outreach-product-field kol-outreach-product-field--qty">
              <span>{t('hub.campaignKol.productQty')}</span>
              <input
                type="number"
                min={1}
                value={row.qty}
                onChange={e => updateRow(index, { qty: Number(e.target.value) || 1 })}
              />
            </label>
            <button
              type="button"
              className="appdev-btn-ghost kol-outreach-product-remove"
              onClick={() => removeRow(index)}
              aria-label={t('hub.campaignKol.removeProductRow')}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))
      )}
      <datalist id="kol-outreach-product-options">
        {products.map(product => (
          <option key={product.sku} value={product.name} />
        ))}
      </datalist>
      <button
        type="button"
        className="appdev-btn-ghost kol-outreach-product-add"
        onClick={() => onChange([...rows, { product: '', qty: 1 }])}
      >
        + {t('hub.campaignKol.addProductRow')}
      </button>
    </div>
  );
}
