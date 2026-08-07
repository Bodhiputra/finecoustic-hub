'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BoardView from '@/components/appdev/BoardView';
import TableView from '@/components/appdev/TableView';
import BoardFilters from '@/components/appdev/BoardFilters';
import PresenceAvatars from '@/components/appdev/PresenceAvatars';
import { useAppdevPresence, usePresenceOnline } from '@/components/appdev/useAppdevPresence';
import IssuePanel from '@/components/appdev/IssuePanel';
import AppdevHelp from '@/components/appdev/AppdevHelp';
import AppdevNotifications from '@/components/appdev/AppdevNotifications';
import ConfirmModal from '@/components/ConfirmModal';
import AppdevAdminUsers from '@/components/appdev/AppdevAdminUsers';
import Icon from '@/components/Icon';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import { useLocale } from '@/components/LocaleProvider';
import { STATUSES, peekNextIssueNumber, parseIssueIdNum, dedupeIssuesById, collectIssueTypeFilterOptions, mergeTaskTypes } from '@/lib/appdev';
import { createDraftIssue, isDraftIssue } from '@/lib/appdev-draft';
import { filterIssues } from '@/lib/appdev-filters';
import { sortIssuesByDueAt } from '@/lib/appdev-due';

const VIEW_KEY = 'appdev-view';
const HELP_KEY = 'appdev-help-dismissed';
const FILTER_ASSIGNEE_KEY = 'appdev-filter-assignee';
const FILTER_TYPE_KEY = 'appdev-filter-type';
const BOARD_SYNC_MS = 30_000;
const SESSION_CHECK_MS = 45_000;
const LOCAL_EDIT_QUIET_MS = 10_000;

const APPDEV_ERROR_KEYS = {
  task_locked: 'appdev.board.error.taskLocked',
  status_assigner_only: 'appdev.board.error.statusAssignerOnly',
  status_not_allowed: 'appdev.board.error.statusNotAllowed',
  worker_required: 'appdev.board.error.workerRequired',
  workers_not_allowed: 'appdev.board.error.workersNotAllowed',
  workers_not_registered: 'appdev.board.error.workersNotRegistered',
  assignee_required: 'appdev.board.error.assigneeRequired',
  not_owner: 'appdev.board.deleteForbidden',
  protected: 'appdev.board.deleteForbidden',
};

function appdevErrorMessage(data, t) {
  const code = data?.error;
  if (code && APPDEV_ERROR_KEYS[code]) return t(APPDEV_ERROR_KEYS[code]);
  if (data?.message) return data.message;
  return t('appdev.board.saveError');
}

function redirectIfSessionRevoked(res) {
  if (res.status === 401) {
    window.location.replace('/appdev?reason=session_revoked');
    return true;
  }
  return false;
}

function redirectForSignOut(reason) {
  const key =
    reason === 'account_deleted'
      ? 'account_deleted'
      : reason === 'blocked'
        ? 'account_blocked'
        : 'session_revoked';
  window.location.replace(`/appdev?reason=${key}`);
}

export default function AppdevBoard({ initialData = null }) {
  const { t, locale } = useLocale();
  const [board, setBoard] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [view, setView] = useState('board');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const boardUpdatedAtRef = useRef(initialData?.meta?.updated_at || '');
  const localEditUntilRef = useRef(0);

  const { subscribe: subscribePresence } = useAppdevPresence(true);
  const onlineUsers = usePresenceOnline(subscribePresence);

  useEffect(() => {
    const storedView = localStorage.getItem(VIEW_KEY);
    if (storedView === 'board' || storedView === 'table') setView(storedView);
    setShowHelp(localStorage.getItem(HELP_KEY) !== '1');
    setAssigneeFilter(localStorage.getItem(FILTER_ASSIGNEE_KEY) === '__me__' ? '__me__' : '');
    setTypeFilter(localStorage.getItem(FILTER_TYPE_KEY) || '');

    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        if (data.admin) setIsAdmin(true);
        if (data.displayName) setCurrentUser(data.displayName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setSelected(prev => {
      if (!prev || !isDraftIssue(prev) || prev.assignee) return prev;
      return { ...prev, assignee: currentUser };
    });
  }, [currentUser]);

  useEffect(() => {
    boardUpdatedAtRef.current = board?.meta?.updated_at || '';
  }, [board?.meta?.updated_at]);

  useEffect(() => {
    let cancelled = false;

    function commentsChanged(prevComments, nextComments) {
      const prev = prevComments || [];
      const next = nextComments || [];
      if (prev.length !== next.length) return true;
      if (!next.length) return false;
      return prev[prev.length - 1]?.id !== next[next.length - 1]?.id;
    }

    async function syncBoard() {
      if (Date.now() < localEditUntilRef.current) return;
      try {
        const since = boardUpdatedAtRef.current;
        const url = since
          ? `/api/appdev/issues?since=${encodeURIComponent(since)}`
          : '/api/appdev/issues';
        const res = await fetch(url, { credentials: 'same-origin' });
        if (cancelled || !res.ok) return;
        if (redirectIfSessionRevoked(res)) return;

        const boardData = await res.json().catch(() => null);
        if (cancelled || boardData?.unchanged || !boardData?.issues) return;

        boardUpdatedAtRef.current = boardData.meta?.updated_at || '';

        setBoard({
          ...boardData,
          issues: dedupeIssuesById(boardData.issues),
        });

        setSelected(prev => {
          if (!prev || isDraftIssue(prev)) return prev;
          const fresh = boardData.issues.find(i => i.id === prev.id);
          if (!fresh) return null;
          if (!commentsChanged(prev.comments, fresh.comments)) return prev;
          return { ...prev, comments: fresh.comments, updated_at: fresh.updated_at };
        });
      } catch {
        /* ignore transient network errors */
      }
    }

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) {
          redirectForSignOut('session_revoked');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.appdev) {
          redirectForSignOut(data.signOutReason);
          return;
        }
      } catch {
        /* ignore transient network errors */
      }
    }

    const startupId = window.setTimeout(checkSession, 2000);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      syncBoard();
    }, BOARD_SYNC_MS);
    const sessionInterval = window.setInterval(checkSession, SESSION_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
        syncBoard();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(startupId);
      window.clearInterval(interval);
      window.clearInterval(sessionInterval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const setViewMode = mode => {
    setView(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const dismissHelp = () => {
    setShowHelp(false);
    localStorage.setItem(HELP_KEY, '1');
  };

  const toggleHelp = () => {
    setShowHelp(open => {
      const next = !open;
      if (next) localStorage.removeItem(HELP_KEY);
      return next;
    });
  };

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/appdev/issues', { credentials: 'same-origin' });
      if (res.status === 401) {
        const me = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const meData = await me.json().catch(() => ({}));
        redirectForSignOut(meData.signOutReason);
        return;
      }
      if (redirectIfSessionRevoked(res)) return;
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.includes('application/json')) {
        throw new Error(String(res.status));
      }
      setBoard(await res.json());
    } catch (err) {
      if (err?.message === '401') {
        window.location.replace('/appdev?reason=session_revoked');
        return;
      }
      setError(t('appdev.board.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (initialData) return;
    load();
  }, [initialData, load]);

  const setAssigneeFilterMode = value => {
    const next = value === '__me__' ? '__me__' : '';
    setAssigneeFilter(next);
    localStorage.setItem(FILTER_ASSIGNEE_KEY, next);
  };

  const setTypeFilterMode = value => {
    setTypeFilter(value);
    localStorage.setItem(FILTER_TYPE_KEY, value);
  };

  const savedIssues = useMemo(
    () => (board?.issues || []).filter(issue => !isDraftIssue(issue)),
    [board]
  );

  const people = board?.meta?.people || [];
  const assignablePeople = board?.meta?.assignable_people ?? people;

  const filteredIssues = useMemo(() => {
    return filterIssues(savedIssues, {
      search,
      assigneeFilter,
      typeFilter,
      currentUser,
    });
  }, [savedIssues, search, assigneeFilter, typeFilter, currentUser]);

  const typeOptions = useMemo(
    () => collectIssueTypeFilterOptions(savedIssues, board?.meta?.task_types),
    [savedIssues, board?.meta?.task_types]
  );

  const taskTypes = useMemo(
    () => mergeTaskTypes(board?.meta?.task_types, savedIssues),
    [board?.meta?.task_types, savedIssues]
  );

  const registerTaskType = useCallback(type => {
    if (!type) return;
    setBoard(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        task_types: mergeTaskTypes(prev.meta?.task_types, prev.issues, [type]),
      },
    }));
  }, []);

  const issuesByStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map(s => [s, []]));
    filteredIssues.forEach(issue => {
      if (map[issue.status]) map[issue.status].push(issue);
    });
    for (const status of STATUSES) {
      map[status] = sortIssuesByDueAt(map[status]);
    }
    return map;
  }, [filteredIssues]);

  const openIssue = issue => setSelected(issue);

  const bumpLocalEditQuiet = useCallback(() => {
    localEditUntilRef.current = Date.now() + LOCAL_EDIT_QUIET_MS;
  }, []);

  const applyIssueUpdate = (issue, people, task_types, boardUpdatedAt) => {
    if (boardUpdatedAt) {
      boardUpdatedAtRef.current = boardUpdatedAt;
      localEditUntilRef.current = Date.now() + LOCAL_EDIT_QUIET_MS;
    }
    setBoard(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        ...(boardUpdatedAt ? { updated_at: boardUpdatedAt } : {}),
        ...(people ? { people } : {}),
        ...(task_types ? { task_types } : {}),
      },
      issues: dedupeIssuesById(
        prev.issues.some(i => i.id === issue.id)
          ? prev.issues.map(i => (i.id === issue.id ? issue : i))
          : [issue, ...prev.issues]
      ),
    }));
    setSelected(prev => (prev?.id === issue.id ? issue : prev));
  };

  const newIssue = () => {
    if (selected && isDraftIssue(selected)) return;

    const draft = createDraftIssue({
      title: t('appdev.board.newIssueDefault'),
      assignee: currentUser,
      previewNumber: peekNextIssueNumber(board),
    });

    setSelected(draft);
    setError('');
  };

  const closeIssue = () => {
    setSelected(null);
  };

  const editingDraft = selected && isDraftIssue(selected);

  const issuePatchBody = draft => ({
    title: draft.title,
    description: draft.description,
    type: draft.type,
    status: draft.status,
    priority: draft.priority,
    workers: draft.workers,
    assigned_at: draft.assigned_at,
    due_at: draft.due_at,
    completed_at: draft.completed_at,
    image_urls: draft.image_urls,
    video_urls: draft.video_urls,
  });

  const patchIssue = async (id, patch, { silent = false } = {}) => {
    if (isDraftIssue(id)) return { ok: false };

    let rollbackBoard = null;
    let rollbackSelected = null;
    if (silent) {
      localEditUntilRef.current = Date.now() + LOCAL_EDIT_QUIET_MS;
      setBoard(prev => {
        rollbackBoard = prev;
        return {
          ...prev,
          issues: prev.issues.map(i => (i.id === id ? { ...i, ...patch, updated_at: new Date().toISOString() } : i)),
        };
      });
      setSelected(prev => {
        if (!prev || prev.id !== id || isDraftIssue(prev)) return prev;
        rollbackSelected = prev;
        return { ...prev, ...patch, updated_at: new Date().toISOString() };
      });
    }

    if (!silent) setSaving(true);
    if (!silent) setError('');
    try {
      const res = await fetch(`/api/appdev/issues/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (redirectIfSessionRevoked(res)) return { ok: false };
      if (!res.ok) {
        if (silent && rollbackBoard) {
          setBoard(rollbackBoard);
          if (rollbackSelected) setSelected(rollbackSelected);
        }
        const msg = appdevErrorMessage(data, t);
        if (!silent) setError(msg);
        return { ok: false, message: msg };
      }
      const { issue, people, task_types, board_updated_at: boardUpdatedAt } = data;
      applyIssueUpdate(issue, people, task_types, boardUpdatedAt);
      return { ok: true };
    } catch {
      if (silent && rollbackBoard) {
        setBoard(rollbackBoard);
        if (rollbackSelected) setSelected(rollbackSelected);
      }
      const msg = t('appdev.board.saveError');
      if (!silent) setError(msg);
      return { ok: false, message: msg };
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleStatusChange = async (issue, newStatus) => {
    if (!issue || issue.status === newStatus) return;
    const result = await patchIssue(issue.id, { status: newStatus }, { silent: true });
    if (!result.ok) setError(result.message || t('appdev.board.saveError'));
  };

  const openIssueById = issueId => {
    const issue = savedIssues.find(i => i.id === issueId);
    if (issue) setSelected(issue);
  };

  const saveIssue = async draft => {
    setSaving(true);
    setError('');
    try {
      if (isDraftIssue(draft.id)) {
        const res = await fetch('/api/appdev/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            title: draft.title,
            status: draft.status,
            type: draft.type,
            description: draft.description,
            priority: draft.priority,
            workers: draft.workers,
            image_urls: draft.image_urls,
            video_urls: draft.video_urls,
          }),
        });
        if (res.status === 403) {
          window.location.replace('/appdev');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(appdevErrorMessage(data, t));
          return;
        }

        let { issue, people, next_number: serverNextNumber } = data;
        const patchRes = await fetch(`/api/appdev/issues/${encodeURIComponent(issue.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(issuePatchBody({ ...draft, id: issue.id })),
        });
        const patchData = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          setError(appdevErrorMessage(patchData, t));
          return;
        }
        issue = patchData.issue;
        people = patchData.people || people;
        const task_types = patchData.task_types || data.task_types;

        const createdNum = parseIssueIdNum(issue.id);
        setBoard(prev => ({
          ...prev,
          meta: {
            ...prev.meta,
            ...(people ? { people } : {}),
            ...(task_types ? { task_types } : {}),
          },
          issues: dedupeIssuesById([issue, ...(prev?.issues || [])]),
          next_number:
            serverNextNumber ??
            (createdNum != null ? createdNum + 1 : prev.next_number),
        }));
        setSelected(null);
        return;
      }

      const res = await fetch(`/api/appdev/issues/${encodeURIComponent(draft.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(issuePatchBody(draft)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(appdevErrorMessage(data, t));
        return;
      }
      const { issue, people, task_types } = data;
      applyIssueUpdate(issue, people, task_types, data.board_updated_at);
      setSelected(issue);
      return;
    } catch {
      setError(t('appdev.board.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const removeIssue = async id => {
    if (isDraftIssue(id)) {
      setSelected(null);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/appdev/issues/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(appdevErrorMessage(data, t));
        return;
      }
      setBoard(prev => ({
        ...prev,
        issues: prev.issues.filter(i => i.id !== id),
      }));
      setSelected(null);
    } catch {
      setError(t('appdev.board.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const postComment = async (id, payload) => {
    if (isDraftIssue(id)) return;

    setPostingComment(true);
    setError('');
    try {
      const res = await fetch(`/api/appdev/issues/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          body: payload.body,
          image_urls: payload.image_urls,
          video_urls: payload.video_urls,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = appdevErrorMessage(data, t);
        setError(msg);
        throw new Error(msg);
      }
      const data = await res.json();
      const { issue, people, board_updated_at: boardUpdatedAt } = data;
      applyIssueUpdate(issue, people, null, boardUpdatedAt);
    } catch {
      setError(t('appdev.chat.postError'));
      throw new Error('comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/appdev/logout', { method: 'POST' });
    window.location.href = '/appdev';
  };

  const totalCount = savedIssues.length;
  const filteredCount = filteredIssues.length;
  const hasActiveFilters = Boolean(search.trim() || assigneeFilter || typeFilter);
  const viewDesc = view === 'board' ? t('appdev.views.boardDesc') : t('appdev.views.tableDesc');

  return (
    <div className="appdev-shell">
      <header className="appdev-header">
        <div className="appdev-header-primary">
          <div className="appdev-topbar-left">
            <div className="appdev-topbar-title">
              <strong>{board?.meta?.project || t('appdev.board.project')}</strong>
              <span className="appdev-topbar-sub">
                {t('appdev.board.subtitle')} · {totalCount} {t('appdev.board.issueCount')}
              </span>
            </div>
          </div>
          <div className="appdev-topbar-actions">
            <PresenceAvatars online={onlineUsers} currentUser={currentUser} t={t} />
            {currentUser && (
              <AppdevNotifications
                t={t}
                locale={locale}
                currentUser={currentUser}
                onOpenIssue={openIssueById}
                refreshKey={board?.meta?.updated_at || ''}
              />
            )}
            <LocaleSwitch />
            <ThemeToggle />
            {isAdmin && <AppdevAdminUsers t={t} />}
            {isAdmin && <span className="appdev-admin-badge">{t('common.admin')}</span>}
            <button
              type="button"
              className="btn-ghost"
              onClick={handleLogout}
              title={t('common.signOutHint')}
            >
              <Icon name="logOut" size={15} />
              {t('common.signOut')}
            </button>
          </div>
        </div>

        <aside className="appdev-scope-notice" aria-label={t('appdev.scopeNotice.title')}>
          <Icon name="helpCircle" size={20} className="appdev-scope-notice-icon" />
          <div className="appdev-scope-notice-body">
            <p className="appdev-scope-notice-title">{t('appdev.scopeNotice.title')}</p>
            <p>{t('appdev.scopeNotice.p1')}</p>
            <p>{t('appdev.scopeNotice.p2')}</p>
            <p>{t('appdev.scopeNotice.p3')}</p>
          </div>
        </aside>

        <div className="appdev-header-secondary">
          <div className="appdev-view-switch" role="tablist" aria-label={t('appdev.views.label')}>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'board'}
              className={`appdev-view-btn${view === 'board' ? ' active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              {t('appdev.views.board')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'table'}
              className={`appdev-view-btn${view === 'table' ? ' active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              {t('appdev.views.table')}
            </button>
          </div>

          <BoardFilters
            assigneeFilter={assigneeFilter}
            onAssigneeFilterChange={setAssigneeFilterMode}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilterMode}
            typeOptions={typeOptions}
            t={t}
          />

          <div className="appdev-search-wrap">
            <Icon name="search" size={16} className="appdev-search-icon" />
            <input
              type="search"
              className="appdev-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('appdev.board.searchPlaceholder')}
              aria-label={t('appdev.board.searchPlaceholder')}
            />
          </div>

          {!loading && totalCount > 0 && (
            <p className="appdev-view-desc">
              {hasActiveFilters
                ? t('appdev.board.filteredCount')
                    .replace('{count}', String(filteredCount))
                    .replace('{total}', String(totalCount))
                : viewDesc}
            </p>
          )}

          <button
            type="button"
            className="appdev-btn-primary appdev-new-issue-btn"
            onClick={newIssue}
            disabled={loading || editingDraft}
          >
            <Icon name="plus" size={15} />
            {t('appdev.board.newIssue')}
          </button>
        </div>
      </header>

      <AppdevHelp open={showHelp} onClose={dismissHelp} onToggle={toggleHelp} t={t} />

      {error && (
        <p className="appdev-error" role="alert">{error}</p>
      )}

      <main className="appdev-main">
        {loading ? (
          <p className="appdev-loading">{t('appdev.board.loading')}</p>
        ) : totalCount === 0 ? (
          <div className="appdev-empty-page">
            <h2>{t('appdev.board.emptyTitle')}</h2>
            <p>{t('appdev.board.emptyBody')}</p>
            <button type="button" className="appdev-btn-primary" onClick={newIssue} disabled={editingDraft}>
              <Icon name="plus" size={15} />
              {t('appdev.board.newIssue')}
            </button>
          </div>
        ) : filteredCount === 0 && hasActiveFilters ? (
          <div className="appdev-empty-page">
            <h2>{t('appdev.board.emptyFilterTitle')}</h2>
            <p>{t('appdev.board.emptyFilterBody')}</p>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSearch('');
                setAssigneeFilterMode('');
                setTypeFilterMode('');
              }}
            >
              {t('appdev.board.clearFilters')}
            </button>
          </div>
        ) : view === 'table' ? (
          <TableView
            issues={filteredIssues}
            onPatch={patchIssue}
            openIssue={openIssue}
            saving={saving}
            currentUser={currentUser}
            isAdmin={isAdmin}
            taskTypes={taskTypes}
            registerTaskType={registerTaskType}
            t={t}
          />
        ) : (
          <BoardView
            issuesByStatus={issuesByStatus}
            openIssue={openIssue}
            onStatusChange={handleStatusChange}
            locale={locale}
            t={t}
          />
        )}
      </main>

      {selected && (
        <IssuePanel
          issue={selected}
          people={people}
          assignablePeople={assignablePeople}
          taskTypes={taskTypes}
          registerTaskType={registerTaskType}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={closeIssue}
          onSave={saveIssue}
          onPatch={patchIssue}
          onDelete={id => setDeleteConfirmId(id)}
          onPostComment={payload => postComment(selected.id, payload)}
          onEditActivity={bumpLocalEditQuiet}
          t={t}
          saving={saving}
          postingComment={postingComment}
        />
      )}

      <ConfirmModal
        open={deleteConfirmId != null}
        title={t('appdev.board.delete')}
        message={t('appdev.board.deleteConfirm')}
        confirmLabel={t('appdev.board.delete')}
        cancelLabel={t('common.cancel')}
        busy={saving}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          const id = deleteConfirmId;
          setDeleteConfirmId(null);
          if (id) removeIssue(id);
        }}
      />
    </div>
  );
}
