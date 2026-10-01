import { useState, type FormEvent } from 'react';
import logo from '../assets/fengle-logo.png';
import { useAuth } from '../auth';
import { Field, errMsg } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { await login(email.trim(), password); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src={logo} alt="Fengle" />
        <div>
          <h1>Fengle Admin</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Sign in to manage orders, partners and the catalog.</p>
        </div>
        <Field label="Email">
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy} style={{ padding: '11px 14px' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
