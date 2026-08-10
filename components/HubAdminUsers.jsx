'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useConfirm } from '@/hooks/useConfirm';
import { HUB_DEPARTMENT_IDS } from '@/lib/hub-departments';

const ROLES = ['manager', 'member', 'intern'];

const DEPARTMENT_LABELS = {
  operations: 'Operations',
  marketing: 'Marketing',
  products: 'Products',
  creatives: 'Creatives',
  finecoustic: 'All About Finecoustic',
  admin: 'Hub admin',
};

export default function HubAdminUsers() {
  const { requestConfirm, confirmDialog } = useConfirm();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('member');

  async function loadUsers() {
    const res = await fetch('/api/hub/admin/users', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('forbidden');
    const data = await res.json();
    setUsers(data.users || []);
  }

  useEffect(() => {
    loadUsers().catch(() => setError('Could not load team members (manager only).'));
  }, []);

  async function createUser(e) {
    e.preventDefault();
    const displayName = newName.trim();
    const password = newPassword.trim();
    if (!displayName || !password) return;

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/hub/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ displayName, password, role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not create team member');
      }
      setNewName('');
      setNewPassword('');
      setNewRole('member');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Could not create team member.');
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(userId, action, extra = {}) {
    setBusyId(userId);
    setError('');
    try {
      const res = await fetch('/api/hub/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, action, ...extra }),
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

  async function toggleDepartment(user, deptId) {
    const access = { ...(user.department_access || {}) };
    access[deptId] = !access[deptId];
    await patchUser(user.id, 'departments', { department_access: access });
  }

  async function removeUser(user) {
    const ok = await requestConfirm({
      title: 'Remove team member',
      message: `Remove ${user.display_name} from Fine Hub? They will no longer be able to sign in.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    patchUser(user.id, 'delete');
  }

  return (
    <div className="hub-page personal-hub">
      <header className="hub-header">
        <div className="hub-brand">
          <Link href="/me">← Personal hub</Link>
        </div>
      </header>
      <main className="hub-main personal-hub-main hub-admin-main">
        <h1>Team members</h1>
        <p className="personal-hub-hint">
          Create team member accounts with an individual name and password. Public sign-up is disabled.
          Master admin (FCS-建宏) uses the master password and is not listed here.
        </p>

        <form className="hub-admin-create-form personal-hub-card" onSubmit={createUser}>
          <h2 className="hub-admin-create-title">Add team member</h2>
          <div className="hub-admin-create-fields">
            <label className="appdev-field">
              <span>Display name</span>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoComplete="off"
                disabled={creating}
              />
            </label>
            <label className="appdev-field">
              <span>Password</span>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={creating}
              />
            </label>
            <label className="appdev-field">
              <span>Role</span>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} disabled={creating}>
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="hub-admin-create-actions">
            <button type="submit" className="appdev-btn-primary" disabled={creating || !newName.trim() || !newPassword.trim()}>
              Create account
            </button>
          </div>
        </form>

        {error && <p className="login-error">{error}</p>}
        <ul className="internal-list-ul">
          {users.map(u => (
            <li key={u.id} className="personal-hub-card">
              <div className="hub-admin-user-head">
                <div>
                  <strong>{u.display_name}</strong>
                  <span className="internal-list-meta">
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
              <div className="hub-admin-dept-access">
                <span className="hub-admin-dept-label">Department access</span>
                <div className="hub-admin-dept-grid">
                  {[...HUB_DEPARTMENT_IDS, 'admin'].map(deptId => (
                    <label key={deptId} className="hub-admin-dept-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(u.department_access?.[deptId])}
                        disabled={busyId === u.id}
                        onChange={() => toggleDepartment(u, deptId)}
                      />
                      {DEPARTMENT_LABELS[deptId] || deptId}
                    </label>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>

      {confirmDialog}
    </div>
  );
}
