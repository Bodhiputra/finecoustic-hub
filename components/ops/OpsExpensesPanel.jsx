'use client';

import { useCallback, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { EXPENSE_STATUSES } from '@/lib/hub-expenses-constants';

const STATUS_KEYS = {
  pending: 'hub.expenses.statusPending',
  submitted: 'hub.expenses.statusSubmitted',
  reimbursed: 'hub.expenses.statusReimbursed',
  rejected: 'hub.expenses.statusRejected',
};

export default function OpsExpensesPanel({ initialExpenses = [] }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: '',
    description: '',
    amount: '',
    currency: 'USD',
  });

  const refresh = useCallback(async () => {
    const res = await fetch(API_V1.opsExpenses, { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = unwrapData(await res.json());
    setExpenses(Array.isArray(data?.expenses) ? data.expenses : []);
  }, []);

  async function createExpense(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(API_V1.opsExpenses, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...draft,
          amount: Number(draft.amount) || 0,
        }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      await refresh();
      setFormOpen(false);
      setDraft(d => ({ ...d, category: '', description: '', amount: '' }));
      toast.success(t('hub.expenses.created'));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(expense, status) {
    setBusy(true);
    try {
      const res = await fetch(API_V1.opsExpense(expense.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reimbursement_status: status }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <section className="ops-expenses-panel">
      <header className="kol-pool-header wrap-row">
        <div>
          <h2 className="kol-pool-title">{t('hub.expenses.title')}</h2>
          <p className="kol-pool-subtitle">{t('hub.expenses.subtitle')}</p>
        </div>
        <div className="kol-pool-header-actions wrap-row">
          <a href={`${API_V1.opsExpenses}?format=csv`} className="hub-btn hub-btn--ghost">
            <Icon name="upload" size={16} />
            <span>{t('hub.expenses.exportCsv')}</span>
          </a>
          <button type="button" className="hub-btn hub-btn--primary" onClick={() => setFormOpen(o => !o)}>
            <Icon name="plus" size={16} />
            <span>{t('hub.expenses.add')}</span>
          </button>
        </div>
      </header>

      {formOpen ? (
        <form className="ops-expense-form kol-edit-form" onSubmit={createExpense}>
          <label>
            {t('hub.expenses.date')}
            <input type="date" value={draft.expense_date} onChange={e => setDraft(d => ({ ...d, expense_date: e.target.value }))} required />
          </label>
          <label>
            {t('hub.expenses.category')}
            <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} />
          </label>
          <label className="kol-edit-form-full">
            {t('hub.expenses.description')}
            <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} required />
          </label>
          <label>
            {t('hub.expenses.amount')}
            <input type="number" step="0.01" min="0" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} required />
          </label>
          <label>
            {t('hub.expenses.currency')}
            <input value={draft.currency} onChange={e => setDraft(d => ({ ...d, currency: e.target.value.toUpperCase() }))} />
          </label>
          <footer className="kol-modal-foot">
            <button type="button" className="appdev-btn-ghost" onClick={() => setFormOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="appdev-btn-primary" disabled={busy}>{t('hub.internal.taskPanel.save')}</button>
          </footer>
        </form>
      ) : null}

      <p className="ops-expense-total">{t('hub.expenses.total').replace('{amount}', total.toFixed(2))}</p>

      {expenses.length === 0 ? (
        <p className="internal-empty">{t('hub.expenses.empty')}</p>
      ) : (
        <div className="kol-pool-table-wrap h-scroll">
          <table className="kol-pool-table">
            <thead>
              <tr>
                <th>{t('hub.expenses.date')}</th>
                <th>{t('hub.expenses.category')}</th>
                <th>{t('hub.expenses.description')}</th>
                <th>{t('hub.expenses.amount')}</th>
                <th>{t('hub.expenses.status')}</th>
                <th>{t('hub.expenses.createdBy')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td>{exp.expense_date}</td>
                  <td>{exp.category || '—'}</td>
                  <td>{exp.description}</td>
                  <td>{exp.amount} {exp.currency}</td>
                  <td>
                    <select
                      value={exp.reimbursement_status}
                      disabled={busy}
                      onChange={e => updateStatus(exp, e.target.value)}
                    >
                      {EXPENSE_STATUSES.map(s => (
                        <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>
                      ))}
                    </select>
                  </td>
                  <td>{exp.created_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
