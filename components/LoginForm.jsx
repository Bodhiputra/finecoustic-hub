'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeToggle from '@/components/ThemeToggle';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';

function LoginFormInner({
  titleKey,
  subtitleKey,
  loginEndpoint,
  defaultRedirect,
  passwordId = 'password',
  collectName = true,
  nameId = 'display-name',
}) {
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [showRetriesRemaining, setShowRetriesRemaining] = useState(false);
  const [locked, setLocked] = useState(false);
  const [retryAfterSec, setRetryAfterSec] = useState(0);

  const canSubmit =
    password.trim().length > 0 &&
    (!collectName || displayName.trim().length > 0) &&
    !loading &&
    !locked;

  function formatRetryTime(seconds) {
    const sec = Math.max(1, Number(seconds) || 300);
    if (sec >= 60) {
      const mins = Math.ceil(sec / 60);
      if (locale === 'zh') return mins === 1 ? '1 分钟' : `${mins} 分钟`;
      return mins === 1 ? '1 minute' : `${mins} minutes`;
    }
    if (locale === 'zh') return sec === 1 ? '1 秒' : `${sec} 秒`;
    return sec === 1 ? '1 second' : `${sec} seconds`;
  }

  function formatRetriesLeft(count) {
    if (count === 1) return t('common.retriesLeftSingular');
    return t('common.retriesLeft').replace('{count}', String(count));
  }

  const applyRateLimitState = useCallback(data => {
    if (data?.attemptsLeft == null) {
      setAttemptsLeft(null);
      setLocked(false);
      setRetryAfterSec(0);
      return;
    }

    setAttemptsLeft(data.attemptsLeft);
    if (data.allowed === false || data.attemptsLeft === 0) {
      setLocked(true);
      setRetryAfterSec(data.retryAfterSec || 0);
    } else {
      setLocked(false);
      setRetryAfterSec(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(loginEndpoint, { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.allowed === false) {
          setLocked(true);
          setRetryAfterSec(data.retryAfterSec || 0);
          setShowRetriesRemaining(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [loginEndpoint]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          password: password.trim(),
          ...(collectName ? { displayName: displayName.trim() } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        applyRateLimitState(data);
        setShowRetriesRemaining(true);
        setError('');
        setLoading(false);
        return;
      }

      if (res.status === 403 && data.error === 'name_master_only') {
        setError(t('common.nameMasterOnly'));
        setLoading(false);
        return;
      }

      if (res.status === 403 && data.error === 'admin_name_required') {
        setError(t('common.adminNameRequired'));
        setLoading(false);
        return;
      }

      if (!res.ok) {
        if (res.status === 401 && typeof data.attemptsLeft === 'number') {
          applyRateLimitState({ ...data, allowed: true });
          setShowRetriesRemaining(true);
        }
        setError(t('common.incorrectPassword'));
        setLoading(false);
        return;
      }

      const from = searchParams.get('from') || defaultRedirect;
      window.location.assign(from);
    } catch {
      setError(t('common.somethingWrong'));
      setLoading(false);
    }
  }

  const retriesClass =
    locked || attemptsLeft === 0
      ? 'login-retries is-locked'
      : attemptsLeft != null && attemptsLeft <= 2
        ? 'login-retries is-warn'
        : 'login-retries';

  return (
    <div className="login-page">
      <div className="login-page-toolbar">
        <LocaleSwitch />
        <ThemeToggle />
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <h1>{t(titleKey)}</h1>
        {subtitleKey && <p className="login-subtitle">{t(subtitleKey)}</p>}
        {collectName && (
          <>
            <label htmlFor={nameId}>{t('common.yourName')}</label>
            <input
              id={nameId}
              type="text"
              autoComplete="name"
              className="login-name-input"
              value={displayName}
              disabled={locked}
              onChange={e => {
                setDisplayName(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={Boolean(error)}
            />
          </>
        )}
        <label htmlFor={passwordId}>{t('common.password')}</label>
        <div className="login-password-field">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            disabled={locked}
            onChange={e => {
              setPassword(e.target.value);
              if (error) setError('');
              if (showRetriesRemaining && !locked) {
                setShowRetriesRemaining(false);
                setAttemptsLeft(null);
              }
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={
              [
                showRetriesRemaining ? 'login-password-meta' : null,
                error ? 'login-error' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
            aria-pressed={showPassword}
            disabled={locked}
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
        {showRetriesRemaining && (
          <p id="login-password-meta" className={retriesClass} aria-live="polite">
            {locked
              ? t('common.rateLimited').replace('{time}', formatRetryTime(retryAfterSec))
              : attemptsLeft != null
                ? formatRetriesLeft(attemptsLeft)
                : null}
          </p>
        )}
        {error && (
          <p id="login-error" className="login-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={`btn-login${loading ? ' is-loading' : ''}`}
          disabled={!canSubmit || loading}
          aria-busy={loading}
          aria-disabled={!canSubmit || loading}
        >
          {loading ? (
            <span className="btn-login-spinner" aria-hidden="true" />
          ) : (
            t('common.signIn')
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginForm(props) {
  return (
    <Suspense>
      <LoginFormInner {...props} />
    </Suspense>
  );
}
