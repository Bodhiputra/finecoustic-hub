'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';
import Icon from '@/components/Icon';
import {
  SURVEY_QUESTIONS,
  answerBreakdown,
  calcSurveyStats,
  downloadCsv,
  filterSurveyRows,
  formatSurveyTime,
  rowQuestionnaire,
  rowsToCsv,
} from '@/lib/preorder-survey-ui';

function IntentBadge({ intent }) {
  const label = intent === 'reserve' ? 'Reserve' : intent === 'decline' ? 'Decline' : intent;
  return <span className={`survey-badge survey-badge--${intent}`}>{label}</span>;
}

function AnswerBars({ rows, questions }) {
  return (
    <div className="survey-breakdown-grid">
      {questions.map(q => {
        const { answered, entries, max } = answerBreakdown(rows, q);
        return (
          <article key={q.id} className="survey-breakdown-card">
            <header>
              <h3>
                <span className="survey-q-id">{q.short}</span>
                {q.title}
              </h3>
              <p>
                {answered} answered
                {q.hint ? ` · ${q.hint}` : ''}
              </p>
            </header>
            {entries.length === 0 ? (
              <p className="survey-empty-inline">No answers yet</p>
            ) : (
              <ul className="survey-bars">
                {entries.map(({ label, count }) => (
                  <li key={label}>
                    <div className="survey-bar-head">
                      <span className="survey-bar-label">{label}</span>
                      <span className="survey-bar-count">{count}</span>
                    </div>
                    <div className="survey-bar-track" aria-hidden="true">
                      <div
                        className="survey-bar-fill"
                        style={{ width: `${max ? (count / max) * 100 : 0}%` }}
                      />
                    </div>
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

function ResponseAnswers({ row }) {
  const items = rowQuestionnaire(row);

  return (
    <dl className="survey-response-answers">
      {items.map(item => (
        <div key={item.id} className="survey-response-answer">
          <dt>
            <span className="survey-q-id">{item.short}</span>
            {item.title}
          </dt>
          <dd>
            {item.answers.length > 1 ? (
              <ul>
                {item.answers.map(answer => (
                  <li key={answer}>{answer}</li>
                ))}
              </ul>
            ) : (
              item.answer
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function PreorderSurveyDashboard({ initialRows = [] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [intent, setIntent] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flushOpen, setFlushOpen] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushError, setFlushError] = useState('');

  const filtered = useMemo(
    () => filterSurveyRows(rows, { intent, from, to }),
    [rows, intent, from, to]
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

  const handleFlush = async () => {
    setFlushing(true);
    setFlushError('');
    try {
      const res = await fetch('/api/preorder-survey/flush', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not clear responses');
      }
      setRows([]);
      setFlushOpen(false);
      router.refresh();
    } catch (err) {
      setFlushError(err.message || 'Could not clear responses');
    } finally {
      setFlushing(false);
    }
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
        <div className="survey-toolbar-actions">
          <button type="button" className="btn-ghost" onClick={handleExport} disabled={!filtered.length}>
            <Icon name="download" size={15} />
            Export CSV
          </button>
          <button
            type="button"
            className="btn-ghost survey-flush-btn"
            onClick={() => setFlushOpen(true)}
            disabled={!rows.length || flushing}
          >
            Clear all
          </button>
        </div>
      </div>

      {flushError && <p className="survey-flush-error" role="alert">{flushError}</p>}

      <ConfirmModal
        open={flushOpen}
        title="Clear all questionnaire responses?"
        message={`This permanently deletes all ${rows.length} saved response(s) from Neon. This cannot be undone.`}
        confirmLabel={flushing ? 'Clearing…' : 'Clear all'}
        cancelLabel="Cancel"
        busy={flushing}
        onConfirm={handleFlush}
        onCancel={() => {
          if (!flushing) setFlushOpen(false);
        }}
      />

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
          <p className="panel-desc">Answer distribution for reserve-path questions (R1–R3).</p>
        </header>
        <AnswerBars rows={reserveRows} questions={SURVEY_QUESTIONS.reserve} />
      </article>

      <article className="panel panel-full">
        <header className="panel-head">
          <h2>Decline answers</h2>
          <p className="panel-desc">Answer distribution for decline-path questions (D1–D5).</p>
        </header>
        <AnswerBars rows={declineRows} questions={SURVEY_QUESTIONS.decline} />
      </article>

      <article className="panel panel-full">
        <header className="panel-head">
          <h2>Responses</h2>
          <p className="panel-desc">
            Showing {filtered.length} of {rows.length} loaded responses.
          </p>
        </header>
        <div className="survey-response-list">
          {filtered.length === 0 ? (
            <p className="survey-empty-cell">No responses match these filters.</p>
          ) : (
            filtered.map(row => (
              <article key={row.id} className="survey-response-card">
                <header className="survey-response-card__head">
                  <div>
                    <strong className="survey-response-card__when">
                      {formatSurveyTime(row.created_at)}
                    </strong>
                    <span className="survey-response-card__email">{row.email || '—'}</span>
                  </div>
                  <div className="survey-response-card__meta">
                    <IntentBadge intent={row.intent} />
                    <span>Mkt: {row.accepts_marketing ? 'Yes' : 'No'}</span>
                    {row.intent === 'reserve' && (
                      <span>Checkout: {row.checkout_started ? 'Yes' : 'No'}</span>
                    )}
                  </div>
                </header>
                <ResponseAnswers row={row} />
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
