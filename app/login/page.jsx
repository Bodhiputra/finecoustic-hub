'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = password.trim().length > 0 && !loading;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!res.ok) {
        setError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      // Full navigation so the auth cookie is sent on the next request (client router.push can bounce back to /login)
      const from = searchParams.get('from') || '/';
      window.location.assign(from);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Welcome to Finecoustic Hub</h1>
        <label htmlFor="password">Password</label>
        <div className="login-password-field">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c5.52 0 10 4.48 10 7s-1.19 2.87-3.14 4.36M6.11 6.11C3.6 7.64 2 9.9 2 12c0 2.52 4.48 7 10 7 1.13 0 2.2-.18 3.18-.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M2 12s4.48-7 10-7 10 7 10 7-4.48 7-10 7S2 12 2 12Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            )}
          </button>
        </div>
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
            'Sign in'
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
