'use client';

import Icon from '@/components/Icon';
import UserAvatar from '@/components/internal/UserAvatar';
import { useLocale } from '@/components/LocaleProvider';
import { canDragOutreachCard, isNoDealCard, kolCardChips } from '@/lib/kol-outreach-utils';

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
}) {
  const { t } = useLocale();
  const chips = kolCardChips(task, poolRecord, t);
  const assignee = task.assignee || '';
  const dimmed = isNoDealCard(task);
  const canDrag = draggable && canDragOutreachCard(task, displayName);

  return (
    <article
      className={[
        'kol-outreach-card',
        dimmed && 'is-no-deal',
        isDragging && 'is-dragging',
        !canDrag && draggable && 'is-drag-locked',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="kol-outreach-card-main" onClick={() => onOpenCard?.(task)}>
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
        {assignee ? (
          <span className="kol-outreach-card-assignee">
            <UserAvatar name={assignee} size={18} />
            <span>{assignee}</span>
          </span>
        ) : (
          <span className="kol-outreach-card-unassigned">{t('hub.campaignKol.unassigned')}</span>
        )}
      </button>
      <button
        type="button"
        className="kol-outreach-card-info"
        onClick={e => {
          e.stopPropagation();
          onMoreInfo?.(task);
        }}
      >
        {t('hub.campaignKol.moreInfo')}
      </button>
      {!canDrag && draggable && assignee && assignee !== displayName ? (
        <p className="kol-outreach-card-hint">{t('hub.campaignKol.assigneeOnlyDrag')}</p>
      ) : null}
      {!assignee ? (
        <p className="kol-outreach-card-hint">{t('hub.campaignKol.assignBeforeDrag')}</p>
      ) : null}
    </article>
  );
}
