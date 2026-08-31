'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import ButtonBusyContent from '@/components/ButtonBusyContent';
import KolModal from '@/components/KolModal';
import { useLocale } from '@/components/LocaleProvider';
import { KOL_BOARD_PROP } from '@/lib/kol-outreach-shared';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function KolOutreachFollowUpModal({ open, task, onClose, onSave, busy = false }) {
  const { t } = useLocale();
  const cv = task?.custom_values || {};
  const [followUpDate, setFollowUpDate] = useState(todayIso());
  const [followUpNote, setFollowUpNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setFollowUpDate(cv[KOL_BOARD_PROP.followUpDate] || todayIso());
    setFollowUpNote(cv[KOL_BOARD_PROP.followUpNote] || '');
  }, [open, cv]);

  if (!open || !task) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave?.({
      custom_values: {
        ...cv,
        [KOL_BOARD_PROP.followUpDate]: followUpDate,
        [KOL_BOARD_PROP.followUpNote]: followUpNote.trim(),
      },
    });
  }

  const title = t('hub.campaignKol.followUpTitle').replace('{name}', task.title || '—');

  return (
    <KolModal open={open} onClose={onClose} labelledBy="kol-follow-up-title">
      <form onSubmit={handleSubmit}>
        <header className="kol-modal-head">
          <h3 id="kol-follow-up-title">{title}</h3>
          <button type="button" className="appdev-btn-ghost" onClick={onClose} aria-label={t('common.cancel')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <label className="appdev-field">
          <span>{t('hub.campaignKol.followUpDate')}</span>
          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} required />
        </label>

        <label className="appdev-field">
          <span>{t('hub.campaignKol.followUpNote')}</span>
          <textarea rows={4} value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} placeholder={t('hub.campaignKol.followUpNotePlaceholder')} />
        </label>

        <footer className="kol-modal-foot">
          <button type="button" className="appdev-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="appdev-btn-primary" disabled={busy}>
            <ButtonBusyContent busy={busy} busyLabel={t('common.saving')}>
              {t('hub.campaignKol.followUpSave')}
            </ButtonBusyContent>
          </button>
        </footer>
      </form>
    </KolModal>
  );
}
