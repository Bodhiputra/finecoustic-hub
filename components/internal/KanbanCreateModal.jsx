'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import HubModal from '@/components/HubModal';
import { useLocale } from '@/components/LocaleProvider';
import { ALL_DEPARTMENTS_ID, BOARD_DEPARTMENT_IDS, deptText, getDepartment } from '@/lib/internal';

export default function KanbanCreateModal({
  open,
  title,
  defaultDepartment = '',
  showDepartmentPicker = false,
  confirmLabel,
  cancelLabel,
  busy = false,
  existingBoards = [],
  loadingExisting = false,
  onCancel,
  onSubmit,
  onSelectExisting,
}) {
  const { t } = useLocale();
  const nameId = useId();
  const deptId = useId();
  const inputRef = useRef(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState(defaultDepartment || BOARD_DEPARTMENT_IDS[0]);

  const hasExisting = existingBoards.length > 0;

  useEffect(() => {
    if (!open) return;
    setName('');
    setDepartment(defaultDepartment || BOARD_DEPARTMENT_IDS[0]);
    const timer = window.setTimeout(() => {
      if (!hasExisting) inputRef.current?.focus();
    }, 0);
    const onKey = e => {
      if (e.key === 'Escape' && !busy) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, defaultDepartment, busy, onCancel, hasExisting]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = String(name || '').trim();
    if (!trimmed || busy) return;
    onSubmit?.({ name: trimmed, department: showDepartmentPicker ? department : defaultDepartment });
  }

  function departmentLabel(id) {
    if (id === ALL_DEPARTMENTS_ID) return t('hub.internal.allDepartments');
    const dept = getDepartment(id);
    return dept ? deptText(dept, t, 'label') : id;
  }

  return (
    <HubModal
      open={open}
      onClose={onCancel}
      className="appdev-confirm-modal appdev-prompt-modal kanban-create-modal"
      labelledBy="kanban-create-title"
      disableBackdropClose={busy}
    >
      <form onSubmit={handleSubmit}>
        <h2 id="kanban-create-title" className="appdev-confirm-title">
          {title}
        </h2>

        {loadingExisting ? (
          <p className="kanban-create-loading">{t('common.loading')}</p>
        ) : hasExisting ? (
          <section className="kanban-create-existing">
            <p className="appdev-prompt-label">{t('hub.internal.existingKanbans')}</p>
            <ul className="kol-modal-list kanban-create-list">
              {existingBoards.map(board => (
                <li key={board.id}>
                  <button
                    type="button"
                    className="kol-modal-row kanban-create-row"
                    disabled={busy}
                    onClick={() => onSelectExisting?.(board)}
                  >
                    <Icon name="kanban" size={16} aria-hidden />
                    <span className="kol-modal-row-name">{board.name}</span>
                    {board.department ? (
                      <span className="kanban-create-dept">{departmentLabel(board.department)}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="kanban-create-divider-label">{t('hub.internal.createNewKanban')}</p>
          </section>
        ) : null}

        <label className="appdev-prompt-field" htmlFor={nameId}>
          <span className="appdev-prompt-label">{t('hub.internal.boardNamePrompt')}</span>
          <input
            ref={inputRef}
            id={nameId}
            type="text"
            className="appdev-prompt-input"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={busy}
            maxLength={120}
            autoComplete="off"
          />
        </label>
        {showDepartmentPicker ? (
          <label className="appdev-prompt-field" htmlFor={deptId}>
            <span className="appdev-prompt-label">{t('hub.internal.boardDepartmentPrompt')}</span>
            <select
              id={deptId}
              className="appdev-prompt-input appdev-prompt-select"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={busy}
            >
              {BOARD_DEPARTMENT_IDS.map(id => (
                <option key={id} value={id}>
                  {departmentLabel(id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <footer className="appdev-confirm-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button type="submit" className="appdev-btn-primary" disabled={busy || !String(name || '').trim()}>
            {confirmLabel || t('common.confirm')}
          </button>
        </footer>
      </form>
    </HubModal>
  );
}
