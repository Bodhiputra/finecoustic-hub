'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  SURVEY_QUESTIONS,
  answerBreakdown,
  calcSurveyStats,
  downloadCsv,
  filterSurveyRows,
  formatSurveyTime,
  rowsToCsv,
  truncate,
} from '@/lib/preorder-survey-ui';

function IntentBadge({ intent }) {
  const label = intent === 'reserve' ? 'Reserve' : intent === 'decline' ? 'Decline' : intent;
  return <span className={`survey-badge survey-badge--${intent}`}>{label}</span>;
}

function AnswerBars({ rows, questions }) {
  return (
    <div className="survey-breakdown-grid">
      {questions.map(q => {
        const { answered, entries, max } = answerBreakdown(rows, q.id);
        return (
          <article key={q.id} className="survey-breakdown-card">
            <header>
              <h3>
                <span className="survey-q-id">{q.short}</span>
                {q.title}
              </h3>
              <p>{answered} answered</p>
            </header>
            {entries.length === 0 ? (
              <p className="survey-empty-inline">No answers yet</p>
            ) : (
              <ul className="survey-bars">
                {entries.map(({ letter, count }) => (
                  <li key={letter}>
                    <span className="survey-bar-label">{letter}</span>
                    <div className="survey-bar-track" aria-hidden="true">
                      <div
                        className="survey-bar-fill"
                        style={{ width: `${max ? (count / max) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="survey-bar-count">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function PreorderSurveyDashboard({ initialRows = [] }) {
  const [intent, setIntent] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(
    () => filterSurveyRows(initialRows, { intent, from, to }),
    [initialRows, intent, from, to]
  );

  const stats = useMemo(() => calcSurveyStats(filtered), [filtered]);

  const reserveRows = useMemo(
    () => filtered.filter(r => r.intent === 'reserve'),
    [filtered]
  );
  const declineRows = useMemo(
    () => filtered.filter(r => r.intent === 'decline'),
    [filtered]
  );

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`preorder-survey-${stamp}.csv`, rowsToCsv(filtered));
  };

  return (
    <section className="view active">
      <div className="survey-toolbar">
        <div className="survey-filters">
          <label className="survey-filter">
            <span>Intent</span>
            <select value={intent} onChange={e => setIntent(e.target.value)}>
              <option value="all">All</option>
              <option value="reserve">Reserve</option>
              <option value="decline">Decline</option>
            </select>
          </label>
          <label className="survey-filter">
            <span>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="survey-filter">
            <span>To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          {(from || to || intent !== 'all') && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setIntent('all');
                setFrom('');
                setTo('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={handleExport} disabled={!filtered.length}>
          <Icon name="download" size={15} />
          Export CSV
        </button>
      </div>

      <div className="kpi-grid survey-kpi-grid">
        <div className="kpi kpi-primary">
          <label>Total responses</label>
          <strong>{stats.total}</strong>
          <span>
            {stats.reserve} reserve · {stats.decline} decline
          </span>
        </div>
        <div className="kpi kpi-ok">
          <label>Reserve</label>
          <strong>{stats.reserve}</strong>
          <span>
            {stats.total ? Math.round((stats.reserve / stats.total) * 100) : 0}% of filtered
          </span>
        </div>
        <div className="kpi kpi-warn">
          <label>Decline</label>
          <strong>{stats.decline}</strong>
          <span>
            {stats.total ? Math.round((stats.decline / stats.total) * 100) : 0}% of filtered
          </span>
        </div>
        <div className="kpi">
          <label>Checkout started</label>
          <strong>{stats.checkoutRate}%</strong>
          <span>
            {stats.checkoutStarted} of {stats.reserve} reserve paths
          </span>
        </div>
      </div>

      <article className="panel panel-full">
        <header className="panel-head">
          <h2>Reserve answers</h2>
          <p className="panel-desc">Top letter codes from reserve-path questions (R1–R3).</p>
        </header>
        <AnswerBars rows={reserveRows} questions={SURVEY_QUESTIONS.reserve} />
      </article>

      <article className="panel panel-full">
        <header className="panel-head">
          <h2>Decline answers</h2>
          <p className="panel-desc">Top letter codes from decline-path questions (D1–D5).</p>
        </header>
        <AnswerBars rows={declineRows} questions={SURVEY_QUESTIONS.decline} />
      </article>

      <article className="panel panel-full">
        <header className="panel-head">
          <h2>Responses</h2>
          <p className="panel-desc">
            Showing {filtered.length} of {initialRows.length} loaded responses.
          </p>
        </header>
        <div className="table-scroll">
          <table className="data-table survey-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Intent</th>
                <th>Email</th>
                <th>Mkt</th>
                <th>R1</th>
                <th>R2</th>
                <th>R3</th>
                <th>D1</th>
                <th>D2</th>
                <th>D3</th>
                <th>D4</th>
                <th>D5</th>
                <th>Summary</th>
                <th>Checkout</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="survey-empty-cell">
                    No responses match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id}>
                    <td className="num">{formatSurveyTime(row.created_at)}</td>
                    <td>
                      <IntentBadge intent={row.intent} />
                    </td>
                    <td>{row.email || '—'}</td>
                    <td>{row.accepts_marketing ? 'Yes' : 'No'}</td>
                    <td className="notes-cell" title={row.r1 || ''}>
                      {truncate(row.r1, 40)}
                    </td>
                    <td className="notes-cell" title={row.r2 || ''}>
                      {truncate(row.r2, 40)}
                    </td>
                    <td className="notes-cell" title={row.r3 || ''}>
                      {truncate(row.r3, 40)}
                    </td>
                    <td className="notes-cell" title={row.d1 || ''}>
                      {truncate(row.d1, 40)}
                    </td>
                    <td className="notes-cell" title={row.d2 || ''}>
                      {truncate(row.d2, 40)}
                    </td>
                    <td className="notes-cell" title={row.d3 || ''}>
                      {truncate(row.d3, 40)}
                    </td>
                    <td className="notes-cell" title={row.d4 || ''}>
                      {truncate(row.d4, 40)}
                    </td>
                    <td className="notes-cell" title={row.d5 || ''}>
                      {truncate(row.d5, 40)}
                    </td>
                    <td className="notes-cell" title={row.summary || ''}>
                      {truncate(row.summary, 60)}
                    </td>
                    <td>{row.checkout_started ? 'Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
