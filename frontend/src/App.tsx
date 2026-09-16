import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import RoutesPage from './pages/RoutesPage';
import DriverPage from './pages/DriverPage';

type Page = 'dashboard' | 'orders' | 'routes' | 'drivers';

function AppShell() {
  const { isLoggedIn, user, logout } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (!isLoggedIn) return <LoginPage />;

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'orders',    label: 'Orders',    icon: '📦' },
    { id: 'routes',    label: 'Routes',    icon: '🗺️' },
    { id: 'drivers',   label: 'Drivers',   icon: '🚚' },
  ] as const;

  const initials = user?.email.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>SmartRoute</h1>
          <span>Route Optimization</span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(n => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                {user?.role}
              </div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Sign out">↩</button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
        {page === 'orders'    && <OrdersPage />}
        {page === 'routes'    && <RoutesPage />}
        {page === 'drivers'   && <DriverPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
