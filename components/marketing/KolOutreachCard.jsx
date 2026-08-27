'use client';

import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { canDragOutreachCard, isNoDealCard, kolCardChips, needsFollowUp } from '@/lib/kol-outreach-utils';
import { normalizeKolOutreachStatus } from '@/lib/kol-outreach-shared';

export default function KolOutreachCard({
  task,
  poolRecord = null,
  displayName = '',
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onOpenCard,
  onMoreInfo,
  onFollowUp,
}) {
  const { t } = useLocale();
  const chips = kolCardChips(task, poolRecord, t);
  const assignee = task.assignee || '';
  const dimmed = isNoDealCard(task);
  const canDrag = draggable && canDragOutreachCard(task, displayName);
  const showFollowUp = normalizeKolOutreachStatus(task.status) === 'waiting_response';
  const showAssigneeHint = !canDrag && draggable && assignee && assignee !== displayName;
  const showUnassignedHint = !assignee;

  return (
    <article
      className={[
        'kol-outreach-card',
        dimmed && 'is-no-deal',
        isDragging && 'is-dragging',
        canDrag && 'is-draggable',
        !canDrag && draggable && 'is-drag-locked',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="kol-outreach-card-open" onClick={() => onOpenCard?.(task)}>
        <span className="kol-outreach-card-title">{task.title || '—'}</span>
        {chips.length ? (
          <div className="kol-outreach-card-chips">
            {chips.map(chip => (
              <span key={chip.key} className={`internal-hint-chip ${chip.className}`}>
                {chip.label}
              </span>
            ))}
          </div>
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
    </article>
  );
}
