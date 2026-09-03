'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ButtonBusyContent from '@/components/ButtonBusyContent';
import KolModal from '@/components/KolModal';
import KolSegmentPicker from '@/components/marketing/KolSegmentPicker';
import KolOutreachShipKitFields from '@/components/marketing/KolOutreachShipKitFields';
import KolOutreachShippingAddressForm, {
  emptyShippingForm,
  isShippingFormComplete,
  shippingFormFromRecord,
} from '@/components/marketing/KolOutreachShippingAddressForm';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import KolOutreachProductRowsEditor from '@/components/marketing/KolOutreachProductRowsEditor';
import KolOutreachOrderNumberField from '@/components/marketing/KolOutreachOrderNumberField';
import {
  KOL_APPROACH_DIRECTIONS,
  KOL_APPROACH_PLATFORMS,
  KOL_BOARD_PROP,
  KOL_DEAL_TYPES,
  KOL_NO_DEAL_REASON_NO_REPLY,
  KOL_NO_DEAL_REASON_PRESET_NO_REPLY,
  KOL_NO_DEAL_REASON_PRESET_OTHER,
  normalizeApproachDirection,
  parseDealProducts,
  resolveNoDealReasonPreset,
  serializeDealProducts,
  suggestNextKolOrderNumber,
  validateKolOrderNumber,
} from '@/lib/kol-outreach-shared';
import { hasKolShippingAddress } from '@/lib/kol-pool';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function KolOutreachTransitionModal({
  open,
  task,
  toStatus,
  stepIndex = 0,
  stepCount = 0,
  displayName = '',
  poolRecord = null,
  outreachTasks = [],
  onClose,
  onConfirm,
  busy = false,
}) {
  const { t } = useLocale();
  const cv = task?.custom_values || {};
  const [platforms, setPlatforms] = useState([]);
  const [approachDirection, setApproachDirection] = useState('outbound');
  const [approachDate, setApproachDate] = useState(todayIso());
  const [dealType, setDealType] = useState('Product barter');
  const [dealTerms, setDealTerms] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDeadline, setDealDeadline] = useState('');
  const [productRows, setProductRows] = useState([]);
  const [shippingForm, setShippingForm] = useState(emptyShippingForm());
  const [noDealReasonPreset, setNoDealReasonPreset] = useState(KOL_NO_DEAL_REASON_PRESET_NO_REPLY);
  const [noDealReasonCustom, setNoDealReasonCustom] = useState('');
  const [qcPassed, setQcPassed] = useState(false);
  const [shippingDate, setShippingDate] = useState(todayIso());
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [trackingSent, setTrackingSent] = useState(false);
  const [mediaKitLink, setMediaKitLink] = useState('');
  const [mediaKitSent, setMediaKitSent] = useState(false);
  const [productArrived, setProductArrived] = useState(false);
  const [publishUrl, setPublishUrl] = useState('');
  const [publishDate, setPublishDate] = useState(todayIso());
  const [catalogProducts, setCatalogProducts] = useState([]);

  const needsShippingAddress = toStatus === 'deal' && !hasKolShippingAddress(poolRecord);

  const approachOptions = useMemo(
    () => KOL_APPROACH_DIRECTIONS.map(item => ({
      id: item.id,
      label: item.id === 'outbound' ? t('hub.campaignKol.approachOutbound') : t('hub.campaignKol.approachInbound'),
    })),
    [t]
  );

  const dealTypeOptions = useMemo(
    () => KOL_DEAL_TYPES.map(item => ({ id: item.id, label: t(item.labelKey) })),
    [t]
  );

  const noDealReasonOptions = useMemo(
    () => [
      { id: KOL_NO_DEAL_REASON_PRESET_NO_REPLY, label: t('hub.campaignKol.statusNoReply') },
      { id: KOL_NO_DEAL_REASON_PRESET_OTHER, label: t('hub.campaignKol.noDealReasonOther') },
    ],
    [t]
  );

  useEffect(() => {
    if (!open) return;
    setApproachDate(cv[KOL_BOARD_PROP.approachDate] || todayIso());
    setApproachDirection(normalizeApproachDirection(cv[KOL_BOARD_PROP.approachDirection]));
    setDealType(cv[KOL_BOARD_PROP.dealType] || 'Product barter');
    setDealTerms(cv[KOL_BOARD_PROP.dealTerms] || '');
    setDealAmount(cv[KOL_BOARD_PROP.dealAmount] || '');
    setDealDeadline(cv[KOL_BOARD_PROP.dealDeadline] || '');
    setProductRows(parseDealProducts(cv[KOL_BOARD_PROP.dealProducts]).length
      ? parseDealProducts(cv[KOL_BOARD_PROP.dealProducts])
      : []);
    setShippingForm(shippingFormFromRecord(poolRecord, { fallbackName: displayName }));
    const existingNoDealReason = cv[KOL_BOARD_PROP.noDealReason] || '';
    setNoDealReasonPreset(resolveNoDealReasonPreset(existingNoDealReason));
    setNoDealReasonCustom(
      resolveNoDealReasonPreset(existingNoDealReason) === KOL_NO_DEAL_REASON_PRESET_OTHER
        ? existingNoDealReason
        : ''
    );
    setQcPassed(cv[KOL_BOARD_PROP.qcPassed] === 'yes');
    setShippingDate(cv[KOL_BOARD_PROP.shippingDate] || todayIso());
    setOrderNumber(cv[KOL_BOARD_PROP.orderNumber] || '');
    setTrackingLink(cv[KOL_BOARD_PROP.trackingLink] || '');
    setTrackingSent(cv[KOL_BOARD_PROP.trackingSent] === 'yes');
    setMediaKitLink(cv[KOL_BOARD_PROP.mediaKitLink] || '');
    setMediaKitSent(cv[KOL_BOARD_PROP.mediaKitSent] === 'yes');
    setProductArrived(cv[KOL_BOARD_PROP.productArrived] === 'yes');
    setPublishUrl(cv[KOL_BOARD_PROP.publishUrl] || '');
    setPublishDate(cv[KOL_BOARD_PROP.publishDate] || todayIso());
    setPlatforms(
      String(cv[KOL_BOARD_PROP.socials] || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    );
  }, [open, task, cv, poolRecord, displayName]);

  useEffect(() => {
    if (!open || toStatus !== 'weibin' || !task) return;
    if (cv[KOL_BOARD_PROP.orderNumber]) return;
    setOrderNumber(suggestNextKolOrderNumber(outreachTasks));
  }, [open, toStatus, task, cv, outreachTasks]);

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
      weibin: 'hub.campaignKol.modalWeibinTitle',
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
      nextCustom[KOL_BOARD_PROP.approachDirection] = approachDirection;
      nextCustom[KOL_BOARD_PROP.socials] = platforms.join(', ');
      nextCustom[KOL_BOARD_PROP.approachDate] = approachDate;
    }
    if (toStatus === 'deal') {
      if (needsShippingAddress && !isShippingFormComplete(shippingForm)) return;
      const products = productRows.filter(row => row.product?.trim());
      nextCustom[KOL_BOARD_PROP.dealType] = dealType;
      nextCustom[KOL_BOARD_PROP.dealTerms] = dealTerms.trim();
      nextCustom[KOL_BOARD_PROP.dealAmount] = dealAmount.trim();
      nextCustom[KOL_BOARD_PROP.dealDeadline] = dealDeadline;
      nextCustom[KOL_BOARD_PROP.dealProducts] = serializeDealProducts(products);
    }
    if (toStatus === 'no_deal') {
      if (noDealReasonPreset === KOL_NO_DEAL_REASON_PRESET_OTHER && !noDealReasonCustom.trim()) return;
      nextCustom[KOL_BOARD_PROP.noDealReason] = noDealReasonPreset === KOL_NO_DEAL_REASON_PRESET_NO_REPLY
        ? KOL_NO_DEAL_REASON_NO_REPLY
        : noDealReasonCustom.trim();
    }
    if (toStatus === 'quality_control') {
      nextCustom[KOL_BOARD_PROP.qcPassed] = qcPassed ? 'yes' : 'no';
      nextCustom[KOL_BOARD_PROP.qcDate] = todayIso();
      nextCustom[KOL_BOARD_PROP.qcCheckedBy] = displayName;
    }
    if (toStatus === 'weibin') {
      const result = validateKolOrderNumber(orderNumber);
      if (result.normalized) {
        nextCustom[KOL_BOARD_PROP.orderNumber] = result.normalized;
      }
    }
    if (toStatus === 'shipping') {
      const resolvedRaw = orderNumber.trim() || String(cv[KOL_BOARD_PROP.orderNumber] || '').trim();
      const result = validateKolOrderNumber(resolvedRaw);
      nextCustom[KOL_BOARD_PROP.shippingDate] = shippingDate;
      if (result.normalized) {
        nextCustom[KOL_BOARD_PROP.orderNumber] = result.normalized;
      }
      nextCustom[KOL_BOARD_PROP.trackingLink] = trackingLink.trim();
      nextCustom[KOL_BOARD_PROP.trackingSent] = trackingSent ? 'yes' : 'no';
      if (trackingSent && !cv[KOL_BOARD_PROP.trackingSentAt]) {
        nextCustom[KOL_BOARD_PROP.trackingSentAt] = todayIso();
      }
      nextCustom[KOL_BOARD_PROP.mediaKitLink] = mediaKitLink.trim();
      nextCustom[KOL_BOARD_PROP.mediaKitSent] = mediaKitSent ? 'yes' : 'no';
      if (mediaKitSent && !cv[KOL_BOARD_PROP.mediaKitSentAt]) {
        nextCustom[KOL_BOARD_PROP.mediaKitSentAt] = todayIso();
      }
    }
    if (toStatus === 'arrived') {
      nextCustom[KOL_BOARD_PROP.arrivalDate] = todayIso();
      nextCustom[KOL_BOARD_PROP.productArrived] = productArrived ? 'yes' : 'no';
    }
    if (toStatus === 'publish') {
      if (!publishUrl.trim()) return;
      nextCustom[KOL_BOARD_PROP.publishUrl] = publishUrl.trim();
      nextCustom[KOL_BOARD_PROP.publishDate] = publishDate;
    }

    onConfirm?.({
      status: toStatus,
      custom_values: nextCustom,
      productRows: toStatus === 'deal' ? productRows.filter(row => row.product?.trim()) : [],
      poolShippingPatch: toStatus === 'deal' && needsShippingAddress ? shippingForm : null,
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

        <div className="kol-modal-body">
        {toStatus === 'waiting_response' ? (
          <>
            <div className="appdev-field">
              <span>{t('hub.campaignKol.approachDirection')}</span>
              <KolSegmentPicker
                options={approachOptions}
                value={approachDirection}
                onChange={setApproachDirection}
                ariaLabel={t('hub.campaignKol.approachDirection')}
              />
            </div>
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
            <div className="appdev-field">
              <span>{t('hub.campaignKol.colDealType')}</span>
              <KolSegmentPicker
                options={dealTypeOptions}
                value={dealType}
                onChange={setDealType}
                ariaLabel={t('hub.campaignKol.colDealType')}
              />
            </div>
            {needsShippingAddress ? (
              <KolOutreachShippingAddressForm value={shippingForm} onChange={setShippingForm} disabled={busy} />
            ) : null}
            <KolOutreachProductRowsEditor rows={productRows} onChange={setProductRows} products={catalogProducts} t={t} />
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
          <>
            <div className="appdev-field">
              <span>{t('hub.campaignKol.noDealReason')}</span>
              <KolSegmentPicker
                options={noDealReasonOptions}
                value={noDealReasonPreset}
                onChange={setNoDealReasonPreset}
                ariaLabel={t('hub.campaignKol.noDealReason')}
              />
            </div>
            {noDealReasonPreset === KOL_NO_DEAL_REASON_PRESET_OTHER ? (
              <label className="appdev-field">
                <span>{t('hub.campaignKol.noDealReasonOther')}</span>
                <textarea
                  rows={4}
                  value={noDealReasonCustom}
                  onChange={e => setNoDealReasonCustom(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </>
        ) : null}

        {toStatus === 'quality_control' ? (
          <label className="kol-toggle-row kol-toggle-row--block">
            <span>{t('hub.campaignKol.qcPassed')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={qcPassed}
              className={`kol-toggle${qcPassed ? ' is-on' : ''}`}
              onClick={() => setQcPassed(v => !v)}
            >
              <span className="kol-toggle-thumb" aria-hidden="true" />
            </button>
          </label>
        ) : null}

        {toStatus === 'weibin' ? (
          <div className="kol-modal-panel">
            <p className="kol-modal-sub">{t('hub.campaignKol.weibinHint')}</p>
            <KolOutreachOrderNumberField
              value={orderNumber}
              onChange={setOrderNumber}
              outreachTasks={outreachTasks}
              disabled={busy}
            />
          </div>
        ) : null}

        {toStatus === 'shipping' ? (
          <KolOutreachShipKitFields
            shippingDate={shippingDate}
            onShippingDateChange={setShippingDate}
            requireShippingDate
            requireOrderNumber={false}
            showOrderNumber={!String(cv[KOL_BOARD_PROP.orderNumber] || '').trim()}
            orderNumber={orderNumber}
            onOrderNumberChange={setOrderNumber}
            outreachTasks={outreachTasks}
            excludeTaskId={task.id}
            mediaKitLink={mediaKitLink}
            onMediaKitLinkChange={setMediaKitLink}
            mediaKitSent={mediaKitSent}
            onMediaKitSentChange={setMediaKitSent}
            trackingLink={trackingLink}
            onTrackingLinkChange={setTrackingLink}
            trackingSent={trackingSent}
            onTrackingSentChange={setTrackingSent}
            disabled={busy}
          />
        ) : null}

        {toStatus === 'arrived' ? (
          <label className="kol-toggle-row kol-toggle-row--block">
            <span>{t('hub.campaignKol.productArrivedConfirm')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={productArrived}
              className={`kol-toggle${productArrived ? ' is-on' : ''}`}
              onClick={() => setProductArrived(v => !v)}
            >
              <span className="kol-toggle-thumb" aria-hidden="true" />
            </button>
          </label>
        ) : null}

        {toStatus === 'publish' ? (
          <>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishUrl')}</span>
              <input type="url" value={publishUrl} onChange={e => setPublishUrl(e.target.value)} required />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishDate')}</span>
              <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} required />
            </label>
          </>
        ) : null}
        </div>

        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="appdev-btn-primary" disabled={busy}>
            <ButtonBusyContent busy={busy} busyLabel={t('common.saving')}>
              {t('common.confirm')}
            </ButtonBusyContent>
          </button>
        </footer>
      </form>
    </KolModal>
  );
}
