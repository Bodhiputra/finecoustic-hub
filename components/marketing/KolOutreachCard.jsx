'use client';

import UserAvatar from '@/components/internal/UserAvatar';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { kolDeliveryNotesDisplay, kolLinkAriaLabel, kolOutreachPlatformIconName } from '@/lib/kol-pool';
import {
  canDragOutreachCard,
  canStartAnotherOutreachRound,
  isNoDealCard,
  kolCardChips,
  needsFollowUp,
} from '@/lib/kol-outreach-utils';
import {
  KOL_BOARD_PROP,
  kolOutreachStatusAtOrPast,
  normalizeKolOutreachStatus,
} from '@/lib/kol-outreach-shared';

export default function KolOutreachCard({
  task,
  poolRecord = null,
  displayName = '',
  isManager = false,
  isAdmin = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  selected = false,
  onToggleSelect,
  onOpenCard,
  onMoreInfo,
  onFollowUp,
  outreachTasks = [],
  onStartAnotherOutreach,
}) {
  const { t } = useLocale();
  const status = normalizeKolOutreachStatus(task?.status);
  const chips = kolCardChips(task, poolRecord, t);
  const showDeliveryNotes = kolOutreachStatusAtOrPast(status, 'weibin') && status !== 'no_deal';
  const deliveryNotes = showDeliveryNotes ? kolDeliveryNotesDisplay(poolRecord) : '';
  const assignee = task.assignee || '';
  const socialLink = String(poolRecord?.links || '').trim();
  const approachedSocials = String(task?.custom_values?.[KOL_BOARD_PROP.socials] || '');
  const platformIcon = kolOutreachPlatformIconName(poolRecord, approachedSocials);
  const showPlatformIcon = Boolean(platformIcon);
  const dimmed = isNoDealCard(task);
  const canDrag = draggable && canDragOutreachCard(task, displayName, { isManager, isAdmin });
  const showFollowUp = status === 'waiting_response';
  const showAnotherOutreach = canStartAnotherOutreachRound(task, outreachTasks);
  const outreachLead = isManager || isAdmin;
  const showAssigneeHint = !canDrag && draggable && assignee && assignee !== displayName && !outreachLead;
  const showUnassignedHint = !assignee && !outreachLead;

  return (
    <article
      className={[
        'kol-outreach-card',
        dimmed && 'is-no-deal',
        isDragging && 'is-dragging',
        canDrag && 'is-draggable',
        !canDrag && draggable && 'is-drag-locked',
        selected && 'is-selected',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={onDragEnd}
    >
      <div className="kol-outreach-card-body">
        {onToggleSelect ? (
          <button
            type="button"
            className={`kol-outreach-card-pick${selected ? ' is-on' : ''}`}
            aria-label={t('hub.campaignKol.selectCard')}
            aria-pressed={selected}
            onClick={() => onToggleSelect(task.id)}
          />
        ) : null}
        <div className="kol-outreach-card-content">
          <button type="button" className="kol-outreach-card-open" onClick={() => onOpenCard?.(task)}>
            <div className="kol-outreach-card-title-row">
              {showPlatformIcon ? (
                socialLink ? (
                  <a
                    href={socialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`kol-outreach-card-platform-icon is-${platformIcon}`}
                    aria-label={kolLinkAriaLabel(poolRecord, t)}
                    title={kolLinkAriaLabel(poolRecord, t)}
                    onClick={e => e.stopPropagation()}
                  >
                    <Icon name={platformIcon} size={16} />
                  </a>
                ) : (
                  <span
                    className={`kol-outreach-card-platform-icon is-${platformIcon}`}
                    aria-hidden="true"
                  >
                    <Icon name={platformIcon} size={16} />
                  </span>
                )
              ) : null}
              <span className="kol-outreach-card-title">{task.title || '—'}</span>
            </div>
            {chips.length ? (
              <div className="kol-outreach-card-chips">
                {chips.map(chip => (
                  <span key={chip.key} className={`internal-hint-chip ${chip.className}`}>
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}
            {showDeliveryNotes ? (
              <p className="kol-outreach-card-delivery-notes" title={deliveryNotes}>
                <span className="kol-outreach-card-delivery-notes-label">{t('hub.kol.shippingNotes')}</span>
                <span className="kol-outreach-card-delivery-notes-value">{deliveryNotes}</span>
              </p>
            ) : null}
          </button>

          <footer className="kol-outreach-card-foot">
        <div className="kol-outreach-card-foot-main">
          {assignee ? (
            <span className="kol-outreach-card-assignee">
              <UserAvatar name={assignee} size={16} />
              <span className="kol-outreach-card-assignee-name">{assignee}</span>
            </span>
          ) : (
            <span className="kol-outreach-card-unassigned">{t('hub.campaignKol.unassigned')}</span>
          )}

          <div className="kol-outreach-card-actions">
            <button
              type="button"
              className="kol-outreach-card-action"
              onClick={() => onMoreInfo?.(task)}
            >
              {t('hub.campaignKol.moreInfo')}
            </button>
            {showFollowUp ? (
              <button
                type="button"
                className={`kol-outreach-card-action${needsFollowUp(task) ? ' is-due' : ''}`}
                onClick={() => onFollowUp?.(task)}
              >
                {t('hub.campaignKol.followUpAction')}
              </button>
            ) : null}
            {showAnotherOutreach ? (
              <button
                type="button"
                className="kol-outreach-card-action is-accent"
                onClick={() => onStartAnotherOutreach?.(task)}
              >
                {t('hub.campaignKol.startAnotherOutreach')}
              </button>
            ) : null}
          </div>
        </div>

        {showAssigneeHint || showUnassignedHint ? (
          <p className="kol-outreach-card-hint">
            {showAssigneeHint
              ? t('hub.campaignKol.assigneeOnlyDrag')
              : t('hub.campaignKol.assignBeforeDrag')}
          </p>
        ) : null}
          </footer>
        </div>
      </div>
    </article>
  );
}
