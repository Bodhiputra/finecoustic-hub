'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import UserAvatar from '@/components/internal/UserAvatar';
import HubBackLink from '@/components/ui/HubBackLink';
import Icon from '@/components/Icon';
import { useConfirm } from '@/hooks/useConfirm';
import { useLocale } from '@/components/LocaleProvider';
import { HUB_ADMIN_DEPARTMENT_OPTIONS, HUB_ASSIGNABLE_DEPARTMENT_IDS, defaultDepartmentAccess, normalizeDepartmentAccess } from '@/lib/hub-departments';
import { HUB_PERMISSION_MATRIX } from '@/lib/hub-permissions';

const ROLES = ['manager', 'associate', 'intern'];

const ROLE_LABELS = {
  manager: 'Manager',
  associate: 'Associate',
  member: 'Associate',
  intern: 'Intern',
};

const DEPARTMENT_LABELS = Object.fromEntries(
  HUB_ADMIN_DEPARTMENT_OPTIONS.map(({ id, label }) => [id, label])
);

const HubAdminUserRow = memo(function HubAdminUserRow({
  user,
  busyId,
  busyDeptKey,
  onToggleDepartment,
  onPatch,
  onRemove,
}) {
  return (
    <li className="personal-hub-card hub-admin-user-card">
      <div className="hub-admin-user-head">
        <div>
          <strong>{user.display_name}</strong>
          <span className="internal-list-meta">
            {' · '}
            {ROLE_LABELS[user.role] || user.role}
            {user.blocked ? ' · blocked' : ''}
          </span>
        </div>
        <div className="hub-admin-user-actions">
          {user.blocked ? (
            <button
              type="button"
              className="appdev-btn-ghost"
              disabled={busyId === user.id}
              onClick={() => onPatch(user.id, 'unblock')}
            >
              Unblock
            </button>
          ) : (
            <button
              type="button"
              className="appdev-btn-ghost"
              disabled={busyId === user.id}
              onClick={() => onPatch(user.id, 'block')}
            >
              Block
            </button>
          )}
          <button
            type="button"
            className="appdev-btn-danger"
            disabled={busyId === user.id}
            onClick={() => onRemove(user)}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="hub-admin-dept-access">
        <span className="hub-admin-dept-label">Department access</span>
        <div className="hub-admin-dept-grid" role="group" aria-label="Department access">
          {HUB_ASSIGNABLE_DEPARTMENT_IDS.map(deptId => {
            const checked = Boolean(user.department_access?.[deptId]);
            const rowKey = `${user.id}:${deptId}`;
            const isBusy = busyDeptKey === rowKey;
            return (
              <label
                key={deptId}
                className={`hub-admin-dept-toggle${checked ? ' is-on' : ''}${isBusy ? ' is-busy' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBusy}
                  onChange={() => onToggleDepartment(user.id, deptId)}
                />
                <span className="hub-admin-dept-toggle-label">{DEPARTMENT_LABELS[deptId] || deptId}</span>
              </label>
            );
          })}
        </div>
      </div>
    </li>
  );
});

export default function HubAdminUsers({ initialDisplayName = '' }) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const [profile, setProfile] = useState(() => ({ displayName: initialDisplayName }));
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [busyDeptKey, setBusyDeptKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState('associate');
  const [newDepartments, setNewDepartments] = useState(() => defaultDepartmentAccess());

  function toggleNewDepartment(deptId) {
    setNewDepartments(prev => ({ ...prev, [deptId]: !prev[deptId] }));
  }

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/hub/admin/users', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('forbidden');
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.displayName) {
          setProfile({ displayName: data.displayName });
        }
      })
      .catch(() => {});

    loadUsers().catch(() => setError('Could not load team members (master admin only).'));
  }, [loadUsers]);

  const replaceUser = useCallback((userId, nextUser) => {
    setUsers(prev => prev.map(u => (u.id === userId ? nextUser : u)));
  }, []);

  const removeUserById = useCallback(userId => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  }, []);

  async function createUser(e) {
    e.preventDefault();
    const displayName = newName.trim();
    const password = newPassword.trim();
    if (!displayName || !password) return;
    if (!HUB_ASSIGNABLE_DEPARTMENT_IDS.some(id => newDepartments[id])) {
      setError('Select at least one department.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/hub/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName,
          password,
          role: newRole,
          department_access: newDepartments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not create team member');
      }
      setNewName('');
      setNewPassword('');
      setShowPassword(false);
      setNewRole('associate');
      setNewDepartments(defaultDepartmentAccess());
      if (data.user) {
        setUsers(prev => [...prev, data.user]);
      }
    } catch (err) {
      setError(err.message || 'Could not create team member.');
    } finally {
      setCreating(false);
    }
  }

  const patchUser = useCallback(async (userId, action, extra = {}) => {
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
      if (action === 'delete') {
        removeUserById(userId);
      } else if (data.user) {
        replaceUser(userId, data.user);
      }
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setBusyId('');
    }
  }, [removeUserById, replaceUser]);

  const toggleDepartment = useCallback(async (userId, deptId) => {
    const rowKey = `${userId}:${deptId}`;
    if (busyDeptKey) return;

    let prevAccess = null;
    let nextAccess = null;

    setUsers(prev => {
      const user = prev.find(u => u.id === userId);
      if (!user) return prev;
      prevAccess = normalizeDepartmentAccess(user.department_access, user.role);
      nextAccess = normalizeDepartmentAccess(
        { ...prevAccess, [deptId]: !prevAccess[deptId] },
        user.role
      );
      return prev.map(u => (u.id === userId ? { ...u, department_access: nextAccess } : u));
    });

    if (!nextAccess) return;

    setBusyDeptKey(rowKey);
    setError('');

    try {
      const res = await fetch('/api/hub/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, action: 'departments', department_access: nextAccess }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }
      if (data.user) {
        replaceUser(userId, data.user);
      }
    } catch (err) {
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, department_access: prevAccess } : u))
      );
      setError(err.message || 'Action failed.');
    } finally {
      setBusyDeptKey('');
    }
  }, [busyDeptKey, replaceUser]);

  const handleRemove = useCallback(async user => {
    const ok = await requestConfirm({
      title: 'Remove team member',
      message: `Remove ${user.display_name} from Fine Teams? They will no longer be able to sign in.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    patchUser(user.id, 'delete');
  }, [patchUser, requestConfirm]);

  return (
    <div className="hub-page personal-hub">
      <header className="hub-header">
        <div className="hub-brand">
          <Link href="/" className="brand-logo-link" aria-label={t('hub.internal.home')}>
            <Image className="brand-logo" src="/FLogo.png" alt="" width={36} height={36} />
          </Link>
          <div>
            <strong>{t('hub.admin.teamMembers')}</strong>
            <small>{profile.displayName || 'Admin'}</small>
          </div>
        </div>
        <div className="hub-header-actions">
          <UserAvatar name={profile.displayName} size={32} />
          <ThemeToggle />
        </div>
      </header>

      <main className="hub-main personal-hub-main hub-admin-main">
        <HubBackLink href="/" label={t('hub.internal.home')} className="hub-admin-back" />

        <p className="personal-hub-hint">
          Master admin only — sign in as FCS-建宏 with the master password to create accounts.
          Assign an individual name, password, role, and department access.
          Assign department access for operational areas only (Operations, Marketing, Products, Creatives).
          All About Finecoustic is company wiki — not a department — visible to everyone; managers can edit.
          Master admin is not listed here.
        </p>

        {error ? <p className="personal-hub-alert" role="alert">{error}</p> : null}

        <section className="personal-hub-card">
          <h2>Add team member</h2>
          <form className="personal-hub-form" onSubmit={createUser}>
            <label>
              <span>Display name</span>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoComplete="off"
                disabled={creating}
              />
            </label>
            <label>
              <span>Password</span>
              <div className="personal-hub-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={creating}
                />
                <button
                  type="button"
                  className="personal-hub-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                  disabled={creating}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </label>
            <label>
              <span>Role</span>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} disabled={creating}>
                {ROLES.map(role => (
                  <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                ))}
              </select>
            </label>
            <div className="hub-admin-dept-access hub-admin-dept-access--create">
              <span className="hub-admin-dept-label">Department access</span>
              <div className="hub-admin-dept-grid" role="group" aria-label="Department access for new associate">
                {HUB_ASSIGNABLE_DEPARTMENT_IDS.map(deptId => (
                  <label
                    key={deptId}
                    className={`hub-admin-dept-toggle${newDepartments[deptId] ? ' is-on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(newDepartments[deptId])}
                      disabled={creating}
                      onChange={() => toggleNewDepartment(deptId)}
                    />
                    <span className="hub-admin-dept-toggle-label">{DEPARTMENT_LABELS[deptId] || deptId}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="appdev-btn-primary hub-admin-submit"
              disabled={creating || !newName.trim() || !newPassword.trim()}
            >
              {creating ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </section>

        <section className="personal-hub-card hub-admin-permissions-ref">
          <h2>Roles &amp; permissions</h2>
          <p className="personal-hub-hint">
            Department checkboxes control which areas someone can open. Role controls tasks, campaigns, and kanbans.
            Jot down is open to every role inside allowed departments.
            Team admin (/hub/admin) is master-only (FCS-建宏 + master password) — not the Manager role.
          </p>
          <div className="hub-admin-permissions-table-wrap">
            <table className="hub-admin-permissions-table">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Manager</th>
                  <th scope="col">Associate</th>
                  <th scope="col">Intern</th>
                </tr>
              </thead>
              <tbody>
                {HUB_PERMISSION_MATRIX.map(row => (
                  <tr key={row.area}>
                    <th scope="row">{row.area}</th>
                    <td>{row.manager}</td>
                    <td>{row.associate}</td>
                    <td>{row.intern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ul className="internal-list-ul hub-admin-user-list">
          {users.map(u => (
            <HubAdminUserRow
              key={u.id}
              user={u}
              busyId={busyId}
              busyDeptKey={busyDeptKey}
              onToggleDepartment={toggleDepartment}
              onPatch={patchUser}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      </main>

      {confirmDialog}
    </div>
  );
}
