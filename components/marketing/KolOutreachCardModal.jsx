'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ButtonBusyContent from '@/components/ButtonBusyContent';
import KolModal from '@/components/KolModal';
import KolOutreachProductRowsEditor from '@/components/marketing/KolOutreachProductRowsEditor';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { buildTeamAssigneeOptions } from '@/lib/internal';
import {
  KOL_APPROACH_PLATFORMS,
  KOL_BOARD_PROP,
  KOL_INITIATIVES,
  kolCardModalSections,
  normalizeApproachDirection,
  normalizeKolOutreachStatus,
  parseDealProducts,
  resolveKolInitiative,
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
  const [noDealReason, setNoDealReason] = useState('');
  const [qcDate, setQcDate] = useState('');
  const [qcCheckedBy, setQcCheckedBy] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
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
    setNoDealReason(cv[KOL_BOARD_PROP.noDealReason] || '');
    setQcDate(cv[KOL_BOARD_PROP.qcDate] || '');
    setQcCheckedBy(cv[KOL_BOARD_PROP.qcCheckedBy] || displayName);
    setQcNotes(cv[KOL_BOARD_PROP.qcNotes] || '');
    setShippingDate(cv[KOL_BOARD_PROP.shippingDate] || '');
    setTrackingLink(cv[KOL_BOARD_PROP.trackingLink] || '');
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
      nextCustom[KOL_BOARD_PROP.noDealReason] = noDealReason.trim();
    }
    if (sections.qualityControl) {
      nextCustom[KOL_BOARD_PROP.qcDate] = qcDate;
      nextCustom[KOL_BOARD_PROP.qcCheckedBy] = qcCheckedBy.trim();
      nextCustom[KOL_BOARD_PROP.qcNotes] = qcNotes.trim();
    }
    if (sections.shipping) {
      nextCustom[KOL_BOARD_PROP.shippingDate] = shippingDate;
      nextCustom[KOL_BOARD_PROP.trackingLink] = trackingLink.trim();
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

          <label className="appdev-field">
            <span>{t('hub.campaignKol.initiative')}</span>
            <select value={initiative} onChange={e => setInitiative(e.target.value)} disabled={busy}>
              {KOL_INITIATIVES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
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
            <label className="appdev-field">
              <span>{t('hub.campaignKol.approachDirection')}</span>
              <select
                value={approachDirection}
                onChange={e => setApproachDirection(e.target.value)}
                disabled={busy}
              >
                <option value="outbound">{t('hub.campaignKol.approachOutbound')}</option>
                <option value="inbound">{t('hub.campaignKol.approachInbound')}</option>
              </select>
            </label>
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
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colDealType')}</span>
              <select value={dealType} onChange={e => setDealType(e.target.value)} disabled={busy}>
                <option value="Product barter">{t('hub.campaignKol.dealBarter')}</option>
                <option value="Paid">{t('hub.campaignKol.dealPaid')}</option>
                <option value="Hybrid">{t('hub.campaignKol.dealHybrid')}</option>
                <option value="Other">{t('hub.campaignKol.dealOther')}</option>
              </select>
            </label>
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
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcDate')}</span>
              <input
                type="date"
                value={qcDate}
                onChange={e => setQcDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcCheckedBy')}</span>
              <input
                value={qcCheckedBy}
                onChange={e => setQcCheckedBy(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.qcNotes')}</span>
              <textarea rows={3} value={qcNotes} onChange={e => setQcNotes(e.target.value)} disabled={busy} />
            </label>
          </Section>
        ) : null}

        {sections.noDeal ? (
          <Section title={t('hub.campaignKol.cardModalNoDeal')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.noDealReason')}</span>
              <textarea rows={3} value={noDealReason} onChange={e => setNoDealReason(e.target.value)} disabled={busy} />
            </label>
          </Section>
        ) : null}

        {sections.shipping ? (
          <Section title={t('hub.campaignKol.cardModalShipping')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.colShipping')}</span>
              <input
                type="date"
                value={shippingDate}
                onChange={e => setShippingDate(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.trackingLink')}</span>
              <input
                type="url"
                value={trackingLink}
                onChange={e => setTrackingLink(e.target.value)}
                placeholder={t('hub.campaignKol.trackingLinkPlaceholder')}
                disabled={busy}
              />
            </label>
            <label className="kol-outreach-checkbox">
              <input
                type="checkbox"
                checked={mediaKitSent}
                onChange={e => setMediaKitSent(e.target.checked)}
                disabled={busy}
              />
              {t('hub.campaignKol.mediaKitSent')}
            </label>
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
            <label className="kol-outreach-checkbox">
              <input
                type="checkbox"
                checked={productArrived}
                onChange={e => setProductArrived(e.target.checked)}
                disabled={busy}
              />
              {t('hub.campaignKol.productArrivedConfirm')}
            </label>
          </Section>
        ) : null}

        {sections.publish ? (
          <Section title={t('hub.campaignKol.cardModalPublish')}>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishUrl')}</span>
              <input
                type="url"
                value={publishUrl}
                onChange={e => setPublishUrl(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishPlatform')}</span>
              <input
                value={publishPlatform}
                onChange={e => setPublishPlatform(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="appdev-field">
              <span>{t('hub.campaignKol.publishDate')}</span>
              <input
                type="date"
                value={publishDate}
                onChange={e => setPublishDate(e.target.value)}
                disabled={busy}
              />
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
