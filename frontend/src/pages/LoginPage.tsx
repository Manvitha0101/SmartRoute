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
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<'DISPATCHER' | 'DRIVER' | 'ADMIN'>('DISPATCHER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register({
        email: email.trim(),
        password,
        role,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      login(data.accessToken, data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please check details or server connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo-badge">🚀</div>
          <h1>SmartRoute</h1>
          <p>{isSignUp ? 'Create your account & select role' : 'Delivery Route Optimization & Fleet Dispatch'}</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {!isSignUp ? (
          <>
            {/* ── One-click Demo Profiles ── */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Demo Profiles — Click to enter instantly
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
                    <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: '0.92rem' }}>
                      {demoLoading === p.label ? 'Signing in…' : `Login as ${p.label}`}
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
            <form onSubmit={handleLoginSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email or Phone Number</label>
                <input
                  id="email"
                  type="text"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. dispatcher@smartroute.io or 9848012345"
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

            <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-3)' }}>Don't have an account? </span>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Create Account (Sign Up) →
              </button>
            </div>
          </>
        ) : (
          /* ── Registration Form ── */
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Select Your Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'DISPATCHER' as const, label: 'Dispatcher', icon: '🚚', color: '#0ea5e9' },
                  { id: 'DRIVER' as const,     label: 'Driver',     icon: '🛣️', color: '#059669' },
                  { id: 'ADMIN' as const,      label: 'Admin',      icon: '⚡', color: '#8b5cf6' },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '10px 8px', borderRadius: 8,
                      border: `2px solid ${role === r.id ? r.color : 'var(--border)'}`,
                      background: role === r.id ? r.color + '18' : 'var(--surface-2)',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{r.icon}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: role === r.id ? r.color : 'var(--text-1)' }}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Manvith Reddy"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {role === 'DRIVER' && (
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" htmlFor="reg-phone">Phone Number (Login ID)</label>
                <input
                  id="reg-phone"
                  type="text"
                  className="form-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 9848012345"
                  required
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="reg-password">Create Password</label>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: '#0284c7' }}>
              {loading ? <><span className="spinner" /> Creating account…</> : `🚀 Register as ${role}`}
            </button>

            <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-3)' }}>Already have an account? </span>
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
