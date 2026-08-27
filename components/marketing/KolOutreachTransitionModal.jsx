'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  KOL_APPROACH_PLATFORMS,
  KOL_BOARD_PROP,
  parseDealProducts,
  serializeDealProducts,
} from '@/lib/kol-outreach-shared';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ProductRowsEditor({ rows, onChange, products, t }) {
  function updateRow(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="kol-outreach-product-rows">
      <span className="appdev-prompt-label">{t('hub.campaignKol.productsGifted')}</span>
      {rows.map((row, index) => (
        <div key={`product-row-${index}`} className="kol-outreach-product-row">
          <input
            list="kol-outreach-product-options"
            value={row.product}
            onChange={e => updateRow(index, { product: e.target.value })}
            placeholder={t('hub.campaignKol.productPlaceholder')}
          />
          <input
            type="number"
            min={1}
            value={row.qty}
            onChange={e => updateRow(index, { qty: Number(e.target.value) || 1 })}
            aria-label={t('hub.campaignKol.productQty')}
          />
          <button type="button" className="appdev-btn-ghost" onClick={() => removeRow(index)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <datalist id="kol-outreach-product-options">
        {products.map(product => (
          <option key={product.sku} value={product.name} />
        ))}
      </datalist>
      <button
        type="button"
        className="appdev-btn-ghost"
        onClick={() => onChange([...rows, { product: '', qty: 1 }])}
      >
        + {t('hub.campaignKol.addProductRow')}
      </button>
    </div>
  );
}

export default function KolOutreachTransitionModal({
  open,
  task,
  toStatus,
  stepIndex = 0,
  stepCount = 0,
  displayName = '',
  onClose,
  onConfirm,
  busy = false,
}) {
  const { t } = useLocale();
  const cv = task?.custom_values || {};
  const [platforms, setPlatforms] = useState([]);
  const [approachDate, setApproachDate] = useState(todayIso());
  const [dealType, setDealType] = useState('Product barter');
  const [dealTerms, setDealTerms] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDeadline, setDealDeadline] = useState('');
  const [productRows, setProductRows] = useState([{ product: '', qty: 1 }]);
  const [noDealReason, setNoDealReason] = useState('');
  const [qcDate, setQcDate] = useState(todayIso());
  const [qcCheckedBy, setQcCheckedBy] = useState(displayName);
  const [qcNotes, setQcNotes] = useState('');
  const [shippingDate, setShippingDate] = useState(todayIso());
  const [trackingLink, setTrackingLink] = useState('');
  const [mediaKitSent, setMediaKitSent] = useState(false);
  const [productArrived, setProductArrived] = useState(false);
  const [publishUrl, setPublishUrl] = useState('');
  const [publishPlatform, setPublishPlatform] = useState('');
  const [publishDate, setPublishDate] = useState(todayIso());
  const [catalogProducts, setCatalogProducts] = useState([]);

  useEffect(() => {
    if (!open) return;
    setApproachDate(cv[KOL_BOARD_PROP.approachDate] || todayIso());
    setDealType(cv[KOL_BOARD_PROP.dealType] || 'Product barter');
    setDealTerms(cv[KOL_BOARD_PROP.dealTerms] || '');
    setDealAmount(cv[KOL_BOARD_PROP.dealAmount] || '');
    setDealDeadline(cv[KOL_BOARD_PROP.dealDeadline] || '');
    setProductRows(parseDealProducts(cv[KOL_BOARD_PROP.dealProducts]).length
      ? parseDealProducts(cv[KOL_BOARD_PROP.dealProducts])
      : [{ product: '', qty: 1 }]);
    setNoDealReason(cv[KOL_BOARD_PROP.noDealReason] || '');
    setQcDate(cv[KOL_BOARD_PROP.qcDate] || todayIso());
    setQcCheckedBy(cv[KOL_BOARD_PROP.qcCheckedBy] || displayName);
    setQcNotes(cv[KOL_BOARD_PROP.qcNotes] || '');
    setShippingDate(cv[KOL_BOARD_PROP.shippingDate] || todayIso());
    setTrackingLink(cv[KOL_BOARD_PROP.trackingLink] || '');
    setMediaKitSent(cv[KOL_BOARD_PROP.mediaKitSent] === 'yes');
    setProductArrived(cv[KOL_BOARD_PROP.productArrived] === 'yes');
    setPublishUrl(cv[KOL_BOARD_PROP.publishUrl] || '');
    setPublishPlatform(cv[KOL_BOARD_PROP.publishPlatform] || '');
    setPublishDate(cv[KOL_BOARD_PROP.publishDate] || todayIso());
    setPlatforms(
      String(cv[KOL_BOARD_PROP.socials] || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    );
  }, [open, task, cv, displayName]);

  useEffect(() => {
    if (!open || toStatus !== 'deal') return;
    fetch(API_V1.products, { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        const data = unwrapData(body);
        setCatalogProducts(Array.isArray(data?.products) ? data.products : []);
      })
      .catch(() => setCatalogProducts([]));
  }, [open, toStatus]);

  if (!open || !task || !toStatus) return null;

  function togglePlatform(name) {
    setPlatforms(current =>
      current.includes(name) ? current.filter(item => item !== name) : [...current, name]
    );
  }

  function titleForStatus() {
    const keys = {
      waiting_response: 'hub.campaignKol.modalApproachTitle',
      deal: 'hub.campaignKol.modalDealTitle',
      no_deal: 'hub.campaignKol.modalNoDealTitle',
      quality_control: 'hub.campaignKol.modalQcTitle',
      shipping: 'hub.campaignKol.modalShippingTitle',
      arrived: 'hub.campaignKol.modalArrivedTitle',
      publish: 'hub.campaignKol.modalPublishTitle',
    };
    const key = keys[toStatus];
    return key ? t(key).replace('{name}', task.title) : task.title;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextCustom = { ...cv };

    if (toStatus === 'waiting_response') {
      if (!platforms.length) return;
      nextCustom[KOL_BOARD_PROP.socials] = platforms.join(', ');
      nextCustom[KOL_BOARD_PROP.approachDate] = approachDate;
    }
    if (toStatus === 'deal') {
      const products = productRows.filter(row => row.product?.trim());
      if (!products.length) return;
      nextCustom[KOL_BOARD_PROP.dealType] = dealType;
      nextCustom[KOL_BOARD_PROP.dealTerms] = dealTerms.trim();
      nextCustom[KOL_BOARD_PROP.dealAmount] = dealAmount.trim();
      nextCustom[KOL_BOARD_PROP.dealDeadline] = dealDeadline;
      nextCustom[KOL_BOARD_PROP.dealProducts] = serializeDealProducts(products);
    }
    if (toStatus === 'no_deal') {
      nextCustom[KOL_BOARD_PROP.noDealReason] = noDealReason.trim();
    }
    if (toStatus === 'quality_control') {
      nextCustom[KOL_BOARD_PROP.qcDate] = qcDate;
      nextCustom[KOL_BOARD_PROP.qcCheckedBy] = qcCheckedBy.trim();
      nextCustom[KOL_BOARD_PROP.qcNotes] = qcNotes.trim();
    }
    if (toStatus === 'shipping') {
      if (!trackingLink.trim()) return;
      nextCustom[KOL_BOARD_PROP.shippingDate] = shippingDate;
      nextCustom[KOL_BOARD_PROP.trackingLink] = trackingLink.trim();
      nextCustom[KOL_BOARD_PROP.mediaKitSent] = mediaKitSent ? 'yes' : 'no';
    }
    if (toStatus === 'arrived') {
      nextCustom[KOL_BOARD_PROP.arrivalDate] = todayIso();
      nextCustom[KOL_BOARD_PROP.productArrived] = productArrived ? 'yes' : 'no';
    }
    if (toStatus === 'publish') {
      if (!publishUrl.trim()) return;
      nextCustom[KOL_BOARD_PROP.publishUrl] = publishUrl.trim();
      nextCustom[KOL_BOARD_PROP.publishPlatform] = publishPlatform.trim();
      nextCustom[KOL_BOARD_PROP.publishDate] = publishDate;
    }

    onConfirm?.({
      status: toStatus,
      custom_values: nextCustom,
      productRows: toStatus === 'deal' ? productRows.filter(row => row.product?.trim()) : [],
    });
  }

  return (
    <KolModal open={open} onClose={onClose} labelledBy="kol-transition-title" wide>
      <form onSubmit={handleSubmit}>
        <header className="kol-modal-head">
          <div className="kol-modal-head-copy">
            <h3 id="kol-transition-title">{titleForStatus()}</h3>
            {stepCount > 1 ? (
              <p className="kol-modal-sub">
                {t('hub.campaignKol.transitionStep')
                  .replace('{current}', String(stepIndex + 1))
                  .replace('{total}', String(stepCount))}
              </p>
            ) : null}
          </div>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        {toStatus === 'waiting_response' ? (
          <>
            <fieldset className="kol-outreach-platform-pick">
              <legend>{t('hub.campaignKol.platformsApproached')}</legend>
              {KOL_APPROACH_PLATFORMS.map(name => (
                <label key={name} className="kol-outreach-platform-option">
                  <input
                    type="checkbox"
                    checked={platforms.includes(name)}
                    onChange={() => togglePlatform(name)}
                  />
                  {name}
                </label>
              ))}
            </fieldset>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colApproachDate')}</span>
              <input type="date" value={approachDate} onChange={e => setApproachDate(e.target.value)} required />
            </label>
          </>
        ) : null}

        {toStatus === 'deal' ? (
          <>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colDealType')}</span>
              <select value={dealType} onChange={e => setDealType(e.target.value)}>
                <option value="Product barter">{t('hub.campaignKol.dealBarter')}</option>
                <option value="Paid">{t('hub.campaignKol.dealPaid')}</option>
                <option value="Hybrid">{t('hub.campaignKol.dealHybrid')}</option>
                <option value="Other">{t('hub.campaignKol.dealOther')}</option>
              </select>
            </label>
            <ProductRowsEditor rows={productRows} onChange={setProductRows} products={catalogProducts} t={t} />
            <label className="appdev-field">
              <span>{t('hub.campaignKol.dealAmount')}</span>
              <input value={dealAmount} onChange={e => setDealAmount(e.target.value)} placeholder="Shipping fee, etc." />
            </label>
            {dealType === 'Paid' ? (
              <label className="appdev-field">
                <span>{t('hub.campaignKol.dealDeadline')}</span>
                <input type="date" value={dealDeadline} onChange={e => setDealDeadline(e.target.value)} />
              </label>
            ) : null}
            <label className="appdev-field">
              <span>{t('hub.campaignKol.dealTerms')}</span>
              <textarea rows={4} value={dealTerms} onChange={e => setDealTerms(e.target.value)} />
            </label>
          </>
        ) : null}

        {toStatus === 'no_deal' ? (
          <label className="appdev-field">
            <span>{t('hub.campaignKol.noDealReason')}</span>
            <textarea rows={4} value={noDealReason} onChange={e => setNoDealReason(e.target.value)} required />
          </label>
        ) : null}

        {toStatus === 'quality_control' ? (
          <>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcDate')}</span>
              <input type="date" value={qcDate} onChange={e => setQcDate(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcCheckedBy')}</span>
              <input value={qcCheckedBy} onChange={e => setQcCheckedBy(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcNotes')}</span>
              <textarea rows={3} value={qcNotes} onChange={e => setQcNotes(e.target.value)} />
            </label>
          </>
        ) : null}

        {toStatus === 'shipping' ? (
          <>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colShipping')}</span>
              <input type="date" value={shippingDate} onChange={e => setShippingDate(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.trackingLink')}</span>
              <input type="url" value={trackingLink} onChange={e => setTrackingLink(e.target.value)} required />
            </label>
            <label className="kol-outreach-checkbox">
              <input type="checkbox" checked={mediaKitSent} onChange={e => setMediaKitSent(e.target.checked)} />
              {t('hub.campaignKol.mediaKitSent')}
            </label>
          </>
        ) : null}

        {toStatus === 'arrived' ? (
          <label className="kol-outreach-checkbox">
            <input type="checkbox" checked={productArrived} onChange={e => setProductArrived(e.target.checked)} />
            {t('hub.campaignKol.productArrivedConfirm')}
          </label>
        ) : null}

        {toStatus === 'publish' ? (
          <>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishUrl')}</span>
              <input type="url" value={publishUrl} onChange={e => setPublishUrl(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishPlatform')}</span>
              <input value={publishPlatform} onChange={e => setPublishPlatform(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishDate')}</span>
              <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} required />
            </label>
          </>
        ) : null}

        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="appdev-btn-primary" disabled={busy}>
            {t('common.confirm')}
          </button>
        </footer>
      </form>
    </KolModal>
  );
}
