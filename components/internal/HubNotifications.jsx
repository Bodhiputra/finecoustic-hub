'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { HUB_NOTIFICATIONS_REFRESH_EVENT } from '@/lib/hub-notifications-ui';

function formatNotificationDate(iso, locale) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function notificationText(item, t) {
  const title = item.title || item.entity_id || '—';
  const actor = item.actor_name || t('hub.notifications.someone');
  switch (item.type) {
    case 'assigned':
      return t('hub.notifications.assigned').replace('{title}', title).replace('{actor}', actor);
    case 'mention':
      return t('hub.notifications.mention').replace('{title}', title).replace('{actor}', actor);
    case 'review_request':
      return t('hub.notifications.reviewRequest').replace('{title}', title).replace('{actor}', actor);
    case 'workflow_done':
      return t('hub.notifications.workflowDone').replace('{title}', title).replace('{actor}', actor);
    case 'reminder_due':
      return t('hub.notifications.reminderDue').replace('{title}', title);
    case 'deadline_7d':
      return t('hub.notifications.deadline7d').replace('{title}', title);
    case 'deadline_3d':
      return t('hub.notifications.deadline3d').replace('{title}', title);
    case 'deadline_1d':
      return t('hub.notifications.deadline1d').replace('{title}', title);
    case 'meeting_3h':
      return t('hub.notifications.meeting3h').replace('{title}', title);
    case 'meeting_1h':
      return t('hub.notifications.meeting1h').replace('{title}', title);
    case 'broadcast':
      return item.title || t('hub.notifications.broadcast');
    case 'kol_sync':
      return t('hub.notifications.kolSync').replace('{title}', title);
    default:
      return title;
  }
}

export default function HubNotifications() {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_V1.hubNotifications, { credentials: 'same-origin' });
      if (!res.ok) return;
      const body = await res.json();
      const data = unwrapData(body);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread) || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshQuietly = useCallback(async () => {
    try {
      const res = await fetch(API_V1.hubNotifications, { credentials: 'same-origin' });
      if (!res.ok) return;
      const body = await res.json();
      const data = unwrapData(body);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      load();
      intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') refreshQuietly();
      }, 60_000);
    }, 2500);

    function onRefresh() {
      if (document.visibilityState === 'visible') refreshQuietly();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') refreshQuietly();
    }

    window.addEventListener(HUB_NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener(HUB_NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshQuietly]);

  useEffect(() => {
    if (!open) return undefined;
    if (items.length === 0 && !loading) load();
    return undefined;
  }, [open, items.length, loading, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const markRead = async id => {
    const res = await fetch(API_V1.hubNotifications, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    const body = await res.json();
    const data = unwrapData(body);
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread(Number(data?.unread) || 0);
  };

  const markAll = async () => {
    const res = await fetch(API_V1.hubNotifications, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ markAll: true }),
    });
    if (!res.ok) return;
    const body = await res.json();
    const data = unwrapData(body);
    setUnread(Number(data?.unread) || 0);
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };

  const handleItemClick = async item => {
    if (!item.read_at) await markRead(item.id);
    setOpen(false);
  };

  return (
    <div className="hub-notifications" ref={rootRef}>
      <button
        type="button"
        className={`hub-notifications-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={t('hub.notifications.title')}
        aria-expanded={open}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span className="hub-notifications-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="hub-notifications-panel" role="region" aria-label={t('hub.notifications.title')}>
          <header className="hub-notifications-head">
            <strong>{t('hub.notifications.title')}</strong>
            {unread > 0 && (
              <button type="button" className="hub-notifications-mark-all" onClick={markAll}>
                {t('hub.notifications.markAllRead')}
              </button>
            )}
          </header>
          <ul className="hub-notifications-list">
            {loading && items.length === 0 && (
              <li className="hub-notifications-empty">{t('hub.notifications.loading')}</li>
            )}
            {!loading && items.length === 0 && (
              <li className="hub-notifications-empty">{t('hub.notifications.empty')}</li>
            )}
            {items.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`hub-notifications-item${item.read_at ? ' is-read' : ' is-unread'}`}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="hub-notifications-item-text">
                    {notificationText(item, t)}
                  </span>
                  <span className="hub-notifications-item-time">
                    {formatNotificationDate(item.created_at, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
