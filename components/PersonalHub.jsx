'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import UserAvatar from '@/components/internal/UserAvatar';

export default function PersonalHub({
  authEnabled,
  initialProfile = null,
  initialStats = null,
}) {
  const [profile, setProfile] = useState(
    () => initialProfile ?? { displayName: '', hubUser: null }
  );
  const [stats, setStats] = useState(
    () => initialStats ?? { today: 0, overdue: 0, inProgress: 0, bank: 0 }
  );

  useEffect(() => {
    if (initialProfile && initialStats) return;

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => setProfile({ displayName: data.displayName, hubUser: data.hubUser }))
      .catch(() => {});

    Promise.all([
      fetch('/api/v1/internal/tasks?bucket=today', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/v1/internal/tasks?bucket=overdue', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/v1/internal/tasks?bucket=in_progress', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/v1/internal/tasks?bucket=bank', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([today, overdue, prog, bank]) => {
      setStats({
        today: today.data?.tasks?.length || today.tasks?.length || 0,
        overdue: overdue.data?.tasks?.length || overdue.tasks?.length || 0,
        inProgress: prog.data?.tasks?.length || prog.tasks?.length || 0,
        bank: bank.data?.tasks?.length || bank.tasks?.length || 0,
      });
    }).catch(() => {});
  }, [initialProfile, initialStats]);

  return (
    <div className="hub-page personal-hub">
      <header className="hub-header">
        <div className="hub-brand">
          <Link href="/" className="brand-logo-link" aria-label="Home">
            <Image className="brand-logo" src="/FLogo.png" alt="" width={36} height={36} />
          </Link>
          <div>
            <strong>Personal space</strong>
            <small>{profile.displayName}</small>
          </div>
        </div>
        <div className="hub-header-actions">
          <UserAvatar name={profile.displayName} size={32} />
          <ThemeToggle />
        </div>
      </header>

      <main className="hub-main personal-hub-main">
        <section className="internal-kpi-row personal-kpis">
          <Link href="/tasks?view=today" className="internal-kpi"><span className="internal-kpi-val">{stats.today}</span><span>Today</span></Link>
          <Link href="/tasks?view=overdue" className="internal-kpi is-warn"><span className="internal-kpi-val">{stats.overdue}</span><span>Overdue</span></Link>
          <Link href="/tasks?view=in_progress" className="internal-kpi"><span className="internal-kpi-val">{stats.inProgress}</span><span>In progress</span></Link>
          <Link href="/tasks?view=bank" className="internal-kpi"><span className="internal-kpi-val">{stats.bank}</span><span>Todo bank</span></Link>
        </section>

        <section className="personal-hub-card">
          <h2>Sign-in</h2>
          <p className="personal-hub-hint">
            Fine Teams uses one shared team password for every employee. Personal passwords are not used.
          </p>
        </section>

        {profile.hubUser?.permissions?.canManageUsers && (
          <section className="personal-hub-card">
            <h2>Admin</h2>
            <p className="personal-hub-hint">View, block, or remove team members.</p>
            <Link href="/hub/admin" className="appdev-btn-primary">Team members</Link>
          </section>
        )}
      </main>
    </div>
  );
}
