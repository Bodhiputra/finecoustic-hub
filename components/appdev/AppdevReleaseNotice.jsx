'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import HubModal from '@/components/HubModal';
import { RELEASE_NOTICE_ID } from '@/lib/appdev-constants';
import { getMessage, messages } from '@/lib/i18n/messages';

const STORAGE_KEY = `appdev-release-notice-${RELEASE_NOTICE_ID}`;

const FEATURE_KEYS = [
  'autosave',
  'statusPills',
  'joinAssignee',
  'notifications',
  'reviewNotify',
  'filterMe',
];

/** Changelog modal — copy is Chinese-first for the appdev team. */
function zh(path) {
  return getMessage(messages.zh, path);
}

export default function AppdevReleaseNotice() {
  const [open, setOpen] = useState(false);
  const dismissRef = useRef(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    dismissRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  return (
    <HubModal
      open={open}
      onClose={dismiss}
      className="appdev-release-notice"
      backdropClassName="appdev-release-backdrop"
      labelledBy="appdev-release-title"
      describedBy="appdev-release-intro"
    >
      <header className="appdev-release-header">
        <span className="appdev-release-badge">{zh('appdev.releaseNotice.badge')}</span>
        <h2 id="appdev-release-title" className="appdev-release-title">
          {zh('appdev.releaseNotice.title')}
        </h2>
        <p id="appdev-release-intro" className="appdev-release-intro">
          {zh('appdev.releaseNotice.intro')}
        </p>
      </header>

      <ul className="appdev-release-list">
        {FEATURE_KEYS.map(key => (
          <li key={key}>
            <strong>{zh(`appdev.releaseNotice.${key}Title`)}</strong>
            <span>{zh(`appdev.releaseNotice.${key}Body`)}</span>
          </li>
        ))}
      </ul>

      <footer className="appdev-release-foot">
        <button
          ref={dismissRef}
          type="button"
          className="appdev-btn-primary appdev-release-dismiss"
          onClick={dismiss}
        >
          {zh('appdev.releaseNotice.dismiss')}
        </button>
      </footer>
    </HubModal>
  );
}
