import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { ApiError } from '../api/client';

const DEMO_PROFILES = [
  {
    label: 'Dispatcher',
    email: 'dispatcher@smartroute.io',
    password: 'Password@123',
    icon: '🚚',
    desc: 'Manage orders, assign drivers & optimize routes',
    color: '#0ea5e9',
  },
  {
    label: 'Admin',
    email: 'admin@smartroute.io',
    password: 'Password@123',
    icon: '⚡',
    desc: 'Executive overview — KPIs, fleet analytics, warehouses',
    color: '#8b5cf6',
  },
  {
    label: 'Driver',
    email: 'driver@smartroute.io',
    password: 'Password@123',
    icon: '🛣️',
    desc: 'Suresh Reddy — view assigned stops and start trips',
    color: '#059669',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const doLogin = async (em: string, pw: string, tag?: string) => {
    setError('');
    if (tag) setDemoLoading(tag); else setLoading(true);
    try {
      const data = await api.login(em, pw);
      login(data.accessToken, data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Invalid email or password.'
            : `Server error: ${err.message}`
        );
      } else {
        setError('Cannot reach the backend server. Make sure it is running.');
      }
    } finally {
      setLoading(false);
      setDemoLoading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo-badge">🚀</div>
          <h1>SmartRoute</h1>
          <p>Intelligent Delivery Route Optimization &amp; Fleet Dispatch</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* ── One-click Demo Profiles ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Demo — Click to enter instantly
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_PROFILES.map(p => (
              <button
                key={p.email}
                type="button"
                disabled={!!demoLoading || loading}
                onClick={() => doLogin(p.email, p.password, p.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  background: demoLoading === p.label ? p.color : '#fff',
                  color: demoLoading === p.label ? '#fff' : 'var(--text-1)',
                  border: `2px solid ${p.color}`,
                  borderRadius: 10,
                  cursor: demoLoading || loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  opacity: demoLoading && demoLoading !== p.label ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!demoLoading && !loading) (e.currentTarget as HTMLButtonElement).style.background = p.color + '15'; }}
                onMouseLeave={e => { if (!demoLoading && !loading && demoLoading !== p.label) (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
              >
                <span style={{ fontSize: '1.6rem' }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {demoLoading === p.label ? 'Signing in…' : `Login as ${p.label}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: demoLoading === p.label ? 'rgba(255,255,255,0.8)' : 'var(--text-3)', marginTop: 2 }}>
                    {p.desc}
                  </div>
                </div>
                {demoLoading === p.label
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#fff' }} />
                  : <span style={{ fontSize: '1.1rem', color: p.color }}>→</span>
                }
              </button>
            ))}
          </div>
        </div>

        <div className="login-divider">
          <span>or sign in manually</span>
        </div>

        {/* ── Manual Email / Password form ── */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !!demoLoading} style={{ marginTop: 8 }}>
            {loading ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 16, textAlign: 'center' }}>
          Demo password for all accounts: <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>Password@123</code>
        </p>
      </div>
    </div>
  );
}
