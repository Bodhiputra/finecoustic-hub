'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ButtonBusyContent from '@/components/ButtonBusyContent';
import KolModal from '@/components/KolModal';
import KolSegmentPicker from '@/components/marketing/KolSegmentPicker';
import KolOutreachShipKitFields from '@/components/marketing/KolOutreachShipKitFields';
import KolOutreachProductRowsEditor from '@/components/marketing/KolOutreachProductRowsEditor';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { buildTeamAssigneeOptions } from '@/lib/internal';
import {
  KOL_APPROACH_DIRECTIONS,
  KOL_APPROACH_PLATFORMS,
  KOL_BOARD_PROP,
  KOL_DEAL_TYPES,
  KOL_INITIATIVES,
  KOL_NO_DEAL_REASON_NO_REPLY,
  KOL_NO_DEAL_REASON_PRESET_NO_REPLY,
  KOL_NO_DEAL_REASON_PRESET_OTHER,
  kolCardModalSections,
  normalizeApproachDirection,
  normalizeKolOutreachStatus,
  parseDealProducts,
  resolveKolInitiative,
  resolveNoDealReasonPreset,
  serializeDealProducts,
} from '@/lib/kol-outreach-shared';
import { taskInitiative } from '@/lib/kol-outreach-utils';

function Section({ title, children }) {
  return (
    <section className="kol-card-modal-section">
      <h4 className="kol-card-modal-section-title">{title}</h4>
      <div className="kol-card-modal-section-body">{children}</div>
    </section>
  );
}

export default function KolOutreachCardModal({
  open,
  task,
  teamMembers = [],
  displayName = '',
  defaultInitiative = '',
  onClose,
  onSave,
  onDelete,
  busy = false,
}) {
  const { t } = useLocale();
  const cv = task?.custom_values || {};
  const status = normalizeKolOutreachStatus(task?.status);
  const sections = useMemo(() => kolCardModalSections(status), [status]);

  const [assignee, setAssignee] = useState('');
  const [initiative, setInitiative] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [approachDirection, setApproachDirection] = useState('outbound');
  const [approachDate, setApproachDate] = useState('');
  const [dealType, setDealType] = useState('Product barter');
  const [dealTerms, setDealTerms] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDeadline, setDealDeadline] = useState('');
  const [productRows, setProductRows] = useState([]);
  const [noDealReasonPreset, setNoDealReasonPreset] = useState(KOL_NO_DEAL_REASON_PRESET_NO_REPLY);
  const [noDealReasonCustom, setNoDealReasonCustom] = useState('');
  const [qcPassed, setQcPassed] = useState(false);
  const [weibinBatchCode, setWeibinBatchCode] = useState('');
  const [weibinHandoffDate, setWeibinHandoffDate] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [trackingSent, setTrackingSent] = useState(false);
  const [mediaKitLink, setMediaKitLink] = useState('');
  const [mediaKitSent, setMediaKitSent] = useState(false);
  const [arrivalDate, setArrivalDate] = useState('');
  const [productArrived, setProductArrived] = useState(false);
  const [publishUrl, setPublishUrl] = useState('');
  const [publishPlatform, setPublishPlatform] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [catalogProducts, setCatalogProducts] = useState([]);

  const hasPipelineSections = Object.values(sections).some(Boolean);

  const assigneeOptions = useMemo(
    () => buildTeamAssigneeOptions(teamMembers, {
      displayName,
      extraNames: [task?.assignee],
    }),
    [teamMembers, displayName, task?.assignee]
  );

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

  const initiativeOptions = useMemo(
    () => KOL_INITIATIVES.map(item => ({ id: item.id, label: item.label })),
    []
  );

  const noDealReasonOptions = useMemo(
    () => [
      { id: KOL_NO_DEAL_REASON_PRESET_NO_REPLY, label: t('hub.campaignKol.statusNoReply') },
      { id: KOL_NO_DEAL_REASON_PRESET_OTHER, label: t('hub.campaignKol.noDealReasonOther') },
    ],
    [t]
  );

  useEffect(() => {
    if (!open || !task) return;
    setAssignee(task.assignee || '');
    setInitiative(resolveKolInitiative(taskInitiative(task) || defaultInitiative));
    setPlatforms(
      String(cv[KOL_BOARD_PROP.socials] || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    );
    setApproachDate(cv[KOL_BOARD_PROP.approachDate] || '');
    setApproachDirection(normalizeApproachDirection(cv[KOL_BOARD_PROP.approachDirection]));
    setDealType(cv[KOL_BOARD_PROP.dealType] || 'Product barter');
    setDealTerms(cv[KOL_BOARD_PROP.dealTerms] || '');
    setDealAmount(cv[KOL_BOARD_PROP.dealAmount] || '');
    setDealDeadline(cv[KOL_BOARD_PROP.dealDeadline] || '');
    setProductRows(parseDealProducts(cv[KOL_BOARD_PROP.dealProducts]));
    const existingNoDealReason = cv[KOL_BOARD_PROP.noDealReason] || '';
    setNoDealReasonPreset(resolveNoDealReasonPreset(existingNoDealReason));
    setNoDealReasonCustom(
      resolveNoDealReasonPreset(existingNoDealReason) === KOL_NO_DEAL_REASON_PRESET_OTHER
        ? existingNoDealReason
        : ''
    );
    setQcPassed(cv[KOL_BOARD_PROP.qcPassed] === 'yes');
    setWeibinBatchCode(cv[KOL_BOARD_PROP.weibinBatchCode] || '');
    setWeibinHandoffDate(cv[KOL_BOARD_PROP.weibinHandoffDate] || '');
    setShippingDate(cv[KOL_BOARD_PROP.shippingDate] || '');
    setOrderNumber(cv[KOL_BOARD_PROP.orderNumber] || '');
    setTrackingLink(cv[KOL_BOARD_PROP.trackingLink] || '');
    setTrackingSent(cv[KOL_BOARD_PROP.trackingSent] === 'yes');
    setMediaKitLink(cv[KOL_BOARD_PROP.mediaKitLink] || '');
    setMediaKitSent(cv[KOL_BOARD_PROP.mediaKitSent] === 'yes');
    setArrivalDate(cv[KOL_BOARD_PROP.arrivalDate] || '');
    setProductArrived(cv[KOL_BOARD_PROP.productArrived] === 'yes');
    setPublishUrl(cv[KOL_BOARD_PROP.publishUrl] || '');
    setPublishPlatform(cv[KOL_BOARD_PROP.publishPlatform] || '');
    setPublishDate(cv[KOL_BOARD_PROP.publishDate] || '');
  }, [open, task, cv, defaultInitiative, displayName]);

  useEffect(() => {
    if (!open || !sections.deal) return;
    fetch(API_V1.products, { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        const data = unwrapData(body);
        setCatalogProducts(Array.isArray(data?.products) ? data.products : []);
      })
      .catch(() => setCatalogProducts([]));
  }, [open, sections.deal]);

  if (!open || !task) return null;

  function togglePlatform(name) {
    setPlatforms(current =>
      current.includes(name) ? current.filter(item => item !== name) : [...current, name]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    const nextCustom = { ...(task.custom_values || {}) };

    nextCustom[KOL_BOARD_PROP.initiative] = initiative;
    nextCustom[KOL_BOARD_PROP.dealAmount] = dealAmount.trim();

    if (sections.approach) {
      nextCustom[KOL_BOARD_PROP.approachDirection] = approachDirection;
      nextCustom[KOL_BOARD_PROP.socials] = platforms.join(', ');
      nextCustom[KOL_BOARD_PROP.approachDate] = approachDate;
    }
    if (sections.deal) {
      nextCustom[KOL_BOARD_PROP.dealType] = dealType;
      nextCustom[KOL_BOARD_PROP.dealTerms] = dealTerms.trim();
      nextCustom[KOL_BOARD_PROP.dealDeadline] = dealDeadline;
      nextCustom[KOL_BOARD_PROP.dealProducts] = serializeDealProducts(
        productRows.filter(row => row.product?.trim())
      );
    }
    if (sections.noDeal) {
      nextCustom[KOL_BOARD_PROP.noDealReason] = noDealReasonPreset === KOL_NO_DEAL_REASON_PRESET_NO_REPLY
        ? KOL_NO_DEAL_REASON_NO_REPLY
        : noDealReasonCustom.trim();
    }
    if (sections.qualityControl) {
      nextCustom[KOL_BOARD_PROP.qcPassed] = qcPassed ? 'yes' : 'no';
    }
    if (sections.weibin) {
      nextCustom[KOL_BOARD_PROP.weibinBatchCode] = weibinBatchCode.trim();
      nextCustom[KOL_BOARD_PROP.weibinHandoffDate] = weibinHandoffDate;
    }
    if (sections.shipping) {
      nextCustom[KOL_BOARD_PROP.shippingDate] = shippingDate;
      nextCustom[KOL_BOARD_PROP.orderNumber] = orderNumber.trim();
      nextCustom[KOL_BOARD_PROP.trackingLink] = trackingLink.trim();
      nextCustom[KOL_BOARD_PROP.trackingSent] = trackingSent ? 'yes' : 'no';
      nextCustom[KOL_BOARD_PROP.mediaKitLink] = mediaKitLink.trim();
      nextCustom[KOL_BOARD_PROP.mediaKitSent] = mediaKitSent ? 'yes' : 'no';
    }
    if (sections.arrived) {
      nextCustom[KOL_BOARD_PROP.arrivalDate] = arrivalDate;
      nextCustom[KOL_BOARD_PROP.productArrived] = productArrived ? 'yes' : 'no';
    }
    if (sections.publish) {
      nextCustom[KOL_BOARD_PROP.publishUrl] = publishUrl.trim();
      nextCustom[KOL_BOARD_PROP.publishPlatform] = publishPlatform.trim();
      nextCustom[KOL_BOARD_PROP.publishDate] = publishDate;
    }

    onSave?.({
      assignee: assignee.trim(),
      custom_values: nextCustom,
      productRows: sections.deal ? productRows.filter(row => row.product?.trim()) : [],
    });
  }

  return (
    <KolModal open={open} onClose={onClose} labelledBy="kol-card-modal-title" wide={hasPipelineSections}>
      <form onSubmit={handleSubmit} className="kol-card-modal-form">
        <header className="kol-modal-head">
          <div className="kol-modal-head-copy">
            <h3 id="kol-card-modal-title">{task.title}</h3>
            <p className="kol-modal-sub">{t('hub.campaignKol.cardModalHint')}</p>
          </div>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <Section title={t('hub.campaignKol.cardModalBasics')}>
          <label className="appdev-field">
            <span>{t('hub.internal.taskPanel.assignee')}</span>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} disabled={busy}>
              <option value="">{t('hub.internal.taskPanel.assigneeUnassigned')}</option>
              {assigneeOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="appdev-field">
            <span>{t('hub.campaignKol.initiative')}</span>
            <KolSegmentPicker
              options={initiativeOptions}
              value={initiative}
              onChange={setInitiative}
              disabled={busy}
              ariaLabel={t('hub.campaignKol.initiative')}
            />
          </div>
        </Section>

        <Section title={t('hub.campaignKol.cardModalFees')}>
          <label className="appdev-field">
            <span>{t('hub.campaignKol.feesAmount')}</span>
            <input
              value={dealAmount}
              onChange={e => setDealAmount(e.target.value)}
              placeholder={t('hub.campaignKol.feesAmountPlaceholder')}
              disabled={busy}
            />
          </label>
        </Section>

        {sections.approach ? (
          <Section title={t('hub.campaignKol.cardModalApproach')}>
            <div className="appdev-field">
              <span>{t('hub.campaignKol.approachDirection')}</span>
              <KolSegmentPicker
                options={approachOptions}
                value={approachDirection}
                onChange={setApproachDirection}
                disabled={busy}
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
                    disabled={busy}
                  />
                  {name}
                </label>
              ))}
            </fieldset>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colApproachDate')}</span>
              <input
                type="date"
                value={approachDate}
                onChange={e => setApproachDate(e.target.value)}
                disabled={busy}
              />
            </label>
          </Section>
        ) : null}

        {sections.deal ? (
          <Section title={t('hub.campaignKol.cardModalDeal')}>
            <div className="appdev-field">
              <span>{t('hub.campaignKol.colDealType')}</span>
              <KolSegmentPicker
                options={dealTypeOptions}
                value={dealType}
                onChange={setDealType}
                disabled={busy}
                ariaLabel={t('hub.campaignKol.colDealType')}
              />
            </div>
            <KolOutreachProductRowsEditor
              rows={productRows}
              onChange={setProductRows}
              products={catalogProducts}
              t={t}
            />
            {dealType === 'Paid' ? (
              <label className="appdev-field">
                <span>{t('hub.campaignKol.dealDeadline')}</span>
                <input
                  type="date"
                  value={dealDeadline}
                  onChange={e => setDealDeadline(e.target.value)}
                  disabled={busy}
                />
              </label>
            ) : null}
            <label className="appdev-field">
              <span>{t('hub.campaignKol.dealTerms')}</span>
              <textarea rows={4} value={dealTerms} onChange={e => setDealTerms(e.target.value)} disabled={busy} />
            </label>
          </Section>
        ) : null}

        {sections.qualityControl ? (
          <Section title={t('hub.campaignKol.cardModalQc')}>
            <label className="kol-toggle-row kol-toggle-row--block">
              <span>{t('hub.campaignKol.qcPassed')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={qcPassed}
                className={`kol-toggle${qcPassed ? ' is-on' : ''}`}
                onClick={() => setQcPassed(v => !v)}
                disabled={busy}
              >
                <span className="kol-toggle-thumb" aria-hidden="true" />
              </button>
            </label>
          </Section>
        ) : null}

        {sections.weibin ? (
          <Section title={t('hub.campaignKol.cardModalWeibin')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.weibinBatchCode')}</span>
              <input
                value={weibinBatchCode}
                onChange={e => setWeibinBatchCode(e.target.value)}
                placeholder={t('hub.campaignKol.weibinBatchPlaceholder')}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.weibinHandoffDate')}</span>
              <input
                type="date"
                value={weibinHandoffDate}
                onChange={e => setWeibinHandoffDate(e.target.value)}
                disabled={busy}
              />
            </label>
          </Section>
        ) : null}

        {sections.noDeal ? (
          <Section title={t('hub.campaignKol.cardModalNoDeal')}>
            <div className="appdev-field">
              <span>{t('hub.campaignKol.noDealReason')}</span>
              <KolSegmentPicker
                options={noDealReasonOptions}
                value={noDealReasonPreset}
                onChange={setNoDealReasonPreset}
                ariaLabel={t('hub.campaignKol.noDealReason')}
                disabled={busy}
              />
            </div>
            {noDealReasonPreset === KOL_NO_DEAL_REASON_PRESET_OTHER ? (
              <label className="appdev-field">
                <span>{t('hub.campaignKol.noDealReasonOther')}</span>
                <textarea
                  rows={3}
                  value={noDealReasonCustom}
                  onChange={e => setNoDealReasonCustom(e.target.value)}
                  disabled={busy}
                />
              </label>
            ) : null}
          </Section>
        ) : null}

        {sections.shipping ? (
          <Section title={t('hub.campaignKol.cardModalShipping')}>
            <KolOutreachShipKitFields
              shippingDate={shippingDate}
              onShippingDateChange={setShippingDate}
              orderNumber={orderNumber}
              onOrderNumberChange={setOrderNumber}
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
          </Section>
        ) : null}

        {sections.arrived ? (
          <Section title={t('hub.campaignKol.cardModalArrived')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.arrivalDate')}</span>
              <input
                type="date"
                value={arrivalDate}
                onChange={e => setArrivalDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="kol-toggle-row kol-toggle-row--block">
              <span>{t('hub.campaignKol.productArrivedConfirm')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={productArrived}
                className={`kol-toggle${productArrived ? ' is-on' : ''}`}
                onClick={() => setProductArrived(v => !v)}
                disabled={busy}
              >
                <span className="kol-toggle-thumb" aria-hidden="true" />
              </button>
            </label>
          </Section>
        ) : null}

        {sections.publish ? (
          <Section title={t('hub.campaignKol.cardModalPublish')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishUrl')}</span>
              <input type="url" value={publishUrl} onChange={e => setPublishUrl(e.target.value)} disabled={busy} />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishPlatform')}</span>
              <input value={publishPlatform} onChange={e => setPublishPlatform(e.target.value)} disabled={busy} />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishDate')}</span>
              <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} disabled={busy} />
            </label>
          </Section>
        ) : null}

        <footer className="kol-modal-foot">
          {onDelete ? (
            <button
              type="button"
              className="appdev-btn-danger kol-modal-foot-danger"
              onClick={onDelete}
              disabled={busy}
            >
              {t('hub.campaignKol.removeCard')}
            </button>
          ) : null}
          <div className="kol-modal-foot-actions">
            <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="appdev-btn-primary" disabled={busy}>
              <ButtonBusyContent busy={busy} busyLabel={t('common.saving')}>
                {t('common.save')}
              </ButtonBusyContent>
            </button>
          </div>
        </footer>
      </form>
    </KolModal>
  );
}
