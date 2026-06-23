'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import Icon from '@/components/Icon';

export default function AppdevAdminUsers({ t }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/appdev/admin/users', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError(t('appdev.admin.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) loadUsers();
  }, [open, loadUsers]);

  async function toggleBlock(user) {
    setBusyId(user.id);
    setError('');
    try {
      const res = await fetch(`/api/appdev/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ blocked: !user.blocked }),
      });
      if (!res.ok) throw new Error('block');
      const data = await res.json();
      setUsers(prev => prev.map(u => (u.id === user.id ? data.user : u)));
    } catch {
      setError(t('appdev.admin.actionError'));
    } finally {
      setBusyId('');
    }
  }

  async function removeUser(user) {
    setBusyId(user.id);
    setError('');
    try {
      const res = await fetch(`/api/appdev/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('delete');
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch {
      setError(t('appdev.admin.actionError'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost appdev-admin-users-btn"
        onClick={() => setOpen(true)}
        title={t('appdev.admin.title')}
      >
        <Icon name="layout" size={15} />
        {t('appdev.admin.title')}
      </button>

      {open && (
        <div className="appdev-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="appdev-modal appdev-admin-modal"
            role="dialog"
            aria-labelledby="appdev-admin-title"
            onClick={e => e.stopPropagation()}
          >
            <header className="appdev-modal-header">
              <h2 id="appdev-admin-title">{t('appdev.admin.title')}</h2>
              <button type="button" className="appdev-modal-close" onClick={() => setOpen(false)}>
                <Icon name="x" size={18} />
              </button>
            </header>
            <p className="appdev-admin-intro">{t('appdev.admin.intro')}</p>
            {error && (
              <p className="appdev-error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <p className="appdev-loading">{t('appdev.admin.loading')}</p>
            ) : users.length === 0 ? (
              <p className="appdev-admin-empty">{t('appdev.admin.empty')}</p>
            ) : (
              <ul className="appdev-admin-user-list">
                {users.map(user => (
                  <li key={user.id} className="appdev-admin-user-row">
                    <div className="appdev-admin-user-meta">
                      <strong>{user.display_name}</strong>
                      {user.blocked && (
                        <span className="appdev-admin-blocked-badge">{t('appdev.admin.blocked')}</span>
                      )}
                    </div>
                    <div className="appdev-admin-user-actions">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === user.id}
                        onClick={() => toggleBlock(user)}
                      >
                        {user.blocked ? t('appdev.admin.unblock') : t('appdev.admin.block')}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost appdev-admin-delete-btn"
                        disabled={busyId === user.id}
                        onClick={() => setDeleteTarget(user)}
                      >
                        {t('appdev.admin.delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget != null}
        title={t('appdev.admin.delete')}
        message={t('appdev.admin.deleteConfirm').replace('{name}', deleteTarget?.display_name || '')}
        confirmLabel={t('appdev.admin.delete')}
        cancelLabel={t('common.cancel')}
        busy={Boolean(deleteTarget && busyId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const user = deleteTarget;
            setDeleteTarget(null);
            removeUser(user);
          }
        }}
      />
    </>
  );
}
