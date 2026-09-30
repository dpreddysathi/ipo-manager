import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Turns "API 401 Unauthorized — Invalid email or password" into the part
 *  the user actually needs to read. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^API \d+ [A-Za-z ]+ — /, '');
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="logo">📈</span> IPO Manager
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to see your IPOs, people and money.</p>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
