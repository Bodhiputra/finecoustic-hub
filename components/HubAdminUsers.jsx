'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HubAdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function loadUsers() {
    const res = await fetch('/api/hub/admin/users', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('forbidden');
    const data = await res.json();
    setUsers(data.users || []);
  }

  useEffect(() => {
    loadUsers().catch(() => setError('Could not load users (manager only).'));
  }, []);

  async function patchUser(userId, action) {
    setBusyId(userId);
    setError('');
    try {
      const res = await fetch('/api/hub/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setBusyId('');
    }
  }

  function removeUser(user) {
    if (!confirm(`Remove ${user.display_name} from Fine Hub? They will need to sign up again.`)) {
      return;
    }
    patchUser(user.id, 'delete');
  }

  return (
    <div className="hub-page personal-hub">
      <header className="hub-header">
        <div className="hub-brand">
          <Link href="/me">← Personal hub</Link>
        </div>
      </header>
      <main className="hub-main personal-hub-main">
        <h1>Hub users</h1>
        <p className="personal-hub-hint">
          Everyone signs in with the shared team password. Block or remove accounts here.
        </p>
        {error && <p className="login-error">{error}</p>}
        <ul className="warzone-list-ul">
          {users.map(u => (
            <li key={u.id} className="personal-hub-card">
              <div className="hub-admin-user-head">
                <div>
                  <strong>{u.display_name}</strong>
                  <span className="warzone-list-meta">
                    {' '}
                    · {u.role}
                    {u.blocked ? ' · blocked' : ''}
                  </span>
                </div>
                <div className="hub-admin-user-actions">
                  {u.blocked ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId === u.id}
                      onClick={() => patchUser(u.id, 'unblock')}
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId === u.id}
                      onClick={() => patchUser(u.id, 'block')}
                    >
                      Block
                    </button>
                  )}
                  <button
                    type="button"
                    className="appdev-btn-danger"
                    disabled={busyId === u.id}
                    onClick={() => removeUser(u)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
