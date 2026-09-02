'use client';

import Icon from '@/components/Icon';

export default function KolOutreachProductRowsEditor({ rows, onChange, products, t }) {
  function addProduct(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const existing = rows.find(row => row.product.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(rows.map(row =>
        row.product.toLowerCase() === trimmed.toLowerCase()
          ? { ...row, qty: row.qty + 1 }
          : row
      ));
      return;
    }
    onChange([...rows, { product: trimmed, qty: 1 }]);
  }

  function updateQty(index, qty) {
    onChange(rows.map((row, i) => (i === index ? { ...row, qty: Math.max(1, qty) } : row)));
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="kol-deal-products">
      <span className="appdev-prompt-label">{t('hub.campaignKol.productsGifted')}</span>

      {products.length ? (
        <div className="kol-deal-products-catalog" role="list" aria-label={t('hub.campaignKol.productsGifted')}>
          {products.map(product => (
            <button
              key={product.sku}
              type="button"
              className="kol-deal-products-chip"
              onClick={() => addProduct(product.name)}
            >
              + {product.name}
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="kol-deal-products-empty">{t('hub.campaignKol.productRowsEmpty')}</p>
      ) : (
        <ul className="kol-deal-products-list">
          {rows.map((row, index) => (
            <li key={`${row.product}-${index}`} className="kol-deal-products-item">
              <span className="kol-deal-products-name">{row.product}</span>
              <label className="kol-deal-products-qty">
                <span className="sr-only">{t('hub.campaignKol.productQty')}</span>
                <button
                  type="button"
                  className="kol-deal-products-step"
                  onClick={() => updateQty(index, row.qty - 1)}
                  aria-label="-"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={e => updateQty(index, Number(e.target.value) || 1)}
                  aria-label={t('hub.campaignKol.productQty')}
                />
                <button
                  type="button"
                  className="kol-deal-products-step"
                  onClick={() => updateQty(index, row.qty + 1)}
                  aria-label="+"
                >
                  +
                </button>
              </label>
              <button
                type="button"
                className="hub-icon-btn kol-deal-products-remove"
                onClick={() => removeRow(index)}
                aria-label={t('hub.campaignKol.removeProductRow')}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="appdev-field kol-deal-products-custom">
        <span>{t('hub.campaignKol.productPlaceholder')}</span>
        <input
          type="text"
          placeholder={t('hub.campaignKol.productPlaceholderExample')}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addProduct(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
      </label>
    </div>
  );
}
