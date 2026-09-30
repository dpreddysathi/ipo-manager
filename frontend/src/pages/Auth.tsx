import { useState, type CSSProperties, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Turns "API 401 Unauthorized — Invalid email or password" into the part
 *  the user actually needs to read. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^API \d+ [A-Za-z ]+ — /, '');
}

type Mode = 'login' | 'register';

/**
 * One auth page for both modes. The card stays mounted while switching, so
 * the form slides between "Log in" and "Create account" instead of the whole
 * page remounting (which replayed a broken pop animation on every switch).
 */
export function AuthPage({ mode }: { mode: Mode }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Slide direction for the form swap: register slides in from the right.
  const [dir, setDir] = useState<1 | -1>(1);

  if (user) return <Navigate to="/" replace />;

  function switchMode(next: Mode) {
    if (next === mode || busy) return;
    setDir(next === 'register' ? 1 : -1);
    setError('');
    setShowPw(false);
    navigate(next === 'register' ? '/register' : '/login');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await register({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo">📈</span> IPO Manager
        </div>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-sub">
          {isLogin
            ? 'Log in to see your IPOs, people and money.'
            : 'Your IPOs, people and money stay visible only to you.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Log in or create account">
          <span className="auth-tabs-pill" data-mode={mode} aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={isLogin ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={!isLogin ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <form
          key={mode}
          className="auth-form"
          style={{ '--auth-dir': dir } as CSSProperties}
          onSubmit={submit}
        >
          {error && (
            <div className="form-error" key={error}>
              {error}
            </div>
          )}
          {!isLogin && (
            <div className="field">
              <label htmlFor="auth-name">Your name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="pw-wrap">
              <input
                id="auth-password"
                type={showPw ? 'text' : 'password'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={isLogin ? undefined : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {!isLogin && <div className="hint">At least 6 characters.</div>}
          </div>
          <button className="btn btn-primary auth-submit" disabled={busy}>
            {busy && <span className="btn-spinner" aria-hidden="true" />}
            {busy
              ? isLogin
                ? 'Logging in…'
                : 'Creating account…'
              : isLogin
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-note">
          {isLogin
            ? 'First time here? Switch to Create account above — your existing data is claimed by the first account that registers.'
            : 'Already registered? Switch to Log in above.'}
        </p>
      </div>
    </div>
  );
}
