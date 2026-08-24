'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { buildTeamAssigneeOptions } from '@/lib/internal';
import { KOL_INITIATIVES, KOL_BOARD_PROP } from '@/lib/kol-outreach-shared';
import { taskInitiative } from '@/lib/kol-outreach-utils';

export default function KolOutreachCardModal({
  open,
  task,
  teamMembers = [],
  displayName = '',
  defaultInitiative = '',
  onClose,
  onSave,
  busy = false,
}) {
  const { t } = useLocale();
  const [assignee, setAssignee] = useState('');
  const [initiative, setInitiative] = useState('');

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
    setInitiative(taskInitiative(task) || defaultInitiative || 'fbs');
  }, [open, task, defaultInitiative]);

  if (!open || !task) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.({
      assignee: assignee.trim(),
      custom_values: {
        ...(task.custom_values || {}),
        [KOL_BOARD_PROP.initiative]: initiative,
      },
    });
  }

  return (
    <KolModal open={open} onClose={onClose} labelledBy="kol-card-modal-title">
      <form onSubmit={handleSubmit}>
        <header className="kol-modal-head">
          <h3 id="kol-card-modal-title">{task.title}</h3>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>

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

        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="appdev-btn-primary" disabled={busy}>
            {t('common.save')}
          </button>
        </footer>
      </form>
    </KolModal>
  );
}
