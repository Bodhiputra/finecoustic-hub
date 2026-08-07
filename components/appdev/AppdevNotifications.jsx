'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { formatIssueDate, appdevNotificationRequiresAction } from '@/lib/appdev';

function formatNotificationDate(iso, locale) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function notificationText(item, t, locale) {
  const title = item.issue_title || item.issue_id;
  const actor = item.actor_name;
  switch (item.type) {
    case 'assigned':
      return t('appdev.notifications.assigned').replace('{title}', title).replace('{actor}', actor);
    case 'assignee_joined':
      return t('appdev.notifications.assigneeJoined').replace('{title}', title).replace('{actor}', actor);
    case 'assignee_removed':
      return t('appdev.notifications.assigneeRemoved').replace('{title}', title).replace('{actor}', actor);
    case 'status_change':
      return t('appdev.notifications.statusChange')
        .replace('{title}', title)
        .replace('{actor}', actor)
        .replace('{status}', t(`appdev.status.${item.payload?.to_status || 'todo'}`));
    case 'comment':
      return t('appdev.notifications.comment').replace('{title}', title).replace('{actor}', actor);
    case 'due_soon':
      return t('appdev.notifications.dueSoon')
        .replace('{title}', title)
        .replace('{date}', formatIssueDate(item.payload?.due_at, locale));
    case 'due_overdue':
      return t('appdev.notifications.dueOverdue')
        .replace('{title}', title)
        .replace('{date}', formatIssueDate(item.payload?.due_at, locale));
    case 'review_request':
      return t('appdev.notifications.reviewRequest').replace('{title}', title).replace('{actor}', actor);
    default:
      return title;
  }
}

export default function AppdevNotifications({
  t,
  locale,
  currentUser,
  onOpenIssue,
  onUnreadChange,
  refreshKey = '',
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch('/api/appdev/notifications', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      const nextUnread = Number(data.unread) || 0;
      setUnread(nextUnread);
      onUnreadChange?.(nextUnread);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [currentUser, onUnreadChange]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async id => {
    await fetch('/api/appdev/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id }),
    });
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread(u => {
      const next = Math.max(0, u - 1);
      onUnreadChange?.(next);
      return next;
    });
  };

  const markAll = async () => {
    if (unread <= 0) return;
    const res = await fetch('/api/appdev/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ markAll: true, excludePersistent: true }),
    });
    const data = await res.json().catch(() => ({}));
    const nextUnread = Number(data.unread) || 0;
    setUnread(nextUnread);
    setItems(prev =>
      prev.map(n =>
        appdevNotificationRequiresAction(n)
          ? n
          : { ...n, read_at: n.read_at || new Date().toISOString() }
      )
    );
    onUnreadChange?.(nextUnread);
  };

  const handleBellClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await markAll();
  };

  const handleItemClick = async item => {
    if (!appdevNotificationRequiresAction(item) && !item.read_at) {
      await markRead(item.id);
    }
    setOpen(false);
    onOpenIssue?.(item.issue_id);
  };

  const isUnread = item => !item.read_at || appdevNotificationRequiresAction(item);

  return (
    <div className="appdev-notifications" ref={rootRef}>
      <button
        type="button"
        className={`appdev-notifications-trigger${open ? ' is-open' : ''}`}
        onClick={handleBellClick}
        aria-label={t('appdev.notifications.title')}
        aria-expanded={open}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span className="appdev-notifications-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="appdev-notifications-panel" role="region" aria-label={t('appdev.notifications.title')}>
          <header className="appdev-notifications-head">
            <strong>{t('appdev.notifications.title')}</strong>
          </header>
          <ul className="appdev-notifications-list">
            {loading && items.length === 0 && (
              <li className="appdev-notifications-empty">{t('appdev.notifications.loading')}</li>
            )}
            {!loading && items.length === 0 && (
              <li className="appdev-notifications-empty">{t('appdev.notifications.empty')}</li>
            )}
            {items.map(item => {
              const actionRequired = appdevNotificationRequiresAction(item);
              return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`appdev-notifications-item${isUnread(item) ? ' is-unread' : ' is-read'}${actionRequired ? ' is-action-required' : ''}`}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="appdev-notifications-item-text">
                    {notificationText(item, t, locale)}
                  </span>
                  {actionRequired && (
                    <span className="appdev-notifications-item-badge">
                      {t('appdev.notifications.actionRequired')}
                    </span>
                  )}
                  <span className="appdev-notifications-item-time">
                    {formatNotificationDate(item.created_at, locale)}
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
